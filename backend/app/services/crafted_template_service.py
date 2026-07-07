import concurrent.futures
import hashlib
import json
import logging
import time
from datetime import datetime
from pathlib import PurePosixPath
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.models.crafted_template import CraftedTemplate
from app.models.crafted_template_entitlement import CraftedTemplateEntitlement
from app.services import r2_storage

logger = logging.getLogger(__name__)

CRAFTED_PREFIX = "crafted_"
DEFAULT_MAX_PACKAGE_BYTES = 25 * 1024 * 1024
DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024
DEFAULT_CACHE_TTL_SECONDS = 300
DEFAULT_SUMMARY_FETCH_WORKERS = 8
SUMMARY_OBJECT_NAME = "summary.json"

# L1 in-process cache: template_id -> {"expires_at": ..., "payload": ...}
# Holds the full bundle (intro/outro/content code, frontend files, etc.).
_crafted_package_cache: dict[str, dict[str, Any]] = {}
# L1 in-process cache for marquee summaries fetched from R2 summary.json.
# Separate from the package cache because the list endpoint never needs the bundle.
_crafted_summary_cache: dict[str, dict[str, Any]] = {}
_cache_hits = 0
_cache_misses = 0


def is_crafted_templates_enabled() -> bool:
    raw = str(getattr(settings, "CRAFTED_TEMPLATES_ENABLED", "false")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def crafted_cache_stats() -> dict[str, int]:
    return {
        "entries": len(_crafted_package_cache),
        "hits": _cache_hits,
        "misses": _cache_misses,
    }


def _cache_ttl_seconds() -> int:
    raw = getattr(settings, "CRAFTED_TEMPLATE_CACHE_TTL_SECONDS", None)
    try:
        value = int(raw) if raw is not None else DEFAULT_CACHE_TTL_SECONDS
    except Exception:
        value = DEFAULT_CACHE_TTL_SECONDS
    return max(10, value)


def _max_package_bytes() -> int:
    raw = getattr(settings, "CRAFTED_TEMPLATE_MAX_PACKAGE_BYTES", None)
    try:
        value = int(raw) if raw is not None else DEFAULT_MAX_PACKAGE_BYTES
    except Exception:
        value = DEFAULT_MAX_PACKAGE_BYTES
    return max(1, value)


def _max_file_bytes() -> int:
    raw = getattr(settings, "CRAFTED_TEMPLATE_MAX_FILE_BYTES", None)
    try:
        value = int(raw) if raw is not None else DEFAULT_MAX_FILE_BYTES
    except Exception:
        value = DEFAULT_MAX_FILE_BYTES
    return max(1, value)


def is_crafted_template(template_id: str) -> bool:
    return isinstance(template_id, str) and template_id.startswith(CRAFTED_PREFIX)


def _norm_rel_path(path: str) -> str:
    p = (path or "").strip().replace("\\", "/")
    if not p:
        return ""
    return str(PurePosixPath(p))


def _is_safe_rel_path(path: str) -> bool:
    p = _norm_rel_path(path)
    if not p:
        return False
    if p.startswith("/") or p.startswith("./"):
        return False
    parts = PurePosixPath(p).parts
    if any(part in ("..", "") for part in parts):
        return False
    return True


def _join_r2_key(prefix: str, rel_path: str) -> str:
    base = prefix.strip().strip("/")
    rel = _norm_rel_path(rel_path).lstrip("/")
    return f"{base}/{rel}" if base else rel


def _manifest_declared_size(entry: Any) -> int | None:
    if isinstance(entry, dict):
        raw = entry.get("size")
    elif isinstance(entry, int):
        raw = entry
    else:
        raw = None
    try:
        return int(raw) if raw is not None else None
    except Exception:
        return None


def _manifest_declared_sha(entry: Any) -> str | None:
    if isinstance(entry, dict):
        raw = entry.get("sha256")
        return raw.strip().lower() if isinstance(raw, str) and raw.strip() else None
    return None


def _required_paths(manifest: dict[str, Any]) -> tuple[list[str], list[str], str, str, str, str]:
    generated = manifest.get("generated") if isinstance(manifest.get("generated"), dict) else None
    if generated:
        intro = _norm_rel_path(generated.get("intro", "generated/SceneIntro.tsx"))
        outro = _norm_rel_path(generated.get("outro", "generated/SceneOutro.tsx"))
        content = generated.get("content", ["generated/SceneContent0.tsx"])
        if not isinstance(content, list):
            content = ["generated/SceneContent0.tsx"]
        content_paths = [_norm_rel_path(str(p)) for p in content if isinstance(p, (str, bytes))]
        registry = _norm_rel_path(generated.get("registry", "generated/contentRegistry.ts"))
        composition = _norm_rel_path(generated.get("composition", "generated/GeneratedVideo.tsx"))
    else:
        intro = ""
        outro = ""
        content_paths = []
        registry = ""
        composition = ""

    backend = manifest.get("backend") if isinstance(manifest.get("backend"), dict) else {}
    base_required = [
        _norm_rel_path(backend.get("meta", manifest.get("meta_path", "backend/meta.json"))),
        _norm_rel_path(backend.get("prompt", manifest.get("prompt_path", "backend/prompt.md"))),
        _norm_rel_path(backend.get("layout_prompt", manifest.get("layout_prompt_path", "backend/layout_prompt.md"))),
        _norm_rel_path(manifest.get("manifest_path", "manifest.json")),
    ]
    if generated:
        base_required.extend([intro, outro, registry, composition])
    return base_required, content_paths, intro, outro, registry, composition


def _required_module_files(
    manifest: dict[str, Any],
    section_name: str,
    template_key: str,
    *,
    default_dir: str,
    default_entry: str,
    default_layout_index: str,
) -> tuple[str, str, str, list[str]]:
    section = manifest.get(section_name) if isinstance(manifest.get(section_name), dict) else {}
    mount_id_raw = (section.get("mount_id") if isinstance(section.get("mount_id"), str) else template_key) or template_key
    mount_id = "".join(ch for ch in mount_id_raw.strip().lower() if ch.isalnum() or ch == "_") or template_key
    entry_rel = _norm_rel_path(section.get("entry", f"{default_dir}/{default_entry}"))
    layout_index_rel = _norm_rel_path(section.get("layout_index", f"{default_dir}/{default_layout_index}"))
    files_raw = section.get("files", [])
    if not isinstance(files_raw, list):
        files_raw = []
    module_files = [_norm_rel_path(str(p)) for p in files_raw if isinstance(p, (str, bytes))]
    if entry_rel and entry_rel not in module_files:
        module_files.append(entry_rel)
    if layout_index_rel and layout_index_rel not in module_files:
        module_files.append(layout_index_rel)
    return mount_id, entry_rel, layout_index_rel, module_files


def _frontend_preview_rel(manifest: dict[str, Any]) -> str:
    """
    Resolve the optional marquee preview file path from the manifest.
    Returns "" when no preview file was bundled.
    """
    section = manifest.get("frontend") if isinstance(manifest.get("frontend"), dict) else {}
    raw = section.get("preview") if isinstance(section.get("preview"), str) else ""
    return _norm_rel_path(raw) if raw else ""


def _frontend_layout_fields_rel(manifest: dict[str, Any]) -> str:
    """
    Resolve the optional SceneEditModal layout_fields file path from the
    manifest. Returns "" when no layoutFields.ts/json was bundled.
    """
    section = manifest.get("frontend") if isinstance(manifest.get("frontend"), dict) else {}
    raw = section.get("layout_fields") if isinstance(section.get("layout_fields"), str) else ""
    return _norm_rel_path(raw) if raw else ""


def _required_remotion_files(manifest: dict[str, Any], template_key: str) -> tuple[str, str, str, list[str]]:
    """
    Built-in-style remotion contract for crafted templates.

    remotion:
      mount_id: "finance_pro"                 # optional, defaults to template_key
      entry: "remotion-video/FinanceVideo.tsx"
      layout_index: "remotion-video/layouts/index.ts"
      files:
        - "remotion-video/FinanceVideo.tsx"
        - "remotion-video/layouts/index.ts"
        - "remotion-video/layouts/Hero.tsx"
    """
    return _required_module_files(
        manifest,
        "remotion",
        template_key,
        default_dir="remotion-video",
        default_entry="TemplateVideo.tsx",
        default_layout_index="layouts/index.ts",
    )


def _public_assets_from_manifest(r2_prefix: str, files_map: Any) -> tuple[dict[str, str], list[str]]:
    """Map `public/<path>` bundle entries to staticFile keys and public CDN URLs; list R2 keys for render."""
    urls: dict[str, str] = {}
    relpaths: list[str] = []
    if not isinstance(files_map, dict):
        return {}, []
    for raw_key in files_map.keys():
        if not isinstance(raw_key, str):
            continue
        norm = _norm_rel_path(raw_key)
        if not norm.startswith("public/"):
            continue
        inner = norm[len("public/") :]
        if not inner or not _is_safe_rel_path(inner):
            continue
        relpaths.append(norm)
        urls[inner] = r2_storage.public_url(_join_r2_key(r2_prefix, norm))
    return urls, sorted(set(relpaths))


def _required_frontend_files(manifest: dict[str, Any], template_key: str) -> tuple[str, str, str, list[str]]:
    """
    Built-in-style frontend contract for crafted templates.

    frontend:
      mount_id: "finance_pro"
      entry: "frontend/FinanceVideoComposition.tsx"
      layout_index: "frontend/layouts/index.ts"
      files:
        - "frontend/FinanceVideoComposition.tsx"
        - "frontend/layouts/index.ts"
        - "frontend/layouts/HeroImage.tsx"
    """
    return _required_module_files(
        manifest,
        "frontend",
        template_key,
        default_dir="frontend",
        default_entry="TemplateVideoComposition.tsx",
        default_layout_index="layouts/index.ts",
    )


def _validate_manifest_contract(manifest: dict[str, Any], template_row: CraftedTemplate) -> tuple[bool, str]:
    template_id = template_row.public_template_id
    if (manifest.get("template_id") or "").strip() != template_id:
        return False, "manifest.template_id mismatch"
    if (manifest.get("template_key") or "").strip() != template_row.template_key:
        return False, "manifest.template_key mismatch"

    files_map = manifest.get("files")
    if not isinstance(files_map, dict):
        return False, "manifest.files must be an object"

    required_base, content_paths, intro_rel, outro_rel, registry_rel, composition_rel = _required_paths(manifest)
    has_generated_contract = bool(intro_rel and outro_rel and registry_rel and composition_rel)
    if has_generated_contract and not content_paths:
        return False, "at least one generated content scene is required"
    (
        _remotion_mount_id,
        remotion_entry,
        remotion_layout_index,
        remotion_files,
    ) = _required_remotion_files(manifest, template_row.template_key)
    (
        _frontend_mount_id,
        frontend_entry,
        frontend_layout_index,
        frontend_files,
    ) = _required_frontend_files(manifest, template_row.template_key)
    if not remotion_files:
        return False, "manifest.remotion.files must include built-in-style template files"

    for rel in required_base + content_paths + remotion_files + frontend_files:
        if not _is_safe_rel_path(rel):
            return False, f"invalid relative path: {rel}"
        if rel not in files_map:
            return False, f"manifest.files missing entry: {rel}"
    if not _is_safe_rel_path(remotion_entry):
        return False, "manifest.remotion.entry invalid"
    if not _is_safe_rel_path(remotion_layout_index):
        return False, "manifest.remotion.layout_index invalid"
    if frontend_files:
        if not _is_safe_rel_path(frontend_entry):
            return False, "manifest.frontend.entry invalid"
        if not _is_safe_rel_path(frontend_layout_index):
            return False, "manifest.frontend.layout_index invalid"

    return True, ""


def _validate_sizes_from_manifest(manifest: dict[str, Any]) -> tuple[bool, str]:
    files_map = manifest.get("files", {})
    if not isinstance(files_map, dict):
        return False, "manifest.files missing"
    total = 0
    max_pkg = _max_package_bytes()
    max_file = _max_file_bytes()
    for rel, entry in files_map.items():
        if not _is_safe_rel_path(str(rel)):
            return False, f"unsafe file path in manifest.files: {rel}"
        file_size = _manifest_declared_size(entry)
        if file_size is None:
            continue
        if file_size > max_file:
            return False, f"file exceeds max file size: {rel}"
        total += file_size
        if total > max_pkg:
            return False, "package exceeds max total size"
    return True, ""


def _file_bytes_with_checks(prefix: str, rel_path: str, manifest_entry: Any) -> bytes | None:
    if not _is_safe_rel_path(rel_path):
        logger.warning("[CRAFTED] Unsafe relative path rejected: %s", rel_path)
        return None
    key = _join_r2_key(prefix, rel_path)
    raw = r2_storage.download_bytes(key)
    if raw is None:
        logger.warning("[CRAFTED] R2 download returned None for %s", key)
        return None
    max_file = _max_file_bytes()
    if len(raw) > max_file:
        logger.warning(
            "[CRAFTED] File exceeds max size: %s (got=%d, max=%d)",
            key,
            len(raw),
            max_file,
        )
        return None
    declared_size = _manifest_declared_size(manifest_entry)
    if declared_size is not None and declared_size != len(raw):
        logger.warning(
            "[CRAFTED] Size mismatch for %s (declared=%s, actual=%d)",
            key,
            declared_size,
            len(raw),
        )
        return None
    declared_sha = _manifest_declared_sha(manifest_entry)
    if declared_sha:
        digest = hashlib.sha256(raw).hexdigest().lower()
        if digest != declared_sha:
            logger.warning(
                "[CRAFTED] SHA256 mismatch for %s (declared=%s, actual=%s)",
                key,
                declared_sha,
                digest,
            )
            return None
    return raw


def _is_entitled(row: CraftedTemplateEntitlement | None) -> bool:
    if not row or (row.status or "").strip().lower() != "active":
        return False
    now = datetime.utcnow()
    if row.starts_at and row.starts_at > now:
        return False
    if row.expires_at and row.expires_at <= now:
        return False
    return True


def validate_crafted_template_access(template_id: str, user_id: int, db: Session) -> bool:
    if not is_crafted_template(template_id):
        return False
    tpl = (
        db.query(CraftedTemplate)
        .filter(
            CraftedTemplate.public_template_id == template_id,
            CraftedTemplate.status == "active",
        )
        .first()
    )
    if not tpl:
        return False
    entitlement = (
        db.query(CraftedTemplateEntitlement)
        .filter(
            CraftedTemplateEntitlement.user_id == user_id,
            CraftedTemplateEntitlement.crafted_template_id == tpl.id,
        )
        .first()
    )
    return _is_entitled(entitlement)


def _from_cache(template_id: str) -> dict[str, Any] | None:
    global _cache_hits, _cache_misses
    item = _crafted_package_cache.get(template_id)
    if not item:
        _cache_misses += 1
        return None
    if item.get("expires_at", 0) < time.time():
        _crafted_package_cache.pop(template_id, None)
        _cache_misses += 1
        return None
    _cache_hits += 1
    return item.get("payload")


def _put_cache(template_id: str, payload: dict[str, Any]) -> None:
    _crafted_package_cache[template_id] = {
        "expires_at": time.time() + _cache_ttl_seconds(),
        "payload": payload,
    }


def _summary_r2_key(r2_prefix: str) -> str:
    return _join_r2_key(r2_prefix, SUMMARY_OBJECT_NAME)


def _summary_from_cache(template_id: str) -> dict[str, Any] | None:
    item = _crafted_summary_cache.get(template_id)
    if not item:
        return None
    if item.get("expires_at", 0) < time.time():
        _crafted_summary_cache.pop(template_id, None)
        return None
    payload = item.get("payload")
    return payload if isinstance(payload, dict) else None


def _put_summary_cache(template_id: str, payload: dict[str, Any]) -> None:
    _crafted_summary_cache[template_id] = {
        "expires_at": time.time() + _cache_ttl_seconds(),
        "payload": payload,
    }


def build_summary_payload(
    *,
    meta: dict[str, Any],
    preview_image_url: str | None,
    preview_file: str | None,
    preview_file_rel: str | None,
    layout_fields: str | None,
    layout_fields_rel: str | None,
    theme: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a summary.json payload from already-loaded bundle pieces.

    Single source of truth for the summary shape so the server-side
    backfill (reads from R2) and the bundle/upload script (client-side,
    reads from the local bundle dir) produce byte-identical artifacts.
    """
    if isinstance(theme, dict):
        resolved_theme: dict[str, Any] = theme
    elif isinstance(meta.get("theme"), dict):
        resolved_theme = meta["theme"]
    else:
        colors = meta.get("preview_colors") if isinstance(meta.get("preview_colors"), dict) else {}
        resolved_theme = {"colors": colors, "fonts": {}}
    summary: dict[str, Any] = dict(meta)
    summary["preview_image_url"] = preview_image_url
    summary["preview_file"] = preview_file
    summary["preview_file_rel"] = preview_file_rel
    summary["layout_fields"] = layout_fields
    summary["layout_fields_rel"] = layout_fields_rel
    summary["theme"] = resolved_theme
    return summary


def _compose_summary_from_package(package: dict[str, Any]) -> dict[str, Any]:
    """Build the summary.json payload from a fully-loaded package dict."""
    meta = package.get("meta") if isinstance(package.get("meta"), dict) else {}
    return build_summary_payload(
        meta=meta,
        preview_image_url=package.get("preview_image_url"),
        preview_file=package.get("preview_file"),
        preview_file_rel=package.get("preview_file_rel"),
        layout_fields=package.get("layout_fields"),
        layout_fields_rel=package.get("layout_fields_rel"),
        theme=package.get("theme"),
    )


def write_summary_to_r2(r2_prefix: str, summary: dict[str, Any]) -> bool:
    """Upload summary.json to R2 under the given prefix. Returns True on success."""
    if not r2_storage.is_r2_configured():
        return False
    try:
        key = _summary_r2_key(r2_prefix)
        body = json.dumps(summary, ensure_ascii=False).encode("utf-8")
        r2_storage.upload_bytes(key, body, content_type="application/json")
        return True
    except Exception:
        logger.warning(
            "[CRAFTED] Failed to upload summary.json to R2 prefix=%s",
            r2_prefix,
            exc_info=True,
        )
        return False


def _fetch_summary_from_r2(r2_prefix: str) -> dict[str, Any] | None:
    payload = r2_storage.download_json(_summary_r2_key(r2_prefix))
    return payload if isinstance(payload, dict) else None


def _fetch_summaries_parallel(targets: list[tuple[str, str]]) -> dict[str, dict[str, Any]]:
    """Fetch summary.json for many templates in parallel. Returns {template_id: payload} for successes only."""
    if not targets:
        return {}
    results: dict[str, dict[str, Any]] = {}
    max_workers = max(1, min(DEFAULT_SUMMARY_FETCH_WORKERS, len(targets)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_id = {
            executor.submit(_fetch_summary_from_r2, prefix): tpl_id
            for tpl_id, prefix in targets
        }
        for future in concurrent.futures.as_completed(future_to_id):
            tpl_id = future_to_id[future]
            try:
                payload = future.result()
            except Exception:
                payload = None
            if isinstance(payload, dict):
                results[tpl_id] = payload
    return results


def load_crafted_template_package(
    template_id: str,
    user_id: int | None = None,
    db: Session | None = None,
    require_entitlement: bool = False,
    force_refresh: bool = False,
) -> dict[str, Any] | None:
    if not is_crafted_template(template_id):
        return None
    if not is_crafted_templates_enabled():
        return None
    if not force_refresh:
        cached = _from_cache(template_id)
        if cached is not None:
            return cached
    if db is None:
        return None

    template_row = (
        db.query(CraftedTemplate)
        .filter(
            CraftedTemplate.public_template_id == template_id,
            CraftedTemplate.status == "active",
        )
        .first()
    )
    if not template_row:
        return None

    if require_entitlement:
        if user_id is None:
            return None
        entitlement = (
            db.query(CraftedTemplateEntitlement)
            .filter(
                CraftedTemplateEntitlement.user_id == user_id,
                CraftedTemplateEntitlement.crafted_template_id == template_row.id,
            )
            .first()
        )
        if not _is_entitled(entitlement):
            return None

    manifest_key = template_row.manifest_path or _join_r2_key(template_row.r2_prefix, "manifest.json")
    manifest = r2_storage.download_json(manifest_key)
    if not isinstance(manifest, dict):
        logger.warning("[CRAFTED] Missing/invalid manifest for %s", template_id)
        return None

    ok, reason = _validate_manifest_contract(manifest, template_row)
    if not ok:
        logger.warning("[CRAFTED] Contract validation failed for %s: %s", template_id, reason)
        return None
    ok, reason = _validate_sizes_from_manifest(manifest)
    if not ok:
        logger.warning("[CRAFTED] Size validation failed for %s: %s", template_id, reason)
        return None

    files_map = manifest.get("files", {})
    required_base, content_paths, intro_rel, outro_rel, registry_rel, composition_rel = _required_paths(manifest)
    remotion_mount_id, remotion_entry_rel, remotion_layout_index_rel, remotion_file_paths = _required_remotion_files(
        manifest, template_row.template_key
    )
    frontend_mount_id, frontend_entry_rel, frontend_layout_index_rel, frontend_file_paths = _required_frontend_files(
        manifest, template_row.template_key
    )
    _ = required_base  # already validated by contract checks

    def _read_text(rel_path: str) -> str | None:
        raw = _file_bytes_with_checks(template_row.r2_prefix, rel_path, files_map.get(rel_path))
        if raw is None:
            return None
        try:
            return raw.decode("utf-8")
        except Exception:
            return None

    backend = manifest.get("backend") if isinstance(manifest.get("backend"), dict) else {}
    meta_rel = _norm_rel_path(backend.get("meta", manifest.get("meta_path", "backend/meta.json")))
    prompt_rel = _norm_rel_path(backend.get("prompt", manifest.get("prompt_path", "backend/prompt.md")))
    layout_prompt_rel = _norm_rel_path(backend.get("layout_prompt", manifest.get("layout_prompt_path", "backend/layout_prompt.md")))

    meta_raw = _read_text(meta_rel)
    prompt_raw = _read_text(prompt_rel)
    layout_prompt_raw = _read_text(layout_prompt_rel)
    intro_code = _read_text(intro_rel) if intro_rel else None
    outro_code = _read_text(outro_rel) if outro_rel else None
    registry_code = _read_text(registry_rel) if registry_rel else None
    composition_code = _read_text(composition_rel) if composition_rel else None
    content_codes = [_read_text(p) for p in content_paths] if content_paths else []
    remotion_files: dict[str, str] = {}
    for p in remotion_file_paths:
        code = _read_text(p)
        if code is None:
            logger.warning("[CRAFTED] Failed to load required remotion file '%s' for %s", p, template_id)
            return None
        remotion_files[p] = code
    frontend_files: dict[str, str] = {}
    for p in frontend_file_paths:
        code = _read_text(p)
        if code is None:
            logger.warning("[CRAFTED] Failed to load required frontend file '%s' for %s", p, template_id)
            return None
        frontend_files[p] = code

    if not meta_raw or prompt_raw is None or layout_prompt_raw is None:
        logger.warning(
            "[CRAFTED] Missing core backend file for %s (meta=%s, prompt=%s, layout_prompt=%s)",
            template_id,
            bool(meta_raw),
            prompt_raw is not None,
            layout_prompt_raw is not None,
        )
        return None
    if content_paths:
        if intro_code is None or outro_code is None or registry_code is None or composition_code is None:
            logger.warning(
                "[CRAFTED] Missing generated scene file(s) for %s (intro=%s, outro=%s, registry=%s, composition=%s)",
                template_id,
                intro_code is not None,
                outro_code is not None,
                registry_code is not None,
                composition_code is not None,
            )
            return None
    if content_codes and any(code is None for code in content_codes):
        logger.warning("[CRAFTED] One or more generated content scenes failed to load for %s", template_id)
        return None

    try:
        meta = json.loads(meta_raw)
    except Exception:
        return None
    if not isinstance(meta, dict):
        return None

    theme = meta.get("theme")
    if not isinstance(theme, dict):
        theme = {
            "colors": meta.get("preview_colors") if isinstance(meta.get("preview_colors"), dict) else {},
            "fonts": {},
        }

    public_asset_urls, public_r2_relpaths = _public_assets_from_manifest(template_row.r2_prefix, files_map)

    preview_file_rel = _frontend_preview_rel(manifest)
    preview_file_code = _read_text(preview_file_rel) if preview_file_rel else None

    layout_fields_rel = _frontend_layout_fields_rel(manifest)
    layout_fields_code = _read_text(layout_fields_rel) if layout_fields_rel else None

    package = {
        "template_id": template_id,
        "template_key": template_row.template_key,
        "name": template_row.name,
        "category": meta.get("category") or template_row.category or "blog",
        "theme": theme,
        "meta": meta,
        "prompt": prompt_raw,
        "layout_prompt": layout_prompt_raw,
        "intro_code": intro_code,
        "outro_code": outro_code,
        "content_codes": content_codes,
        "content_archetype_ids": meta.get("content_archetype_ids") or [],
        "image_box_aspect_ratios": meta.get("image_box_aspect_ratios"),
        "has_generated_code": bool(content_codes),
        "generated_prompt": prompt_raw,
        "composition_code": composition_code,
        "remotion_files": remotion_files,
        "remotion_entry_rel": remotion_entry_rel,
        "remotion_layout_index_rel": remotion_layout_index_rel,
        "remotion_mount_id": remotion_mount_id,
        "frontend_files": frontend_files,
        "frontend_entry_rel": frontend_entry_rel,
        "frontend_layout_index_rel": frontend_layout_index_rel,
        "frontend_mount_id": frontend_mount_id,
        "preview_file": preview_file_code,
        "preview_file_rel": preview_file_rel or None,
        "layout_fields": layout_fields_code,
        "layout_fields_rel": layout_fields_rel or None,
        "preview_image_url": r2_storage.public_url(_join_r2_key(template_row.r2_prefix, _norm_rel_path(manifest.get("preview_image", "assets/preview.jpg")))),
        "public_asset_urls": public_asset_urls,
        "public_r2_relpaths": public_r2_relpaths,
        "crafted_r2_prefix": template_row.r2_prefix,
        "manifest": manifest,
    }
    _put_cache(template_id, package)
    return package


def _resolve_preview_image_url_from_manifest(prefix: str, manifest_path: str) -> str | None:
    if not manifest_path:
        return None
    manifest = r2_storage.download_json(manifest_path)
    if not isinstance(manifest, dict):
        return None
    preview_rel = _norm_rel_path(manifest.get("preview_image", "assets/preview.jpg"))
    if not _is_safe_rel_path(preview_rel):
        return None
    return r2_storage.public_url(_join_r2_key(prefix, preview_rel))


def _list_summary_from_payload(
    tpl: CraftedTemplate,
    summary: dict[str, Any],
    *,
    fallback_preview_url: str | None = None,
) -> dict[str, Any]:
    preview_image_url = (
        summary.get("preview_image_url")
        if isinstance(summary.get("preview_image_url"), str)
        else fallback_preview_url
    )
    theme = summary.get("theme")
    if not isinstance(theme, dict):
        theme = {}
    styles = summary.get("styles")
    if not isinstance(styles, list):
        styles = []
    preview_file = summary.get("preview_file")
    if not isinstance(preview_file, str):
        preview_file = None
    preview_file_rel = summary.get("preview_file_rel")
    if not isinstance(preview_file_rel, str):
        preview_file_rel = None
    layout_fields = summary.get("layout_fields")
    if not isinstance(layout_fields, str):
        layout_fields = None
    layout_fields_rel = summary.get("layout_fields_rel")
    if not isinstance(layout_fields_rel, str):
        layout_fields_rel = None
    return {
        "id": tpl.public_template_id,
        "name": tpl.name,
        "description": summary.get("description", "") if isinstance(summary.get("description"), str) else "",
        "styles": styles,
        "preview_colors": summary.get("preview_colors"),
        "hero_layout": summary.get("hero_layout"),
        "fallback_layout": summary.get("fallback_layout"),
        "valid_layouts": summary.get("valid_layouts"),
        "layouts_without_image": summary.get("layouts_without_image"),
        "layout_prop_schema": summary.get("layout_prop_schema"),
        "template_type": "crafted",
        "crafted": True,
        "composition_id": "GeneratedVideo",
        "preview_image_url": preview_image_url,
        "preview_file": preview_file,
        "preview_file_rel": preview_file_rel,
        "layout_fields": layout_fields,
        "layout_fields_rel": layout_fields_rel,
        "theme": theme,
        "logo_urls": summary.get("logo_urls"),
        "og_image": summary.get("og_image"),
    }


def _build_and_backfill_summary(
    tpl: CraftedTemplate,
    *,
    db: Session,
    force_refresh: bool,
) -> dict[str, Any] | None:
    """Compose a summary by loading the full package, then write it back to R2."""
    package = load_crafted_template_package(
        tpl.public_template_id,
        db=db,
        require_entitlement=False,
        force_refresh=force_refresh,
    )
    if not package:
        return None
    payload = _compose_summary_from_package(package)
    write_summary_to_r2(tpl.r2_prefix, payload)
    return payload


def list_user_crafted_templates(
    user_id: int,
    db: Session,
    *,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    if not is_crafted_templates_enabled():
        return []
    now = datetime.utcnow()
    rows = (
        db.query(CraftedTemplate, CraftedTemplateEntitlement)
        .join(
            CraftedTemplateEntitlement,
            CraftedTemplateEntitlement.crafted_template_id == CraftedTemplate.id,
        )
        .filter(
            CraftedTemplate.status == "active",
            CraftedTemplateEntitlement.user_id == user_id,
            CraftedTemplateEntitlement.status == "active",
            sa_or_none(CraftedTemplateEntitlement.starts_at, now, le=True),
            sa_or_none(CraftedTemplateEntitlement.expires_at, now, ge=True),
        )
        .order_by(CraftedTemplate.updated_at.desc())
        .all()
    )
    if not rows:
        return []

    # Resolve summaries: in-memory cache → parallel R2 GET → fallback build-from-package.
    summaries_by_id: dict[str, dict[str, Any]] = {}
    to_fetch: list[tuple[str, str]] = []
    for tpl, _ in rows:
        if not force_refresh:
            cached = _summary_from_cache(tpl.public_template_id)
            if cached is not None:
                summaries_by_id[tpl.public_template_id] = cached
                continue
        to_fetch.append((tpl.public_template_id, tpl.r2_prefix))

    fetched = _fetch_summaries_parallel(to_fetch) if to_fetch else {}
    for tpl_id, payload in fetched.items():
        _put_summary_cache(tpl_id, payload)
        summaries_by_id[tpl_id] = payload

    out: list[dict[str, Any]] = []
    for tpl, _ in rows:
        tpl_id = tpl.public_template_id
        summary = summaries_by_id.get(tpl_id)
        if summary is None:
            # summary.json missing on R2 — build from manifest+meta, write back, cache it.
            summary = _build_and_backfill_summary(tpl, db=db, force_refresh=force_refresh)
            if summary is None:
                logger.warning(
                    "[CRAFTED] Could not load or compose summary for %s",
                    tpl_id,
                )
                continue
            _put_summary_cache(tpl_id, summary)
        fallback_preview_url = None
        if not isinstance(summary.get("preview_image_url"), str):
            fallback_preview_url = _resolve_preview_image_url_from_manifest(
                tpl.r2_prefix,
                tpl.manifest_path or _join_r2_key(tpl.r2_prefix, "manifest.json"),
            )
        out.append(_list_summary_from_payload(tpl, summary, fallback_preview_url=fallback_preview_url))
    return out


def sa_or_none(column, value, *, le: bool = False, ge: bool = False):
    """Small helper to keep SQLAlchemy filter readable."""
    if le:
        return (column.is_(None)) | (column <= value)
    if ge:
        return (column.is_(None)) | (column >= value)
    return column.is_(None)
