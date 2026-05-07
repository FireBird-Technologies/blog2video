import argparse
import hashlib
import json
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import r2_storage
from app.config import settings


def crafted_r2_namespace_prefix() -> str:
    return str(getattr(settings, "CRAFTED_TEMPLATE_R2_PREFIX", "") or "").strip().strip("/")


def apply_crafted_r2_namespace(prefix: str) -> str:
    normalized = str(prefix or "").strip().strip("/")
    ns = crafted_r2_namespace_prefix()
    if not ns:
        return normalized
    if not normalized:
        return ns
    if normalized == ns or normalized.startswith(f"{ns}/"):
        return normalized
    return f"{ns}/{normalized}"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_tree(src_dir: Path, dst_dir: Path) -> None:
    if not src_dir.exists():
        return
    for src in src_dir.rglob("*"):
        if not src.is_file():
            continue
        rel = src.relative_to(src_dir)
        dst = dst_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def first_existing(*paths: Path) -> Path | None:
    for p in paths:
        if p.exists():
            return p
    return None


def infer_frontend_entry(frontend_dir: Path) -> str:
    candidates = sorted(frontend_dir.glob("*VideoComposition.tsx"))
    if candidates:
        return f"frontend/{candidates[0].name}"
    fallback = first_existing(frontend_dir / "TemplateVideoComposition.tsx", frontend_dir / "index.tsx")
    if fallback:
        return f"frontend/{fallback.name}"
    return "frontend/TemplateVideoComposition.tsx"


def infer_remotion_entry(remotion_dir: Path, composition_id: str | None) -> str:
    if composition_id:
        preferred = remotion_dir / f"{composition_id}.tsx"
        if preferred.exists():
            return f"remotion-video/{preferred.name}"
    candidates = sorted(remotion_dir.glob("*Video.tsx"))
    if candidates:
        return f"remotion-video/{candidates[0].name}"
    fallback = first_existing(remotion_dir / "TemplateVideo.tsx", remotion_dir / "index.tsx")
    if fallback:
        return f"remotion-video/{fallback.name}"
    return "remotion-video/TemplateVideo.tsx"


def gather_files_map(bundle_dir: Path) -> dict[str, dict[str, str | int]]:
    out: dict[str, dict[str, str | int]] = {}
    for p in sorted(bundle_dir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(bundle_dir).as_posix()
        out[rel] = {"size": p.stat().st_size, "sha256": sha256_file(p)}
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bundle a built-in template into crafted package and upload to R2.")
    parser.add_argument("--template-id", required=True, help="Built-in template id (for example: nightfall, default).")
    parser.add_argument("--template-key", help="Crafted template_key. Default: <template-id>_bundle")
    parser.add_argument("--public-template-id", help="Crafted public id. Default: crafted_<template-id>_bundle")
    parser.add_argument("--supported-video-style", default="explainer", help="explainer|promotional|storytelling")
    parser.add_argument("--upload", action="store_true", help="Upload bundle files to R2. If omitted, only creates local bundle.")
    parser.add_argument("--r2-prefix", help="Optional explicit R2 prefix.")
    parser.add_argument(
        "--replace-existing",
        action="store_true",
        help=(
            "Replace an existing crafted bundle in-place on R2 using the same prefix "
            "(stable URLs/manifest path). Requires --upload and --r2-prefix."
        ),
    )
    parser.add_argument(
        "--prune-source-after-bundle",
        action="store_true",
        help=(
            "After bundle (and upload if enabled), remove local source folders for this template "
            "from backend/frontend/remotion codebase."
        ),
    )
    return parser.parse_args()


def _list_r2_keys(prefix: str) -> list[str]:
    bucket = settings.R2_BUCKET_NAME
    if not bucket:
        return []
    client = r2_storage._get_client()
    keys: list[str] = []
    token: str | None = None
    while True:
        kwargs = {
            "Bucket": bucket,
            "Prefix": prefix.strip().strip("/") + "/",
            "MaxKeys": 1000,
        }
        if token:
            kwargs["ContinuationToken"] = token
        resp = client.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []) or []:
            key = obj.get("Key")
            if isinstance(key, str):
                keys.append(key)
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
        if not isinstance(token, str):
            break
    return keys


def main() -> None:
    args = parse_args()
    template_id = str(args.template_id).strip().lower()
    if not template_id:
        raise ValueError("template-id is required")

    if args.replace_existing and not args.upload:
        raise ValueError("--replace-existing requires --upload")
    if args.replace_existing and not (isinstance(args.r2_prefix, str) and args.r2_prefix.strip()):
        raise ValueError("--replace-existing requires --r2-prefix")

    existing_manifest = None
    existing_prefix_raw = args.r2_prefix.strip().strip("/") if isinstance(args.r2_prefix, str) and args.r2_prefix.strip() else ""
    existing_prefix = apply_crafted_r2_namespace(existing_prefix_raw)
    if args.replace_existing:
        existing_manifest = r2_storage.download_json(f"{existing_prefix}/manifest.json")
        if not existing_manifest:
            raise FileNotFoundError(f"Cannot replace existing bundle: missing manifest at {existing_prefix}/manifest.json")

    template_key = (
        args.template_key
        or (existing_manifest.get("template_key") if isinstance(existing_manifest, dict) else None)
        or f"{template_id}_bundle"
    ).strip()
    public_template_id = (
        args.public_template_id
        or (existing_manifest.get("template_id") if isinstance(existing_manifest, dict) else None)
        or f"crafted_{template_id}_bundle"
    ).strip()
    style = str(
        args.supported_video_style
        or (existing_manifest.get("supported_video_style") if isinstance(existing_manifest, dict) else None)
        or "explainer"
    ).strip().lower()

    backend_src = REPO_ROOT / "backend" / "templates" / template_id
    frontend_src = REPO_ROOT / "frontend" / "src" / "components" / "remotion" / template_id
    remotion_src = REPO_ROOT / "remotion-video" / "src" / "templates" / template_id
    if not backend_src.exists():
        raise FileNotFoundError(f"Backend template folder not found: {backend_src}")
    if not remotion_src.exists():
        raise FileNotFoundError(f"Remotion template folder not found: {remotion_src}")

    out_root = REPO_ROOT / "crafted-templates" / f"{template_id}-crafted-template"
    if out_root.exists():
        shutil.rmtree(out_root)
    (out_root / "backend").mkdir(parents=True, exist_ok=True)
    (out_root / "frontend").mkdir(parents=True, exist_ok=True)
    (out_root / "remotion-video").mkdir(parents=True, exist_ok=True)

    for name in ("meta.json", "prompt.md", "layout_prompt.md"):
        src = backend_src / name
        if not src.exists():
            raise FileNotFoundError(f"Required backend file missing: {src}")
        shutil.copy2(src, out_root / "backend" / name)

    copy_tree(frontend_src, out_root / "frontend")
    copy_tree(remotion_src, out_root / "remotion-video")

    # Include shared frontend SocialIcons used by ending CTA layouts.
    # Built-in-authored layouts often import "../../SocialIcons"; after bundling
    # into `frontend/layouts/*`, that should resolve to `frontend/SocialIcons.tsx`.
    shared_frontend_social_icons = (
        REPO_ROOT / "frontend" / "src" / "components" / "remotion" / "SocialIcons.tsx"
    )
    if shared_frontend_social_icons.exists():
        shutil.copy2(shared_frontend_social_icons, out_root / "frontend" / "SocialIcons.tsx")

    # Include shared remotion SocialIcons used by ending CTA layouts during render.
    # Built-in-authored remotion layouts often import "../../SocialIcons"; after bundling
    # into `remotion-video/layouts/*`, that should resolve to `remotion-video/SocialIcons.tsx`.
    shared_remotion_social_icons = REPO_ROOT / "remotion-video" / "src" / "templates" / "SocialIcons.tsx"
    if shared_remotion_social_icons.exists():
        shutil.copy2(shared_remotion_social_icons, out_root / "remotion-video" / "SocialIcons.tsx")

    meta_raw = json.loads((out_root / "backend" / "meta.json").read_text(encoding="utf-8"))
    composition_id = meta_raw.get("composition_id") if isinstance(meta_raw, dict) else None

    frontend_files = [
        p.relative_to(out_root).as_posix()
        for p in sorted((out_root / "frontend").rglob("*"))
        if p.is_file() and p.suffix in {".ts", ".tsx", ".json"}
    ]
    remotion_files = [
        p.relative_to(out_root).as_posix()
        for p in sorted((out_root / "remotion-video").rglob("*"))
        if p.is_file() and p.suffix in {".ts", ".tsx"}
    ]
    files_map = gather_files_map(out_root)

    manifest = {
        "template_id": public_template_id,
        "template_key": template_key,
        "supported_video_style": style,
        "backend": {
            "meta": "backend/meta.json",
            "prompt": "backend/prompt.md",
            "layout_prompt": "backend/layout_prompt.md",
        },
        "frontend": {
            "mount_id": template_key,
            "entry": infer_frontend_entry(out_root / "frontend"),
            "layout_index": "frontend/layouts/index.ts",
            "files": frontend_files,
        },
        "remotion": {
            "mount_id": template_key,
            "entry": infer_remotion_entry(out_root / "remotion-video", composition_id if isinstance(composition_id, str) else None),
            "layout_index": "remotion-video/layouts/index.ts",
            "files": remotion_files,
        },
        "preview_image": "assets/preview.jpg",
        "files": files_map,
    }

    manifest_path = out_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    files_map["manifest.json"] = {"size": manifest_path.stat().st_size, "sha256": sha256_file(manifest_path)}
    manifest["files"] = files_map
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"local_bundle={out_root}")
    print(f"public_template_id={public_template_id}")
    print(f"template_key={template_key}")

    if not args.upload:
        if args.prune_source_after_bundle:
            if backend_src.exists():
                shutil.rmtree(backend_src)
            if frontend_src.exists():
                shutil.rmtree(frontend_src)
            if remotion_src.exists():
                shutil.rmtree(remotion_src)
            print("pruned_source=true")
        print("upload=false")
        return

    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    if args.replace_existing:
        prefix = existing_prefix
    else:
        requested_prefix = (
            args.r2_prefix.strip().strip("/")
            if isinstance(args.r2_prefix, str) and args.r2_prefix.strip()
            else f"crafted-templates/{template_id}-crafted-template-{stamp}"
        )
        prefix = apply_crafted_r2_namespace(requested_prefix)

    deleted = 0
    if args.replace_existing:
        old_keys = _list_r2_keys(prefix)
        for key in old_keys:
            if r2_storage.delete_object(key):
                deleted += 1

    uploaded = []
    for p in sorted(out_root.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(out_root).as_posix()
        key = f"{prefix}/{rel}"
        r2_storage.upload_file(str(p), key)
        uploaded.append(key)

    print(f"upload=true")
    print(f"r2_prefix={prefix}")
    if args.replace_existing:
        print("replace_existing=true")
        print(f"deleted_existing_files={deleted}")
    print(f"uploaded_files={len(uploaded)}")

    if args.prune_source_after_bundle:
        if backend_src.exists():
            shutil.rmtree(backend_src)
        if frontend_src.exists():
            shutil.rmtree(frontend_src)
        if remotion_src.exists():
            shutil.rmtree(remotion_src)
        print("pruned_source=true")


if __name__ == "__main__":
    main()

