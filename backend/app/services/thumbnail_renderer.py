"""
Thumbnail Renderer — Renders a single-frame PNG thumbnail of a custom template.

Uses the Remotion CLI to render frame 0 at 480p, uploads to R2 for fast gallery previews.
Runs as a background task after code generation — failure is non-critical.
"""

import json
import logging
import os
import shutil
import subprocess
import time

from app.config import settings
from app.services import r2_storage

logger = logging.getLogger(__name__)


def render_template_thumbnail(template_id: int, user_id: int) -> str | None:
    """
    Render a single frame of a custom template as a PNG thumbnail.

    Creates a minimal workspace with the template's generated code,
    writes a mock data.json with 1 scene, renders frame 0 at 480p,
    uploads the PNG to R2, returns the URL. Returns None on failure.
    """
    from app.services.template_service import _load_custom_template_data
    from app.services.remotion import (
        provision_workspace,
        _write_generated_scene_files,
        get_workspace_dir,
        safe_remove_workspace,
    )

    cache_key = f"custom_{template_id}"
    custom_data = _load_custom_template_data(cache_key)
    if not custom_data or not custom_data.get("has_generated_code"):
        return None

    theme = custom_data.get("theme", {})
    theme_colors = theme.get("colors", {})

    # Use a negative project ID to avoid collision with real projects
    temp_project_id = -(template_id * 1000 + int(time.time()) % 1000)

    try:
        workspace = provision_workspace(temp_project_id, cache_key)
    except Exception as e:
        logger.warning("Thumbnail: workspace provision failed for template %d: %s", template_id, e)
        return None

    try:
        # Write mock data.json with a single intro scene
        public_dir = os.path.join(workspace, "public")
        os.makedirs(public_dir, exist_ok=True)

        mock_data = {
            "projectName": custom_data.get("name", "Preview"),
            "accentColor": theme_colors.get("accent", "#7C3AED"),
            "bgColor": theme_colors.get("bg", "#FFFFFF"),
            "textColor": theme_colors.get("text", "#1A1A2E"),
            "fontFamily": theme.get("fonts", {}).get("heading", "Inter"),
            "brandColors": {
                "primary": theme_colors.get("accent", "#7C3AED"),
                "secondary": theme_colors.get("surface", "#F5F5F5"),
                "accent": theme_colors.get("accent", "#7C3AED"),
                "background": theme_colors.get("bg", "#FFFFFF"),
                "text": theme_colors.get("text", "#1A1A2E"),
            },
            "logoPosition": "bottom_right",
            "logoOpacity": 0.9,
            "logoSize": 100,
            "aspectRatio": "landscape",
            "scenes": [
                {
                    "id": 1,
                    "order": 1,
                    "title": custom_data.get("name", "Your Brand"),
                    "displayText": custom_data.get("name", "Your Brand Story"),
                    "narration": "Your Brand Story Comes to Life",
                    "durationSeconds": 3,
                    "voiceoverFile": None,
                    "images": [],
                    "sceneType": "intro",
                }
            ],
        }

        data_path = os.path.join(public_dir, "data.json")
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(mock_data, f, indent=2)

        # Render frame 0 as a still image
        npx = shutil.which("npx") or "npx"
        output_path = os.path.join(workspace, "thumbnail.png")

        cmd = [
            npx, "remotion", "still", "GeneratedVideo", output_path,
            "--frame", "0",
            "--width", "854",
            "--height", "480",
            "--gl", "swangle", 
            "--timeout", "30000",
            "--bundle-cache", "true",
        ]

        result = subprocess.run(
            cmd,
            cwd=workspace,
            shell=(os.name == "nt"),
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            logger.warning("Thumbnail render failed for template %d: %s", template_id, result.stderr[:500])
            return None

        if not os.path.exists(output_path):
            logger.warning("Thumbnail file not found after render for template %d", template_id)
            return None

        # Upload to R2
        key = r2_storage.brand_asset_key(user_id, template_id, "thumbnail.png")
        url = r2_storage.upload_file(output_path, key, content_type="image/png")
        if url:
            logger.info("Thumbnail uploaded for template %d: %s", template_id, url)
        return url or None

    except subprocess.TimeoutExpired:
        logger.warning("Thumbnail render timed out for template %d", template_id)
        return None
    except Exception as e:
        logger.warning("Thumbnail render error for template %d: %s", template_id, e)
        return None
    finally:
        # Clean up temporary workspace
        try:
            safe_remove_workspace(get_workspace_dir(temp_project_id))
        except Exception:
            pass
