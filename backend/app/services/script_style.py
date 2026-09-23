"""Resolve built-in/personal video styles and immutable project snapshots."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.user import User
from app.services.video_styles import (
    BUILTIN_STYLE_DEFAULT_GUIDANCE,
    EDITABLE_BUILTIN_STYLE_IDS,
    effective_builtin_guidance,
    parse_custom_style_ref,
    resolve_custom_style,
)


VALID_VIDEO_STYLES = {"auto", "explainer", "promotional", "storytelling", "your_style"}

def is_personalized_style(style: str | None) -> bool:
    normalized = (style or "").strip().lower()
    return normalized == "your_style" or parse_custom_style_ref(normalized) is not None


def generation_style_for_project(project: Project) -> str:
    """Custom styles reuse the prompt's authoritative Your Style branch."""
    style = (project.video_style or "explainer").strip().lower()
    return "your_style" if is_personalized_style(style) else style


def snapshot_style_for_project(project: Project, user: User, db: Session | None = None) -> None:
    """Capture a profile at creation; never accept preference text from a client."""
    style = (project.video_style or "auto").strip().lower()
    if style == "your_style":
        profile = (user.script_preferences or "").strip()
        if not profile:
            # A stale client may submit Your Style after it was cleared.
            project.video_style = "auto"
            project.script_style_snapshot = None
            project.script_preferences_version_used = None
            return
        project.script_style_snapshot = profile
        project.script_preferences_version_used = user.script_preferences_version or 0
    elif parse_custom_style_ref(style) is not None:
        if db is None:
            raise ValueError("A database session is required to resolve a custom video style")
        custom = resolve_custom_style(db, user.id, style)
        if not custom:
            raise HTTPException(status_code=422, detail="The selected custom video style was not found.")
        guidance = custom.guidance.strip()
        if not guidance:
            # A stale client may submit a custom style whose guidance was since cleared.
            project.video_style = "explainer"
            project.script_style_snapshot = None
            project.script_preferences_version_used = None
            return
        project.script_style_snapshot = guidance
        project.script_preferences_version_used = None
    elif style in EDITABLE_BUILTIN_STYLE_IDS:
        if db is None:
            raise ValueError("A database session is required to resolve a built-in video style")
        guidance = effective_builtin_guidance(db, user.id, style)
        project.script_style_snapshot = guidance or BUILTIN_STYLE_DEFAULT_GUIDANCE[style]
        project.script_preferences_version_used = None
    else:
        project.script_style_snapshot = None
        project.script_preferences_version_used = None


def style_guidance_for_project(project: Project) -> str:
    style = (project.video_style or "explainer").strip().lower()
    snapshot = (project.script_style_snapshot or "").strip()
    if snapshot:
        return snapshot
    if is_personalized_style(style):
        return ""
    return BUILTIN_STYLE_DEFAULT_GUIDANCE.get(
        style, BUILTIN_STYLE_DEFAULT_GUIDANCE["explainer"]
    )
