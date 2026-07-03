# app/services/edit_tracker.py

import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models.scene_edit_history import SceneEditHistory
from app.models.Project_edit_history import ProjectEditHistory


def new_change_set_id() -> str:
    """Generate an id that groups all field-rows from one user action."""
    return uuid.uuid4().hex


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
    user_id: Optional[int] = None,
    change_set_id: Optional[str] = None,
    target: str = "published",
    revert_of_change_set_id: Optional[str] = None,
    revertable: bool = True,
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
        user_id=user_id,
        change_set_id=change_set_id,
        target=target,
        revert_of_change_set_id=revert_of_change_set_id,
        revertable=revertable,
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
    user_id: Optional[int] = None,
    change_set_id: Optional[str] = None,
    target: str = "published",
    revert_of_change_set_id: Optional[str] = None,
    revertable: bool = True,
):
    if old_value == new_value:
        return

    history = ProjectEditHistory(
        project_id=project_id,
        field_name=field_name,
        old_value=_stringify(old_value),
        new_value=_stringify(new_value),
        is_ai_assisted=is_ai_assisted,
        user_id=user_id,
        change_set_id=change_set_id,
        target=target,
        revert_of_change_set_id=revert_of_change_set_id,
        revertable=revertable,
    )

    db.add(history)


def log_project_event(
    db: Session,
    *,
    project_id: int,
    label: str,
    user_id: Optional[int] = None,
    is_ai_assisted: bool = True,
) -> None:
    """Record a non-revertable project-level event (e.g. 'Template changed to X').

    Bulk operations that rewrite many rows/files aren't field-diffable, so they're
    logged for visibility only. ``field_name`` holds a human label; there is no
    old/new value and ``revertable`` is False.
    """
    db.add(ProjectEditHistory(
        project_id=project_id,
        field_name=label,
        old_value=None,
        new_value=None,
        is_ai_assisted=is_ai_assisted,
        user_id=user_id,
        change_set_id=new_change_set_id(),
        target="published",
        revertable=False,
    ))


def log_scene_event(
    db: Session,
    *,
    project_id: int,
    scene_id: int,
    label: str,
    user_id: Optional[int] = None,
    is_ai_assisted: bool = True,
) -> None:
    """Record a non-revertable scene-level event (e.g. 'Audio regenerated')."""
    db.add(SceneEditHistory(
        project_id=project_id,
        scene_id=scene_id,
        field_name=label,
        old_value=None,
        new_value=None,
        is_ai_assisted=is_ai_assisted,
        user_id=user_id,
        change_set_id=new_change_set_id(),
        target="published",
        revertable=False,
    ))
