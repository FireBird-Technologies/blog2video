# app/services/edit_tracker.py

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.scene_edit_history import SceneEditHistory
from app.models.Project_edit_history import ProjectEditHistory

# Cap on retained edit history per project — global (project) + per-scene edits
# combined. Kept as whole change-sets (one user action = one change-set) so
# reverts stay intact; the oldest change-sets beyond this are deleted.
MAX_HISTORY_CHANGE_SETS = 50


def new_change_set_id() -> str:
    """Generate an id that groups all field-rows from one user action."""
    return uuid.uuid4().hex


def prune_project_history(
    db: Session, project_id: int, limit: int = MAX_HISTORY_CHANGE_SETS
) -> None:
    """Keep only the ``limit`` most-recent change-sets for a project, across both
    the project and scene history tables combined; delete rows of older ones.

    A change-set (all field-rows from one user action, sharing ``change_set_id``)
    is the unit so reverts never see a partial set. Ungrouped legacy rows without
    a ``change_set_id`` each count as their own change-set, matching how the
    history endpoints group them. Flushes pending inserts first so freshly tracked
    edits are included in the ranking.
    """
    db.flush()

    rows = [
        (r.change_set_id, f"p{r.id}", r.edited_at, "project", r.id)
        for r in db.query(
            ProjectEditHistory.change_set_id,
            ProjectEditHistory.id,
            ProjectEditHistory.edited_at,
        ).filter(ProjectEditHistory.project_id == project_id)
    ] + [
        (r.change_set_id, f"s{r.id}", r.edited_at, "scene", r.id)
        for r in db.query(
            SceneEditHistory.change_set_id,
            SceneEditHistory.id,
            SceneEditHistory.edited_at,
        ).filter(SceneEditHistory.project_id == project_id)
    ]

    # Group by change-set (ungrouped rows stand alone), tracking each set's newest
    # edit for ranking.
    newest: dict[str, datetime] = {}
    for change_set_id, fallback_key, edited_at, _table, _rid in rows:
        key = change_set_id or fallback_key
        ts = edited_at or datetime.min
        if key not in newest or ts > newest[key]:
            newest[key] = ts

    if len(newest) <= limit:
        return

    # Keep the newest `limit` change-sets; everything older is pruned.
    keep = {
        key for key, _ts in sorted(newest.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    }

    proj_delete_ids: list[int] = []
    scene_delete_ids: list[int] = []
    for change_set_id, fallback_key, _edited_at, table, rid in rows:
        key = change_set_id or fallback_key
        if key in keep:
            continue
        if table == "project":
            proj_delete_ids.append(rid)
        else:
            scene_delete_ids.append(rid)

    if proj_delete_ids:
        db.query(ProjectEditHistory).filter(
            ProjectEditHistory.id.in_(proj_delete_ids)
        ).delete(synchronize_session=False)
    if scene_delete_ids:
        db.query(SceneEditHistory).filter(
            SceneEditHistory.id.in_(scene_delete_ids)
        ).delete(synchronize_session=False)


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
