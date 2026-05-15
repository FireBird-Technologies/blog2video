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
from app.services.crafted_template_service import (
    SUMMARY_OBJECT_NAME,
    build_summary_payload,
    write_summary_to_r2,
)
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


def template_public_dirs(template_id: str, assets_root: str) -> list[Path]:
    """
    All on-disk public folders that belong exclusively to a single crafted
    template. Order matches what the bundler looks for (scoped first, then
    top-level), and both `frontend/public` and `remotion-video/public`
    roots are included so the prune step matches what the bundler reads
    and what the fetch script writes.
    """
    assets_root = (assets_root or "templates").strip().strip("/").replace("\\", "/")
    out: list[Path] = []
    for src_root in (REPO_ROOT / "frontend" / "public", REPO_ROOT / "remotion-video" / "public"):
        scoped = src_root / Path(assets_root) / template_id
        top_level = src_root / template_id
        for candidate in (scoped, top_level):
            if candidate.exists() and candidate not in out:
                out.append(candidate)
    return out


def prune_template_sources(
    template_id: str,
    *,
    backend_src: Path,
    frontend_src: Path,
    remotion_src: Path,
    public_assets_root: str,
) -> list[str]:
    """
    Remove all local on-disk sources for a crafted template so the bundle
    folder + R2 are the only remaining source of truth. Mirrors what
    `fetch_crafted_template_from_r2.py` re-creates on restore: the three
    source roots plus any template-scoped/top-level public folders.
    """
    pruned: list[str] = []
    for path in (backend_src, frontend_src, remotion_src):
        if path.exists():
            shutil.rmtree(path)
            pruned.append(path.relative_to(REPO_ROOT).as_posix())
    for path in template_public_dirs(template_id, public_assets_root):
        if path.exists():
            shutil.rmtree(path)
            pruned.append(path.relative_to(REPO_ROOT).as_posix())
    return pruned


def infer_frontend_preview(frontend_dir: Path) -> str | None:
    """
    Locate the lightweight `<TemplateName>Preview.tsx` shipped with each crafted
    template. Convention: a single default-exported React component used to
    render the marquee thumbnail without loading the full layout package.
    """
    if not frontend_dir.exists():
        return None
    direct = sorted(frontend_dir.glob("*Preview.tsx"))
    if direct:
        return f"frontend/{direct[0].name}"
    nested = sorted(frontend_dir.glob("preview/*Preview.tsx"))
    if nested:
        rel = nested[0].relative_to(frontend_dir).as_posix()
        return f"frontend/{rel}"
    return None


def infer_frontend_layout_fields(frontend_dir: Path) -> str | None:
    """
    Locate the per-template SceneEditModal field definitions file. Convention:
    `frontend/layoutFields.ts` (or `.json`) at the bundle root, exporting a
    `LAYOUT_FIELDS` Record keyed by layout id. Fetched with the list summary
    so the modal can render template-specific controls without a code change.
    """
    if not frontend_dir.exists():
        return None
    for name in ("layoutFields.ts", "layoutFields.tsx", "layoutFields.json"):
        candidate = frontend_dir / name
        if candidate.exists():
            return f"frontend/{name}"
    return None


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
    parser.add_argument(
        "--upload-existing-bundle",
        action="store_true",
        help=(
            "Skip re-bundling and upload files from an existing local crafted bundle folder "
            "(requires manifest.json in bundle root)."
        ),
    )
    parser.add_argument(
        "--bundle-dir",
        help=(
            "Optional local crafted bundle folder path for --upload-existing-bundle. "
            "Default: crafted-templates/<template-id>-crafted-template"
        ),
    )
    parser.add_argument(
        "--public-assets-root",
        default="templates",
        help=(
            "Copy only template-scoped public assets from "
            "frontend/public/<root>/<template-id> and remotion-video/public/<root>/<template-id> "
            "(default root: templates)."
        ),
    )
    return parser.parse_args()


def _read_text_if_exists(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"[summary] failed to read {path}: {e}")
        return None


def upload_summary_for_bundle(prefix: str, bundle_dir: Path, manifest: dict) -> bool:
    """
    Compose summary.json from the local bundle and upload it to R2 at
    `{prefix}/summary.json`. Called after bundle files are uploaded so the
    dashboard list endpoint sees a fresh summary without requiring a
    follow-up call to /admin/publish.
    """
    backend = manifest.get("backend") if isinstance(manifest.get("backend"), dict) else {}
    meta_rel = backend.get("meta") if isinstance(backend.get("meta"), str) else "backend/meta.json"
    meta_path = bundle_dir / meta_rel
    meta_raw = _read_text_if_exists(meta_path)
    if meta_raw is None:
        print(f"[summary] skipped — meta.json missing at {meta_path}")
        return False
    try:
        meta = json.loads(meta_raw)
    except Exception as e:
        print(f"[summary] skipped — meta.json invalid: {e}")
        return False
    if not isinstance(meta, dict):
        print("[summary] skipped — meta.json is not a JSON object")
        return False

    frontend = manifest.get("frontend") if isinstance(manifest.get("frontend"), dict) else {}
    preview_file_rel = frontend.get("preview") if isinstance(frontend.get("preview"), str) else None
    layout_fields_rel = frontend.get("layout_fields") if isinstance(frontend.get("layout_fields"), str) else None

    preview_file = _read_text_if_exists(bundle_dir / preview_file_rel) if preview_file_rel else None
    layout_fields = _read_text_if_exists(bundle_dir / layout_fields_rel) if layout_fields_rel else None

    preview_image_rel = manifest.get("preview_image", "assets/preview.jpg")
    preview_image_url = r2_storage.public_url(f"{prefix.strip('/')}/{preview_image_rel}") if preview_image_rel else None

    summary = build_summary_payload(
        meta=meta,
        preview_image_url=preview_image_url,
        preview_file=preview_file,
        preview_file_rel=preview_file_rel if preview_file is not None else None,
        layout_fields=layout_fields,
        layout_fields_rel=layout_fields_rel if layout_fields is not None else None,
    )
    return write_summary_to_r2(prefix, summary)


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
    if args.upload_existing_bundle and args.prune_source_after_bundle:
        raise ValueError("--prune-source-after-bundle is only valid when creating a fresh bundle")

    existing_manifest = None
    existing_prefix_raw = args.r2_prefix.strip().strip("/") if isinstance(args.r2_prefix, str) and args.r2_prefix.strip() else ""
    existing_prefix = apply_crafted_r2_namespace(existing_prefix_raw)
    if args.replace_existing:
        existing_manifest = r2_storage.download_json(f"{existing_prefix}/manifest.json")
        if not existing_manifest:
            raise FileNotFoundError(f"Cannot replace existing bundle: missing manifest at {existing_prefix}/manifest.json")

    backend_src = REPO_ROOT / "backend" / "templates" / template_id
    frontend_src = REPO_ROOT / "frontend" / "src" / "components" / "remotion" / template_id
    remotion_src = REPO_ROOT / "remotion-video" / "src" / "templates" / template_id
    out_root_default = REPO_ROOT / "crafted-templates" / f"{template_id}-crafted-template"
    out_root = Path(args.bundle_dir).expanduser().resolve() if args.bundle_dir else out_root_default

    manifest_path = out_root / "manifest.json"
    if args.upload_existing_bundle:
        if not out_root.exists():
            raise FileNotFoundError(f"Bundle folder not found: {out_root}")
        if not manifest_path.exists():
            raise FileNotFoundError(f"manifest.json not found in bundle folder: {manifest_path}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        if not backend_src.exists():
            raise FileNotFoundError(f"Backend template folder not found: {backend_src}")
        if not remotion_src.exists():
            raise FileNotFoundError(f"Remotion template folder not found: {remotion_src}")

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

        # Optional shared font modules. Template entries commonly import
        # ../../../fonts/<template-id>-defaults from their source location.
        # After bundling, these live under <section>/fonts/ so the runtime
        # mount can place render fonts back at workspace src/fonts/.
        for section, src_dir in (
            ("frontend", REPO_ROOT / "frontend" / "src" / "fonts"),
            ("remotion-video", REPO_ROOT / "remotion-video" / "src" / "fonts"),
        ):
            if src_dir.is_dir():
                dst_dir = out_root / section / "fonts"
                for name in (f"{template_id}-defaults.ts", f"{template_id}-defaults.tsx"):
                    src = src_dir / name
                    if src.is_file():
                        dst_dir.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src, dst_dir / name)

        # Static assets: copy template-scoped public assets into bundle `public/`.
        #
        # Two layouts are supported (whichever exists wins; both are merged):
        #   1) frontend/public/<assets_root>/<template_id>/**    (scoped)
        #      remotion-video/public/<assets_root>/<template_id>/**
        #      → bundled under: public/<assets_root>/<template_id>/**
        #
        #   2) frontend/public/<template_id>/**                  (top-level)
        #      remotion-video/public/<template_id>/**
        #      → bundled under: public/<template_id>/**
        #
        # Both layouts preserve the relative path so that `staticFile("…")`
        # keys keep working when the package is mounted into a render
        # workspace OR when previewed at runtime.
        (out_root / "public").mkdir(parents=True, exist_ok=True)
        assets_root = str(args.public_assets_root or "templates").strip().strip("/").replace("\\", "/")
        scoped_rel = Path(assets_root) / template_id
        for src_root in (REPO_ROOT / "frontend" / "public", REPO_ROOT / "remotion-video" / "public"):
            scoped_src = src_root / scoped_rel
            if scoped_src.exists():
                copy_tree(scoped_src, out_root / "public" / scoped_rel)
            top_level_src = src_root / template_id
            if top_level_src.exists() and top_level_src != scoped_src:
                copy_tree(top_level_src, out_root / "public" / template_id)

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

        preview_rel = infer_frontend_preview(out_root / "frontend")
        layout_fields_rel = infer_frontend_layout_fields(out_root / "frontend")
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
                # Marquee preview (lightweight, fetched alongside list summary).
                # Optional — falls back to preview_image when missing.
                "preview": preview_rel,
                # Per-template SceneEditModal field definitions.
                # Optional — falls back to meta.json layout_prop_schema.fields.
                "layout_fields": layout_fields_rel,
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

        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        files_map["manifest.json"] = {"size": manifest_path.stat().st_size, "sha256": sha256_file(manifest_path)}
        manifest["files"] = files_map
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    template_key = (
        args.template_key
        or (manifest.get("template_key") if isinstance(manifest, dict) else None)
        or (existing_manifest.get("template_key") if isinstance(existing_manifest, dict) else None)
        or f"{template_id}_bundle"
    ).strip()
    public_template_id = (
        args.public_template_id
        or (manifest.get("template_id") if isinstance(manifest, dict) else None)
        or (existing_manifest.get("template_id") if isinstance(existing_manifest, dict) else None)
        or f"crafted_{template_id}_bundle"
    ).strip()

    print(f"local_bundle={out_root}")
    print(f"public_template_id={public_template_id}")
    print(f"template_key={template_key}")

    if not args.upload:
        if args.prune_source_after_bundle:
            pruned = prune_template_sources(
                template_id,
                backend_src=backend_src,
                frontend_src=frontend_src,
                remotion_src=remotion_src,
                public_assets_root=args.public_assets_root,
            )
            print("pruned_source=true")
            for path in pruned:
                print(f"pruned_path={path}")
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

    # Generate + upload summary.json so the dashboard list endpoint reflects
    # the new bundle without requiring a follow-up /admin/publish call.
    # Composes locally from the same manifest + meta + preview source we
    # just bundled, so server and script produce identical artifacts.
    if upload_summary_for_bundle(prefix, out_root, manifest):
        print(f"summary_uploaded={prefix}/{SUMMARY_OBJECT_NAME}")
    else:
        print("summary_uploaded=false")

    if args.prune_source_after_bundle:
        pruned = prune_template_sources(
            template_id,
            backend_src=backend_src,
            frontend_src=frontend_src,
            remotion_src=remotion_src,
            public_assets_root=args.public_assets_root,
        )
        print("pruned_source=true")
        for path in pruned:
            print(f"pruned_path={path}")


if __name__ == "__main__":
    main()

