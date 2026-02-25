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
from app.services import r2_storage
from app.services.email import email_service, EmailServiceError
from app.services.template_service import (
    validate_template_id,
    get_hero_layout,
    get_fallback_layout,
    get_composition_id,
    get_layouts_without_image,
)

logger = logging.getLogger(__name__)

# Track running studio processes: project_id -> subprocess.Popen
_studio_processes: dict[int, subprocess.Popen] = {}

# Render progress tracker: project_id -> { progress, total_frames, rendered_frames, done, error }
_render_progress: dict[int, dict] = {}

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
    "src/components/LogoOverlay.tsx"
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

    # Scan src/templates/{template_id}/ recursively for .tsx and .ts files
    template_dir = os.path.join(template_root, "src", "templates", template_id)
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
    """
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

    return workspace


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
    # 1. Check if scene has stored assignedImage in layoutProps (persistent assignment)
    # 2. Respect layoutProps.hideImage: when true, NEVER auto-assign a generic image
    # 3. Layouts in layouts_without_image: always treated as hideImage, clear any assignment
    # 4. Scene-specific images (scene_<sceneId>_...) always stay with their scene and
    #    clear any previous hideImage flag (unless layout doesn't support images)
    # 5. For scenes without assignment and not hideImage, assign generic images ONCE
    #    and store the assignment
    scene_image_map: dict[int, list[str]] = {i: [] for i in range(len(scenes))}
    scenes_need_update: list[Scene] = []  # Track scenes that need remotion_code update
    hide_image_flags: list[bool] = [False] * len(scenes)

    # Layouts that never display images for this template
    no_image_layouts: set[str] = get_layouts_without_image(template_id)

    if all_image_files and scenes:
        # Use project.assets for scene-specific detection (all_image_files has only filenames)
        image_assets = [
            a for a in project.assets
            if a.asset_type.value == "image" and not a.excluded
        ]
        # Deterministic order (helps keep preview/render consistent)
        try:
            image_assets.sort(key=lambda a: (a.created_at, a.id))
        except Exception:
            image_assets.sort(key=lambda a: a.id)

        # Track generic filenames already used by a scene (enforce 1 generic -> 1 scene)
        used_generic_files: set[str] = set()

        scene_specific: list[tuple[int, str]] = []
        generic_files: list[str] = []

        for asset in image_assets:
            m = re.match(r"^scene_(\d+)_", asset.filename)
            if m:
                scene_specific.append((int(m.group(1)), asset.filename))
            else:
                generic_files.append(asset.filename)

        scene_specific_files = {filename for _, filename in scene_specific}

        # First pass: Check for stored assignedImage + hideImage in each scene's layoutProps
        for i, scene in enumerate(scenes):
            layout_props = {}
            layout = get_fallback_layout(template_id)
            desc = None
            if scene.remotion_code:
                try:
                    desc = json.loads(scene.remotion_code)
                    layout = desc.get("layout", layout)
                    layout_props = desc.get("layoutProps", {}) or {}
                except (json.JSONDecodeError, TypeError):
                    pass

            # Layouts that don't support images are always treated as hideImage
            layout_no_image = layout in no_image_layouts
            if layout_no_image:
                hide_image_flags[i] = True
                # Clear any stale assignedImage and set hideImage in remotion_code
                changed = False
                if layout_props.get("assignedImage"):
                    layout_props.pop("assignedImage", None)
                    changed = True
                if not layout_props.get("hideImage"):
                    layout_props["hideImage"] = True
                    changed = True
                if changed and desc is not None:
                    desc["layoutProps"] = layout_props
                    scene.remotion_code = json.dumps(desc)
                    scenes_need_update.append(scene)
                continue  # No further assignment logic for this scene

            hide_image = bool(layout_props.get("hideImage", False))
            hide_image_flags[i] = hide_image

            assigned_image = layout_props.get("assignedImage")
            if assigned_image:
                if hide_image:
                    # Scene is explicitly marked to have no image; clear any stale assignedImage
                    layout_props.pop("assignedImage", None)
                    if desc is not None:
                        desc["layoutProps"] = layout_props
                        scene.remotion_code = json.dumps(desc)
                        scenes_need_update.append(scene)
                elif assigned_image in all_image_files:
                    # Validate and enforce uniqueness for generic assigned images.
                    # Scene-specific filenames must match the scene id in the prefix.
                    m = re.match(r"^scene_(\d+)_", str(assigned_image))
                    if m:
                        assigned_scene_id = int(m.group(1))
                        if assigned_scene_id != scene.id:
                            # Invalid: scene-specific image assigned to a different scene
                            layout_props.pop("assignedImage", None)
                            if desc is not None:
                                desc["layoutProps"] = layout_props
                                scene.remotion_code = json.dumps(desc)
                                scenes_need_update.append(scene)
                        else:
                            # Valid scene-specific assignment
                            scene_image_map[i] = [assigned_image]
                    else:
                        # Generic assignment: enforce 1:1 mapping
                        if assigned_image in used_generic_files:
                            # Duplicate generic assignment — clear so it can be re-assigned uniquely
                            layout_props.pop("assignedImage", None)
                            if desc is not None:
                                desc["layoutProps"] = layout_props
                                scene.remotion_code = json.dumps(desc)
                                scenes_need_update.append(scene)
                        else:
                            used_generic_files.add(str(assigned_image))
                            scene_image_map[i] = [assigned_image]
                else:
                    # Image was deleted - clear stale assignment
                    layout_props.pop("assignedImage", None)
                    if desc is not None:
                        desc["layoutProps"] = layout_props
                        scene.remotion_code = json.dumps(desc)
                        scenes_need_update.append(scene)
        
        # Second pass: Apply scene-specific images (overwrite stored assignments if scene-specific exists)
        # Skip scenes whose layout does not support images.
        for scene_id, filename in scene_specific:
            scene_idx = next((i for i, s in enumerate(scenes) if s.id == scene_id), -1)
            if scene_idx >= 0:
                scene = scenes[scene_idx]
                layout_props = {}
                layout = get_fallback_layout(template_id)
                if scene.remotion_code:
                    try:
                        desc = json.loads(scene.remotion_code)
                        layout = desc.get("layout", layout)
                        layout_props = desc.get("layoutProps", {}) or {}
                    except (json.JSONDecodeError, TypeError):
                        pass

                # Do not assign images to layouts that don't support them
                if layout in no_image_layouts:
                    continue

                scene_image_map[scene_idx] = [filename]
                # Update remotion_code to store scene-specific assignment (if not already set)
                # Only update if assignment changed
                if layout_props.get("assignedImage") != filename or layout_props.get("hideImage"):
                    layout_props["assignedImage"] = filename
                    # Uploading a scene-specific image should re-enable images even if hideImage was set
                    layout_props.pop("hideImage", None)
                    hide_image_flags[scene_idx] = False
                    scene.remotion_code = json.dumps({"layout": layout, "layoutProps": layout_props})
                    scenes_need_update.append(scene)

        # Third pass: Assign generic images to scenes without one yet (1 per scene)
        # IMPORTANT: Do NOT assign generics to scenes that have hideImage=true or
        # whose layout does not support images.
        generic_idx = 0
        for scene_idx in range(len(scenes)):
            # Resolve this scene's layout to check no_image_layouts
            scene = scenes[scene_idx]
            scene_layout = get_fallback_layout(template_id)
            if scene.remotion_code:
                try:
                    scene_layout = json.loads(scene.remotion_code).get("layout", scene_layout)
                except (json.JSONDecodeError, TypeError):
                    pass

            if (
                not scene_image_map[scene_idx]
                and not hide_image_flags[scene_idx]
                and scene_layout not in no_image_layouts
                and generic_idx < len(generic_files)
            ):
                # Pick next unused generic filename (enforce 1:1)
                assigned_filename = None
                while generic_idx < len(generic_files):
                    candidate = generic_files[generic_idx]
                    generic_idx += 1
                    if candidate in used_generic_files:
                        continue
                    if candidate in scene_specific_files:
                        continue
                    assigned_filename = candidate
                    break

                if assigned_filename is None:
                    continue

                scene_image_map[scene_idx] = [assigned_filename]
                used_generic_files.add(assigned_filename)
                # Store assignment in remotion_code (if not already set)
                layout_props = {}
                layout = get_fallback_layout(template_id)
                if scene.remotion_code:
                    try:
                        desc = json.loads(scene.remotion_code)
                        layout = desc.get("layout", layout)
                        layout_props = desc.get("layoutProps", {}) or {}
                    except (json.JSONDecodeError, TypeError):
                        pass
                # Only update if assignment changed
                if layout_props.get("assignedImage") != assigned_filename:
                    layout_props["assignedImage"] = assigned_filename
                    scene.remotion_code = json.dumps({"layout": layout, "layoutProps": layout_props})
                    scenes_need_update.append(scene)

    # Commit scene updates if any
    if scenes_need_update:
        try:
            db.commit()
        except Exception as e:
            print(f"[REBUILD_WORKSPACE] Failed to update scene assignments: {e}")
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
        if scene.remotion_code:
            try:
                desc = json.loads(scene.remotion_code)
                layout = desc.get("layout", fallback)
                layout_props = desc.get("layoutProps", {})
            except (json.JSONDecodeError, TypeError):
                pass

        # Check if image should be hidden for this scene (at most one image per scene)
        hide_image = layout_props.get("hideImage", False)
        raw_images = [] if hide_image else scene_image_map.get(i, [])
        scene_images = raw_images[:1]

        # Use display_text for on-screen text when available; otherwise fall back to narration_text.
        on_screen_text = getattr(scene, "display_text", None) or scene.narration_text

        scene_data.append(
            {
                "id": scene.id,
                "order": scene.order,
                "title": scene.title,
                "narration": on_screen_text,
                "visualDescription": scene.visual_description,
                "layout": layout,
                "layoutProps": layout_props,
                "durationSeconds": scene.duration_seconds,
                "voiceoverFile": voiceover_filename,
                "images": scene_images,
            }
        )

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
        "logo": logo_file,
        "logoPosition": getattr(project, "logo_position", None) or "bottom_right",
        "logoOpacity": getattr(project, "logo_opacity", 0.9) or 0.9,
        "logoSize": getattr(project, "logo_size", None) or "default",
        "aspectRatio": getattr(project, "aspect_ratio", None) or "landscape",
        "scenes": scene_data,
    }
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
        print(f"[REMOTION][project {project_id}] {line}")

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
                            db.commit()
                            print(f"[REMOTION] Project {project_id} marked DONE (no R2)")

                            # Send download-ready email (link to dashboard since no CDN URL)
                            try:
                                from app.models.user import User
                                user = db.query(User).filter(User.id == project.user_id).first()
                                if user:
                                    dashboard_url = f"{settings.FRONTEND_URL}/projects/{project_id}"
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
                    print(f"[REMOTION] Failed to update project status: {e}")

            # Clean up the workspace to free disk space
            workspace = get_workspace_dir(project_id)
            safe_remove_workspace(workspace)
            print(f"[REMOTION] Cleaned up workspace for project {project_id}")

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
                print(
                    f"[REMOTION] Render failed (exit {retcode}) for project {project_id}, "
                    f"retrying {next_attempt}/{MAX_RENDER_RETRIES} in {delay}s (bundle cache reused)..."
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
                print(f"[REMOTION] Project {project_id} not found — skipping R2 upload")
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
            db.commit()
            print(f"[REMOTION] Video uploaded to R2 and project {project_id} marked DONE")

            # Send download-ready email notification to the user
            try:
                from app.models.user import User
                user = db.query(User).filter(User.id == project.user_id).first()
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
        print(f"[REMOTION] R2 video upload failed for project {project_id}: {e}")
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
        print(f"[REMOTION] Downloaded from R2: {os.path.basename(dest)}")
        return True
    except Exception as e:
        print(f"[REMOTION] Failed to download {url}: {e}")
        return False


def _copy_file(src: str, dest: str) -> None:
    """Copy a file from src to dest."""
    if os.path.abspath(src) != os.path.abspath(dest):
        shutil.copy2(src, dest)
