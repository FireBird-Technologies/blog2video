# app/services/edit_tracker.py

from typing import Optional
from sqlalchemy.orm import Session
from app.models.scene_edit_history import SceneEditHistory
from app.models.Project_edit_history import ProjectEditHistory


def _stringify(value):
    if value is None:
        return None
    return str(value)


def track_scene_edit(
    db: Session,
    *,
    project_id: int,
    scene_id: int,
    field_name: str,
    old_value,
    new_value,
    is_ai_assisted: bool,
    user_instruction: Optional[str] = None,
):
    if old_value == new_value:
        return

    history = SceneEditHistory(
        project_id=project_id,
        scene_id=scene_id,
        field_name=field_name,
        old_value=_stringify(old_value),
        new_value=_stringify(new_value),
        user_instruction=user_instruction if is_ai_assisted else None,
        is_ai_assisted=is_ai_assisted,
    )

    db.add(history)


def track_project_edit(
    db: Session,
    *,
    project_id: int,
    field_name: str,
    old_value,
    new_value,
    is_ai_assisted: bool = False,
):
    if old_value == new_value:
        return

    history = ProjectEditHistory(
        project_id=project_id,
        field_name=field_name,
        old_value=_stringify(old_value),
        new_value=_stringify(new_value),
        is_ai_assisted=is_ai_assisted,
    )

    db.add(history)