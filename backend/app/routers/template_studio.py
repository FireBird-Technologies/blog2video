import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
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


_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_FRONTEND_REMOTION_DIR = _ROOT / "frontend" / "src" / "components" / "remotion"
_REMOTION_VIDEO_DIR = _ROOT / "remotion-video" / "src" / "templates"
_TEMPLATES_META_DIR = _ROOT / "backend" / "templates"


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
