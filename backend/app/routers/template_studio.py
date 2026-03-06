import re
import time
import uuid
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter(prefix="/api/template-studio", tags=["template-studio"])


class AspectValue(BaseModel):
    portrait: int = Field(ge=12, le=240)
    landscape: int = Field(ge=12, le=240)


class SaveSourceRequest(BaseModel):
    template_id: str
    layout_id: str
    title_font_size: AspectValue | None = None
    description_font_size: AspectValue | None = None


class AiEditProposeRequest(BaseModel):
    template_id: str
    layout_id: str
    instruction: str = Field(min_length=5, max_length=6000)


class AiEditApplyRequest(BaseModel):
    template_id: str
    layout_id: str
    proposed_code: str = Field(min_length=20, max_length=300000)


class AiEditSessionActionRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)


_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_FRONTEND_REMOTION_DIR = _ROOT / "frontend" / "src" / "components" / "remotion"
_REMOTION_VIDEO_DIR = _ROOT / "remotion-video" / "src" / "templates"
_TEMPLATES_META_DIR = _ROOT / "backend" / "templates"
_AI_TMP_DIR = _ROOT / "backend" / "tmp" / "template_studio_ai_edits"
_AI_PREVIEW_SESSIONS: dict[str, dict] = {}
_AI_SESSION_LOCK = Lock()


def _replace_responsive_expr(source: str, key: str, portrait: int, landscape: int) -> tuple[str, int]:
    pattern = re.compile(rf"{key}\s*\?\?\s*\(p\s*\?\s*\d+\s*:\s*\d+\)")
    replaced, count = pattern.subn(f"{key} ?? (p ? {portrait} : {landscape})", source)
    return replaced, count


def _replace_static_expr(source: str, key: str, portrait: int, landscape: int) -> tuple[str, int]:
    pattern = re.compile(rf"{key}\s*\?\?\s*\d+")
    replaced, count = pattern.subn(f"{key} ?? (p ? {portrait} : {landscape})", source)
    return replaced, count


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
    pattern = re.compile(r"const\s+baseDescSize\s*=\s*p\s*\?\s*\d+\s*:\s*\d+;")
    return pattern.subn(f"const baseDescSize = p ? {portrait} : {landscape};", source)


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


def _call_gemini_code_edit(instruction: str, current_code: str, template_id: str, layout_id: str) -> str:
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured.")
    try:
        from google import genai
    except Exception as e:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail=f"Gemini code edit requires google-genai package: {e}",
        )

    model_name = (getattr(settings, "GEMINI_CODE_MODEL", "") or "gemini-2.5-flash").strip()
    client = genai.Client(api_key=api_key)

    prompt = (
        "You are editing a React TSX component file used in a video template system.\n"
        "Return ONLY the full updated file contents for this single component.\n"
        "Do not include markdown fences, explanations, or extra text.\n\n"
        f"Template ID: {template_id}\n"
        f"Layout ID: {layout_id}\n\n"
        "User instruction:\n"
        f"{instruction}\n\n"
        "Current file content:\n"
        f"{current_code}"
    )
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
    )
    text = getattr(response, "text", "") or ""
    code = _extract_code_from_model_output(text)
    if not code:
        raise HTTPException(status_code=502, detail="Gemini returned empty code output.")
    if "export" not in code:
        raise HTTPException(status_code=502, detail="Gemini output does not look like a component file.")
    return code


def _session_key_for_user(user: User) -> str:
    return f"user:{user.id}"


def _cleanup_session(session: dict, restore_original: bool) -> None:
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
    if restore_original:
        frontend_path.write_text(session["frontend_original"], encoding="utf-8")
        remotion_path.write_text(session["remotion_original"], encoding="utf-8")
    temp_path = Path(session["temp_code_path"])
    if temp_path.exists():
        temp_path.unlink()


def _drop_existing_user_session(user: User, restore_original: bool = True) -> None:
    with _AI_SESSION_LOCK:
        key = _session_key_for_user(user)
        existing = _AI_PREVIEW_SESSIONS.pop(key, None)
    if existing:
        _cleanup_session(existing, restore_original=restore_original)


def _create_preview_session(
    user: User,
    template_id: str,
    layout_id: str,
    frontend_target: Path,
    remotion_target: Path,
    proposed_code: str,
) -> dict:
    _drop_existing_user_session(user, restore_original=True)
    _AI_TMP_DIR.mkdir(parents=True, exist_ok=True)
    session_id = f"ai-{uuid.uuid4().hex}"
    temp_path = _AI_TMP_DIR / f"{session_id}.tsx"
    content = proposed_code.rstrip() + "\n"
    frontend_original = frontend_target.read_text(encoding="utf-8")
    remotion_original = remotion_target.read_text(encoding="utf-8")

    temp_path.write_text(content, encoding="utf-8")
    frontend_target.write_text(content, encoding="utf-8")
    remotion_target.write_text(content, encoding="utf-8")

    session = {
        "session_id": session_id,
        "user_id": user.id,
        "template_id": template_id,
        "layout_id": layout_id,
        "frontend_path": str(frontend_target),
        "remotion_path": str(remotion_target),
        "frontend_original": frontend_original,
        "remotion_original": remotion_original,
        "temp_code_path": str(temp_path),
        "created_at": int(time.time()),
    }
    with _AI_SESSION_LOCK:
        _AI_PREVIEW_SESSIONS[_session_key_for_user(user)] = session
    return session


def _get_user_session_or_404(user: User, session_id: str) -> dict:
    with _AI_SESSION_LOCK:
        session = _AI_PREVIEW_SESSIONS.get(_session_key_for_user(user))
    if not session or session.get("session_id") != session_id:
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
    proposed_code = _call_gemini_code_edit(
        instruction=payload.instruction.strip(),
        current_code=original_code,
        template_id=template_id,
        layout_id=layout_id,
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

    original_code = frontend_target.read_text(encoding="utf-8")
    proposed_code = _call_gemini_code_edit(
        instruction=payload.instruction.strip(),
        current_code=original_code,
        template_id=template_id,
        layout_id=layout_id,
    )
    session = _create_preview_session(
        user=user,
        template_id=template_id,
        layout_id=layout_id,
        frontend_target=frontend_target,
        remotion_target=remotion_target,
        proposed_code=proposed_code,
    )
    return {
        "ok": True,
        "session_id": session["session_id"],
        "template_id": template_id,
        "layout_id": layout_id,
        "preview_files": [
            frontend_target.relative_to(_ROOT).as_posix(),
            remotion_target.relative_to(_ROOT).as_posix(),
        ],
    }


@router.post("/ai-edit/preview-apply")
def apply_ai_preview(payload: AiEditSessionActionRequest, user: User = Depends(get_current_user)):
    session = _get_user_session_or_404(user, payload.session_id)
    temp_path = Path(session["temp_code_path"])
    if not temp_path.exists():
        raise HTTPException(status_code=400, detail="Temporary preview code no longer exists.")
    content = temp_path.read_text(encoding="utf-8")
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
    frontend_path.write_text(content, encoding="utf-8")
    remotion_path.write_text(content, encoding="utf-8")
    _drop_existing_user_session(user, restore_original=False)
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
    _get_user_session_or_404(user, payload.session_id)
    _drop_existing_user_session(user, restore_original=True)
    return {"ok": True, "session_id": payload.session_id}
