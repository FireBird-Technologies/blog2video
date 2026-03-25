import logging
import os
import json
import shutil
import subprocess
import signal
import re
import threading
import tempfile
import time
import zipfile
import requests
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.models.user import User
from app.services import r2_storage
from app.services.email import email_service, EmailServiceError
from app.services.template_service import (
    validate_template_id,
    get_hero_layout,
    get_fallback_layout,
    get_composition_id,
    get_layouts_without_image,
    is_custom_template,
)

from app.observability.logging import get_logger

logger = get_logger(__name__)

# Track running studio processes: project_id -> subprocess.Popen
_studio_processes: dict[int, subprocess.Popen] = {}

# Render progress tracker: project_id -> { progress, total_frames, rendered_frames, done, error }
_render_progress: dict[int, dict] = {}

# Per-project workspace locks to prevent concurrent file writes
_workspace_locks: dict[int, threading.Lock] = {}


def _get_workspace_lock(project_id: int) -> threading.Lock:
    """Get or create a per-project workspace lock."""
    if project_id not in _workspace_locks:
        _workspace_locks[project_id] = threading.Lock()
    return _workspace_locks[project_id]

# ─── Template files to copy into each workspace ──────────────

_TEMPLATE_CONFIG_FILES = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "remotion.config.ts",
]

# Shared files copied for every template
_SHARED_SRC_FILES = [
    "src/Root.tsx",
    "src/index.ts",
    "src/components/LogoOverlay.tsx",
    "src/components/Transitions.tsx",
    "src/components/LogoOverlay.tsx",
    # Shared font registry so templates can resolve font IDs to CSS families
    "src/fonts/registry.ts",
    # Newspaper template default fonts (bundled, not in registry)
    "src/fonts/newspaper-defaults.ts",
    # Nightfall template default fonts (bundled, not in registry)
    "src/fonts/nightfall-defaults.ts",
]


# ─── Per-project workspace management ────────────────────────


def get_workspace_dir(project_id: int) -> str:
    """Return the per-project Remotion workspace path."""
    return os.path.join(
        settings.MEDIA_DIR, f"projects/{project_id}/remotion-workspace"
    )


def _scan_template_files(template_root: str, template_id: str) -> list[str]:
    """
    Dynamically scan and return all .tsx and .ts files for a template.
    All templates live under src/templates/{template_id}/.
    Shared components (LogoOverlay, Transitions) are always included.

    Args:
        template_root: Path to remotion-video directory
        template_id: Template ID (e.g., "default", "nightfall")

    Returns:
        List of relative file paths from template_root
    """
    files = list(_SHARED_SRC_FILES)

    # Map custom_N → "custom" directory for custom templates
    scan_id = "custom" if is_custom_template(template_id) else template_id

    # Scan src/templates/{template_id}/ recursively for .tsx and .ts files
    template_dir = os.path.join(template_root, "src", "templates", scan_id)
    if os.path.isdir(template_dir):
        for root, dirs, filenames in os.walk(template_dir):
            for filename in filenames:
                if filename.endswith((".tsx", ".ts")):
                    full_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(full_path, template_root)
                    # Normalize path separators for cross-platform compatibility
                    rel_path = rel_path.replace("\\", "/")
                    files.append(rel_path)

    return sorted(set(files))


def _get_template_src_files(template_id: str) -> list[str]:
    """
    Return list of source file paths to copy for the given template.
    Dynamically scans src/templates/{template_id}/ — no hardcoded file lists.
    """
    template_root = settings.REMOTION_PROJECT_PATH
    return _scan_template_files(template_root, template_id)


def _get_all_template_src_files() -> list[str]:
    """
    Return all source files from ALL templates under src/templates/.
    Root.tsx imports every template (default, nightfall, etc.), so the
    workspace must contain the full src/templates/ tree regardless of
    which template the project uses.
    """
    template_root = settings.REMOTION_PROJECT_PATH
    files = list(_SHARED_SRC_FILES)
    templates_dir = os.path.join(template_root, "src", "templates")
    if os.path.isdir(templates_dir):
        for tid in os.listdir(templates_dir):
            tid_dir = os.path.join(templates_dir, tid)
            if os.path.isdir(tid_dir):
                for root, _dirs, filenames in os.walk(tid_dir):
                    for filename in filenames:
                        if filename.endswith((".tsx", ".ts")):
                            full_path = os.path.join(root, filename)
                            rel_path = os.path.relpath(full_path, template_root)
                            rel_path = rel_path.replace("\\", "/")
                            files.append(rel_path)
    return sorted(set(files))


def provision_workspace(project_id: int, template_id: str | None = None) -> str:
    """
    Create (or ensure) a per-project Remotion workspace.
    Copies ALL templates (not just the project's) because Root.tsx
    imports from every template directory.

    For custom templates with AI-generated code, overwrites the placeholder
    scene component files (SceneIntro.tsx, SceneContent.tsx, SceneOutro.tsx)
    with the actual generated code from the database.

    Uses a per-project lock to prevent concurrent file writes.
    """
    with _get_workspace_lock(project_id):
        workspace = get_workspace_dir(project_id)
        template = settings.REMOTION_PROJECT_PATH

        os.makedirs(workspace, exist_ok=True)
        os.makedirs(os.path.join(workspace, "public"), exist_ok=True)

        _link_directory(
            os.path.join(template, "node_modules"),
            os.path.join(workspace, "node_modules"),
        )

        # Copy config files
        for filename in _TEMPLATE_CONFIG_FILES:
            src = os.path.join(template, filename)
            dst = os.path.join(workspace, filename)
            if os.path.exists(src):
                shutil.copy2(src, dst)

        # Copy ALL template source files (Root.tsx imports every template)
        for rel_path in _get_all_template_src_files():
            src = os.path.join(template, rel_path)
            dst = os.path.join(workspace, rel_path)
            if os.path.exists(src):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)

        # For custom templates with AI-generated code, overwrite the placeholder
        # scene files with the actual generated code from the database.
        if template_id and is_custom_template(template_id):
            _write_generated_scene_files(workspace, template_id)

        return workspace


def _write_generated_scene_files(workspace: str, template_id: str) -> None:
    """
    Overwrite the placeholder generated scene files in the workspace with
    actual AI-generated code from the database.

    Writes:
      - SceneIntro.tsx (intro variant)
      - SceneOutro.tsx (outro variant)
      - SceneContent0.tsx, SceneContent1.tsx, ... (N content variants)
      - SceneContent.tsx (re-exports Content0 for backward compat)
      - contentRegistry.ts (exports array of all content components + count)
    """
    from app.services.template_service import _load_custom_template_data

    custom_data = _load_custom_template_data(template_id)
    if not custom_data or not custom_data.get("has_generated_code"):
        return

    generated_dir = os.path.join(workspace, "src", "templates", "generated")
    os.makedirs(generated_dir, exist_ok=True)

    # Write intro
    intro_code = custom_data.get("intro_code")
    if intro_code:
        wrapped = _wrap_generated_code(intro_code)
        filepath = os.path.join(generated_dir, "SceneIntro.tsx")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(wrapped)
        logger.info("Wrote SceneIntro.tsx (%d bytes)", len(wrapped))

    # Write outro
    outro_code = custom_data.get("outro_code")
    if outro_code:
        wrapped = _wrap_generated_code(outro_code)
        filepath = os.path.join(generated_dir, "SceneOutro.tsx")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(wrapped)
        logger.info("Wrote SceneOutro.tsx (%d bytes)", len(wrapped))

    # Write content variants
    content_codes = custom_data.get("content_codes") or []
    num_content = len(content_codes)
    for i, code in enumerate(content_codes):
        if not code:
            continue
        wrapped = _wrap_generated_code(code)
        filepath = os.path.join(generated_dir, f"SceneContent{i}.tsx")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(wrapped)
        logger.info("Wrote SceneContent%d.tsx (%d bytes)", i, len(wrapped))

    # Write SceneContent.tsx that re-exports Content0 (backward compat for GeneratedVideo stub)
    if num_content > 0:
        compat = '// Backward-compat: re-export first content variant\nexport { default } from "./SceneContent0";\n'
        filepath = os.path.join(generated_dir, "SceneContent.tsx")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(compat)

    # Write contentRegistry.ts — exports all content variants as an array
    imports = []
    names = []
    for i in range(num_content):
        name = f"Content{i}"
        imports.append(f'import {name} from "./SceneContent{i}";')
        names.append(name)

    registry = (
        "// Auto-generated content variant registry\n"
        + "import type { GeneratedSceneProps } from \"./types\";\n"
        + "\n".join(imports) + "\n\n"
        + f"export const CONTENT_VARIANTS: React.FC<GeneratedSceneProps>[] = [{', '.join(names)}];\n"
        + f"export const CONTENT_VARIANT_COUNT = {num_content};\n"
    )
    filepath = os.path.join(generated_dir, "contentRegistry.ts")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(registry)
    logger.info("Wrote contentRegistry.ts with %d content variants", num_content)


def _wrap_generated_code(raw_code: str) -> str:
    """
    Wrap AI-generated component code in a proper .tsx module.

    The raw code looks like:
        const SceneComponent = (props) => { ... };

    We add Remotion imports, type import, and a default export.
    """
    return f'''// Auto-generated by Blog2Video AI — DO NOT EDIT MANUALLY
import React from "react";
import {{
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Sequence,
  Img,
  random,
}} from "remotion";
import type {{ GeneratedSceneProps }} from "./types";

{raw_code}

export default SceneComponent;
'''


def _link_directory(src: str, dst: str) -> None:
    """Create a directory junction (Windows) or symlink (Unix)."""
    if os.path.exists(dst) or os.path.islink(dst):
        return  # already linked
    if not os.path.exists(src):
        raise FileNotFoundError(
            f"Template node_modules not found at {src}. "
            f"Run 'npm install' in {os.path.dirname(src)} first."
        )

    src = os.path.abspath(src)
    dst = os.path.abspath(dst)

    if os.name == "nt":
        # Directory junction — no admin required on Windows
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", dst, src],
            check=True,
            capture_output=True,
        )
    else:
        os.symlink(src, dst, target_is_directory=True)


def safe_remove_workspace(workspace_dir: str) -> None:
    """
    Safely remove a workspace directory, unlinking the node_modules
    junction/symlink first so we don't delete the shared template's
    real node_modules.
    """
    if not os.path.exists(workspace_dir):
        return
    nm = os.path.join(workspace_dir, "node_modules")
    # Remove junction/symlink without following it
    if os.path.islink(nm):
        os.unlink(nm)
    elif os.path.isdir(nm):
        try:
            # os.rmdir removes a junction on Windows without following it
            os.rmdir(nm)
        except OSError:
            pass  # real dir with contents — rmtree will handle it
    shutil.rmtree(workspace_dir, ignore_errors=True)


def rebuild_workspace(project: Project, scenes: list[Scene], db: Session) -> str:
    """
    Fully rebuild a project's Remotion workspace from DB data.
    Copies template-specific layout files, then writes data.json + assets.
    """
    template_id = validate_template_id(getattr(project, "template", "default"))
    workspace = provision_workspace(project.id, template_id)
    write_remotion_data(project, scenes, db)
    return workspace


# ─── Write project files to workspace ────────────────────────


def write_remotion_data(project: Project, scenes: list[Scene], db: Session) -> str:
    """
    Write scene data and assets to the project's Remotion workspace public folder.
    Includes layout descriptors in the scene data for data-driven rendering.
    Returns the path to data.json.
    """
    template_id = validate_template_id(getattr(project, "template", "default"))
    workspace = provision_workspace(project.id, template_id)
    public_dir = os.path.join(workspace, "public")
    os.makedirs(public_dir, exist_ok=True)

    # Copy static assets from the base Remotion project public/ into this workspace.
    # This ensures template-specific backgrounds (like the vintage newspaper texture)
    # are available both in preview and in the final rendered video.
    template_public_dir = os.path.join(settings.REMOTION_PROJECT_PATH, "public")
    if os.path.isdir(template_public_dir):
        for root, _dirs, filenames in os.walk(template_public_dir):
            for filename in filenames:
                src = os.path.join(root, filename)
                rel = os.path.relpath(src, template_public_dir)
                dst = os.path.join(public_dir, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)

    # Collect and copy non-excluded images to public dir
    # If local file is missing (e.g. different Cloud Run container), download from R2
    all_image_files: list[str] = []
    for asset in project.assets:
        if asset.asset_type.value == "image" and not asset.excluded:
            dest = os.path.join(public_dir, asset.filename)
            if os.path.exists(asset.local_path):
                _copy_file(asset.local_path, dest)
                all_image_files.append(asset.filename)
            elif asset.r2_url:
                if _download_url_to_file(asset.r2_url, dest):
                    all_image_files.append(asset.filename)

    # Hero image (OG/first image) for templates that use it
    hero_image_file = all_image_files[0] if all_image_files else None

    # Distribute images across scenes - images move with their scenes when reordered.
    # Strategy:
    # Image assignment: single-pass approach
    # 1. Parse each scene's remotion_code ONCE into memory
    # 2. Resolve all assignments (stored, scene-specific, generic)
    # 3. Write back modified descriptors ONCE at the end
    scene_image_map: dict[int, list[str]] = {i: [] for i in range(len(scenes))}
    hide_image_flags: list[bool] = [False] * len(scenes)
    no_image_layouts: set[str] = get_layouts_without_image(template_id)

    # Pre-parse all scene descriptors once
    parsed_descs: list[dict | None] = []
    scene_layouts: list[str] = []
    scene_layout_props: list[dict] = []
    fallback = get_fallback_layout(template_id)
    for scene in scenes:
        desc = None
        layout = fallback
        lp = {}
        if scene.remotion_code:
            try:
                desc = json.loads(scene.remotion_code)
                if "layoutConfig" in desc:
                    layout = desc["layoutConfig"].get("arrangement", fallback)
                else:
                    layout = desc.get("layout", fallback)
                lp = desc.get("layoutProps", {}) or {}
            except (json.JSONDecodeError, TypeError):
                pass
        parsed_descs.append(desc)
        scene_layouts.append(layout)
        scene_layout_props.append(lp)

    # Track which scene descriptors were modified (need serialization at end)
    dirty: set[int] = set()

    if all_image_files and scenes:
        image_assets = [
            a for a in project.assets
            if a.asset_type.value == "image" and not a.excluded
        ]
        try:
            image_assets.sort(key=lambda a: (a.created_at, a.id))
        except Exception:
            image_assets.sort(key=lambda a: a.id)

        used_generic_files: set[str] = set()
        scene_specific: list[tuple[int, str]] = []
        generic_files: list[str] = []
        for asset in image_assets:
            m = re.match(r"^scene_(\d+)_", asset.filename)
            if m:
                scene_specific.append((int(m.group(1)), asset.filename))
            else:
                generic_files.append(asset.filename)
        scene_specific_files = {fn for _, fn in scene_specific}

        # Build scene_id -> index lookup
        id_to_idx = {s.id: i for i, s in enumerate(scenes)}

        # Step 1: Process stored assignments + layout constraints
        for i, scene in enumerate(scenes):
            layout = scene_layouts[i]
            lp = scene_layout_props[i]

            if layout in no_image_layouts:
                hide_image_flags[i] = True
                changed = False
                if lp.get("assignedImage"):
                    lp.pop("assignedImage", None)
                    changed = True
                if not lp.get("hideImage"):
                    lp["hideImage"] = True
                    changed = True
                if changed:
                    dirty.add(i)
                continue

            hide_image_flags[i] = bool(lp.get("hideImage", False))
            assigned = lp.get("assignedImage")
            if not assigned:
                continue

            if hide_image_flags[i]:
                lp.pop("assignedImage", None)
                dirty.add(i)
            elif assigned in all_image_files:
                m = re.match(r"^scene_(\d+)_", str(assigned))
                if m:
                    if int(m.group(1)) == scene.id:
                        scene_image_map[i] = [assigned]
                    else:
                        lp.pop("assignedImage", None)
                        dirty.add(i)
                else:
                    if assigned in used_generic_files:
                        lp.pop("assignedImage", None)
                        dirty.add(i)
                    else:
                        used_generic_files.add(str(assigned))
                        scene_image_map[i] = [assigned]
            else:
                lp.pop("assignedImage", None)
                dirty.add(i)

        # Step 2: Scene-specific images (override stored assignments)
        for scene_id, filename in scene_specific:
            idx = id_to_idx.get(scene_id, -1)
            if idx < 0 or scene_layouts[idx] in no_image_layouts:
                continue
            scene_image_map[idx] = [filename]
            lp = scene_layout_props[idx]
            if lp.get("assignedImage") != filename or lp.get("hideImage"):
                lp["assignedImage"] = filename
                lp.pop("hideImage", None)
                hide_image_flags[idx] = False
                dirty.add(idx)

        # Step 3: Scene-type pre-assignment (intro gets hero, outro skips)
        for i, scene in enumerate(scenes):
            if scene_image_map[i]:
                continue
            scene_type = getattr(scene, "scene_type", None)
            if scene_type is None:
                if i == 0:
                    scene_type = "intro"
                elif i == len(scenes) - 1 and len(scenes) > 1:
                    scene_type = "outro"
            if scene_type == "intro" and hero_image_file and hero_image_file in generic_files and hero_image_file not in used_generic_files:
                scene_image_map[i] = [hero_image_file]
                used_generic_files.add(hero_image_file)
            elif scene_type == "outro":
                hide_image_flags[i] = True

        # Step 4: Assign remaining generics (1 per scene)
        generic_idx = 0
        for i in range(len(scenes)):
            if scene_image_map[i] or hide_image_flags[i] or scene_layouts[i] in no_image_layouts:
                continue
            while generic_idx < len(generic_files):
                candidate = generic_files[generic_idx]
                generic_idx += 1
                if candidate in used_generic_files or candidate in scene_specific_files:
                    continue
                scene_image_map[i] = [candidate]
                used_generic_files.add(candidate)
                lp = scene_layout_props[i]
                if lp.get("assignedImage") != candidate:
                    lp["assignedImage"] = candidate
                    dirty.add(i)
                break

    # Serialize modified descriptors back to scenes (single write per scene)
    if dirty:
        is_custom = is_custom_template(template_id)
        for i in dirty:
            desc = parsed_descs[i]
            if desc is not None:
                desc["layoutProps"] = scene_layout_props[i]
                if "layoutConfig" not in desc:
                    desc["layout"] = scene_layouts[i]
                scenes[i].remotion_code = json.dumps(desc)
            elif not is_custom:
                scenes[i].remotion_code = json.dumps({
                    "layout": scene_layouts[i],
                    "layoutProps": scene_layout_props[i],
                })
        try:
            db.commit()
        except Exception as e:
            logger.exception("[REBUILD_WORKSPACE] Failed to update scene assignments: %s", e)
            db.rollback()

    # Build audio asset lookup: scene order -> audio asset (for R2 fallback)
    audio_assets = {
        a.filename: a
        for a in project.assets
        if a.asset_type.value == "audio"
    }

    # Build scene data
    scene_data = []
    for i, scene in enumerate(scenes):
        voiceover_filename = None
        audio_dest_name = f"audio_scene_{scene.order}.mp3"
        dest = os.path.join(public_dir, audio_dest_name)

        if scene.voiceover_path and os.path.exists(scene.voiceover_path):
            voiceover_filename = audio_dest_name
            _copy_file(scene.voiceover_path, dest)
        else:
            # Local file missing — try R2 fallback
            # Extract filename from voiceover_path to handle reordering correctly
            # After reordering, voiceover_path still points to original filename (e.g., scene_1.mp3)
            # but scene.order may have changed (e.g., to 2), so we extract the actual filename
            audio_filename = None
            if scene.voiceover_path:
                # Extract filename from path (handles both / and \ separators)
                # Path format: "C:\...\audio\scene_X.mp3" or ".../audio/scene_X.mp3"
                match = re.search(r'[\\/]scene_(\d+)\.mp3', scene.voiceover_path, re.IGNORECASE)
                if match:
                    audio_filename = f"scene_{match.group(1)}.mp3"
                else:
                    # Fallback: extract from last part of path
                    path_parts = re.split(r'[\\/]', scene.voiceover_path)
                    last_part = path_parts[-1] if path_parts else ""
                    if last_part.startswith('scene_') and last_part.endswith('.mp3'):
                        audio_filename = last_part
            
            # Use extracted filename if available, otherwise fall back to scene.order
            lookup_filename = audio_filename or f"scene_{scene.order}.mp3"
            audio_asset = audio_assets.get(lookup_filename)
            if audio_asset and audio_asset.r2_url:
                if _download_url_to_file(audio_asset.r2_url, dest):
                    voiceover_filename = audio_dest_name

        # Parse layout descriptor from remotion_code (JSON)
        fallback = get_fallback_layout(template_id)
        layout = fallback
        layout_props = {}
        layout_config = None
        if scene.remotion_code:
            try:
                desc = json.loads(scene.remotion_code)
                if "layoutConfig" in desc:
                    # Universal layout engine (custom templates)
                    layout_config = desc["layoutConfig"]
                else:
                    # Built-in templates: legacy layout + layoutProps
                    layout = desc.get("layout", fallback)
                    layout_props = desc.get("layoutProps", {})
            except (json.JSONDecodeError, TypeError):
                pass

        # Check if image should be hidden for this scene (at most one image per scene)
        hide_image = layout_props.get("hideImage", False)
        raw_images = [] if hide_image else scene_image_map.get(i, [])
        scene_images = raw_images[:1]

        # Short on-screen text (display_text) vs full voiceover narration (narration_text)
        on_screen_text = getattr(scene, "display_text", None) or scene.narration_text

        extra_hold = getattr(scene, "extra_hold_seconds", None) or 0.0
        effective_duration = scene.duration_seconds + extra_hold
        scene_entry: dict = {
            "id": scene.id,
            "order": scene.order,
            "title": scene.title,
            "narration": on_screen_text,
            "displayText": on_screen_text,
            "narrationText": scene.narration_text or "",
            "visualDescription": scene.visual_description,
            "durationSeconds": round(effective_duration, 1),
            "voiceoverFile": voiceover_filename,
            "images": scene_images,
        }

        if layout_config is not None:
            # Custom templates: universal layout config
            scene_entry["layoutConfig"] = layout_config
            # Pass structured content (bullets, metrics, quotes, etc.) for AI scene components
            try:
                desc_parsed = json.loads(scene.remotion_code) if scene.remotion_code else {}
                sc = desc_parsed.get("structuredContent")
                if sc:
                    scene_entry["structuredContent"] = sc
            except (json.JSONDecodeError, TypeError):
                pass
            logger.info("[REMOTION] Scene %s: layoutConfig → arrangement=%s, elements=%s, decorations=%s, structuredContent=%s", i, layout_config.get("arrangement"), len(layout_config.get("elements", [])), layout_config.get("decorations"), scene_entry.get("structuredContent", {}).get("contentType", "none"))
        else:
            # Built-in templates: legacy format
            scene_entry["layout"] = layout
            scene_entry["layoutProps"] = layout_props
            logger.info("[REMOTION] Scene %s: legacy → layout=%s, layoutProps keys=%s", i, layout, list(layout_props.keys()))

        scene_data.append(scene_entry)

    # Copy logo to public dir if available
    logo_file = None
    # Try to find the logo locally first, then fall back to R2
    logo_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
    logo_local = None
    for ext_candidate in ("png", "jpg", "jpeg", "webp", "svg"):
        candidate = os.path.join(logo_dir, f"logo.{ext_candidate}")
        if os.path.exists(candidate):
            logo_local = candidate
            break

    if logo_local:
        logo_ext = logo_local.rsplit(".", 1)[-1]
        logo_dest = os.path.join(public_dir, f"logo.{logo_ext}")
        _copy_file(logo_local, logo_dest)
        logo_file = f"logo.{logo_ext}"
    elif project.logo_r2_url:
        logo_ext = project.logo_r2_url.rsplit(".", 1)[-1] if "." in project.logo_r2_url else "png"
        logo_dest = os.path.join(public_dir, f"logo.{logo_ext}")
        if _download_url_to_file(project.logo_r2_url, logo_dest):
            logo_file = f"logo.{logo_ext}"

    data = {
        "projectName": project.name,
        "heroImage": hero_image_file,
        "accentColor": project.accent_color or "#7C3AED",
        "bgColor": project.bg_color or "#FFFFFF",
        "textColor": project.text_color or "#000000",
        "fontFamily": getattr(project, "font_family", None),
        "logo": logo_file,
        "logoPosition": getattr(project, "logo_position", None) or "bottom_right",
        "logoOpacity": getattr(project, "logo_opacity", 0.9) or 0.9,
        "logoSize": float(getattr(project, "logo_size", 100)),
        "aspectRatio": getattr(project, "aspect_ratio", None) or "landscape",
        "scenes": scene_data,
    }

    # Include theme + brandColors for custom templates (GeneratedVideo composition)
    if is_custom_template(template_id):
        from app.services.template_service import _load_custom_template_data
        custom_data = _load_custom_template_data(template_id, db=db)
        if custom_data and custom_data.get("theme"):
            data["theme"] = custom_data["theme"]
            theme_colors = custom_data["theme"].get("colors", {})
            logger.info("[REMOTION] Custom theme loaded for %s: style=%s, accent=%s", template_id, custom_data["theme"].get("style"), theme_colors.get("accent"))

            data["brandColors"] = {
                "primary": theme_colors.get("accent", "#7C3AED"),
                "secondary": theme_colors.get("surface", "#F5F5F5"),
                "accent": theme_colors.get("accent", "#7C3AED"),
                "background": theme_colors.get("bg", "#FFFFFF"),
                "text": theme_colors.get("text", "#1A1A2E"),
            }
            # Tag each scene with a sceneType for GeneratedVideo
            total = len(scene_data)
            content_codes = custom_data.get("content_codes") or []
            num_content_variants = len(content_codes) if content_codes else 1
            data["contentVariantCount"] = num_content_variants
            pass  # variant count set

            # Assign scene types and content variant indices.
            # Content variants cycle evenly (0, 1, 2, 3, 4, 0, 1, ...) so each content
            # scene gets a visually different design regardless of contentType.
            # Previously routed by contentType, but most blog content produces "plain"
            # which caused all scenes to use the same variant.
            content_idx = 0
            for idx, sd in enumerate(scene_data):
                scene_obj = scenes[idx] if idx < len(scenes) else None
                db_type = getattr(scene_obj, "scene_type", None) if scene_obj else None

                # Check for explicit per-scene overrides from variant switching
                override_type = None
                override_variant = None
                if scene_obj and scene_obj.remotion_code:
                    try:
                        desc = json.loads(scene_obj.remotion_code)
                        override_type = desc.get("sceneTypeOverride")
                        override_variant = desc.get("contentVariantIndex")
                    except (json.JSONDecodeError, TypeError):
                        pass

                # Priority: override > db_type > position-based
                if override_type in ("intro", "content", "outro"):
                    sd["sceneType"] = override_type
                elif db_type in ("intro", "content", "outro"):
                    sd["sceneType"] = db_type
                elif idx == 0:
                    sd["sceneType"] = "intro"
                elif idx == total - 1 and total > 1:
                    sd["sceneType"] = "outro"
                else:
                    sd["sceneType"] = "content"
                # Assign content variant index for content scenes
                if sd["sceneType"] == "content":
                    if override_variant is not None:
                        sd["contentVariantIndex"] = override_variant % num_content_variants
                    else:
                        # Cycle evenly through all variants for visual diversity
                        sd["contentVariantIndex"] = content_idx % num_content_variants
                    content_idx += 1
            logger.info(
                "GeneratedVideo: brandColors and sceneTypes set for %d scenes (%d content variants)",
                total, num_content_variants,
            )

            # Include brand logo if available via BrandKit
            # Use brand logo as fallback when no project-level logo was uploaded
            brand_kit = custom_data.get("brand_kit")
            if brand_kit:
                logos = brand_kit.get("logos", [])
                if logos:
                    primary = logos[0] if isinstance(logos[0], dict) else {"url": logos[0]}
                    logo_url = primary.get("url", "")
                    if logo_url:
                        logo_filename = "brand-logo.png"
                        logo_dest = os.path.join(public_dir, logo_filename)
                        if _download_url_to_file(logo_url, logo_dest):
                            # Set as main logo if no project logo exists
                            if not data.get("logo"):
                                data["logo"] = logo_filename
                            data["brandLogo"] = logo_filename
                            logger.info("Brand logo downloaded to workspace: %s", logo_filename)

                # Pass brand images for AI scene components
                brand_images_raw = brand_kit.get("images", [])
                if isinstance(brand_images_raw, list) and brand_images_raw:
                    brand_image_files = []
                    for bi_idx, bi in enumerate(brand_images_raw[:5]):
                        bi_url = bi if isinstance(bi, str) else (bi.get("url", "") if isinstance(bi, dict) else "")
                        if bi_url:
                            bi_ext = bi_url.rsplit(".", 1)[-1].split("?")[0] if "." in bi_url else "png"
                            bi_filename = f"brand_img_{bi_idx}.{bi_ext}"
                            bi_dest = os.path.join(public_dir, bi_filename)
                            if _download_url_to_file(bi_url, bi_dest):
                                brand_image_files.append(bi_filename)
                    if brand_image_files:
                        data["brandImages"] = brand_image_files
                        logger.info("Brand images downloaded to workspace: %s", brand_image_files)
        else:
            logger.warning("[REMOTION] No theme found for custom template %s", template_id)
    data_path = os.path.join(public_dir, "data.json")
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return data_path


# ─── Studio (local dev subprocess — for paid users) ──────────


def launch_studio(project: Project, db: Session) -> int:
    """Launch Remotion Studio from the project workspace."""
    stop_studio(project.id)

    workspace = get_workspace_dir(project.id)

    studio_port = 3100 + (project.id % 100)
    npx = shutil.which("npx") or "npx"
    studio_cmd = [
        npx,
        "remotion",
        "studio",
        "--port",
        str(studio_port),
        "--no-open",
    ]

    studio_proc = subprocess.Popen(
        studio_cmd,
        cwd=workspace,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=(os.name == "nt"),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )
    _studio_processes[project.id] = studio_proc

    project.studio_port = studio_port
    db.commit()

    return studio_port


def stop_studio(project_id: int) -> None:
    """Stop running Remotion Studio subprocess."""
    process = _studio_processes.pop(project_id, None)
    if process and process.poll() is None:
        try:
            if os.name == "nt":
                process.terminate()
            else:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except (ProcessLookupError, OSError):
            pass


# ─── Studio zip download (for production / paid users) ────────


def create_studio_zip(project_id: int) -> str:
    """
    Create a downloadable zip of the project's Remotion workspace.
    Excludes node_modules (users run npm install themselves).
    Returns the path to the zip file.
    """
    workspace = get_workspace_dir(project_id)
    if not os.path.exists(workspace):
        raise FileNotFoundError(f"Workspace not found for project {project_id}")

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(workspace):
            # Skip node_modules (it's a junction/symlink to shared template)
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for f in files:
                full_path = os.path.join(root, f)
                arc_name = os.path.relpath(full_path, workspace)
                zf.write(full_path, arc_name)

    return tmp.name


# ─── Render ───────────────────────────────────────────────────


def get_render_progress(project_id: int) -> dict:
    """Return the current render progress for a project."""
    return _render_progress.get(project_id, {})


# Resolution presets: label -> (width, height, scale)
# Landscape: base is 1920x1080; Portrait: base is 1080x1920
# Scale values must produce exact integer dimensions to avoid Remotion errors.
# Instead of computing scale from target/base, we use --width/--height overrides
# for sub-1080p resolutions, which guarantees integer output.
RESOLUTION_PRESETS = {
    "landscape": {
        "480p":  {"width": 854,  "height": 480},
        "720p":  {"width": 1280, "height": 720},
        "1080p": {"width": 1920, "height": 1080},
    },
    "portrait": {
        "480p":  {"width": 480,  "height": 854},
        "720p":  {"width": 720,  "height": 1280},
        "1080p": {"width": 1080, "height": 1920},
    },
}


def _build_render_cmd(
    npx: str, output_path: str, resolution: str = "1080p",
    aspect_ratio: str = "landscape",
    composition_id: str = "DefaultVideo",
) -> list[str]:
    """Build the Remotion render command with resolution scaling and optimizations."""
    """Build the Remotion render command. Always renders at native 1080p — no --scale."""
    is_portrait = aspect_ratio == "portrait"

    cmd = [
        npx, "remotion", "render", composition_id, output_path,
        "--concurrency", "100%",              # use all CPU cores
        "--enable-multiprocess-on-linux",     # separate processes per frame (avoids GIL)
        "--gl", "angle",                      # faster OpenGL on Linux/Cloud Run
        "--jpeg-quality", "70",               # faster encoding, minimal quality loss
        "--bundle-cache", "true",             # reuse webpack bundle across renders
        "--timeout", "60000",                 # 60s timeout for delayRender (font loading)
    ]

    # Always use explicit --width / --height to guarantee integer dimensions
    # Presets already handle both landscape and portrait correctly
    presets = RESOLUTION_PRESETS.get(aspect_ratio, RESOLUTION_PRESETS["landscape"])
    preset = presets.get(resolution, presets["1080p"])
    cmd.extend(["--width", str(preset["width"]), "--height", str(preset["height"])])

    return cmd


def render_video(project: Project, resolution: str = "1080p") -> str:
    """Render the video synchronously from the project workspace."""
    # Ensure workspace has ALL templates before rendering
    template_id_sync = validate_template_id(getattr(project, "template", "default"))
    provision_workspace(project.id, template_id_sync)
    workspace = get_workspace_dir(project.id)
    output_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/output")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "video.mp4")
    aspect_ratio = getattr(project, "aspect_ratio", "landscape") or "landscape"
    template_id = validate_template_id(getattr(project, "template", "default"))
    composition_id = get_composition_id(template_id)

    npx = shutil.which("npx") or "npx"
    cmd = _build_render_cmd(npx, output_path, resolution, aspect_ratio, composition_id)

    result = subprocess.run(
        cmd,
        cwd=workspace,
        shell=(os.name == "nt"),
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Remotion render failed: {result.stderr}")

    return output_path


MAX_RENDER_RETRIES = 3  # total attempts (1 initial + 2 retries)


def start_render_async(project: Project, resolution: str = "1080p") -> None:
    """Kick off the Remotion render as a background subprocess with progress tracking."""
    # Ensure workspace has ALL templates before rendering (Root.tsx imports them all)
    template_id = validate_template_id(getattr(project, "template", "default"))
    provision_workspace(project.id, template_id)
    workspace = get_workspace_dir(project.id)
    output_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/output")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "video.mp4")
    aspect_ratio = getattr(project, "aspect_ratio", "landscape") or "landscape"
    template_id = validate_template_id(getattr(project, "template", "default"))
    composition_id = get_composition_id(template_id)

    npx = shutil.which("npx") or "npx"
    cmd = _build_render_cmd(npx, output_path, resolution, aspect_ratio, composition_id)
    logger.info("[RENDER] project=%s template=%s resolution=%s aspect_ratio=%s", project.id, project.template, resolution, aspect_ratio)

    _render_progress[project.id] = {
        "progress": 0,
        "total_frames": 0,
        "rendered_frames": 0,
        "done": False,
        "error": None,
        "output_path": output_path,
        "time_remaining": None,
        "_cmd": cmd,
        "_workspace": workspace,
        "_attempt": 1,
    }

    _launch_render_process(project.id, cmd, workspace)


def _launch_render_process(project_id: int, cmd: list[str], workspace: str) -> None:
    """Spawn the Remotion render subprocess and wire up stream readers + waiter."""
    process = subprocess.Popen(
        cmd,
        cwd=workspace,
        shell=(os.name == "nt"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

    for stream in (process.stdout, process.stderr):
        t = threading.Thread(
            target=_read_render_stream,
            args=(project_id, stream),
            daemon=True,
        )
        t.start()

    threading.Thread(
        target=_wait_render, args=(project_id, process), daemon=True
    ).start()


# ─── Render stream parsing ────────────────────────────────────


def _read_render_stream(project_id: int, stream) -> None:
    """Read raw byte stream, splitting on \\r and \\n for Remotion progress."""
    frame_pat = re.compile(r"Rendered\s+(\d+)\s*/\s*(\d+)")
    time_pat = re.compile(r"time remaining:\s*(.+?)$")

    buf = b""
    try:
        while True:
            ch = stream.read(1)
            if not ch:
                break
            if ch in (b"\r", b"\n"):
                if buf:
                    _parse_render_line(
                        project_id,
                        buf.decode("utf-8", errors="replace"),
                        frame_pat,
                        time_pat,
                    )
                    buf = b""
            else:
                buf += ch
        if buf:
            _parse_render_line(
                project_id,
                buf.decode("utf-8", errors="replace"),
                frame_pat,
                time_pat,
            )
    except Exception:
        pass


def _parse_render_line(project_id: int, line: str, frame_pat, time_pat) -> None:
    """Parse a single line of Remotion render output for progress info."""
    line = line.strip()
    if not line:
        return

    # Log non-progress lines (errors, warnings) for debugging
    if "error" in line.lower() or "Error" in line or "Cannot" in line or "Module not found" in line:
        logger.debug("[REMOTION][project %s] %s", project_id, line)

    m = frame_pat.search(line)
    if m:
        rendered = int(m.group(1))
        total = int(m.group(2))
        _render_progress[project_id]["rendered_frames"] = rendered
        _render_progress[project_id]["total_frames"] = total
        if total > 0:
            _render_progress[project_id]["progress"] = round(
                (rendered / total) * 100
            )
        tm = time_pat.search(line)
        if tm:
            _render_progress[project_id]["time_remaining"] = tm.group(1).strip()


def _wait_render(project_id: int, process: subprocess.Popen) -> None:
    """Wait for the render process to finish. Auto-retry on failure using cached bundle."""
    import time

    try:
        # Wait for the render process to fully exit on its own.
        # Do NOT try to terminate early — after all frames are rendered,
        # Remotion still needs time to encode/mux the final MP4.
        process.wait()  # block until process exits naturally

        retcode = process.returncode
        prog = _render_progress.get(project_id, {})
        output_path = prog.get("output_path", "")

        if retcode == 0 and output_path and os.path.exists(output_path) and _is_valid_mp4(output_path):
            _render_progress[project_id]["progress"] = 100
            _render_progress[project_id]["rendered_frames"] = prog.get("total_frames", 0)

            # Upload rendered video to R2 (also sets ProjectStatus.DONE in DB)
            r2_url = upload_rendered_video_to_r2(project_id, output_path)

            # If R2 is not configured, still mark project as DONE in DB
            if not r2_url:
                try:
                    from app.database import SessionLocal
                    from app.models.project import Project, ProjectStatus
                    db = SessionLocal()
                    try:
                        project = db.query(Project).filter(Project.id == project_id).first()
                        if project:
                            project.status = ProjectStatus.DONE
                            user = db.query(User).filter(User.id == project.user_id).first()
                            db.commit()
                            logger.info("[REMOTION] Project %s marked DONE (no R2)", project_id)

                            # Send download-ready email (link to dashboard since no CDN URL)
                            try:
                                if user:
                                    dashboard_url = f"{settings.FRONTEND_URL}/project/{project_id}"
                                    email_service.send_download_ready_email(
                                        user_email=user.email,
                                        user_name=user.name,
                                        project_name=project.name,
                                        video_url=dashboard_url,
                                    )
                            except EmailServiceError as email_err:
                                logger.error(f"[REMOTION] Download email failed for project {project_id}: {email_err}")
                            except Exception as email_err:
                                logger.error(f"[REMOTION] Unexpected error sending download email for project {project_id}: {email_err}", exc_info=True)
                    finally:
                        db.close()
                except Exception as e:
                    logger.exception("[REMOTION] Failed to update project status: %s", e)

            # Clean up the workspace to free disk space
            workspace = get_workspace_dir(project_id)
            safe_remove_workspace(workspace)
            logger.info("[REMOTION] Cleaned up workspace for project %s", project_id)

            # NOW mark as done in progress dict for polling endpoint
            _render_progress[project_id]["done"] = True
        elif retcode == 0:
            # Process exited OK but no valid MP4 found
            _render_progress[project_id]["error"] = "Render completed but no valid video file was produced"
            _render_progress[project_id]["done"] = True
        else:
            # ── Render failed — auto-retry with cached bundle ──
            attempt = prog.get("_attempt", 1)
            cmd = prog.get("_cmd")
            workspace = prog.get("_workspace")

            if attempt < MAX_RENDER_RETRIES and cmd and workspace:
                next_attempt = attempt + 1
                delay = 3 * attempt  # 3s, 6s backoff
                logger.warning(
                    "[REMOTION] Render failed (exit %s) for project %s, retrying %s/%s in %ss (bundle cache reused)",
                    retcode, project_id, next_attempt, MAX_RENDER_RETRIES, delay,
                )
                time.sleep(delay)

                # Reset progress for the retry but keep internal state
                _render_progress[project_id].update({
                    "progress": 0,
                    "rendered_frames": 0,
                    "total_frames": 0,
                    "done": False,
                    "error": None,
                    "time_remaining": None,
                    "_attempt": next_attempt,
                })
                _launch_render_process(project_id, cmd, workspace)
            else:
                _render_progress[project_id]["error"] = (
                    f"Render failed (exit code {retcode}) after {attempt} attempt(s)"
                )
                _render_progress[project_id]["done"] = True
    except Exception as e:
        _render_progress[project_id]["error"] = str(e)
        _render_progress[project_id]["done"] = True


def _is_valid_mp4(path: str) -> bool:
    """Quick check that a file looks like a valid MP4 (has ftyp box)."""
    try:
        with open(path, "rb") as f:
            header = f.read(12)
        if len(header) < 8:
            return False
        # MP4 files start with a box: [size(4 bytes)][type(4 bytes)]
        # Common types: ftyp, moov, free, mdat
        box_type = header[4:8]
        return box_type in (b"ftyp", b"moov", b"free", b"mdat", b"wide", b"skip")
    except Exception:
        return False


def upload_rendered_video_to_r2(project_id: int, local_path: str) -> Optional[str]:
    """
    Upload the rendered video to R2 and update the project record.
    Called after a successful render. Returns the R2 URL or None.
    """
    if not r2_storage.is_r2_configured():
        return None

    try:
        # Fetch project to get user_id for R2 key namespacing
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            from app.models.project import Project
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                logger.warning("[REMOTION] Project %s not found — skipping R2 upload", project_id)
                return None

            user_id = project.user_id
            # Use a versioned key so each render (including re-render) gets a new URL.
            # That way the project's URL updates and caches don't serve the old video.
            version = str(int(time.time()))
            if project.r2_video_key:
                r2_storage.delete_object(project.r2_video_key)
            r2_url = r2_storage.upload_project_video_versioned(
                user_id, project_id, local_path, version
            )
            r2_key = r2_storage.video_key_versioned(user_id, project_id, version)

            project.r2_video_key = r2_key
            project.r2_video_url = r2_url
            # Also mark project as DONE in DB so status persists even if
            # the polling endpoint never gets called (e.g. user closed tab,
            # Cloud Run instance restarted, etc.)
            from app.models.project import ProjectStatus
            project.status = ProjectStatus.DONE
            user = db.query(User).filter(User.id == project.user_id).first()
            db.commit()
            logger.info("[REMOTION] Video uploaded to R2 and project %s marked DONE", project_id)

            # Send download-ready email notification to the user
            try:
                if user:
                    email_service.send_download_ready_email(
                        user_email=user.email,
                        user_name=user.name,
                        project_name=project.name,
                        video_url=r2_url,
                    )
            except EmailServiceError as email_err:
                logger.error(f"[REMOTION] Download email failed for project {project_id}: {email_err}")
            except Exception as email_err:
                logger.error(f"[REMOTION] Unexpected error sending download email for project {project_id}: {email_err}", exc_info=True)
        finally:
            db.close()

        return r2_url
    except Exception as e:
        logger.exception("[REMOTION] R2 video upload failed for project %s: %s", project_id, e)
        return None


# ─── Internal helpers ─────────────────────────────────────────


def _download_url_to_file(url: str, dest: str) -> bool:
    """
    Download a file from a URL (typically R2 public URL) to a local path.
    Used when rebuilding workspaces on a different Cloud Run container
    where local files don't exist but R2 assets are available.
    Returns True on success, False on failure.
    """
    try:
        resp = requests.get(url, timeout=30, stream=True)
        resp.raise_for_status()
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info("[REMOTION] Downloaded from R2: %s", os.path.basename(dest))
        return True
    except Exception as e:
        logger.warning("[REMOTION] Failed to download %s: %s", url, e)
        return False


def _copy_file(src: str, dest: str) -> None:
    """Copy a file from src to dest."""
    if os.path.abspath(src) != os.path.abspath(dest):
        shutil.copy2(src, dest)
