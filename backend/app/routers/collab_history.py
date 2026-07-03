"""Collaboration: edit-history preview and revert/redo.

Preview groups per-field history rows by ``change_set_id`` and joins the acting
user so the UI can show "who changed what". Revert re-applies the *old* values of
a change-set onto the live rows and records the revert as its own change-set — so
redo is just reverting the revert, giving back-and-forth for free.
"""

import logging
from datetime import datetime
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.scene import Scene
from app.models.scene_edit_history import SceneEditHistory
from app.models.Project_edit_history import ProjectEditHistory
from app.services.access import get_accessible_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}", tags=["collaboration"])


# ─── Schemas ─────────────────────────────────────────────────────────

class FieldChange(BaseModel):
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    scene_id: Optional[int] = None


class ChangeSetOut(BaseModel):
    change_set_id: Optional[str]
    target: str
    edited_at: datetime
    is_ai_assisted: bool
    user_instruction: Optional[str] = None
    reverted: bool = False
    revert_of_change_set_id: Optional[str] = None
    revertable: bool = True
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_picture: Optional[str] = None
    changes: list[FieldChange]


class CommentOut(BaseModel):
    id: int
    scene_id: int
    body: str
    created_at: datetime
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_picture: Optional[str] = None


class CommentCreate(BaseModel):
    body: str


# ─── Helpers ─────────────────────────────────────────────────────────

def _group_change_sets(rows: list, db: Session) -> list[ChangeSetOut]:
    """Group heterogeneous history rows by change_set_id, newest first."""
    # Preserve first-seen order but sort groups by max edited_at desc.
    groups: dict[str, list] = {}
    order: list[str] = []
    for r in rows:
        key = r.change_set_id or f"_row_{r.id}"  # ungrouped legacy rows stand alone
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(r)

    user_ids = {r.user_id for r in rows if r.user_id}
    users = {
        u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}

    out: list[ChangeSetOut] = []
    for key in order:
        grp = groups[key]
        head = max(grp, key=lambda r: r.edited_at or datetime.min)
        uid = head.user_id
        u = users.get(uid)
        out.append(ChangeSetOut(
            change_set_id=head.change_set_id,
            target=getattr(head, "target", "published") or "published",
            edited_at=head.edited_at,
            is_ai_assisted=bool(head.is_ai_assisted),
            user_instruction=getattr(head, "user_instruction", None),
            reverted=bool(getattr(head, "reverted", False)),
            revert_of_change_set_id=getattr(head, "revert_of_change_set_id", None),
            revertable=bool(getattr(head, "revertable", True)),
            user_id=uid,
            user_name=u.name if u else None,
            user_picture=u.picture if u else None,
            changes=[
                FieldChange(
                    field_name=r.field_name,
                    old_value=r.old_value,
                    new_value=r.new_value,
                    scene_id=getattr(r, "scene_id", None),
                )
                for r in grp
            ],
        ))
    out.sort(key=lambda c: c.edited_at or datetime.min, reverse=True)
    return out


# ─── Preview endpoints ───────────────────────────────────────────────

@router.get("/history", response_model=list[ChangeSetOut])
def project_history(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Project-level edits (colors, fonts, captions, playback, template, bgm, etc.)
    grouped by change-set. Scene edits have their own per-scene endpoint."""
    get_accessible_project(project_id, user, db)
    rows = list(
        db.query(ProjectEditHistory)
        .filter(ProjectEditHistory.project_id == project_id)
        .all()
    )
    return _group_change_sets(rows, db)


@router.get("/scenes/{scene_id}/history", response_model=list[ChangeSetOut])
def scene_history(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit history for one scene, grouped by change-set (who changed what)."""
    get_accessible_project(project_id, user, db)
    rows = (
        db.query(SceneEditHistory)
        .filter(
            SceneEditHistory.project_id == project_id,
            SceneEditHistory.scene_id == scene_id,
        )
        .all()
    )
    return _group_change_sets(rows, db)


# ─── Revert / redo ───────────────────────────────────────────────────

@router.post("/history/{change_set_id}/revert", response_model=list[ChangeSetOut])
def revert_change_set(
    project_id: int,
    change_set_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revert (or redo) a change-set in place, without adding a new history entry.

    Toggles the change-set's ``reverted`` flag and applies the matching values to the
    live rows: reverting writes each row's ``old_value``, redoing writes ``new_value``.
    No new change-set is recorded — the ``reverted`` flag is the single source of
    truth. Owner-only, since it changes the live video. Returns updated history.
    """
    project = get_accessible_project(project_id, user, db)

    scene_rows = (
        db.query(SceneEditHistory)
        .filter(
            SceneEditHistory.project_id == project_id,
            SceneEditHistory.change_set_id == change_set_id,
        )
        .all()
    )
    proj_rows = (
        db.query(ProjectEditHistory)
        .filter(
            ProjectEditHistory.project_id == project_id,
            ProjectEditHistory.change_set_id == change_set_id,
        )
        .all()
    )
    if not scene_rows and not proj_rows:
        raise HTTPException(status_code=404, detail="Change-set not found")

    # Bulk operations (script/template/audio regen) are logged for visibility only.
    if any(not getattr(r, "revertable", True) for r in (*scene_rows, *proj_rows)):
        raise HTTPException(status_code=400, detail="This action can't be reverted.")

    # Reverts change the live video — restrict to the owner.
    if project.user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can revert changes.")

    # Currently reverted? Then this call is a REDO (re-apply new_value); otherwise a
    # REVERT (apply old_value). Read the state from the first row.
    currently_reverted = bool(getattr((scene_rows or proj_rows)[0], "reverted", False))

    def _target_value(row):
        # Redo restores the change's new_value; revert restores the pre-change old_value.
        return row.new_value if currently_reverted else row.old_value

    # Apply the chosen values directly onto the live rows (no new history rows).
    scene_broadcasts: list[tuple[int, str, object]] = []
    proj_broadcasts: list[tuple[str, object]] = []
    scenes_by_id = {s.id: s for s in db.query(Scene).filter(Scene.project_id == project_id).all()}
    for r in scene_rows:
        scene = scenes_by_id.get(r.scene_id)
        if scene is None or not hasattr(scene, r.field_name):
            continue
        old_live = getattr(scene, r.field_name, None)
        coerced = _coerce(_target_value(r), old_live)
        setattr(scene, r.field_name, coerced)
        scene_broadcasts.append((r.scene_id, r.field_name, coerced))
    for r in proj_rows:
        if not hasattr(project, r.field_name):
            continue
        old_live = getattr(project, r.field_name, None)
        coerced = _coerce(_target_value(r), old_live)
        setattr(project, r.field_name, coerced)
        proj_broadcasts.append((r.field_name, coerced))

    # Flip the flag in place: reverted <-> active (enables redo, and back).
    for r in (*scene_rows, *proj_rows):
        r.reverted = not currently_reverted

    db.commit()
    # Keep remotion workspace in sync after applying the change.
    _rebuild_workspace_safe(project, db)

    # Push the applied values live to any collaborators connected on this project.
    from app.routers.collab_ws import broadcast_project_edit, broadcast_scene_edit
    for sid, field, value in scene_broadcasts:
        broadcast_scene_edit(
            project_id, sid, field, value,
            user_id=user.id, name=user.name, change_set_id=change_set_id,
        )
    for field, value in proj_broadcasts:
        broadcast_project_edit(
            project_id, field, value,
            user_id=user.id, name=user.name, change_set_id=change_set_id,
        )

    rows = (
        list(db.query(SceneEditHistory).filter(SceneEditHistory.project_id == project_id).all())
        + list(db.query(ProjectEditHistory).filter(ProjectEditHistory.project_id == project_id).all())
    )
    return _group_change_sets(rows, db)


def _coerce(value: Any, like: Any):
    """Coerce a stringified history value back toward the live field's type."""
    if like is None or value is None:
        return value
    try:
        if isinstance(like, bool):
            return str(value).lower() in ("true", "1", "yes")
        if isinstance(like, int) and not isinstance(like, bool):
            return int(float(value))
        if isinstance(like, float):
            return float(value)
    except (ValueError, TypeError):
        return value
    return value


def _rebuild_workspace_safe(project: Project, db: Session) -> None:
    try:
        from app.services.remotion import write_remotion_data
        scenes = db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.order).all()
        write_remotion_data(project, scenes, db)
    except Exception as e:
        logger.warning("[COLLAB] Failed to rebuild remotion workspace after revert: %s", e)


# ─── Scene comments ──────────────────────────────────────────────────

def _comment_out(c, user_by_id: dict) -> CommentOut:
    u = user_by_id.get(c.user_id)
    return CommentOut(
        id=c.id,
        scene_id=c.scene_id,
        body=c.body,
        created_at=c.created_at,
        user_id=c.user_id,
        user_name=u.name if u else None,
        user_picture=u.picture if u else None,
    )


@router.get("/comments", response_model=list[CommentOut])
def list_comments(
    project_id: int,
    scene_id: Optional[int] = Query(default=None, description="Filter to one scene"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List comments for the project (or a single scene), newest first."""
    from app.models.scene_comment import SceneComment

    get_accessible_project(project_id, user, db)  # access check (owner or member)

    q = db.query(SceneComment).filter(SceneComment.project_id == project_id)
    if scene_id is not None:
        q = q.filter(SceneComment.scene_id == scene_id)
    rows = q.order_by(SceneComment.created_at.desc()).all()

    user_ids = {r.user_id for r in rows if r.user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return [_comment_out(c, users) for c in rows]


@router.post("/scenes/{scene_id}/comments", response_model=CommentOut)
def create_comment(
    project_id: int,
    scene_id: int,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a comment to a scene. Any user with access (owner or member) may post."""
    from app.models.scene_comment import SceneComment

    get_accessible_project(project_id, user, db)

    scene = (
        db.query(Scene).filter(Scene.id == scene_id, Scene.project_id == project_id).first()
    )
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")

    comment = SceneComment(project_id=project_id, scene_id=scene_id, user_id=user.id, body=body)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    out = _comment_out(comment, {user.id: user})
    _broadcast_comment(project_id, {"type": "comment_added", "comment": out.model_dump()})
    return out


@router.delete("/comments/{comment_id}")
def delete_comment(
    project_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a comment. Author or project owner only."""
    from app.models.scene_comment import SceneComment

    project = get_accessible_project(project_id, user, db)
    comment = (
        db.query(SceneComment)
        .filter(SceneComment.id == comment_id, SceneComment.project_id == project_id)
        .first()
    )
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != user.id and project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments.")

    scene_id = comment.scene_id
    db.delete(comment)
    db.commit()

    _broadcast_comment(
        project_id,
        {"type": "comment_deleted", "comment_id": comment_id, "scene_id": scene_id},
    )
    return {"deleted": True}


def _broadcast_comment(project_id: int, message: dict) -> None:
    """Fan a comment change out to live collaborators, best-effort."""
    try:
        from app.routers.collab_ws import collab_manager
        collab_manager.broadcast_from_sync(project_id, message)
    except Exception:
        pass
