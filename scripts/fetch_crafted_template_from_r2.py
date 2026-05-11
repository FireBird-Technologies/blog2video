import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import r2_storage


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download a crafted template package from R2 and restore it into "
            "local source folders (backend/templates, frontend/src/components/remotion, "
            "remotion-video/src/templates, plus merged static files under frontend/public "
            "and remotion-video/public)."
        )
    )
    parser.add_argument("--template-id", required=True, help="Local template id to restore into.")
    parser.add_argument(
        "--r2-prefix",
        required=True,
        help="R2 prefix used when uploading crafted package (for example: crafted-templates/foo-20260506-123000).",
    )
    parser.add_argument(
        "--manifest-path",
        help="Optional explicit manifest key. Defaults to <r2-prefix>/manifest.json.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwriting existing local files.",
    )
    return parser.parse_args()


def _strip_prefix(path: str, prefix: str) -> str:
    rel = path.replace("\\", "/").lstrip("/")
    pfx = prefix.strip("/").replace("\\", "/")
    if rel.startswith(pfx + "/"):
        return rel[len(pfx) + 1 :]
    return rel


def _safe_write_text(path: Path, content: str, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"Refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _safe_write_bytes(path: Path, content: bytes, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"Refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _download_text_required(key: str) -> str:
    text = r2_storage.download_text(key)
    if text is None:
        raise FileNotFoundError(f"Missing R2 object: {key}")
    return text


def _download_bytes_required(key: str) -> bytes:
    blob = r2_storage.download_bytes(key)
    if blob is None:
        raise FileNotFoundError(f"Missing R2 object: {key}")
    return blob


def _resolve_section_files(manifest: dict, section: str, default_prefix: str) -> list[str]:
    section_obj = manifest.get(section) if isinstance(manifest.get(section), dict) else {}
    files = section_obj.get("files", [])
    out: list[str] = []
    if isinstance(files, list):
        out.extend([str(p) for p in files if isinstance(p, str)])
    # Fallback for older manifests: infer from top-level files index.
    if not out:
        files_index = manifest.get("files", {})
        if isinstance(files_index, dict):
            out.extend([k for k in files_index.keys() if isinstance(k, str) and k.replace("\\", "/").startswith(default_prefix + "/")])
    # Unique + stable order
    dedup: list[str] = []
    seen = set()
    for p in out:
        norm = p.replace("\\", "/").lstrip("/")
        if norm in seen:
            continue
        seen.add(norm)
        dedup.append(norm)
    return dedup


def main() -> None:
    args = parse_args()
    template_id = args.template_id.strip()
    if not template_id:
        raise ValueError("template-id is required")

    r2_prefix = args.r2_prefix.strip().strip("/")
    if not r2_prefix:
        raise ValueError("r2-prefix is required")

    manifest_key = (args.manifest_path or f"{r2_prefix}/manifest.json").strip().strip("/")
    manifest = r2_storage.download_json(manifest_key)
    if not manifest:
        raise FileNotFoundError(f"Could not download manifest: {manifest_key}")

    backend_target = REPO_ROOT / "backend" / "templates" / template_id
    frontend_target = REPO_ROOT / "frontend" / "src" / "components" / "remotion" / template_id
    remotion_target = REPO_ROOT / "remotion-video" / "src" / "templates" / template_id

    backend_obj = manifest.get("backend") if isinstance(manifest.get("backend"), dict) else {}
    meta_key = str(backend_obj.get("meta", "backend/meta.json"))
    prompt_key = str(backend_obj.get("prompt", "backend/prompt.md"))
    layout_prompt_key = str(backend_obj.get("layout_prompt", "backend/layout_prompt.md"))

    meta_text = _download_text_required(f"{r2_prefix}/{_strip_prefix(meta_key, r2_prefix)}")
    prompt_text = _download_text_required(f"{r2_prefix}/{_strip_prefix(prompt_key, r2_prefix)}")
    layout_prompt_text = _download_text_required(f"{r2_prefix}/{_strip_prefix(layout_prompt_key, r2_prefix)}")

    _safe_write_text(backend_target / "meta.json", meta_text, args.overwrite)
    _safe_write_text(backend_target / "prompt.md", prompt_text, args.overwrite)
    _safe_write_text(backend_target / "layout_prompt.md", layout_prompt_text, args.overwrite)

    frontend_files = _resolve_section_files(manifest, "frontend", "frontend")
    remotion_files = _resolve_section_files(manifest, "remotion", "remotion-video")

    restored_frontend = 0
    for rel in frontend_files:
        rel_norm = rel.replace("\\", "/").lstrip("/")
        if not rel_norm.startswith("frontend/"):
            continue
        body = _download_text_required(f"{r2_prefix}/{_strip_prefix(rel_norm, r2_prefix)}")
        local_rel = rel_norm[len("frontend/") :]
        _safe_write_text(frontend_target / local_rel, body, args.overwrite)
        restored_frontend += 1

    restored_remotion = 0
    for rel in remotion_files:
        rel_norm = rel.replace("\\", "/").lstrip("/")
        if not rel_norm.startswith("remotion-video/"):
            continue
        body = _download_text_required(f"{r2_prefix}/{_strip_prefix(rel_norm, r2_prefix)}")
        local_rel = rel_norm[len("remotion-video/") :]
        _safe_write_text(remotion_target / local_rel, body, args.overwrite)
        restored_remotion += 1

    frontend_public = REPO_ROOT / "frontend" / "public"
    remotion_public = REPO_ROOT / "remotion-video" / "public"
    files_index = manifest.get("files", {})
    restored_public = 0
    if isinstance(files_index, dict):
        for rel_key in sorted(files_index.keys()):
            if not isinstance(rel_key, str):
                continue
            rel_norm = rel_key.replace("\\", "/").lstrip("/")
            if not rel_norm.startswith("public/"):
                continue
            inner = rel_norm[len("public/") :]
            parts = inner.split("/")
            if not inner or ".." in parts or any(not p for p in parts):
                continue
            blob = _download_bytes_required(f"{r2_prefix}/{_strip_prefix(rel_norm, r2_prefix)}")
            _safe_write_bytes(frontend_public / inner, blob, args.overwrite)
            _safe_write_bytes(remotion_public / inner, blob, args.overwrite)
            restored_public += 1

    print(json.dumps(
        {
            "template_id": template_id,
            "manifest_key": manifest_key,
            "backend_dir": str(backend_target),
            "frontend_dir": str(frontend_target),
            "remotion_dir": str(remotion_target),
            "restored_frontend_files": restored_frontend,
            "restored_remotion_files": restored_remotion,
            "restored_public_files": restored_public,
        },
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()
