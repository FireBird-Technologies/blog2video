import re
import shutil
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


class AiEditPreviewSwitchRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)
    version: str = Field(min_length=1, max_length=64)


class AiEditVersionsRequest(BaseModel):
    template_id: str
    layout_id: str


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

    # Base code for Gemini is always whatever is currently in the frontend file.
    # This reflects the currently selected version in the preview.
    current_code = frontend_target.read_text(encoding="utf-8")

    # Reuse an existing session for this user+template+layout, if one exists.
    session: dict | None = _get_user_layout_session(user, template_id, layout_id)

    proposed_code = _call_gemini_code_edit(
        instruction=payload.instruction.strip(),
        current_code=current_code,
        template_id=template_id,
        layout_id=layout_id,
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
    version_file = _get_version_file(session, version)
    content = version_file.read_text(encoding="utf-8")
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
    frontend_path.write_text(content, encoding="utf-8")
    remotion_path.write_text(content, encoding="utf-8")
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
    version_file = _get_version_file(session, active_version)
    content = version_file.read_text(encoding="utf-8")
    frontend_path = Path(session["frontend_path"])
    remotion_path = Path(session["remotion_path"])
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
    if not version_dir.exists():
        return {
            "ok": True,
            "session_id": None,
            "template_id": template_id,
            "layout_id": layout_id,
            "versions": [],
            "active_version_id": None,
        }

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
