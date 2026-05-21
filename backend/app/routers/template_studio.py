import base64
import json
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.template_studio_codegen import coerce_prop_default
from app.services.template_studio_llm import template_studio_chat

router = APIRouter(prefix="/api/template-studio", tags=["template-studio"])


# ─── Studio access password (server-side, rate-limited) ─────────────────────

_STUDIO_PW_MAX_ATTEMPTS = 5
_STUDIO_PW_LOCKOUT_SECONDS = 10 * 60
_STUDIO_PW_ATTEMPTS: dict[str, dict[str, float]] = {}
_STUDIO_PW_LOCK = Lock()


class StudioPasswordRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200)


@router.get("/auth/status")
def template_studio_auth_status() -> dict[str, bool]:
    """Return whether a server-side studio password is configured (no secret leakage)."""
    configured = (settings.TEMPLATE_STUDIO_PASSWORD or "").strip()
    return {"gated": bool(configured)}


def _studio_pw_client_key(request: Request) -> str:
    """Best-effort client identifier for rate-limiting. Prefers X-Forwarded-For
    when behind a proxy, otherwise the direct peer address."""
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else "unknown"


@router.post("/auth/verify")
def verify_studio_password(payload: StudioPasswordRequest, request: Request):
    """Verify the template-studio gate password. Public (no user auth) since
    this is the entry gate. Uses constant-time compare + per-IP lockout to
    blunt brute force."""
    import secrets

    configured = (settings.TEMPLATE_STUDIO_PASSWORD or "").strip()
    if not configured:
        # No password configured → gate disabled. Anything passes.
        return {"ok": True, "gated": False}

    key = _studio_pw_client_key(request)
    now = time.time()
    with _STUDIO_PW_LOCK:
        entry = _STUDIO_PW_ATTEMPTS.get(key) or {"count": 0, "locked_until": 0.0}
        if entry["locked_until"] > now:
            retry_in = int(entry["locked_until"] - now)
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Retry in {retry_in}s.",
                headers={"Retry-After": str(retry_in)},
            )

    if secrets.compare_digest(payload.password, configured):
        with _STUDIO_PW_LOCK:
            _STUDIO_PW_ATTEMPTS.pop(key, None)
        return {"ok": True, "gated": True}

    with _STUDIO_PW_LOCK:
        entry = _STUDIO_PW_ATTEMPTS.get(key) or {"count": 0, "locked_until": 0.0}
        entry["count"] = int(entry["count"]) + 1
        remaining = _STUDIO_PW_MAX_ATTEMPTS - entry["count"]
        if entry["count"] >= _STUDIO_PW_MAX_ATTEMPTS:
            entry["locked_until"] = now + _STUDIO_PW_LOCKOUT_SECONDS
            entry["count"] = 0
            _STUDIO_PW_ATTEMPTS[key] = entry
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Locked for {_STUDIO_PW_LOCKOUT_SECONDS // 60} minutes.",
                headers={"Retry-After": str(_STUDIO_PW_LOCKOUT_SECONDS)},
            )
        _STUDIO_PW_ATTEMPTS[key] = entry

    raise HTTPException(
        status_code=401,
        detail=f"Incorrect password. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
    )


class AspectValue(BaseModel):
    # Template metadata currently allows values as low as 10 and as high as 320.
    # Keep save-source validation aligned so valid editor values don't get rejected.
    portrait: int = Field(ge=1, le=400)
    landscape: int = Field(ge=1, le=400)


class SaveSourceRequest(BaseModel):
    template_id: str
    layout_id: str
    title_font_size: AspectValue | None = None
    description_font_size: AspectValue | None = None


class AiEditProposeRequest(BaseModel):
    template_id: str
    layout_id: str
    instruction: str = Field(min_length=5, max_length=6000)
    image_base64: str | None = None
    image_mime_type: str | None = None


class AiEditApplyRequest(BaseModel):
    template_id: str
    layout_id: str
    proposed_code: str = Field(min_length=20, max_length=300000)


class AiEditSessionActionRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)


class AiEditPreviewSwitchRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)
    version: str = Field(min_length=1, max_length=64)


class AiEditVersionsRequest(BaseModel):
    template_id: str
    layout_id: str


# ─── Prop definition shared by rebuild and create ─────────────────────────────

SUPPORTED_PROP_TYPES = {
    "string", "number", "boolean", "color", "imageUrl",
    "string_array", "object_array", "text",
}


class PropDef(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z][a-zA-Z0-9_]*$")
    type: str
    description: str = Field(default="", max_length=400)
    default: str | None = None

    @field_validator("default", mode="before")
    @classmethod
    def _normalize_default(cls, v: object) -> str | None:
        return coerce_prop_default(v)


class AiLayoutRebuildRequest(BaseModel):
    template_id: str
    layout_id: str
    instruction: str = Field(min_length=5, max_length=6000)
    extra_props: list[PropDef] = Field(default_factory=list, max_length=20)
    image_base64: str | None = None
    image_mime_type: str | None = None


class AiLayoutCreateRequest(BaseModel):
    template_id: str
    base_layout_id: str
    new_layout_id: str = Field(min_length=2, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    layout_description: str = Field(min_length=10, max_length=2000)
    props: list[PropDef] = Field(default_factory=list, max_length=30)
    image_base64: str | None = None
    image_mime_type: str | None = None


class RenderLayoutRequest(BaseModel):
    template_id: str
    layout_id: str
    aspect_ratio: str | None = "landscape"
    duration_seconds: float | None = None
    layout_props: dict | None = None
    resolution: str | None = None


class PlanTemplateRequest(BaseModel):
    """Phase 1: normalize the raw design doc and extract the plan only."""
    template_id: str = Field(min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    design_doc: str = Field(min_length=50, max_length=40000)
    overwrite: bool = False


class CreateTemplateRequest(BaseModel):
    """Phase 2: build the template. Either supply a pre-extracted `plan`
    (from POST /template/plan — what the user saw is what gets built) or a raw
    `design_doc` (legacy path — normalized + extracted inline)."""
    template_id: str = Field(min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    design_doc: str | None = Field(default=None, max_length=40000)
    normalized_doc: str | None = Field(default=None, max_length=40000)
    plan: dict | None = None
    keep_layout_ids: list[str] | None = Field(
        default=None,
        max_length=24,
        description="With plan only: layout ids to generate after Studio review.",
    )
    overwrite: bool = False

    @model_validator(mode="after")
    def _need_plan_or_doc(self) -> "CreateTemplateRequest":
        has_doc = bool(self.design_doc and self.design_doc.strip())
        if not self.plan and not has_doc:
            raise ValueError("Either 'plan' or 'design_doc' is required.")
        if not self.plan and has_doc and len(self.design_doc.strip()) < 50:
            raise ValueError("design_doc must be at least 50 characters.")
        return self

    @model_validator(mode="after")
    def _keep_layouts_need_plan(self) -> "CreateTemplateRequest":
        if self.keep_layout_ids is not None and self.plan is None:
            raise ValueError("keep_layout_ids may only be sent together with plan.")
        return self


_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_FRONTEND_REMOTION_DIR = _ROOT / "frontend" / "src" / "components" / "remotion"
_REMOTION_VIDEO_DIR = _ROOT / "remotion-video" / "src" / "templates"
_TEMPLATES_META_DIR = _ROOT / "backend" / "templates"
_AI_TMP_DIR = _ROOT / "backend" / "tmp" / "template_studio_ai_edits"
_AI_PREVIEW_SESSIONS: dict[str, dict] = {}
_AI_SESSION_LOCK = Lock()


def _replace_responsive_expr(source: str, key: str, portrait: int, landscape: int) -> tuple[str, int]:
    # Match both plain numbers and numbers with * scale: (p ? 90 : 86) or (p ? 90 * scale : 86 * scale)
    pattern_scaled = re.compile(
        rf"{key}\s*\?\?\s*\(p\s*\?\s*\d+\s*\*\s*scale\s*:\s*\d+\s*\*\s*scale\)"
    )
    replaced, count = pattern_scaled.subn(
        f"{key} ?? (p ? {portrait} * scale : {landscape} * scale)", source
    )
    if count:
        return replaced, count
    pattern = re.compile(rf"{key}\s*\?\?\s*\(p\s*\?\s*\d+\s*:\s*\d+\)")
    replaced, count = pattern.subn(f"{key} ?? (p ? {portrait} : {landscape})", source)
    return replaced, count


def _replace_static_expr(source: str, key: str, portrait: int, landscape: int) -> tuple[str, int]:
    pattern = re.compile(rf"{key}\s*\?\?\s*\d+")
    replaced, count = pattern.subn(f"{key} ?? (p ? {portrait} : {landscape})", source)
    return replaced, count


def _replace_nested_has_image_expr(source: str, key: str, portrait: int, landscape: int) -> tuple[str, int]:
    """
    Replace nested fallbacks like:
      key ?? (p ? (hasImage ? 40 : 36) : 46)
      key ?? (p ? (hasImage ? 22 : 25) : (hasImage ? 26 : 25))
    with:
      key ?? (p ? portrait : landscape)
    """
    # portrait: (hasImage ? A : B), landscape: (hasImage ? C : D)
    pattern_both = re.compile(
        rf"{key}\s*\?\?\s*\(\s*p\s*\?\s*"
        rf"\(\s*hasImage\s*\?\s*\d+\s*:\s*\d+\s*\)\s*:\s*"
        rf"\(\s*hasImage\s*\?\s*\d+\s*:\s*\d+\s*\)\s*\)",
    )
    replaced, count = pattern_both.subn(f"{key} ?? (p ? {portrait} : {landscape})", source)

    # portrait: (hasImage ? A : B), landscape: N
    pattern_land_num = re.compile(
        rf"{key}\s*\?\?\s*\(\s*p\s*\?\s*"
        rf"\(\s*hasImage\s*\?\s*\d+\s*:\s*\d+\s*\)\s*:\s*"
        rf"\d+\s*\)",
    )
    replaced, count2 = pattern_land_num.subn(f"{key} ?? (p ? {portrait} : {landscape})", replaced)
    return replaced, count + count2


def _replace_stick_figure_title(source: str, portrait: int, landscape: int) -> tuple[str, int]:
    pattern = re.compile(r"titleFontSize\s*\?\?\s*\d+")
    replacements = 0

    def _repl(_match):
        nonlocal replacements
        replacements += 1
        if replacements == 1:
            return f"titleFontSize ?? {portrait}"
        return f"titleFontSize ?? {landscape}"

    replaced = pattern.sub(_repl, source, count=2)
    return replaced, replacements


def _replace_handwritten_description(source: str, portrait: int, landscape: int) -> tuple[str, int]:
    # Match frontend: const finalDescSize = descPropSize ?? (p ? 22 : 28);
    pattern_plain = re.compile(r"const\s+finalDescSize\s*=\s*\w+\s*\?\?\s*\(\s*p\s*\?\s*\d+\s*:\s*\d+\s*\);")
    replaced, count = pattern_plain.subn(f"const finalDescSize = descPropSize ?? (p ? {portrait} : {landscape});", source)
    if count:
        return replaced, count
    # Match remotion-video: const finalDescSize = descPropSize ?? (p ? 22 : 28) * scale;
    pattern_scaled = re.compile(r"const\s+finalDescSize\s*=\s*\w+\s*\?\?\s*\(\s*p\s*\?\s*\d+\s*:\s*\d+\s*\)\s*\*\s*scale;")
    replaced, count = pattern_scaled.subn(f"const finalDescSize = descPropSize ?? (p ? {portrait} : {landscape}) * scale;", source)
    return replaced, count


def _snake_to_pascal(value: str) -> str:
    parts = re.split(r"[_-]+", value.strip())
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


def _parse_layout_to_file_map(index_path: Path) -> dict[str, str]:
    if not index_path.exists():
        return {}
    content = index_path.read_text(encoding="utf-8")

    import_map: dict[str, str] = {}
    import_re = re.compile(r'import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+"([^"]+)";')
    for symbol, import_path in import_re.findall(content):
        file_base = Path(import_path).name
        if file_base:
            import_map[symbol] = f"{file_base}.tsx"

    layout_map: dict[str, str] = {}
    registry_re = re.compile(r"^\s*([a-z0-9_-]+)\s*:\s*([A-Za-z0-9_]+)\s*,\s*$", re.MULTILINE)
    for layout_id, symbol in registry_re.findall(content):
        file_name = import_map.get(symbol)
        if file_name:
            layout_map[layout_id] = file_name

    return layout_map


def _resolve_target_files(template_id: str, layout_id: str) -> tuple[Path, Path]:
    frontend_template_dir = _FRONTEND_REMOTION_DIR / template_id
    remotion_template_dir = _REMOTION_VIDEO_DIR / template_id
    frontend_layout_dir = frontend_template_dir / "layouts"
    remotion_layout_dir = remotion_template_dir / "layouts"

    frontend_index = frontend_layout_dir / "index.ts"
    remotion_index = remotion_layout_dir / "index.ts"

    frontend_map = _parse_layout_to_file_map(frontend_index)
    remotion_map = _parse_layout_to_file_map(remotion_index)

    frontend_file_name = frontend_map.get(layout_id)
    remotion_file_name = remotion_map.get(layout_id)

    if not frontend_file_name:
        frontend_file_name = f"{_snake_to_pascal(layout_id)}.tsx"
    if not remotion_file_name:
        remotion_file_name = frontend_file_name

    return (frontend_layout_dir / frontend_file_name, remotion_layout_dir / remotion_file_name)


def _update_meta_defaults(
    template_id: str,
    layout_id: str,
    title_font_size: AspectValue | None,
    description_font_size: AspectValue | None,
) -> Path | None:
    meta_path = _TEMPLATES_META_DIR / template_id / "meta.json"
    if not meta_path.exists():
        return None

    import json

    data = json.loads(meta_path.read_text(encoding="utf-8"))
    schema = data.get("layout_prop_schema")
    if not isinstance(schema, dict):
        return None
    layout_schema = schema.get(layout_id)
    if not isinstance(layout_schema, dict):
        return None

    defaults = layout_schema.get("defaults")
    if not isinstance(defaults, dict):
        defaults = {}
        layout_schema["defaults"] = defaults

    updated = False
    if title_font_size:
        defaults["titleFontSize"] = {
            "portrait": title_font_size.portrait,
            "landscape": title_font_size.landscape,
        }
        updated = True
    if description_font_size:
        defaults["descriptionFontSize"] = {
            "portrait": description_font_size.portrait,
            "landscape": description_font_size.landscape,
        }
        updated = True

    if not updated:
        return None

    meta_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return meta_path


def _apply_font_updates_to_content(
    source: str,
    layout_id: str,
    title_font_size: AspectValue | None,
    description_font_size: AspectValue | None,
) -> tuple[str, int]:
    content = source
    changes = 0

    if title_font_size:
        updated, count = _replace_responsive_expr(
            content,
            "titleFontSize",
            title_font_size.portrait,
            title_font_size.landscape,
        )
        if count == 0:
            updated, count = _replace_nested_has_image_expr(
                content,
                "titleFontSize",
                title_font_size.portrait,
                title_font_size.landscape,
            )
        if count == 0:
            updated, count = _replace_static_expr(
                content,
                "titleFontSize",
                title_font_size.portrait,
                title_font_size.landscape,
            )
        if count == 0 and layout_id == "stick_figure_scene":
            updated, count = _replace_stick_figure_title(
                content,
                title_font_size.portrait,
                title_font_size.landscape,
            )
        content = updated
        changes += count

    if description_font_size:
        updated, count = _replace_responsive_expr(
            content,
            "descriptionFontSize",
            description_font_size.portrait,
            description_font_size.landscape,
        )
        if count == 0:
            updated, count = _replace_nested_has_image_expr(
                content,
                "descriptionFontSize",
                description_font_size.portrait,
                description_font_size.landscape,
            )
        if count == 0:
            updated, count = _replace_static_expr(
                content,
                "descriptionFontSize",
                description_font_size.portrait,
                description_font_size.landscape,
            )
        if count == 0 and layout_id == "handwritten_equation":
            updated, count = _replace_handwritten_description(
                content,
                description_font_size.portrait,
                description_font_size.landscape,
            )
        content = updated
        changes += count

    return content, changes


def _extract_code_from_model_output(text: str) -> str:
    content = (text or "").strip()
    if not content:
        return ""
    fenced = re.search(r"```(?:tsx|ts|javascript|typescript)?\s*([\s\S]*?)```", content, re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()
    return content


_CODE_EDIT_SYSTEM_PROMPT = (
    "You are editing a React TSX component file used in a video template system.\n"
    "Return ONLY the full updated file contents for this single component.\n"
    "Do not include markdown fences, explanations, or extra text."
)


def _build_code_edit_user_text(
    *,
    instruction: str,
    current_code: str,
    template_id: str,
    layout_id: str,
    has_image: bool,
) -> str:
    image_note = ""
    if has_image:
        image_note = (
            "\n\nThe user attached a reference image above.\n"
            "- Use it as the primary source of truth for spatial layout, hierarchy, and visual motifs.\n"
            "- Silently inspect the image first; do NOT output analysis text.\n"
            "- Then implement the TSX to match the image as closely as possible.\n"
        )
    return (
        f"Template ID: {template_id}\n"
        f"Layout ID: {layout_id}\n\n"
        "User instruction:\n"
        f"{instruction}{image_note}\n\n"
        "Current file content:\n"
        f"{current_code}"
    )


def _call_anthropic_code_edit(
    instruction: str,
    current_code: str,
    template_id: str,
    layout_id: str,
) -> str:
    """Generate / edit a layout TSX via Anthropic (Claude Sonnet). Text-only — used by template creation."""
    user_text = _build_code_edit_user_text(
        instruction=instruction,
        current_code=current_code,
        template_id=template_id,
        layout_id=layout_id,
        has_image=False,
    )
    text = template_studio_chat(
        system=_CODE_EDIT_SYSTEM_PROMPT,
        user=user_text,
        max_tokens=16000,
        temperature=0.2,
        log_label=f"layout_tsx/{template_id}/{layout_id}",
    )
    code = _extract_code_from_model_output(text)
    if not code:
        raise HTTPException(status_code=502, detail="Model returned empty code output.")
    if "export" not in code:
        raise HTTPException(status_code=502, detail="Model output does not look like a component file.")
    _validate_tsx_or_raise(code, template_id, layout_id)
    return code


def _call_gemini_code_edit(
    instruction: str,
    current_code: str,
    template_id: str,
    layout_id: str,
    *,
    image_base64: str | None = None,
    image_mime_type: str | None = None,
) -> str:
    """Generate / edit a layout TSX via Gemini (vision-capable). Used by the
    image-driven scene edit / layout rebuild / layout create flows."""
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured.")
    try:
        from google import genai
        from google.genai import types
    except Exception as e:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail=f"Gemini code edit requires google-genai package: {e}",
        )

    default_model = (getattr(settings, "GEMINI_CODE_MODEL", "") or "gemini-3.5-flash").strip()
    image_model = (getattr(settings, "GEMINI_CODE_MODEL_WITH_IMAGE", "") or "").strip()
    model_name = image_model if (image_base64 and image_mime_type and image_model) else default_model
    client = genai.Client(api_key=api_key)

    image_note = ""
    if image_base64 and image_mime_type:
        image_note = (
            "\n\nThe user attached a reference image above.\n"
            "- Use it as the primary source of truth for spatial layout, hierarchy, and visual motifs.\n"
            "- Silently inspect the image first; do NOT output analysis text.\n"
            "- Then implement the TSX to match the image as closely as possible.\n"
        )
    prompt = (
        "You are editing a React TSX component file used in a video template system.\n"
        "Return ONLY the full updated file contents for this single component.\n"
        "Do not include markdown fences, explanations, or extra text.\n\n"
        f"Template ID: {template_id}\n"
        f"Layout ID: {layout_id}\n\n"
        "User instruction:\n"
        f"{instruction}{image_note}\n\n"
        "Current file content:\n"
        f"{current_code}"
    )

    prompt_part = types.Part.from_text(text=prompt)
    if image_base64 and image_mime_type:
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image_base64.")
        mime = (image_mime_type or "image/jpeg").strip().lower()
        if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
            mime = "image/jpeg"
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime)
        contents = [types.Content(role="user", parts=[image_part, prompt_part])]
    else:
        contents = [types.Content(role="user", parts=[prompt_part])]

    response = client.models.generate_content(
        model=model_name,
        contents=contents,
    )
    text = getattr(response, "text", "") or ""
    code = _extract_code_from_model_output(text)
    if not code:
        raise HTTPException(status_code=502, detail="Gemini returned empty code output.")
    if "export" not in code:
        raise HTTPException(status_code=502, detail="Gemini output does not look like a component file.")
    _validate_tsx_or_raise(code, template_id, layout_id)
    return code


def _call_code_edit(
    instruction: str,
    current_code: str,
    template_id: str,
    layout_id: str,
    *,
    image_base64: str | None = None,
    image_mime_type: str | None = None,
    backend: str = "gemini",
) -> str:
    """Dispatch a layout-TSX generation/edit call.

    backend="gemini"     — Gemini (vision-capable). Default — used by **scene
                           edit** and **layout rebuild** (image optional).
    backend="anthropic"  — Claude Sonnet via Anthropic (text-only). Used by
                           **new template** (`template/create`) and **new layout**
                           (`ai-layout/create`); image inputs are ignored.
    """
    if backend == "anthropic":
        return _call_anthropic_code_edit(instruction, current_code, template_id, layout_id)
    return _call_gemini_code_edit(
        instruction,
        current_code,
        template_id,
        layout_id,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
    )


def _validate_tsx_or_raise(code: str, template_id: str, layout_id: str) -> None:
    """
    Run a lightweight TypeScript/TSX syntax check on generated code.
    If tsc is not available, validation is skipped.
    """
    tmp_dir = _AI_TMP_DIR / "validate"
    try:
        tmp_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        return

    safe_template = (template_id or "").strip().lower().replace("/", "_")
    safe_layout = (layout_id or "").strip().lower().replace("/", "_")
    tmp_path = tmp_dir / f"{safe_template}__{safe_layout}__preview.tsx"
    try:
        try:
            tmp_path.write_text(code, encoding="utf-8")
        except Exception:
            return

        # Use --noResolve so we only validate syntax/TSX shape and local types,
        # and do not fail just because imports can't be resolved from this temp path.
        cmd = ["npx", "tsc", "--noEmit", "--jsx", "react-jsx", "--noResolve", str(tmp_path)]
        try:
            result = subprocess.run(
                cmd,
                cwd=_ROOT,
                capture_output=True,
                text=True,
                timeout=40,
            )
        except Exception:
            # If tsc or node is not available, don't block the flow.
            return

        if result.returncode != 0:
            # Don't persist or activate this version if TypeScript reports errors.
            msg = (result.stderr or result.stdout or "").strip()
            # Truncate very long outputs.
            if len(msg) > 4000:
                msg = msg[:4000] + "\n... (truncated)"
            raise HTTPException(
                status_code=502,
                detail=f"Generated TSX failed type-checking; TypeScript reported errors:\n{msg}",
            )
    finally:
        # Best-effort cleanup of the temporary validation file and directory.
        try:
            if tmp_path.exists():
                tmp_path.unlink()
            # Remove validate dir if empty.
            if tmp_dir.exists() and not any(tmp_dir.iterdir()):
                tmp_dir.rmdir()
        except Exception:
            # Non-fatal; leave artifacts if filesystem permissions block cleanup.
            pass


def _get_session(session_id: str) -> dict | None:
    with _AI_SESSION_LOCK:
        return _AI_PREVIEW_SESSIONS.get(session_id)


def _save_session(session: dict) -> None:
    session_id = session.get("session_id")
    if not session_id:
        return
    with _AI_SESSION_LOCK:
        _AI_PREVIEW_SESSIONS[session_id] = session


def _get_user_layout_session(user: User, template_id: str, layout_id: str) -> dict | None:
    """Return the existing preview session for this user+template+layout, if any."""
    with _AI_SESSION_LOCK:
        for session in _AI_PREVIEW_SESSIONS.values():
            if (
                session.get("user_id") == user.id
                and session.get("template_id") == template_id
                and session.get("layout_id") == layout_id
            ):
                return session
    return None


def _version_dir_for(user: User, template_id: str, layout_id: str) -> Path:
    """Directory to store all versions for a user/template/layout."""
    safe_template = (template_id or "").strip().lower()
    safe_layout = (layout_id or "").strip().lower()
    return _AI_TMP_DIR / str(user.id) / safe_template / safe_layout


def _next_version_id(session: dict) -> str:
    versions = session.get("versions") or []
    max_n = 0
    for v in versions:
        if isinstance(v, str) and v.startswith("v"):
            try:
                n = int(v[1:])
            except ValueError:
                continue
            if n > max_n:
                max_n = n
    return f"v{max_n + 1}" if max_n else "v1"


def _get_version_file(session: dict, version_id: str) -> Path:
    version_dir = Path(session["version_dir"])
    if not version_dir.exists():
        raise HTTPException(status_code=400, detail="Preview version directory no longer exists.")
    path = version_dir / f"{version_id}.tsx"
    if not path.exists():
        raise HTTPException(status_code=400, detail=f"Version {version_id} not found.")
    return path


def _sync_versions_meta(session: dict) -> None:
    """Persist versions and active_version_id to meta.json for this layout."""
    version_dir = Path(session["version_dir"])
    version_dir.mkdir(parents=True, exist_ok=True)
    meta = {
        "versions": session.get("versions") or [],
        "active_version_id": session.get("active_version_id"),
    }
    for key in ("session_type", "meta_path", "prompt_path", "created_files",
                "index_frontend_path", "index_remotion_path", "types_frontend_path", "types_remotion_path", "config_path"):
        if session.get(key) is not None:
            meta[key] = session[key]
    import json

    (version_dir / "meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _load_versions_meta(version_dir: Path) -> tuple[list[str], str | None]:
    """Load versions + active_version_id from meta.json or infer from files."""
    if not version_dir.exists():
        return [], None
    meta_path = version_dir / "meta.json"
    versions: list[str] = []
    active: str | None = None
    if meta_path.exists():
        import json

        try:
            data = json.loads(meta_path.read_text(encoding="utf-8"))
            v = data.get("versions")
            if isinstance(v, list):
                versions = [str(x) for x in v]
            av = data.get("active_version_id")
            if isinstance(av, str):
                active = av
        except Exception:
            # Fallback to inferring from files below
            pass
    if not versions:
        # Infer from *.tsx files
        files = sorted(p for p in version_dir.glob("*.tsx") if p.is_file())
        for p in files:
            name = p.stem
            if name not in versions:
                versions.append(name)
    if not active and versions:
        # Prefer last non-original version as active, else "original"
        non_original = [v for v in versions if v != "original"]
        active = non_original[-1] if non_original else versions[0]
    return versions, active


def _cleanup_version_folder(version_dir: Path) -> None:
    """Remove version folder and its contents."""
    if version_dir.exists():
        shutil.rmtree(version_dir, ignore_errors=True)


def _cleanup_session(session: dict, restore_original: bool) -> None:
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
    version_dir = session.get("version_dir")
    if restore_original:
        if version_dir:
            vd = Path(version_dir)
            original_file = vd / "original.tsx"
            if original_file.exists():
                content = original_file.read_text(encoding="utf-8")
                frontend_path.write_text(content, encoding="utf-8")
                remotion_path.write_text(content, encoding="utf-8")
            # Restore meta and prompt for rebuild/create sessions
            meta_orig = vd / "meta_original.json"
            prompt_orig = vd / "prompt_original.md"
            meta_path_str = session.get("meta_path")
            prompt_path_str = session.get("prompt_path")
            if meta_path_str and meta_orig.exists():
                Path(meta_path_str).write_text(meta_orig.read_text(encoding="utf-8"), encoding="utf-8")
            if prompt_path_str and prompt_orig.exists():
                Path(prompt_path_str).write_text(prompt_orig.read_text(encoding="utf-8"), encoding="utf-8")
            # Restore layout_prompt.md if we saved it (create/rebuild)
            layout_prompt_orig = vd / "layout_prompt_original.md"
            if layout_prompt_orig.exists():
                template_id = session.get("template_id")
                if template_id:
                    layout_prompt_path = _TEMPLATES_META_DIR / template_id / "layout_prompt.md"
                    layout_prompt_path.write_text(layout_prompt_orig.read_text(encoding="utf-8"), encoding="utf-8")
            # Restore registry files for create sessions
            for key in ("index_frontend_path", "index_remotion_path", "types_frontend_path", "types_remotion_path", "config_path"):
                orig_path = vd / f"{key}_original"
                if orig_path.exists() and session.get(key):
                    Path(session[key]).write_text(orig_path.read_text(encoding="utf-8"), encoding="utf-8")
            # Delete created files for create sessions (paths are absolute)
            for path_str in session.get("created_files") or []:
                p = Path(path_str)
                if p.exists():
                    p.unlink(missing_ok=True)
        else:
            frontend_path.write_text(session["frontend_original"], encoding="utf-8")
            remotion_path.write_text(session["remotion_original"], encoding="utf-8")
    if version_dir:
        _cleanup_version_folder(Path(version_dir))


def _drop_session(session: dict, restore_original: bool = True) -> None:
    """Remove a single session, restoring originals if requested."""
    session_id = session.get("session_id")
    if session_id:
        with _AI_SESSION_LOCK:
            _AI_PREVIEW_SESSIONS.pop(session_id, None)
    _cleanup_session(session, restore_original=restore_original)


def _create_preview_session(
    user: User,
    template_id: str,
    layout_id: str,
    frontend_target: Path,
    remotion_target: Path,
    proposed_code: str,
) -> dict:
    session_id = f"ai-{uuid.uuid4().hex}"
    version_dir = _version_dir_for(user, template_id, layout_id)
    version_dir.mkdir(parents=True, exist_ok=True)

    original_content = frontend_target.read_text(encoding="utf-8")
    proposed_content = proposed_code.rstrip() + "\n"

    original_path = version_dir / "original.tsx"
    if not original_path.exists():
        original_path.write_text(original_content, encoding="utf-8")
    first_version_id = "v1"
    (version_dir / f"{first_version_id}.tsx").write_text(proposed_content, encoding="utf-8")

    frontend_target.write_text(proposed_content, encoding="utf-8")
    remotion_target.write_text(proposed_content, encoding="utf-8")

    session = {
        "session_id": session_id,
        "user_id": user.id,
        "template_id": template_id,
        "layout_id": layout_id,
        "frontend_path": str(frontend_target),
        "remotion_path": str(remotion_target),
        "version_dir": str(version_dir),
        "versions": ["original", first_version_id],
        "active_version_id": first_version_id,
        "frontend_original": original_content,
        "remotion_original": original_content,
        "created_at": int(time.time()),
    }
    _sync_versions_meta(session)
    _save_session(session)
    return session


def _get_user_session_or_404(user: User, session_id: str) -> dict:
    session = _get_session(session_id)
    if not session or session.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="AI preview session not found.")
    return session


@router.post("/save-source")
def save_source_defaults(payload: SaveSourceRequest, _: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    layout_id = (payload.layout_id or "").strip().lower()

    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Save-to-source supports built-in templates only.")

    frontend_target, remotion_target = _resolve_target_files(template_id, layout_id)
    target_paths = [frontend_target, remotion_target]

    missing = [p for p in target_paths if not p.exists()]
    if missing:
        missing_rel = [p.relative_to(_ROOT).as_posix() for p in missing]
        raise HTTPException(status_code=404, detail=f"Layout source file not found: {', '.join(missing_rel)}")

    updated_files: list[str] = []
    total_changes = 0
    for path in target_paths:
        original = path.read_text(encoding="utf-8")
        updated_content, changes = _apply_font_updates_to_content(
            original,
            layout_id,
            payload.title_font_size,
            payload.description_font_size,
        )
        if changes == 0:
            rel = path.relative_to(_ROOT).as_posix()
            raise HTTPException(status_code=400, detail=f"No matching font-size defaults found in {rel}")
        path.write_text(updated_content, encoding="utf-8")
        updated_files.append(path.relative_to(_ROOT).as_posix())
        total_changes += changes

    meta_path = _update_meta_defaults(
        template_id=template_id,
        layout_id=layout_id,
        title_font_size=payload.title_font_size,
        description_font_size=payload.description_font_size,
    )

    return {
        "ok": True,
        "updated_file": updated_files[0],
        "updated_files": updated_files,
        "updated_meta_file": meta_path.relative_to(_ROOT).as_posix() if meta_path else None,
        "layout_id": layout_id,
        "template_id": template_id,
        "changes_applied": total_changes,
    }


@router.post("/ai-edit/propose")
def propose_ai_edit(payload: AiEditProposeRequest, _: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    layout_id = (payload.layout_id or "").strip().lower()
    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="AI template editing supports built-in templates only.")

    frontend_target, remotion_target = _resolve_target_files(template_id, layout_id)
    target_paths = [frontend_target, remotion_target]
    missing = [p for p in target_paths if not p.exists()]
    if missing:
        missing_rel = [p.relative_to(_ROOT).as_posix() for p in missing]
        raise HTTPException(status_code=404, detail=f"Layout source file not found: {', '.join(missing_rel)}")

    original_code = frontend_target.read_text(encoding="utf-8")
    proposed_code = _call_code_edit(
        instruction=payload.instruction.strip(),
        current_code=original_code,
        template_id=template_id,
        layout_id=layout_id,
        image_base64=payload.image_base64,
        image_mime_type=payload.image_mime_type,
    )
    return {
        "ok": True,
        "template_id": template_id,
        "layout_id": layout_id,
        "frontend_file": frontend_target.relative_to(_ROOT).as_posix(),
        "remotion_file": remotion_target.relative_to(_ROOT).as_posix(),
        "original_code": original_code,
        "proposed_code": proposed_code,
    }


@router.post("/ai-edit/apply")
def apply_ai_edit(payload: AiEditApplyRequest, _: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    layout_id = (payload.layout_id or "").strip().lower()
    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="AI template editing supports built-in templates only.")

    code = (payload.proposed_code or "").strip()
    if not code or "export" not in code:
        raise HTTPException(status_code=400, detail="Proposed code is invalid or empty.")

    frontend_target, remotion_target = _resolve_target_files(template_id, layout_id)
    target_paths = [frontend_target, remotion_target]
    missing = [p for p in target_paths if not p.exists()]
    if missing:
        missing_rel = [p.relative_to(_ROOT).as_posix() for p in missing]
        raise HTTPException(status_code=404, detail=f"Layout source file not found: {', '.join(missing_rel)}")

    for path in target_paths:
        path.write_text(code + "\n", encoding="utf-8")

    return {
        "ok": True,
        "template_id": template_id,
        "layout_id": layout_id,
        "updated_files": [p.relative_to(_ROOT).as_posix() for p in target_paths],
    }


@router.post("/ai-edit/preview")
def preview_ai_edit(payload: AiEditProposeRequest, user: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    layout_id = (payload.layout_id or "").strip().lower()
    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="AI template editing supports built-in templates only.")

    frontend_target, remotion_target = _resolve_target_files(template_id, layout_id)
    target_paths = [frontend_target, remotion_target]
    missing = [p for p in target_paths if not p.exists()]
    if missing:
        missing_rel = [p.relative_to(_ROOT).as_posix() for p in missing]
        raise HTTPException(status_code=404, detail=f"Layout source file not found: {', '.join(missing_rel)}")

    # Base code for Gemini is always whatever is currently in the frontend file.
    # This reflects the currently selected version in the preview.
    current_code = frontend_target.read_text(encoding="utf-8")

    # Reuse an existing session for this user+template+layout, if one exists.
    session: dict | None = _get_user_layout_session(user, template_id, layout_id)

    proposed_code = _call_code_edit(
        instruction=payload.instruction.strip(),
        current_code=current_code,
        template_id=template_id,
        layout_id=layout_id,
        image_base64=payload.image_base64,
        image_mime_type=payload.image_mime_type,
    )

    if session is None:
        session = _create_preview_session(
            user=user,
            template_id=template_id,
            layout_id=layout_id,
            frontend_target=frontend_target,
            remotion_target=remotion_target,
            proposed_code=proposed_code,
        )
    else:
        version_dir = Path(session["version_dir"])
        # The tmp folder may have been cleaned up between requests; recreate if needed.
        version_dir.mkdir(parents=True, exist_ok=True)
        new_version_id = _next_version_id(session)
        content = proposed_code.rstrip() + "\n"
        (version_dir / f"{new_version_id}.tsx").write_text(content, encoding="utf-8")
        frontend_target.write_text(content, encoding="utf-8")
        remotion_target.write_text(content, encoding="utf-8")
        versions = list(session.get("versions") or [])
        versions.append(new_version_id)
        session["versions"] = versions
        session["active_version_id"] = new_version_id
        _sync_versions_meta(session)
        _save_session(session)
    return {
        "ok": True,
        "session_id": session["session_id"],
        "template_id": template_id,
        "layout_id": layout_id,
        "preview_files": [
            frontend_target.relative_to(_ROOT).as_posix(),
            remotion_target.relative_to(_ROOT).as_posix(),
        ],
        "versions": session.get("versions", []),
        "active_version_id": session.get("active_version_id"),
    }


def _write_version_to_targets(user: User, session: dict, version: str) -> None:
    """Copy a version file to frontend and remotion targets and mark it active."""
    version_dir = Path(session["version_dir"])
    version_file = _get_version_file(session, version)
    content = version_file.read_text(encoding="utf-8")
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
    frontend_path.write_text(content, encoding="utf-8")
    remotion_path.write_text(content, encoding="utf-8")
    # For rebuild sessions, also write meta and prompt
    meta_path_str = session.get("meta_path")
    prompt_path_str = session.get("prompt_path")
    if meta_path_str:
        meta_v = version_dir / (f"{version}_meta.json" if version != "original" else "meta_original.json")
        if meta_v.exists():
            Path(meta_path_str).write_text(meta_v.read_text(encoding="utf-8"), encoding="utf-8")
    if prompt_path_str:
        prompt_v = version_dir / (f"{version}_prompt.md" if version != "original" else "prompt_original.md")
        if prompt_v.exists():
            Path(prompt_path_str).write_text(prompt_v.read_text(encoding="utf-8"), encoding="utf-8")
    versions = session.get("versions") or []
    if version not in versions:
        versions.append(version)
    session["versions"] = versions
    session["active_version_id"] = version
    _sync_versions_meta(session)
    _save_session(session)


@router.post("/ai-edit/preview-switch")
def switch_ai_preview_version(
    payload: AiEditPreviewSwitchRequest, user: User = Depends(get_current_user)
):
    """Switch preview between original and proposed version."""
    session = _get_user_session_or_404(user, payload.session_id)
    if not session.get("version_dir"):
        raise HTTPException(status_code=400, detail="Session has no version folder.")
    if payload.version not in (session.get("versions") or []):
        # Ensure the version file exists even if it's not yet in the versions list.
        _get_version_file(session, payload.version)
    _write_version_to_targets(user, session, payload.version)
    return {
        "ok": True,
        "session_id": payload.session_id,
        "version": payload.version,
        "template_id": session["template_id"],
        "layout_id": session["layout_id"],
        "versions": session.get("versions", []),
        "active_version_id": session.get("active_version_id"),
    }


@router.post("/ai-edit/preview-apply")
def apply_ai_preview(payload: AiEditSessionActionRequest, user: User = Depends(get_current_user)):
    session = _get_user_session_or_404(user, payload.session_id)
    version_dir = session.get("version_dir")
    if not version_dir:
        raise HTTPException(status_code=400, detail="Preview session has no version data.")
    active_version = session.get("active_version_id")
    if not active_version:
        raise HTTPException(status_code=400, detail="No active version to apply.")
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
    # For create sessions, files are already written; just drop session
    if session.get("session_type") != "create":
        version_file = _get_version_file(session, active_version)
        content = version_file.read_text(encoding="utf-8")
        frontend_path.write_text(content, encoding="utf-8")
        remotion_path.write_text(content, encoding="utf-8")
    _drop_session(session, restore_original=False)
    return {
        "ok": True,
        "session_id": payload.session_id,
        "template_id": session["template_id"],
        "layout_id": session["layout_id"],
        "updated_files": [
            frontend_path.relative_to(_ROOT).as_posix(),
            remotion_path.relative_to(_ROOT).as_posix(),
        ],
    }


@router.post("/ai-edit/preview-discard")
def discard_ai_preview(payload: AiEditSessionActionRequest, user: User = Depends(get_current_user)):
    session = _get_user_session_or_404(user, payload.session_id)
    _drop_session(session, restore_original=True)
    return {"ok": True, "session_id": payload.session_id}


@router.post("/ai-edit/versions")
def list_ai_versions(payload: AiEditVersionsRequest, user: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    layout_id = (payload.layout_id or "").strip().lower()
    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="AI template editing supports built-in templates only.")

    version_dir = _version_dir_for(user, template_id, layout_id)
    create_version_dir = _version_dir_for(user, template_id, f"_create_{layout_id}")
    if not version_dir.exists() and not create_version_dir.exists():
        return {
            "ok": True,
            "session_id": None,
            "template_id": template_id,
            "layout_id": layout_id,
            "versions": [],
            "active_version_id": None,
        }
    if not version_dir.exists():
        version_dir = create_version_dir

    versions, active = _load_versions_meta(version_dir)
    if not versions:
        return {
            "ok": True,
            "session_id": None,
            "template_id": template_id,
            "layout_id": layout_id,
            "versions": [],
            "active_version_id": None,
        }

    session = _get_user_layout_session(user, template_id, layout_id)
    if session is None:
        # Rehydrate a session from disk so switch/apply can work.
        frontend_target, remotion_target = _resolve_target_files(template_id, layout_id)
        original_path = version_dir / "original.tsx"
        if original_path.exists():
            original_content = original_path.read_text(encoding="utf-8")
        else:
            original_content = frontend_target.read_text(encoding="utf-8")

        meta_path_str = str(_TEMPLATES_META_DIR / template_id / "meta.json")
        prompt_path_str = str(_TEMPLATES_META_DIR / template_id / "prompt.md")
        session_type = "edit"
        if (version_dir / "meta_original.json").exists():
            session_type = "rebuild"

        meta_json = version_dir / "meta.json"
        extra = {}
        if meta_json.exists():
            import json as _json
            try:
                data = _json.loads(meta_json.read_text(encoding="utf-8"))
                for key in ("session_type", "meta_path", "prompt_path", "created_files",
                            "index_frontend_path", "index_remotion_path", "types_frontend_path", "types_remotion_path", "config_path"):
                    if key in data:
                        extra[key] = data[key]
            except Exception:
                pass

        session_id = f"ai-{uuid.uuid4().hex}"
        session = {
            "session_id": session_id,
            "user_id": user.id,
            "template_id": template_id,
            "layout_id": layout_id,
            "frontend_path": str(frontend_target),
            "remotion_path": str(remotion_target),
            "version_dir": str(version_dir),
            "versions": versions,
            "active_version_id": active,
            "frontend_original": original_content,
            "remotion_original": original_content,
            "created_at": int(time.time()),
            "session_type": extra.get("session_type", session_type),
            "meta_path": extra.get("meta_path", meta_path_str if session_type == "rebuild" else None),
            "prompt_path": extra.get("prompt_path", prompt_path_str if session_type == "rebuild" else None),
            **{k: extra[k] for k in ("created_files", "index_frontend_path", "index_remotion_path", "types_frontend_path", "types_remotion_path", "config_path") if k in extra},
        }
        _save_session(session)

    return {
        "ok": True,
        "session_id": session["session_id"],
        "template_id": template_id,
        "layout_id": layout_id,
        "versions": versions,
        "active_version_id": active,
    }


# ─── Layout rebuild / create helpers ─────────────────────────────────────────


def _load_meta_json(template_id: str) -> tuple[dict, Path]:
    """Load meta.json for a built-in template. Returns (data, path)."""
    import json as _json
    meta_path = _TEMPLATES_META_DIR / template_id / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"meta.json not found for template '{template_id}'.")
    data = _json.loads(meta_path.read_text(encoding="utf-8"))
    return data, meta_path


def _write_meta_json(data: dict, meta_path: Path) -> None:
    import json as _json
    meta_path.write_text(_json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _load_prompt_md(template_id: str) -> tuple[str, Path]:
    prompt_path = _TEMPLATES_META_DIR / template_id / "prompt.md"
    if not prompt_path.exists():
        raise HTTPException(status_code=404, detail=f"prompt.md not found for template '{template_id}'.")
    return prompt_path.read_text(encoding="utf-8"), prompt_path


def _load_layout_prompt_md(template_id: str) -> tuple[str | None, Path]:
    """Load layout_prompt.md if it exists. Returns (content, path); content is None if missing."""
    layout_prompt_path = _TEMPLATES_META_DIR / template_id / "layout_prompt.md"
    if not layout_prompt_path.exists():
        return None, layout_prompt_path
    return layout_prompt_path.read_text(encoding="utf-8"), layout_prompt_path


def _add_or_update_layout_in_layout_prompt(content: str, layout_id: str, description: str) -> str:
    """
    Add or update a layout entry in layout_prompt.md content.
    Format: - `layout_id`  
      - **Best for**: description
    """
    desc_one_line = description.strip().split("\n")[0].strip()
    entry_block = f"- `{layout_id}`  \n  - **Best for**: {desc_one_line}\n"
    # Match existing entry: - `layout_id`  followed by indented lines until next - ` or section
    pattern = re.compile(
        rf"^(- `{re.escape(layout_id)}`\s*\n(?:  - .*\n)*)",
        re.MULTILINE,
    )
    m = pattern.search(content)
    if m:
        return content[: m.start(1)] + entry_block + content[m.end(1) :]
    # Insert before "Variety rules" or similar top-level section (line starting with word:)
    insert_pattern = re.compile(r"\n\n(Variety rules|Global variety|Usage rules)[:\s]", re.MULTILINE | re.IGNORECASE)
    insert_m = insert_pattern.search(content)
    if insert_m:
        insert_pos = insert_m.start()
        return content[:insert_pos] + "\n" + entry_block + "\n" + content[insert_pos:]
    # Fallback: append before trailing newlines
    return content.rstrip() + "\n\n" + entry_block + "\n"


def _extract_prompt_layout_section(prompt_text: str, layout_id: str) -> str:
    """
    Extract the markdown block for a layout from prompt.md.
    Uses '---' separators to avoid accidentally capturing non-layout sections.
    Returns empty string if not found.
    """
    blocks = _split_prompt_md_blocks(prompt_text)
    for b in blocks:
        header = _first_nonempty_line(b)
        if header.strip().lower() == f"## {layout_id}".lower():
            return b.rstrip()
    return ""


def _replace_prompt_layout_section(prompt_text: str, layout_id: str, new_section: str) -> str:
    """
    Replace or insert a layout markdown block in prompt.md using '---' block boundaries.
    This avoids overwriting sections like '# Scene Flow Rules' that come after the catalog.
    """
    new_block = new_section.strip()
    if not new_block.lower().startswith(f"## {layout_id}".lower()):
        new_block = f"## {layout_id}\n" + new_block.lstrip()

    blocks = _split_prompt_md_blocks(prompt_text)
    # Try replace in-place.
    for i, b in enumerate(blocks):
        header = _first_nonempty_line(b).strip()
        if header.lower() == f"## {layout_id}".lower():
            blocks[i] = new_block
            return _join_prompt_md_blocks(blocks)

    # Not found: insert into the Layout Catalog section (before scene flow / rules blocks).
    insert_at = len(blocks)
    layout_catalog_idx = None
    for i, b in enumerate(blocks):
        h = _first_nonempty_line(b).strip()
        if h.lower() == "# layout catalog":
            layout_catalog_idx = i
            continue
        if layout_catalog_idx is not None and i > layout_catalog_idx:
            # Insert before the first top-level heading after the catalog.
            if h.startswith("# ") and h.lower() != "# layout catalog":
                insert_at = i
                break
    # Additional safety: even if we didn't see an explicit "# Layout Catalog",
    # prefer to insert before common post-catalog sections.
    post_headers = {
        "# scene flow rules",
        "# content extraction rules",
        "# variety rules",
        "# scene flow",
    }
    for i, b in enumerate(blocks):
        h = _first_nonempty_line(b).strip().lower()
        if h in post_headers:
            insert_at = min(insert_at, i)
            break

    if layout_catalog_idx is not None or insert_at < len(blocks):
        blocks.insert(insert_at, new_block)
    else:
        # Fallback: append.
        blocks.append(new_block)
    return _join_prompt_md_blocks(blocks)


_PROMPT_SPLIT_RE = re.compile(r"\n\s*---\s*\n")


def _split_prompt_md_blocks(prompt_text: str) -> list[str]:
    text = (prompt_text or "").strip()
    if not text:
        return []
    # Preserve order; normalize whitespace within blocks by trimming edges only.
    parts = _PROMPT_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def _join_prompt_md_blocks(blocks: list[str]) -> str:
    return ("\n\n---\n\n".join(b.strip() for b in blocks if b and b.strip()).rstrip() + "\n")


def _first_nonempty_line(block: str) -> str:
    for line in (block or "").splitlines():
        if line.strip():
            return line
    return ""


def _validate_prop_types(props: list[PropDef]) -> None:
    for p in props:
        if p.type not in SUPPORTED_PROP_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Prop '{p.name}' has unsupported type '{p.type}'. "
                       f"Supported: {', '.join(sorted(SUPPORTED_PROP_TYPES))}",
            )


def _validate_prop_names_no_collision(
    extra_props: list[PropDef],
    existing_fields: list[dict],
) -> None:
    existing_keys = {f["key"] for f in existing_fields}
    reserved = {"children", "key", "ref"}
    for p in extra_props:
        if p.name in reserved:
            raise HTTPException(status_code=400, detail=f"Prop name '{p.name}' is reserved.")
        if p.name in existing_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Prop '{p.name}' already exists in the layout schema.",
            )


def _props_to_schema_fields(props: list[PropDef]) -> list[dict]:
    type_map = {
        "string": "string", "text": "text", "color": "color", "imageUrl": "string",
        "number": "number", "boolean": "boolean",
        "string_array": "string_array", "object_array": "object_array",
    }
    fields = []
    for p in props:
        field: dict = {"key": p.name, "label": p.name.replace("_", " ").title(), "type": type_map.get(p.type, "string")}
        if p.description:
            field["description"] = p.description
        if p.type == "number":
            field["min"] = 0
            field["max"] = 500
            field["step"] = 1
        if p.type == "object_array":
            # Add label/value subFields so UI shows both inputs; layouts render both
            field["subFields"] = [{"key": "label", "label": "Label"}, {"key": "value", "label": "Value"}]
            field["maxItems"] = 10
        fields.append(field)
    return fields


def _props_to_defaults(props: list[PropDef]) -> dict:
    import json as _json
    defaults: dict = {}
    for p in props:
        if p.default is None or (isinstance(p.default, str) and not p.default.strip()):
            continue
        raw = p.default.strip() if isinstance(p.default, str) else p.default
        if p.type == "number":
            try:
                defaults[p.name] = int(raw)
            except ValueError:
                try:
                    defaults[p.name] = float(raw)
                except ValueError:
                    defaults[p.name] = raw
        elif p.type == "boolean":
            defaults[p.name] = str(raw).lower() in {"true", "1", "yes"}
        elif p.type == "string_array":
            s = str(raw).strip()
            if s.startswith("["):
                try:
                    parsed = _json.loads(s)
                    if isinstance(parsed, list):
                        defaults[p.name] = [str(x) for x in parsed]
                        continue
                except _json.JSONDecodeError:
                    pass
            parts = [x.strip() for x in s.split(",") if x.strip()]
            defaults[p.name] = parts
        elif p.type == "object_array":
            # JSON array, or "label: value" pairs, or comma-separated values (label = "Label N", value = item)
            s = str(raw).strip()
            if s.startswith("["):
                try:
                    defaults[p.name] = _json.loads(s)
                except _json.JSONDecodeError:
                    defaults[p.name] = [{"label": s, "value": s}]
            else:
                parts = [x.strip() for x in s.split(",") if x.strip()]
                result = []
                for i, part in enumerate(parts):
                    if ":" in part:
                        lbl, _, val = part.partition(":")
                        result.append({"label": lbl.strip(), "value": val.strip()})
                    else:
                        result.append({"label": f"Label {i + 1}", "value": part})
                defaults[p.name] = result
        else:
            defaults[p.name] = raw
    return defaults


def _build_prop_schema_entry(
    label: str,
    existing_fields: list[dict],
    existing_defaults: dict,
    extra_props: list[PropDef],
    preserve_keys: dict | None = None,
) -> dict:
    """Build schema entry. preserve_keys: extra keys to keep (e.g. scene_defaults)."""
    merged_fields = existing_fields + _props_to_schema_fields(extra_props)
    merged_defaults = {**existing_defaults, **_props_to_defaults(extra_props)}
    out: dict = {"label": label, "defaults": merged_defaults, "fields": merged_fields}
    if preserve_keys:
        for k, v in preserve_keys.items():
            if k not in out:
                out[k] = v
    return out


# Props that are UI/typography settings, not content — exclude from prompt.md (DSPy does not set these)
_PROMPT_EXCLUDE_PROPS = frozenset({"titleFontSize", "descriptionFontSize"})


def _build_prompt_section(layout_id: str, description: str, props: list[PropDef]) -> str:
    """Build prompt.md section for a layout. Excludes titleFontSize, descriptionFontSize (not set by DSPy)."""
    lines = [f"## {layout_id}"]
    lines.append(f"**Visual:** {description.strip()}")
    lines.append("")
    content_props = [p for p in props if p.name not in _PROMPT_EXCLUDE_PROPS]
    if content_props:
        prop_lines = []
        for p in content_props:
            desc = f" — {p.description}" if p.description else ""
            default_hint = f" (default: {p.default})" if p.default else ""
            prop_lines.append(f"  - `{p.name}` ({p.type}){desc}{default_hint}")
        lines.append("**Props:**")
        lines.extend(prop_lines)
    lines.append("")
    lines.append(f"**When to Use:** Use `{layout_id}` when content fits this layout style.")
    return "\n".join(lines)


def _extract_visual_from_prompt_section(section_md: str) -> str:
    """
    Given a prompt.md section, extract the one-line **Visual:** description.
    Returns empty string if not found.
    """
    if not section_md:
        return ""
    for line in section_md.splitlines():
        s = line.strip()
        if s.lower().startswith("**visual:**"):
            return s.split(":", 1)[1].strip()
    return ""


def _build_doc_section_prompts(
    *,
    template_id: str,
    layout_id: str,
    instruction: str,
    tsx: str,
    props: list[PropDef],
) -> tuple[str, str]:
    content_props = [p for p in props if p.name not in _PROMPT_EXCLUDE_PROPS]
    props_desc = "\n".join(
        f"- `{p.name}` ({p.type}){(' — ' + p.description.strip()) if p.description else ''}"
        for p in content_props
    ) or "- (none)"

    system_prompt = (
        "You write documentation sections for a video template layout catalog (prompt.md).\n"
        "Output MUST be markdown ONLY, and MUST start with a header line exactly:\n"
        f"## {layout_id}\n\n"
        "Do not wrap in code fences. Do not add any extra sections outside this layout.\n"
        "Be concise but specific. Use the TSX to infer the visual design.\n\n"
        "Required structure inside the section:\n"
        f"## {layout_id}\n"
        "**Visual:** <1-2 sentences describing what the layout looks like>\n"
        "\n"
        "**Props:**\n"
        "  - `<prop>` (<type>) — <how it affects visuals/content> (include only the important ones)\n"
        "\n"
        f"**When to Use:** <1-2 sentences, include `{layout_id}`>\n"
        "\n"
        "**Avoid When:** <1 sentence>\n"
        "\n"
        "**Notes:** <1-3 bullets with any constraints like image support, long text behavior, etc.>\n"
    )

    user_prompt = (
        f"Template ID: {template_id}\n"
        f"Layout ID: {layout_id}\n\n"
        "User instruction (intent):\n"
        f"{instruction.strip()}\n\n"
        "Known props (name, type, description):\n"
        f"{props_desc}\n\n"
        "Final TSX implementation (source of truth for visuals/behavior):\n"
        f"{tsx.strip()[:12000]}"
    )
    return system_prompt, user_prompt


def _call_anthropic_layout_doc_section(
    *,
    template_id: str,
    layout_id: str,
    instruction: str,
    tsx: str,
    props: list[PropDef],
) -> str:
    """Generate a prompt.md doc section via Anthropic (Claude Sonnet). Text-only — used by template creation. Returns markdown starting with '## {layout_id}'."""
    system_prompt, user_prompt = _build_doc_section_prompts(
        template_id=template_id,
        layout_id=layout_id,
        instruction=instruction,
        tsx=tsx,
        props=props,
    )
    text = template_studio_chat(
        system=system_prompt,
        user=user_prompt,
        max_tokens=2000,
        temperature=0.4,
        log_label=f"prompt_md/{template_id}/{layout_id}",
    ).strip()
    if not text:
        raise HTTPException(status_code=502, detail="Model returned empty prompt.md section.")
    if not text.lstrip().startswith(f"## {layout_id}"):
        text = f"## {layout_id}\n" + text.lstrip().lstrip("#").lstrip()
    return text.rstrip()


def _call_gemini_layout_doc_section(
    *,
    template_id: str,
    layout_id: str,
    instruction: str,
    tsx: str,
    props: list[PropDef],
    image_base64: str | None = None,
    image_mime_type: str | None = None,
) -> str:
    """Generate a prompt.md doc section via Gemini (vision-capable). Used by
    the image-driven layout rebuild / create flows. Returns markdown starting
    with '## {layout_id}'."""
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured.")
    try:
        from google import genai
        from google.genai import types
    except Exception as e:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail=f"Gemini requires google-genai package: {e}",
        )

    default_model = (getattr(settings, "GEMINI_CODE_MODEL", "") or "gemini-3.5-flash").strip()
    image_model = (getattr(settings, "GEMINI_CODE_MODEL_WITH_IMAGE", "") or "").strip()
    model_name = image_model if (image_base64 and image_mime_type and image_model) else default_model
    client = genai.Client(api_key=api_key)

    system_prompt, user_prompt = _build_doc_section_prompts(
        template_id=template_id,
        layout_id=layout_id,
        instruction=instruction,
        tsx=tsx,
        props=props,
    )

    prompt_part = types.Part.from_text(text=system_prompt + "\n\n" + user_prompt)
    parts: list = []
    if image_base64 and image_mime_type:
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image_base64.")
        mime = (image_mime_type or "image/jpeg").strip().lower()
        if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
            mime = "image/jpeg"
        parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime))
    parts.append(prompt_part)

    response = client.models.generate_content(
        model=model_name,
        contents=[types.Content(role="user", parts=parts)],
    )
    text = (getattr(response, "text", "") or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned empty prompt.md section.")
    if not text.lstrip().startswith(f"## {layout_id}"):
        text = f"## {layout_id}\n" + text.lstrip().lstrip("#").lstrip()
    return text.rstrip()


def _call_layout_doc_section(
    *,
    template_id: str,
    layout_id: str,
    instruction: str,
    tsx: str,
    props: list[PropDef],
    image_base64: str | None = None,
    image_mime_type: str | None = None,
    backend: str = "gemini",
) -> str:
    """Dispatch a prompt.md doc-section generation call.

    backend="gemini"     — Gemini. Default — **rebuild** prompt.md updates.
    backend="anthropic"  — Anthropic. **New template** and **new layout**
                           prompt.md enrichment; images ignored.
    """
    if backend == "anthropic":
        return _call_anthropic_layout_doc_section(
            template_id=template_id,
            layout_id=layout_id,
            instruction=instruction,
            tsx=tsx,
            props=props,
        )
    return _call_gemini_layout_doc_section(
        template_id=template_id,
        layout_id=layout_id,
        instruction=instruction,
        tsx=tsx,
        props=props,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
    )


def _build_rebuild_gemini_prompt(
    template_id: str,
    layout_id: str,
    instruction: str,
    current_tsx: str,
    all_props: list[dict],
) -> str:
    props_desc = "\n".join(
        f"  - {f['key']} ({f.get('type', 'string')}): {f.get('description', f.get('label', ''))}"
        for f in all_props
    )
    return (
        "You are rebuilding a React TSX layout component used in a Remotion video template system.\n"
        "Return ONLY the full updated TSX file contents — no markdown fences, explanations, or extra text.\n\n"
        f"Template ID: {template_id}\n"
        f"Layout ID: {layout_id}\n\n"
        "CRITICAL: You MUST preserve rendering of `title` and `narration` props. Never remove or break them.\n"
        "The component receives title and narration from the scene; they must remain visible in the output.\n\n"
        "User instruction:\n"
        f"{instruction}\n\n"
        "The component must accept EXACTLY these props (add TypeScript destructuring for each):\n"
        f"{props_desc}\n\n"
        "Always destructure props using: `const {{ title, narration, accentColor, bgColor, textColor, aspectRatio, "
        "titleFontSize, descriptionFontSize, stats, ...extra }} = props;`\n"
        "then access extra props like `extra.myProp`.\n\n"
        "For object_array props (items with label and value): render BOTH — e.g. show item.label as caption and item.value as main text.\n\n"
        "Use the current file content provided below as the starting point.\n"
    )


def _build_create_gemini_prompt(
    template_id: str,
    new_layout_id: str,
    layout_description: str,
    props: list[PropDef],
    base_tsx: str,
    base_layout_id: str,
    reference_tsvs: list[tuple[str, str]],
) -> str:
    props_desc = "\n".join(
        f"  - {p.name} ({p.type}): {p.description}"
        for p in props
    )
    ref_examples = ""
    for ref_id, ref_tsx in reference_tsvs[:2]:
        snippet = (ref_tsx or "").strip()
        if snippet:
            ref_examples += f"\n--- Reference layout: {ref_id} (snippet) ---\n{snippet[:1200]}\n"

    pascal_name = _snake_to_pascal(new_layout_id)
    return (
        "You are creating a brand-new React TSX layout component for a Remotion video template system.\n"
        "Return ONLY the full TSX file contents — no markdown fences, explanations, or extra text.\n\n"
        f"Template ID: {template_id}\n"
        f"New layout ID: {new_layout_id}\n"
        f"Component export name: {pascal_name}\n\n"
        f"Layout description: {layout_description}\n\n"
        "The component must accept these custom props (in addition to the base BlogLayoutProps):\n"
        f"{props_desc}\n\n"
        "Destructure all props from the shared layout props type. Use destructuring:\n"
        f"export const {pascal_name} = ({{ title, narration, accentColor, bgColor, textColor, aspectRatio, "
        "titleFontSize, descriptionFontSize, stats, imageUrl, ...extra }}: LayoutProps) => {{\n"
        "  // access custom props via extra.propName\n}}\n\n"
        "For object_array props (items with label and value): render BOTH — show item.label as caption and item.value as main text.\n\n"
        "Typography — REQUIRED (Template Studio edits title/body sizes via meta + Save-to-source; match patterns used in templates like newspaper):\n"
        '  - Immediately inside the component: const p = aspectRatio === "portrait";\n'
        "  - Main headline (`title` string): fontSize MUST include the verbatim pattern "
        "titleFontSize ?? (p ? <int> : <int>) (optional * scale factors on the ints).\n"
        "  - Primary body (`narration` string): fontSize MUST include "
        "descriptionFontSize ?? (p ? <int> : <int>) similarly.\n"
        "  - Do not rely on hard-coded px for those two roles without wiring these props.\n\n"
        f"Base your visual style on this existing layout ({base_layout_id}) — "
        "keep the same color palette, font choices, and animation approach.\n"
        "Use the current file content provided below as the style reference.\n"
        f"{ref_examples}"
        "\nIMPORTANT: Import from 'remotion' (AbsoluteFill, useCurrentFrame, interpolate, Img, etc.). "
        "Do NOT import from any other path. Use the same animation patterns as the base layout."
    )


def _file_to_image_parts(image: UploadFile | None) -> tuple[str | None, str | None]:
    """Return (image_base64, image_mime_type) from an uploaded file, or (None, None)."""
    if not image:
        return None, None
    try:
        data = image.file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read uploaded image.")
    if not data:
        return None, None
    mime = (image.content_type or "image/jpeg").strip().lower()
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        mime = "image/jpeg"
    return base64.b64encode(data).decode("utf-8"), mime


def _read_layout_tsx(template_id: str, layout_id: str) -> str | None:
    """Read the frontend TSX for a layout, returning None if not found."""
    frontend_target, _ = _resolve_target_files(template_id, layout_id)
    if frontend_target.exists():
        return frontend_target.read_text(encoding="utf-8")
    return None


def _register_layout_in_index(
    index_path: Path,
    layout_id: str,
    component_name: str,
    file_stem: str,
    registry_name: str,
    layout_type_name: str,
) -> None:
    """Add an import and registry entry to a layouts/index.ts file."""
    if not index_path.exists():
        raise HTTPException(status_code=500, detail=f"Index file not found: {index_path}")
    content = index_path.read_text(encoding="utf-8")
    if component_name in content:
        return

    # Insert import after last import line
    last_import = max(
        (i for i, line in enumerate(content.splitlines()) if line.startswith("import ")),
        default=-1,
    )
    lines = content.splitlines(keepends=True)
    new_import = f'import {{ {component_name} }} from "./{file_stem}";\n'
    lines.insert(last_import + 1, new_import)

    # Add to LayoutType union
    content2 = "".join(lines)
    type_pattern = re.compile(rf'(export type {layout_type_name}\s*=\s*(?:[^\n]+\n)*\s+\|\s+"[^"]+";)', re.MULTILINE)
    m = type_pattern.search(content2)
    if m:
        old_type = m.group(0)
        # Add new member before the semicolon at the end
        new_type = re.sub(r';$', f'\n  | "{layout_id}";', old_type.rstrip())
        content2 = content2.replace(old_type, new_type)

    # Add registry entry before closing brace of the registry const
    registry_pattern = re.compile(
        rf'(export const {registry_name}.*?=\s*{{[^}}]*?)(}};)',
        re.DOTALL,
    )
    m2 = registry_pattern.search(content2)
    if m2:
        new_entry = f"  {layout_id}: {component_name},\n"
        content2 = content2[: m2.start(2)] + new_entry + content2[m2.start(2):]

    index_path.write_text(content2, encoding="utf-8")


def _register_layout_type_in_types_ts(template_dir: Path, layout_id: str, layout_type_name: str) -> None:
    """Add layout_id to the LayoutType union in types.ts (or wherever it's defined)."""
    types_path = template_dir / "types.ts"
    if not types_path.exists():
        return
    content = types_path.read_text(encoding="utf-8")
    if f'"{layout_id}"' in content:
        return
    # Match union type ending with semicolon
    pattern = re.compile(
        rf'(export type {layout_type_name}\s*=(?:[^;]+\|)*[^;]+)(;)',
        re.DOTALL,
    )
    m = pattern.search(content)
    if m:
        updated = content[:m.start(2)] + f'\n  | "{layout_id}"' + content[m.start(2):]
        types_path.write_text(updated, encoding="utf-8")


def _register_layout_in_template_config(layout_id: str, template_id: str) -> None:
    """Add layout_id to the template's validLayouts Set in templateConfig.tsx."""
    config_path = (_FRONTEND_REMOTION_DIR / "templateConfig.tsx").resolve()
    if not config_path.exists():
        return
    content = config_path.read_text(encoding="utf-8")
    if f'"{layout_id}"' in content:
        return
    # Find the set literal for this template e.g. NEWSPAPER_LAYOUTS = new Set([...])
    upper_id = template_id.upper()
    pattern = re.compile(
        rf'(const {upper_id}_LAYOUTS\s*=\s*new Set\(\[)(.*?)(\]\))',
        re.DOTALL,
    )
    m = pattern.search(content)
    if m:
        new_content = content[:m.start(2)] + m.group(2) + f'  "{layout_id}",\n' + content[m.start(3):]
        config_path.write_text(new_content, encoding="utf-8")


@router.post("/ai-layout/rebuild")
def rebuild_layout(payload: AiLayoutRebuildRequest, user: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    layout_id = (payload.layout_id or "").strip().lower()
    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Layout rebuild supports built-in templates only.")

    _validate_prop_types(payload.extra_props)

    # Load current state
    meta, meta_path = _load_meta_json(template_id)
    schema = meta.get("layout_prop_schema", {}).get(layout_id)
    if schema is None:
        raise HTTPException(status_code=404, detail=f"Layout '{layout_id}' not found in meta.json.")

    existing_fields: list[dict] = schema.get("fields", [])
    existing_defaults: dict = schema.get("defaults", {})
    existing_label: str = schema.get("label", layout_id.replace("_", " ").title())
    preserve_keys = {k: v for k, v in schema.items() if k not in ("label", "defaults", "fields")}

    _validate_prop_names_no_collision(payload.extra_props, existing_fields)

    frontend_target, remotion_target = _resolve_target_files(template_id, layout_id)
    if not frontend_target.exists():
        raise HTTPException(status_code=404, detail=f"Layout TSX not found: {frontend_target.name}")

    current_tsx = frontend_target.read_text(encoding="utf-8")
    prompt_text, prompt_path = _load_prompt_md(template_id)

    all_fields = existing_fields + _props_to_schema_fields(payload.extra_props)
    gemini_prompt = _build_rebuild_gemini_prompt(
        template_id, layout_id, payload.instruction, current_tsx, all_fields
    )
    new_tsx = _call_code_edit(
        instruction=gemini_prompt,
        current_code=current_tsx,
        template_id=template_id,
        layout_id=layout_id,
        image_base64=payload.image_base64,
        image_mime_type=payload.image_mime_type,
    )

    content = new_tsx.rstrip() + "\n"
    new_schema = _build_prop_schema_entry(
        existing_label, existing_fields, existing_defaults, payload.extra_props,
        preserve_keys=preserve_keys if preserve_keys else None,
    )
    meta.setdefault("layout_prop_schema", {})[layout_id] = new_schema
    all_props_for_prompt = [
        PropDef(name=f["key"], type=f.get("type", "string"), description=f.get("description", f.get("label", "")))
        for f in all_fields
    ]
    # Build a richer prompt.md section using AI, based on the final TSX + props.
    # Fallback to simple section generation if the model call fails for any reason.
    try:
        new_section = _call_layout_doc_section(
            template_id=template_id,
            layout_id=layout_id,
            instruction=payload.instruction,
            tsx=content,
            props=all_props_for_prompt,
            image_base64=payload.image_base64,
            image_mime_type=payload.image_mime_type,
        )
    except HTTPException:
        new_section = _build_prompt_section(layout_id, payload.instruction, all_props_for_prompt)
    updated_prompt = _replace_prompt_layout_section(prompt_text, layout_id, new_section)

    # Versioning: create or reuse session
    version_dir = _version_dir_for(user, template_id, layout_id)
    version_dir.mkdir(parents=True, exist_ok=True)

    session = _get_user_layout_session(user, template_id, layout_id)
    # Save originals on first rebuild (or when upgrading from code-only session)
    if not (version_dir / "meta_original.json").exists():
        (version_dir / "original.tsx").write_text(current_tsx, encoding="utf-8")
        (version_dir / "meta_original.json").write_text(
            meta_path.read_text(encoding="utf-8"),
            encoding="utf-8",
        )
        (version_dir / "prompt_original.md").write_text(prompt_text, encoding="utf-8")
        layout_prompt_content, layout_prompt_path = _load_layout_prompt_md(template_id)
        if layout_prompt_content is not None:
            (version_dir / "layout_prompt_original.md").write_text(layout_prompt_content, encoding="utf-8")
    # Use v1 for first rebuild; append for subsequent rebuilds (ignore code-only versions)
    if session is None or not session.get("meta_path"):
        first_version_id = "v1"
        versions = ["original", "v1"]
    else:
        first_version_id = _next_version_id(session)
        versions = list(session.get("versions") or [])
        if first_version_id not in versions:
            versions.append(first_version_id)

    (version_dir / f"{first_version_id}.tsx").write_text(content, encoding="utf-8")
    (version_dir / f"{first_version_id}_meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (version_dir / f"{first_version_id}_prompt.md").write_text(updated_prompt, encoding="utf-8")

    frontend_target.write_text(content, encoding="utf-8")
    remotion_target.write_text(content, encoding="utf-8")
    _write_meta_json(meta, meta_path)
    prompt_path.write_text(updated_prompt, encoding="utf-8")

    # Update layout_prompt.md if it exists (pipeline uses it for layout catalog)
    layout_prompt_content, layout_prompt_path = _load_layout_prompt_md(template_id)
    if layout_prompt_content is not None:
        rebuild_description = _extract_visual_from_prompt_section(new_section) or payload.instruction
        updated_layout_prompt = _add_or_update_layout_in_layout_prompt(
            layout_prompt_content, layout_id, rebuild_description
        )
        layout_prompt_path.write_text(updated_layout_prompt, encoding="utf-8")

    session_id = session["session_id"] if session else f"ai-{uuid.uuid4().hex}"
    active = first_version_id

    new_session = {
        "session_id": session_id,
        "user_id": user.id,
        "template_id": template_id,
        "layout_id": layout_id,
        "frontend_path": str(frontend_target),
        "remotion_path": str(remotion_target),
        "version_dir": str(version_dir),
        "versions": versions,
        "active_version_id": active,
        "session_type": "rebuild",
        "meta_path": str(meta_path),
        "prompt_path": str(prompt_path),
        "created_at": int(time.time()),
    }
    _sync_versions_meta(new_session)
    _save_session(new_session)

    updated_files_list = [
        frontend_target.relative_to(_ROOT).as_posix(),
        remotion_target.relative_to(_ROOT).as_posix(),
        meta_path.relative_to(_ROOT).as_posix(),
        prompt_path.relative_to(_ROOT).as_posix(),
    ]
    if layout_prompt_content is not None:
        updated_files_list.append(layout_prompt_path.relative_to(_ROOT).as_posix())

    return {
        "ok": True,
        "session_id": session_id,
        "template_id": template_id,
        "layout_id": layout_id,
        "versions": versions,
        "active_version_id": active,
        "updated_files": updated_files_list,
        "schema": new_schema,
    }


@router.post("/ai-layout/create")
def create_layout(payload: AiLayoutCreateRequest, user: User = Depends(get_current_user)):
    template_id = (payload.template_id or "").strip().lower()
    new_layout_id = (payload.new_layout_id or "").strip().lower()
    base_layout_id = (payload.base_layout_id or "").strip().lower()

    if not template_id or template_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Layout creation supports built-in templates only.")

    _validate_prop_types(payload.props)

    meta, meta_path = _load_meta_json(template_id)
    existing_ids = set(meta.get("valid_layouts", []))
    if new_layout_id in existing_ids:
        raise HTTPException(status_code=400, detail=f"Layout ID '{new_layout_id}' already exists in this template.")

    if base_layout_id not in existing_ids:
        raise HTTPException(status_code=400, detail=f"Base layout '{base_layout_id}' not found in template.")

    # Resolve paths before any modification
    frontend_layout_dir = _FRONTEND_REMOTION_DIR / template_id / "layouts"
    remotion_layout_dir = _REMOTION_VIDEO_DIR / template_id / "layouts"
    frontend_index = frontend_layout_dir / "index.ts"
    remotion_index = remotion_layout_dir / "index.ts"
    types_frontend = frontend_layout_dir.parent / "types.ts"
    types_remotion = remotion_layout_dir.parent / "types.ts"
    config_path = (_FRONTEND_REMOTION_DIR / "templateConfig.tsx").resolve()
    prompt_text, prompt_path = _load_prompt_md(template_id)

    # Versioning: save originals before any modification
    version_dir = _version_dir_for(user, template_id, f"_create_{new_layout_id}")
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / "meta_original.json").write_text(meta_path.read_text(encoding="utf-8"), encoding="utf-8")
    (version_dir / "prompt_original.md").write_text(prompt_text, encoding="utf-8")
    layout_prompt_content, layout_prompt_path = _load_layout_prompt_md(template_id)
    if layout_prompt_content is not None:
        (version_dir / "layout_prompt_original.md").write_text(layout_prompt_content, encoding="utf-8")
    if frontend_index.exists():
        (version_dir / "index_frontend_path_original").write_text(frontend_index.read_text(encoding="utf-8"), encoding="utf-8")
    if remotion_index.exists():
        (version_dir / "index_remotion_path_original").write_text(remotion_index.read_text(encoding="utf-8"), encoding="utf-8")
    if types_frontend.exists():
        (version_dir / "types_frontend_path_original").write_text(types_frontend.read_text(encoding="utf-8"), encoding="utf-8")
    if types_remotion.exists():
        (version_dir / "types_remotion_path_original").write_text(types_remotion.read_text(encoding="utf-8"), encoding="utf-8")
    if config_path.exists():
        (version_dir / "config_path_original").write_text(config_path.read_text(encoding="utf-8"), encoding="utf-8")

    # Read base TSX
    base_tsx = _read_layout_tsx(template_id, base_layout_id) or ""

    # Gather a couple of reference layouts for style context
    other_ids = [lid for lid in list(existing_ids)[:4] if lid != base_layout_id][:2]
    reference_tsvs = [
        (lid, _read_layout_tsx(template_id, lid) or "")
        for lid in other_ids
    ]

    gemini_prompt = _build_create_gemini_prompt(
        template_id, new_layout_id, payload.layout_description,
        payload.props, base_tsx, base_layout_id, reference_tsvs,
    )
    new_tsx = _call_code_edit(
        instruction=gemini_prompt,
        current_code=base_tsx,
        template_id=template_id,
        layout_id=new_layout_id,
        image_base64=payload.image_base64,
        image_mime_type=payload.image_mime_type,
        backend="anthropic",
    )

    pascal_name = _snake_to_pascal(new_layout_id)
    file_stem = pascal_name
    content = new_tsx.rstrip() + "\n"

    frontend_file = frontend_layout_dir / f"{file_stem}.tsx"
    remotion_file = remotion_layout_dir / f"{file_stem}.tsx"
    frontend_file.write_text(content, encoding="utf-8")
    remotion_file.write_text(content, encoding="utf-8")
    (version_dir / "v1.tsx").write_text(content, encoding="utf-8")

    # Determine layout type name for registration
    upper_id = template_id.upper()
    registry_name = f"{upper_id}_LAYOUT_REGISTRY"
    layout_type_name = _snake_to_pascal(template_id) + "LayoutType"

    if frontend_index.exists():
        idx_content = frontend_index.read_text(encoding="utf-8")
        type_m = re.search(r"export type (\w+LayoutType)", idx_content)
        if type_m:
            layout_type_name = type_m.group(1)
        registry_m = re.search(r"export const (\w+_LAYOUT_REGISTRY)", idx_content)
        if registry_m:
            registry_name = registry_m.group(1)

    for index_path in [frontend_index, remotion_index]:
        if index_path.exists():
            _register_layout_in_index(index_path, new_layout_id, pascal_name, file_stem, registry_name, layout_type_name)

    _register_layout_type_in_types_ts(frontend_layout_dir.parent, new_layout_id, layout_type_name)
    if types_remotion.exists():
        _register_layout_type_in_types_ts(remotion_layout_dir.parent, new_layout_id, layout_type_name)

    _register_layout_in_template_config(new_layout_id, template_id)

    from app.services import template_studio_codegen as codegen

    new_schema = _build_prop_schema_entry(
        _snake_to_pascal(new_layout_id).replace("_", " "),
        [dict(f) for f in codegen.STANDARD_LAYOUT_TYPOGRAPHY_FIELDS],
        dict(codegen.STANDARD_LAYOUT_TYPOGRAPHY_DEFAULTS),
        payload.props,
    )
    meta.setdefault("layout_prop_schema", {})[new_layout_id] = new_schema
    valid_layouts = meta.get("valid_layouts", [])
    if isinstance(valid_layouts, list) and new_layout_id not in valid_layouts:
        valid_layouts.append(new_layout_id)
        meta["valid_layouts"] = valid_layouts
    _write_meta_json(meta, meta_path)

    doc_prop_defs = [
        PropDef(name="titleFontSize", type="number", description="Title font size (portrait/landscape)"),
        PropDef(name="descriptionFontSize", type="number", description="Body font size (portrait/landscape)"),
        *payload.props,
    ]

    new_section = _build_prompt_section(new_layout_id, payload.layout_description, doc_prop_defs)
    # Generate a richer prompt.md section using AI based on the final TSX + props.
    # Fallback to the simple section if the model call fails.
    try:
        new_section = _call_layout_doc_section(
            template_id=template_id,
            layout_id=new_layout_id,
            instruction=payload.layout_description,
            tsx=content,
            props=doc_prop_defs,
            image_base64=payload.image_base64,
            image_mime_type=payload.image_mime_type,
            backend="anthropic",
        )
    except HTTPException:
        new_section = _build_prompt_section(new_layout_id, payload.layout_description, doc_prop_defs)
    prompt_path.write_text(prompt_text.rstrip() + f"\n\n---\n\n{new_section.rstrip()}\n", encoding="utf-8")

    # Update layout_prompt.md if it exists (pipeline uses it for layout catalog)
    if layout_prompt_content is not None:
        best_for = _extract_visual_from_prompt_section(new_section) or payload.layout_description
        updated_layout_prompt = _add_or_update_layout_in_layout_prompt(
            layout_prompt_content, new_layout_id, best_for
        )
        layout_prompt_path.write_text(updated_layout_prompt, encoding="utf-8")

    session_id = f"ai-{uuid.uuid4().hex}"
    created_files = [str(frontend_file), str(remotion_file)]
    session = {
        "session_id": session_id,
        "user_id": user.id,
        "template_id": template_id,
        "layout_id": new_layout_id,
        "frontend_path": str(frontend_file),
        "remotion_path": str(remotion_file),
        "version_dir": str(version_dir),
        "versions": ["v1"],
        "active_version_id": "v1",
        "session_type": "create",
        "meta_path": str(meta_path),
        "prompt_path": str(prompt_path),
        "created_files": created_files,
        "index_frontend_path": str(frontend_index),
        "index_remotion_path": str(remotion_index),
        "types_frontend_path": str(types_frontend),
        "types_remotion_path": str(types_remotion),
        "config_path": str(config_path),
        "created_at": int(time.time()),
    }
    _sync_versions_meta(session)
    _save_session(session)

    created_files_list = [
        frontend_file.relative_to(_ROOT).as_posix(),
        remotion_file.relative_to(_ROOT).as_posix(),
        meta_path.relative_to(_ROOT).as_posix(),
        prompt_path.relative_to(_ROOT).as_posix(),
    ]
    if layout_prompt_content is not None:
        created_files_list.append(layout_prompt_path.relative_to(_ROOT).as_posix())

    return {
        "ok": True,
        "session_id": session_id,
        "template_id": template_id,
        "new_layout_id": new_layout_id,
        "versions": ["v1"],
        "active_version_id": "v1",
        "created_files": created_files_list,
        "schema": new_schema,
    }


@router.post("/ai-edit/preview-file")
def preview_ai_edit_file(
    template_id: str = Form(...),
    layout_id: str = Form(...),
    instruction: str = Form(...),
    image: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
):
    b64, mime = _file_to_image_parts(image)
    payload = AiEditProposeRequest(
        template_id=template_id,
        layout_id=layout_id,
        instruction=instruction,
        image_base64=b64,
        image_mime_type=mime,
    )
    return preview_ai_edit(payload, user=user)


@router.post("/ai-layout/rebuild-file")
def rebuild_layout_file(
    template_id: str = Form(...),
    layout_id: str = Form(...),
    instruction: str = Form(...),
    extra_props_json: str = Form("[]"),
    image: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
):
    try:
        extra_props_raw = json.loads(extra_props_json or "[]")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid extra_props_json (must be JSON array).")
    extra_props = [PropDef(**p) for p in (extra_props_raw or [])]
    b64, mime = _file_to_image_parts(image)
    payload = AiLayoutRebuildRequest(
        template_id=template_id,
        layout_id=layout_id,
        instruction=instruction,
        extra_props=extra_props,
        image_base64=b64,
        image_mime_type=mime,
    )
    return rebuild_layout(payload, user=user)


@router.post("/ai-layout/create-file")
def create_layout_file(
    template_id: str = Form(...),
    base_layout_id: str = Form(...),
    new_layout_id: str = Form(...),
    layout_description: str = Form(...),
    props_json: str = Form("[]"),
    image: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
):
    try:
        props_raw = json.loads(props_json or "[]")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid props_json (must be JSON array).")
    props = [PropDef(**p) for p in (props_raw or [])]
    b64, mime = _file_to_image_parts(image)
    payload = AiLayoutCreateRequest(
        template_id=template_id,
        base_layout_id=base_layout_id,
        new_layout_id=new_layout_id,
        layout_description=layout_description,
        props=props,
        image_base64=b64,
        image_mime_type=mime,
    )
    return create_layout(payload, user=user)


@router.post("/render-layout")
def render_single_layout(payload: RenderLayoutRequest, user: User = Depends(get_current_user)):
    """
    Render a single layout as a short MP4 using remotion-video.

    This is used by Template Studio to render a one-scene demo video for the
    currently selected template/layout with default/random data.
    """
    from app.services.template_service import (
        validate_template_id,
        get_valid_layouts,
        get_preview_colors,
        get_composition_id,
        is_custom_template,
        is_crafted_template,
    )
    from app.services.remotion import provision_workspace, get_workspace_dir, _build_render_cmd, safe_remove_workspace
    import os
    import json as _json
    import shutil as _shutil
    import tempfile as _tempfile
    import subprocess as _subprocess

    template_id = validate_template_id((payload.template_id or "").strip())
    if is_custom_template(template_id) or is_crafted_template(template_id):
        raise HTTPException(status_code=400, detail="Single-layout render is not supported for custom/crafted templates.")

    layout_id = (payload.layout_id or "").strip().lower()
    if not layout_id:
        raise HTTPException(status_code=400, detail="layout_id is required.")

    valid_layouts = get_valid_layouts(template_id)
    if layout_id not in valid_layouts:
        raise HTTPException(
            status_code=400,
            detail=f"Layout '{layout_id}' is not valid for template '{template_id}'.",
        )

    aspect_ratio = (payload.aspect_ratio or "landscape").strip().lower()
    if aspect_ratio not in ("landscape", "portrait"):
        aspect_ratio = "landscape"

    # Use a synthetic project id for per-user temporary workspaces.
    synthetic_project_id = -abs(user.id or 1)

    try:
        # Ensure Remotion workspace with all template code is available.
        provision_workspace(synthetic_project_id, template_id)
        workspace = get_workspace_dir(synthetic_project_id)
        public_dir = os.path.join(workspace, "public")
        os.makedirs(public_dir, exist_ok=True)

        # Copy shared static assets (textures, fonts, etc.) from the base Remotion
        # project public/ into this workspace, so template-specific backgrounds like
        # the vintage newspaper texture are available during render.
        template_public_dir = os.path.join(settings.REMOTION_PROJECT_PATH, "public")
        if os.path.isdir(template_public_dir):
            for root, _dirs, filenames in os.walk(template_public_dir):
                for filename in filenames:
                    src = os.path.join(root, filename)
                    rel = os.path.relpath(src, template_public_dir)
                    dst = os.path.join(public_dir, rel)
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    _shutil.copy2(src, dst)

        # Build minimal data.json for a single scene.
        preview_colors = get_preview_colors(template_id) or {}
        accent = preview_colors.get("accent", "#7C3AED")
        bg = preview_colors.get("bg", "#FFFFFF")
        text = preview_colors.get("text", "#000000")

        # Use caller-provided duration if available, else default to 5 seconds.
        try:
            dur = float(payload.duration_seconds) if payload.duration_seconds is not None else 5.0
        except (TypeError, ValueError):
            dur = 5.0
        if dur <= 0:
            dur = 5.0

        # Layout props passed from Template Studio; fallback to empty dict.
        layout_props = payload.layout_props or {}

        data = {
            "projectName": f"TemplateStudio {template_id}/{layout_id}",
            "accentColor": accent,
            "bgColor": bg,
            "textColor": text,
            "heroImage": None,
            "logo": None,
            "logoPosition": "bottom_right",
            "logoOpacity": 0.9,
            "logoSize": 100.0,
            "aspectRatio": aspect_ratio,
            "scenes": [
                {
                    "id": 1,
                    "order": 1,
                    "title": "Sample Title",
                    "narration": "This is a sample narration for this layout.",
                    "layout": layout_id,
                    "layoutProps": layout_props,
                    "durationSeconds": dur,
                    "voiceoverFile": None,
                    "images": [],
                }
            ],
        }

        data_path = os.path.join(public_dir, "data.json")
        with open(data_path, "w", encoding="utf-8") as f:
            _json.dump(data, f, indent=2)

        # Remotion compositions may use defaultProps with a non-/data.json URL (e.g. BlackswanVideo
        # defaults to /blackswan.json for multi-scene Studio demos). Without --props, the CLI would
        # ignore this workspace's single-scene data.json and render the wrong manifest.
        props_path = os.path.join(public_dir, "template-studio-render-props.json")
        with open(props_path, "w", encoding="utf-8") as f:
            _json.dump({"dataUrl": "/data.json"}, f)

        # Render to a temp file and stream back to the client.
        tmp_dir = _tempfile.mkdtemp(prefix="template-studio-layout-")
        output_path = os.path.join(tmp_dir, f"{template_id}_{layout_id}.mp4")

        npx = _shutil.which("npx") or "npx"
        composition_id = get_composition_id(template_id)
        # Use caller-provided resolution if valid, else default to template-specific base:
        # 720p for whiteboard/newspaper, 1080p for all others.
        resolution = (payload.resolution or "").strip().lower()
        if resolution not in ("720p", "1080p"):
            resolution = "720p" if template_id in ("whiteboard", "newspaper","newscast") else "1080p"
        cmd = _build_render_cmd(
            npx,
            output_path,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            composition_id=composition_id,
        )
        cmd.extend(["--props", "public/template-studio-render-props.json"])

        result = _subprocess.run(
            cmd,
            cwd=workspace,
            shell=(os.name == "nt"),
            capture_output=True,
            text=False,
            timeout=600,
        )
        if result.returncode != 0 or not os.path.exists(output_path):
            stderr = (result.stderr or b"").decode("utf-8", errors="ignore")
            stdout = (result.stdout or b"").decode("utf-8", errors="ignore")
            detail = (stderr or stdout or "Unknown render error").strip()
            raise HTTPException(
                status_code=500,
                detail=f"Remotion render failed: {detail}",
            )

        filename = f"{template_id}_{layout_id}.mp4"
        return FileResponse(
            path=output_path,
            media_type="video/mp4",
            filename=filename,
        )
    finally:
        try:
            workspace = get_workspace_dir(synthetic_project_id)
            safe_remove_workspace(workspace)
        except Exception:
            # Best effort cleanup; ignore failures.
            pass


# ─── Create a brand-new built-in template from a design doc ──────────────────


@router.post("/template/plan")
def plan_template_from_doc(
    payload: PlanTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Phase 1 of template creation: normalize the design doc + extract a plan.

    No filesystem writes. The frontend shows the proposed layouts, lets the user
    uncheck unwanted ids, then calls POST /template/create with the same
    ``plan`` plus ``keep_layout_ids`` so only verified layouts are generated.
    """
    from app.services import template_studio_codegen as codegen

    db.close()

    template_id = payload.template_id.strip().lower()

    registry_path = _TEMPLATES_META_DIR / "registry.json"
    if not registry_path.exists():
        raise HTTPException(status_code=500, detail="backend/templates/registry.json missing.")
    existing_ids = json.loads(registry_path.read_text(encoding="utf-8"))
    if template_id in existing_ids and not payload.overwrite:
        raise HTTPException(status_code=409, detail=f"Template '{template_id}' already exists.")

    if not (settings.TEMPLATE_CREATION_ANTHROPIC_API_KEY or "").strip():
        raise HTTPException(
            status_code=400,
            detail="TEMPLATE_CREATION_ANTHROPIC_API_KEY is required for template planning.",
        )

    warnings: list[str] = []
    try:
        normalized_doc = codegen.normalize_design_doc(
            design_doc=payload.design_doc,
            template_id=template_id,
        )
    except HTTPException as e:
        warnings.append(f"design-doc normalization failed ({e.detail}); used the raw doc")
        normalized_doc = payload.design_doc

    plan = codegen.extract_template_plan(
        design_doc=normalized_doc,
        template_id=template_id,
    )

    return {
        "ok": True,
        "template_id": template_id,
        "name": plan.name,
        "normalized_doc": normalized_doc,
        "plan": plan.model_dump(),
        "layout_ids": [layout.id for layout in plan.layouts],
        "hero_layout": plan.hero_layout,
        "fallback_layout": plan.fallback_layout,
        "warnings": warnings,
    }


@router.post("/template/create")
def create_template_from_doc(
    payload: CreateTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a complete built-in template.

    Two entry modes:
      • `plan` supplied — optionally narrowed with `keep_layout_ids` after the
        Studio review step (subset of layouts to generate).
      • `design_doc` only (legacy) — the raw doc is normalized, then a plan is
        extracted from the normalized doc inline.

    Pipeline:
      1. Resolve the plan (see modes above).
      2. Scaffold: meta.json, prompt.md, layout_prompt.md, types.ts (frontend + remotion-video).
      3. Per-layout codegen (Claude, sequential). Each call is self-contained —
         no base-template reference TSX; the plan must carry everything.
      4. Composition TSX (templated) + layouts/index.ts (templated).
      5. Preview component (templated) + registry edits (templateConfig.tsx,
         templatePreviewRegistry.tsx, registry.json).
      5.5. Full-template TSX verification — type-check the new template with
         the real tsconfig; auto-repair failing layouts (up to 2 rounds), then
         stub any that still fail.
      6. Enrich prompt.md / layout_prompt.md per-layout.

    On any hard failure, all touched files are restored from their snapshot.
    """
    from app.services import template_studio_codegen as codegen

    # Auth already happened via get_current_user. The codegen loop runs for
    # minutes, which is long enough for a remote Postgres (e.g. Supabase) to
    # drop the idle SSL connection — the teardown rollback then 500s. Close
    # the session now; we don't touch the DB again in this endpoint.
    db.close()

    template_id = payload.template_id.strip().lower()

    # ── Validation
    registry_path = _TEMPLATES_META_DIR / "registry.json"
    if not registry_path.exists():
        raise HTTPException(status_code=500, detail="backend/templates/registry.json missing.")
    existing_ids = json.loads(registry_path.read_text(encoding="utf-8"))
    if template_id in existing_ids and not payload.overwrite:
        raise HTTPException(status_code=409, detail=f"Template '{template_id}' already exists.")

    if not (settings.TEMPLATE_CREATION_ANTHROPIC_API_KEY or "").strip():
        raise HTTPException(
            status_code=400,
            detail="TEMPLATE_CREATION_ANTHROPIC_API_KEY is required for template creation.",
        )

    # ── Step 1: resolve the template plan
    warnings: list[str] = []
    raw_design_doc = (payload.design_doc or "").strip()
    normalized_doc = (payload.normalized_doc or "").strip()

    if payload.plan is not None:
        # Phase-2 call from /template/plan: build exactly the plan the user saw.
        try:
            plan = codegen.TemplatePlan(**payload.plan)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid plan payload: {e}")
        if payload.keep_layout_ids is not None:
            if len(payload.keep_layout_ids) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="keep_layout_ids must not be empty when provided.",
                )
            plan = codegen.filter_plan_layouts(plan, payload.keep_layout_ids)
        else:
            codegen.validate_plan(plan, status_code=400)
    else:
        # Legacy path: normalize the raw doc, then extract a plan from it.
        try:
            normalized_doc = codegen.normalize_design_doc(
                design_doc=raw_design_doc,
                template_id=template_id,
            )
        except HTTPException as e:
            warnings.append(f"design-doc normalization failed ({e.detail}); used the raw doc")
            normalized_doc = raw_design_doc
        plan = codegen.extract_template_plan(
            design_doc=normalized_doc,
            template_id=template_id,
        )

    # Snake -> Pascal name maps
    pascal = codegen.snake_to_pascal(template_id)
    type_name = f"{pascal}LayoutType"
    registry_name = f"{template_id.upper()}_LAYOUT_REGISTRY"
    pascal_names = {layout.id: codegen.snake_to_pascal(layout.id) for layout in plan.layouts}
    composition_id = f"{pascal}Video"

    # ── Path resolution
    backend_dir = _TEMPLATES_META_DIR / template_id
    frontend_dir = _FRONTEND_REMOTION_DIR / template_id
    frontend_layouts_dir = frontend_dir / "layouts"
    remotion_dir = _REMOTION_VIDEO_DIR / template_id
    remotion_layouts_dir = remotion_dir / "layouts"
    preview_path = _FRONTEND_REMOTION_DIR.parent / "templatePreviews" / f"{pascal}Preview.tsx"
    config_path = _FRONTEND_REMOTION_DIR / "templateConfig.tsx"
    preview_registry_path = _FRONTEND_REMOTION_DIR.parent / "templatePreviewRegistry.tsx"
    root_tsx_path = _REMOTION_VIDEO_DIR.parent / "Root.tsx"

    # All paths that may be created or modified
    paths_to_snapshot = [
        registry_path,
        config_path,
        preview_registry_path,
        root_tsx_path,
        backend_dir / "meta.json",
        backend_dir / "prompt.md",
        backend_dir / "layout_prompt.md",
        frontend_dir / "types.ts",
        frontend_dir / f"{pascal}VideoComposition.tsx",
        frontend_layouts_dir / "index.ts",
        remotion_dir / "types.ts",
        remotion_dir / f"{pascal}Video.tsx",
        remotion_layouts_dir / "index.ts",
        preview_path,
    ]
    for layout in plan.layouts:
        stem = pascal_names[layout.id]
        paths_to_snapshot.append(frontend_layouts_dir / f"{stem}.tsx")
        paths_to_snapshot.append(remotion_layouts_dir / f"{stem}.tsx")

    snaps = codegen.snapshot_files(paths_to_snapshot)
    created_dirs: list[Path] = []

    def _rollback() -> None:
        codegen.restore_files(snaps)
        # Remove dirs that we created and that are now empty.
        for d in reversed(created_dirs):
            try:
                d.rmdir()
            except OSError:
                pass

    try:
        # ── Step 2: scaffold directories
        for d in (backend_dir, frontend_dir, frontend_layouts_dir, remotion_dir, remotion_layouts_dir):
            if not d.exists():
                d.mkdir(parents=True, exist_ok=True)
                created_dirs.append(d)

        # types.ts (frontend + remotion-video share the same shape)
        types_ts = codegen.build_types_ts(plan, type_name=type_name)
        (frontend_dir / "types.ts").write_text(types_ts, encoding="utf-8")
        (remotion_dir / "types.ts").write_text(types_ts, encoding="utf-8")

        # meta.json
        meta = codegen.build_meta_json(plan=plan, template_id=template_id, composition_id=composition_id)
        _write_meta_json(meta, backend_dir / "meta.json")

        # prompt.md / layout_prompt.md scaffolds
        (backend_dir / "prompt.md").write_text(codegen.build_prompt_md_header(plan), encoding="utf-8")
        (backend_dir / "layout_prompt.md").write_text(
            codegen.build_layout_prompt_md_header(template_id), encoding="utf-8",
        )

        # ── Step 3: per-layout codegen (self-contained prompts; no base-template anchor)
        def _layout_codegen_prompt(lyt) -> str:
            return codegen.build_layout_codegen_prompt(
                template_id=template_id,
                template_name=plan.name,
                template_description=plan.description,
                accent_color=plan.preview_colors.get("accent", "#7C3AED"),
                bg_color=plan.preview_colors.get("bg", "#FFFFFF"),
                text_color=plan.preview_colors.get("text", "#000000"),
                layout=lyt,
                pascal_name=pascal_names[lyt.id],
                design_notes=plan.design_notes,
            )

        for layout in plan.layouts:
            pascal_layout = pascal_names[layout.id]
            instruction = _layout_codegen_prompt(layout)

            try:
                tsx = _call_code_edit(
                    instruction=instruction,
                    current_code="",
                    template_id=template_id,
                    layout_id=layout.id,
                    backend="anthropic",
                )
            except HTTPException as e:
                warnings.append(f"layout {layout.id}: AI codegen failed ({e.detail}); wrote stub")
                tsx = _build_stub_layout_tsx(pascal_layout)

            content = tsx.rstrip() + "\n"
            (frontend_layouts_dir / f"{pascal_layout}.tsx").write_text(content, encoding="utf-8")
            (remotion_layouts_dir / f"{pascal_layout}.tsx").write_text(content, encoding="utf-8")

        # ── Step 4: composition + layouts index
        layout_ids = [layout.id for layout in plan.layouts]
        index_ts = codegen.build_layouts_index_ts(
            layout_ids=layout_ids,
            pascal_names=pascal_names,
            type_name=type_name,
            registry_name=registry_name,
        )
        (frontend_layouts_dir / "index.ts").write_text(index_ts, encoding="utf-8")
        (remotion_layouts_dir / "index.ts").write_text(index_ts, encoding="utf-8")

        (frontend_dir / f"{pascal}VideoComposition.tsx").write_text(
            codegen.build_frontend_composition_tsx(
                plan=plan, pascal=pascal, type_name=type_name, registry_name=registry_name,
            ),
            encoding="utf-8",
        )
        (remotion_dir / f"{pascal}Video.tsx").write_text(
            codegen.build_remotion_video_tsx(
                plan=plan, pascal=pascal, type_name=type_name, registry_name=registry_name,
            ),
            encoding="utf-8",
        )

        # ── Step 5: preview + registry edits
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        preview_path.write_text(codegen.build_preview_tsx(plan, pascal), encoding="utf-8")

        codegen.append_template_to_registry_json(registry_path, template_id)
        codegen.insert_template_in_template_config(
            config_path=config_path,
            template_id=template_id,
            pascal=pascal,
            layouts=layout_ids,
            colors=plan.preview_colors,
            base_width=plan.base_width,
            base_height=plan.base_height,
            hero_layout=plan.hero_layout,
            fallback_layout=plan.fallback_layout,
        )
        codegen.insert_template_in_preview_registry(
            preview_registry_path=preview_registry_path,
            template_id=template_id,
            pascal=pascal,
            title=plan.name,
            subtitle=plan.subtitle or plan.description.split(".")[0][:60],
        )
        # Register the composition in Root.tsx so the Remotion renderer can
        # resolve it — without this, rendering fails with "Could not find
        # composition with ID {Pascal}Video".
        codegen.insert_template_in_root_tsx(
            root_tsx_path=root_tsx_path,
            template_id=template_id,
            pascal=pascal,
            base_width=plan.base_width,
            base_height=plan.base_height,
        )

        # ── Step 5.5: full-template TSX verification + auto-repair
        # Type-check the new template with the real tsconfig (imports + cross-
        # file types resolve). Failing layouts are repaired by the AI for up to
        # 2 rounds; any still invalid are replaced with a safe stub.
        verification: dict = {
            "ok": True,
            "checked": list(layout_ids),
            "repaired": [],
            "stubbed": [],
            "errors": {},
        }
        layouts_by_id = {layout.id: layout for layout in plan.layouts}

        def _write_layout_tsx(lid: str, code: str) -> None:
            stem = pascal_names[lid]
            body = code.rstrip() + "\n"
            (frontend_layouts_dir / f"{stem}.tsx").write_text(body, encoding="utf-8")
            (remotion_layouts_dir / f"{stem}.tsx").write_text(body, encoding="utf-8")

        tc = codegen.run_template_typecheck(root=_ROOT, template_id=template_id, scope="frontend")
        for _repair_round in range(2):
            if tc["ok"]:
                break
            failing: dict[str, list[str]] = {}
            for relpath, errs in tc["errors_by_file"].items():
                lid = codegen.tsx_file_to_layout_id(relpath, pascal_names)
                if lid in layouts_by_id:
                    failing.setdefault(lid, []).extend(errs)
            if not failing:
                break  # only non-layout templated files erred — cannot AI-repair
            for lid, errs in failing.items():
                stem = pascal_names[lid]
                broken = (frontend_layouts_dir / f"{stem}.tsx").read_text(encoding="utf-8")
                repair_instruction = (
                    _layout_codegen_prompt(layouts_by_id[lid])
                    + "\n\nThe previous attempt FAILED TypeScript verification with "
                    "these errors:\n"
                    + "\n".join(errs[:30])
                    + "\n\nReturn the corrected full TSX file with every error fixed."
                )
                try:
                    fixed = _call_code_edit(
                        instruction=repair_instruction,
                        current_code=broken,
                        template_id=template_id,
                        layout_id=lid,
                        backend="anthropic",
                    )
                    _write_layout_tsx(lid, fixed)
                    if lid not in verification["repaired"]:
                        verification["repaired"].append(lid)
                except HTTPException:
                    pass  # leave broken; the next round or stubbing handles it
            tc = codegen.run_template_typecheck(root=_ROOT, template_id=template_id, scope="frontend")

        # Stub any layout still failing; record non-layout errors as warnings.
        if not tc["ok"]:
            for relpath, errs in tc["errors_by_file"].items():
                lid = codegen.tsx_file_to_layout_id(relpath, pascal_names)
                if lid in layouts_by_id:
                    _write_layout_tsx(lid, _build_stub_layout_tsx(pascal_names[lid]))
                    if lid in verification["repaired"]:
                        verification["repaired"].remove(lid)
                    if lid not in verification["stubbed"]:
                        verification["stubbed"].append(lid)
                    warnings.append(
                        f"layout {lid}: still invalid TSX after repair; replaced with a stub"
                    )
                else:
                    verification["errors"][relpath] = errs
                    warnings.append(f"verification: unresolved TypeScript errors in {relpath}")

        # Final remotion-video pass — covers the deterministic <Pascal>Video.tsx.
        tc_remotion = codegen.run_template_typecheck(
            root=_ROOT, template_id=template_id, scope="remotion",
        )
        if not tc_remotion["ok"]:
            for relpath, errs in tc_remotion["errors_by_file"].items():
                verification["errors"].setdefault(relpath, errs)
                warnings.append(
                    f"verification (remotion-video): TypeScript errors in {relpath}"
                )

        verification["ok"] = not verification["stubbed"] and not verification["errors"]

        # ── Step 6: enrich prompt.md sections per-layout (best-effort)
        prompt_path_obj = backend_dir / "prompt.md"
        prompt_text = prompt_path_obj.read_text(encoding="utf-8")
        layout_prompt_text = (backend_dir / "layout_prompt.md").read_text(encoding="utf-8")
        for layout in plan.layouts:
            pascal_layout = pascal_names[layout.id]
            tsx = (frontend_layouts_dir / f"{pascal_layout}.tsx").read_text(encoding="utf-8")
            prop_defs = [
                PropDef(name=p.name, type=p.type, description=p.description or "", default=p.default)
                for p in layout.props
            ]
            try:
                section = _call_layout_doc_section(
                    template_id=template_id,
                    layout_id=layout.id,
                    instruction=layout.visual,
                    tsx=tsx,
                    props=prop_defs,
                    backend="anthropic",
                )
            except HTTPException:
                section = _build_prompt_section(layout.id, layout.visual, prop_defs)
            prompt_text = prompt_text.rstrip() + f"\n\n---\n\n{section.rstrip()}\n"
            layout_prompt_text = _add_or_update_layout_in_layout_prompt(
                layout_prompt_text, layout.id, layout.best_for or layout.visual,
            )
        prompt_path_obj.write_text(prompt_text, encoding="utf-8")
        (backend_dir / "layout_prompt.md").write_text(layout_prompt_text, encoding="utf-8")

        # ── Session for rollback via /ai-edit/preview-discard
        session_id = f"ai-{uuid.uuid4().hex}"
        version_dir = _AI_TMP_DIR / str(user.id) / template_id / "_create_template"
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "snapshots.json").write_text(
            json.dumps(snaps, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        # Persist creation artifacts for debugging / re-runs.
        if raw_design_doc:
            (version_dir / "raw_design_doc.md").write_text(raw_design_doc, encoding="utf-8")
        if normalized_doc:
            (version_dir / "normalized_design_doc.md").write_text(normalized_doc, encoding="utf-8")
        (version_dir / "plan.json").write_text(
            json.dumps(plan.model_dump(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        (version_dir / "verification.json").write_text(
            json.dumps(verification, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        created_files_rel = [
            p.relative_to(_ROOT).as_posix()
            for p in paths_to_snapshot
            if Path(p).exists()
        ]
        return {
            "ok": True,
            "session_id": session_id,
            "template_id": template_id,
            "name": plan.name,
            "layout_ids": layout_ids,
            "hero_layout": plan.hero_layout,
            "fallback_layout": plan.fallback_layout,
            "created_files": created_files_rel,
            "normalized_doc": normalized_doc,
            "verification": verification,
            "warnings": warnings,
            "note": (
                "Generated. Restart the frontend dev server so the new imports in "
                "templateConfig.tsx / templatePreviewRegistry.tsx are picked up."
            ),
        }
    except HTTPException:
        _rollback()
        raise
    except Exception as e:
        _rollback()
        raise HTTPException(status_code=500, detail=f"Template creation failed: {e}")


@router.post("/template/extract-doc")
def extract_design_doc(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """Extract text from an uploaded design-doc file (PDF, DOCX, PPTX, MD, TXT,
    VTT, JSON, HTML, RTF, etc.) and return it as a markdown string suitable
    for the design-doc textarea on the New Template tab."""
    from app.services.doc_extractor import extract_text_from_upload

    if file.size is not None and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB).")

    text = extract_text_from_upload(file)
    if len(text) > 40_000:
        # The design_doc field has a 40k cap on the JSON endpoint; truncate
        # rather than fail outright so the user can edit it down.
        text = text[:40_000]
    return {"ok": True, "filename": file.filename, "text": text}


def _build_stub_layout_tsx(pascal_name: str) -> str:
    """Minimal valid TSX used as a fallback when per-layout AI codegen fails."""
    return (
        'import React from "react";\n'
        'import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";\n'
        'import { SceneLayoutProps } from "../types";\n\n'
        f"export const {pascal_name}: React.FC<SceneLayoutProps> = ({{ title, narration, accentColor, bgColor, textColor, aspectRatio, titleFontSize, descriptionFontSize, fontFamily }}) => {{\n"
        '  const p = aspectRatio === "portrait";\n'
        "  const frame = useCurrentFrame();\n"
        "  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: \"clamp\" });\n"
        "  return (\n"
        "    <AbsoluteFill style={{ backgroundColor: bgColor, color: textColor, fontFamily, padding: 80, opacity, display: \"flex\", flexDirection: \"column\", justifyContent: \"center\" }}>\n"
        "      <h1 style={{ color: accentColor, fontSize: titleFontSize ?? (p ? 92 : 76), margin: 0 }}>{title}</h1>\n"
        "      <p style={{ fontSize: descriptionFontSize ?? (p ? 52 : 40), marginTop: 24 }}>{narration}</p>\n"
        "    </AbsoluteFill>\n"
        "  );\n"
        "};\n"
    )
