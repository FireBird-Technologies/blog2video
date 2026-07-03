"""Collaboration live-edit application.

Collaborators co-edit a project in real time and their edits apply **directly**
to the published Scene/Project rows (there is no separate draft overlay). This
module owns the editable-field whitelist, the published snapshot used to seed a
joining client, and the operations that write an edit onto the live rows while
recording attributed history (target="published").

Only a whitelist of fields is editable via collaboration — the same manual fields
already tracked by the edit history, never derived/system fields (voiceover paths,
ports, tokens, render keys, etc.).
"""

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.scene import Scene
from app.services.edit_tracker import track_scene_edit, track_project_edit


# Fields a collaborator may edit on a scene (mirrors MANUAL_TRACKED_FIELDS in
# projects.py — the manual, user-editable content fields).
SCENE_EDITABLE_FIELDS = {
    "title",
    "narration_text",
    "display_text",
    "visual_description",
    "remotion_code",
    "duration_seconds",
    "extra_hold_seconds",
    "bgm_volume",
    "preferred_layout",
}

# Project-level fields a collaborator may edit.
PROJECT_EDITABLE_FIELDS = {
    "name",
    "accent_color",
    "bg_color",
    "text_color",
    "font_family",
    "captions_enabled",
    "caption_position",
    "caption_font_family",
    "caption_font_size",
    "caption_offset",
    "bgm_track_id",
    "bgm_volume",
    "playback_speed",
    "logo_position",
    "logo_opacity",
    "logo_size",
}


def _scene_snapshot(scene: Scene) -> dict:
    d = {"id": scene.id}
    for f in SCENE_EDITABLE_FIELDS:
        d[f] = getattr(scene, f, None)
    d["order"] = scene.order
    return d


def _project_snapshot(project: Project) -> dict:
    return {f: getattr(project, f, None) for f in PROJECT_EDITABLE_FIELDS}


def build_published_snapshot(project: Project, db: Session) -> dict:
    """Full editable snapshot of the current published state.

    Used to seed a joining collaborator so their editor matches the live rows.
    """
    scenes = (
        db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.order).all()
    )
    return {
        "project": _project_snapshot(project),
        "scenes": [_scene_snapshot(s) for s in scenes],
    }


def apply_scene_field(
    project: Project,
    scene_id: int,
    field_name: str,
    new_value: Any,
    *,
    user_id: int,
    change_set_id: str,
    db: Session,
) -> Optional[dict]:
    """Apply a scene field edit directly to the live scene row.

    Records an attributed history row with target="published". Returns the
    updated scene snapshot. Raises ValueError on a non-editable field or unknown
    scene.
    """
    if field_name not in SCENE_EDITABLE_FIELDS:
        raise ValueError(f"Field '{field_name}' is not editable via collaboration.")

    scene = (
        db.query(Scene)
        .filter(Scene.project_id == project.id, Scene.id == scene_id)
        .first()
    )
    if scene is None:
        raise ValueError(f"Scene {scene_id} not found.")

    old_value = getattr(scene, field_name, None)
    if old_value == new_value:
        return _scene_snapshot(scene)  # no-op

    track_scene_edit(
        db,
        project_id=project.id,
        scene_id=scene_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        is_ai_assisted=False,
        user_id=user_id,
        change_set_id=change_set_id,
        target="published",
    )
    setattr(scene, field_name, new_value)
    db.commit()
    return _scene_snapshot(scene)


def apply_project_field(
    project: Project,
    field_name: str,
    new_value: Any,
    *,
    user_id: int,
    change_set_id: str,
    db: Session,
) -> dict:
    """Apply a project-level field edit directly to the live project row."""
    if field_name not in PROJECT_EDITABLE_FIELDS:
        raise ValueError(f"Field '{field_name}' is not editable via collaboration.")

    old_value = getattr(project, field_name, None)
    if old_value == new_value:
        return _project_snapshot(project)

    track_project_edit(
        db,
        project_id=project.id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        is_ai_assisted=False,
        user_id=user_id,
        change_set_id=change_set_id,
        target="published",
    )
    setattr(project, field_name, new_value)
    db.commit()
    return _project_snapshot(project)
