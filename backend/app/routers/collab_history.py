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
    # Row id of this individual field edit — the unit of per-field revert/redo.
    id: Optional[int] = None
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    scene_id: Optional[int] = None
    # Per-field revert state: this row is currently reverted, and/or superseded by a
    # newer edit to the same field (so it can no longer be reverted/redone).
    reverted: bool = False
    stale: bool = False


class ChangeSetOut(BaseModel):
    change_set_id: Optional[str]
    target: str
    edited_at: datetime
    is_ai_assisted: bool
    user_instruction: Optional[str] = None
    reverted: bool = False
    revert_of_change_set_id: Optional[str] = None
    revertable: bool = True
    # True when a newer edit to one of this change-set's fields exists, so it can no
    # longer be reverted/redone (only the latest edit of a field is actionable).
    stale: bool = False
    # Row ids of this change-set's fields that are still actionable (revertable and not
    # superseded) — what a change-set-level "Revert all" / "Redo all" acts on.
    revertable_field_ids: list[int] = []
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_picture: Optional[str] = None
    changes: list[FieldChange]


class CommentOut(BaseModel):
    id: int
    scene_id: int
    body: str
    created_at: datetime
    parent_id: Optional[int] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_picture: Optional[str] = None


class CommentCreate(BaseModel):
    body: str
    parent_id: Optional[int] = None


# ─── Helpers ─────────────────────────────────────────────────────────

import json as _json

# Fields whose value is a JSON descriptor tracked at sub-field granularity: a later
# edit only supersedes the specific sub-fields (leaf paths) it changes, and a revert
# merges just those sub-fields back onto the live descriptor.
_JSON_LEAF_FIELDS = {"remotion_code"}

# Sentinel for "this key is absent on this side of the diff" (distinct from JSON null).
_MISSING = object()


def _try_json(value):
    """Parse a JSON object string, or None if it isn't a JSON object."""
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s.startswith("{"):
        return None
    try:
        parsed = _json.loads(s)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _walk_leaves(old_v, new_v, path: str, out: dict) -> None:
    """Collect dotted leaf paths whose value changed between old_v and new_v.

    Mirrors the frontend descriptor diff (utils/fieldDiff.ts): recurse into dicts,
    treat everything else (scalars, lists, type changes) as a leaf. ``out`` maps each
    changed leaf path -> (old_leaf_value, new_leaf_value) for merge-based revert/redo.
    A side that lacks the key is recorded as ``_MISSING`` so a merge can delete it
    rather than write a spurious null.
    """
    if old_v == new_v:
        return
    both_dicts = isinstance(old_v, dict) and isinstance(new_v, dict)
    if both_dicts:
        for k in set(old_v) | set(new_v):
            child = f"{path}.{k}" if path else str(k)
            _walk_leaves(
                old_v.get(k, _MISSING), new_v.get(k, _MISSING), child, out
            )
        return
    out[path] = (old_v, new_v)


def _changed_leaves(row) -> dict:
    """Map of changed leaf path -> (old_leaf, new_leaf) for a JSON-descriptor row.

    Returns {} when the row isn't a JSON-leaf field or the values don't parse as JSON
    objects (callers then fall back to whole-field identity).
    """
    if row.field_name not in _JSON_LEAF_FIELDS:
        return {}
    old_obj = _try_json(row.old_value)
    new_obj = _try_json(row.new_value)
    if old_obj is None or new_obj is None:
        return {}
    leaves: dict = {}
    _walk_leaves(old_obj, new_obj, "", leaves)
    return leaves


def _row_field_keys(row) -> list[tuple]:
    """The set of independently-managed 'fields' a row edits.

    For most fields this is a single (scene_id|project, field_name) key. For JSON-leaf
    fields (remotion_code) it's one key per changed sub-field:
    (scene_id|project, field_name, leaf_path) — so edits to different sub-fields don't
    supersede each other.
    """
    scope = getattr(row, "scene_id", None)
    scope = scope if scope is not None else "__project__"
    # scene_deleted / scene_added are project-scoped but target one scene (id in the JSON
    # value). Key them per target scene so acting on scene A then scene B doesn't make A's
    # entry look stale — each is independently revertable. Both toggle the scene's
    # is_active, so they share the same supersede key namespace per scene.
    if row.field_name in ("scene_deleted", "scene_added"):
        payload = _try_json(row.new_value) or {}
        return [("__project__", row.field_name, payload.get("scene_id"))]
    leaves = _changed_leaves(row)
    if leaves:
        return [(scope, row.field_name, path) for path in leaves]
    return [(scope, row.field_name)]


def _set_leaf(obj: dict, path: str, value) -> None:
    """Set (or delete) a dotted leaf path on a nested dict, creating parents as needed.

    ``value is _MISSING`` means the leaf didn't exist in the target descriptor, so the
    key is removed rather than set — keeping the merged result faithful to the target.
    """
    parts = path.split(".")
    cur = obj
    for p in parts[:-1]:
        nxt = cur.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[p] = nxt
        cur = nxt
    leaf = parts[-1]
    if value is _MISSING:
        cur.pop(leaf, None)
    else:
        cur[leaf] = value


def _merge_revert_value(row, live_str, use_new: bool) -> str:
    """Revert/redo a JSON-leaf field by merging only THIS row's changed sub-fields onto
    the current live descriptor — preserving newer edits to other sub-fields.

    ``use_new`` picks the redo target (new leaf values); otherwise the revert target
    (old leaf values). Falls back to the whole stored value if the live descriptor or
    the row's values don't parse as JSON objects.
    """
    live = _try_json(live_str)
    leaves = _changed_leaves(row)
    if live is None or not leaves:
        return row.new_value if use_new else row.old_value
    for path, (old_leaf, new_leaf) in leaves.items():
        # Target is the leaf value on the side we're restoring; _MISSING means the key
        # was absent there, so _set_leaf deletes it rather than writing a null.
        target = new_leaf if use_new else old_leaf
        _set_leaf(live, path, target)
    return _json.dumps(live)


def _stale_row_ids(rows: list) -> set[int]:
    """Ids of rows that are NOT the latest edit of at least one of their fields.

    "Latest" = greatest (edited_at, id) among revertable rows that edit the same field
    (sub-field for remotion_code), ignoring the ``reverted`` flag. A row is stale if any
    field/sub-field it touches has a newer edit — meaning it can no longer be reverted
    (reverting would clobber that newer edit). Bulk-event rows (revertable=False) don't
    participate.
    """
    # newest (edited_at, id) row-id per field key.
    winner: dict[tuple, tuple] = {}
    row_keys: dict[int, list[tuple]] = {}
    for r in rows:
        if not getattr(r, "revertable", True):
            continue
        keys = _row_field_keys(r)
        row_keys[r.id] = keys
        rank = (r.edited_at or datetime.min, r.id)
        for key in keys:
            cur = winner.get(key)
            if cur is None or rank > cur[0]:
                winner[key] = (rank, r.id)

    stale: set[int] = set()
    for r in rows:
        keys = row_keys.get(r.id)
        if not keys:
            continue
        rank = (r.edited_at or datetime.min, r.id)
        # Stale if it isn't the winner for every field/sub-field it touches.
        if any(winner[key] != (rank, r.id) for key in keys):
            stale.add(r.id)
    return stale


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

    # A change-set is stale if any of its (revertable) field-rows is not the latest
    # edit of its field (sub-field for remotion_code) — i.e. a newer edit exists.
    stale_ids = _stale_row_ids(rows)

    out: list[ChangeSetOut] = []
    for key in order:
        grp = groups[key]
        head = max(grp, key=lambda r: r.edited_at or datetime.min)
        uid = head.user_id
        u = users.get(uid)
        revertable = bool(getattr(head, "revertable", True))
        # Per-field: each row carries its own reverted + stale (sub-field aware).
        field_changes = [
            FieldChange(
                id=r.id,
                field_name=r.field_name,
                old_value=r.old_value,
                new_value=r.new_value,
                scene_id=getattr(r, "scene_id", None),
                reverted=bool(getattr(r, "reverted", False)),
                stale=(revertable and r.id in stale_ids),
            )
            for r in grp
        ]
        # Change-set-level rollups (drive "Revert all" and the entry badges).
        revertable_field_ids = [
            r.id for r in grp if revertable and r.id not in stale_ids
        ]
        stale = revertable and any(fc.stale for fc in field_changes)
        all_reverted = bool(grp) and all(
            bool(getattr(r, "reverted", False)) for r in grp
        )
        out.append(ChangeSetOut(
            change_set_id=head.change_set_id,
            target=getattr(head, "target", "published") or "published",
            edited_at=head.edited_at,
            is_ai_assisted=bool(head.is_ai_assisted),
            user_instruction=getattr(head, "user_instruction", None),
            reverted=all_reverted,
            revert_of_change_set_id=getattr(head, "revert_of_change_set_id", None),
            revertable=revertable,
            stale=stale,
            revertable_field_ids=revertable_field_ids,
            user_id=uid,
            user_name=u.name if u else None,
            user_picture=u.picture if u else None,
            changes=field_changes,
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

class RevertFieldsRequest(BaseModel):
    """Row ids of individual field edits to revert/redo. Each is toggled based on its
    own current state: a not-yet-reverted row reverts (applies old_value); a reverted
    row redoes (re-applies new_value)."""
    row_ids: list[int]


@router.post("/history/revert", response_model=list[ChangeSetOut])
def revert_fields(
    project_id: int,
    body: RevertFieldsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revert (or redo) individual field edits by row id, without adding history rows.

    Each targeted row toggles its own ``reverted`` flag and applies the matching value
    to the live field: reverting writes ``old_value``, redoing writes ``new_value``
    (remotion_code merges only its changed sub-fields so sibling edits survive). Fields
    in the same change-set are independent — reverting one leaves the others untouched.
    The owner may act on any row; a collaborator only on rows they authored. A single
    "Revert all" sends every still-actionable row id of a change-set.
    """
    project = get_accessible_project(project_id, user, db)

    row_ids = set(body.row_ids)
    if not row_ids:
        raise HTTPException(status_code=400, detail="No fields selected.")

    scene_rows = (
        db.query(SceneEditHistory)
        .filter(
            SceneEditHistory.project_id == project_id,
            SceneEditHistory.id.in_(row_ids),
        )
        .all()
    )
    proj_rows = (
        db.query(ProjectEditHistory)
        .filter(
            ProjectEditHistory.project_id == project_id,
            ProjectEditHistory.id.in_(row_ids),
        )
        .all()
    )
    targets = [*scene_rows, *proj_rows]
    if len(targets) != len(row_ids):
        raise HTTPException(status_code=404, detail="One or more edits were not found.")

    # Bulk operations (script/template/audio regen) are logged for visibility only.
    if any(not getattr(r, "revertable", True) for r in targets):
        raise HTTPException(status_code=400, detail="This action can't be reverted.")

    # Only the latest edit of a field (sub-field for remotion_code) is revertable. If a
    # newer edit exists, reject — reverting would clobber that edit.
    all_rows = (
        list(db.query(SceneEditHistory).filter(SceneEditHistory.project_id == project_id).all())
        + list(db.query(ProjectEditHistory).filter(ProjectEditHistory.project_id == project_id).all())
    )
    stale_ids = _stale_row_ids(all_rows)
    if any(r.id in stale_ids for r in targets):
        raise HTTPException(
            status_code=409,
            detail="A newer edit to this field exists, so this change can no longer be reverted.",
        )

    # Reverts change the live video. The owner may act on any row; a collaborator only
    # on rows they authored themselves.
    is_owner = project.user_id == user.id
    if not is_owner:
        editors = {r.user_id for r in targets}
        if editors != {user.id}:
            raise HTTPException(
                status_code=403,
                detail="You can only revert changes you made.",
            )

    # Apply each row's own direction: reverted rows redo (new_value), others revert.
    scene_broadcasts: list[tuple[int, str, object]] = []
    proj_broadcasts: list[tuple[str, object]] = []
    # NOTE: do NOT add `Scene.is_active == True` here. Reverting a scene deletion
    # (an is_active True→False edit) needs the soft-deleted scene row to be present
    # so the loop below can set is_active back to True. Filtering it out would break
    # un-delete (the scene wouldn't be found and the revert would silently no-op).
    scenes_by_id = {s.id: s for s in db.query(Scene).filter(Scene.project_id == project_id).all()}
    for r in scene_rows:
        scene = scenes_by_id.get(r.scene_id)
        if scene is None or not hasattr(scene, r.field_name):
            continue
        use_new = bool(getattr(r, "reverted", False))  # currently reverted → redo
        old_live = getattr(scene, r.field_name, None)
        if r.field_name in _JSON_LEAF_FIELDS:
            # Merge only this edit's sub-fields onto the current descriptor so newer
            # edits to other sub-fields are preserved.
            coerced = _merge_revert_value(r, old_live, use_new=use_new)
        else:
            coerced = _coerce(r.new_value if use_new else r.old_value, old_live)
        setattr(scene, r.field_name, coerced)
        scene_broadcasts.append((r.scene_id, r.field_name, coerced))
    reorder_reverted = False
    structural_scene_change = False
    for r in proj_rows:
        use_new = bool(getattr(r, "reverted", False))
        # A scene reorder is stored as a project-level row (not a Project attribute).
        # Its JSON value is {"orders": {scene_id: order}, "titles": {scene_id: title}}
        # over ALL scenes (older rows stored a flat {scene_id: order} map — still read).
        # Restore the whole ordering instead of setattr-ing a nonexistent Project field.
        if r.field_name == "scene_order":
            payload = _try_json(r.old_value if not use_new else r.new_value) or {}
            order_map = payload.get("orders", payload)  # nested new / flat legacy
            for sid, order in order_map.items():
                s = scenes_by_id.get(int(sid))
                if s is not None:
                    s.order = int(order)
            reorder_reverted = True
            continue
        # A scene deletion is stored as a project-level row (so its restore control is in
        # Global Edits) whose JSON value carries the target scene_id + is_active. Apply
        # is_active to that scene: revert un-deletes (old.is_active=True), redo re-deletes.
        # scene_added mirrors scene_deleted: both encode the target scene's is_active in
        # old/new (added = False→True, deleted = True→False). Applying old/new toggles the
        # scene's presence — revert of an add soft-deletes it, redo re-adds it.
        if r.field_name in ("scene_deleted", "scene_added"):
            payload = _try_json(r.old_value if not use_new else r.new_value) or {}
            s = scenes_by_id.get(int(payload.get("scene_id", -1)))
            if s is not None:
                s.is_active = bool(payload.get("is_active", True))
            structural_scene_change = True
            continue
        if not hasattr(project, r.field_name):
            continue
        old_live = getattr(project, r.field_name, None)
        coerced = _coerce(r.new_value if use_new else r.old_value, old_live)
        setattr(project, r.field_name, coerced)
        proj_broadcasts.append((r.field_name, coerced))

    # Flip each targeted row's flag in place: reverted <-> active.
    for r in targets:
        r.reverted = not bool(getattr(r, "reverted", False))

    # Reverting/redoing a reorder, un-delete or add restores scene.order values; audio
    # files are named by order, so resync filenames + voiceover_paths to the new order
    # (otherwise scenes play each other's voiceover after a structural revert).
    if reorder_reverted or structural_scene_change:
        from app.routers.projects import _sync_audio_filenames_to_order
        _sync_audio_filenames_to_order(db, project)

    db.commit()

    # Push the applied values live to any collaborators connected on this project.
    # STRUCTURAL reverts — a scene un-delete/re-delete (is_active) or a scene reorder
    # (scene_order) — change which scenes exist or their order, which the field-level
    # edit broadcast can't express (and an is_active patch would no-op on a scene absent
    # from the client's array). For those, trigger a full re-sync instead of per-field
    # patches.
    from app.routers.collab_ws import (
        broadcast_project_edit,
        broadcast_scene_edit,
        broadcast_project_reload,
    )
    structural = (
        reorder_reverted
        or structural_scene_change
        or any(field == "is_active" for _sid, field, _v in scene_broadcasts)
    )
    if structural:
        broadcast_project_reload(project_id, exclude_user_id=user.id)
    else:
        for sid, field, value in scene_broadcasts:
            broadcast_scene_edit(
                project_id, sid, field, value,
                user_id=user.id, name=user.name, change_set_id=None,
            )
        for field, value in proj_broadcasts:
            broadcast_project_edit(
                project_id, field, value,
                user_id=user.id, name=user.name, change_set_id=None,
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


# ─── Scene comments ──────────────────────────────────────────────────

def _comment_out(c, user_by_id: dict) -> CommentOut:
    u = user_by_id.get(c.user_id)
    return CommentOut(
        id=c.id,
        scene_id=c.scene_id,
        body=c.body,
        created_at=c.created_at,
        parent_id=getattr(c, "parent_id", None),
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

    # Threaded reply: the parent must be a comment on the same scene/project.
    parent_id = payload.parent_id
    if parent_id is not None:
        parent = (
            db.query(SceneComment)
            .filter(
                SceneComment.id == parent_id,
                SceneComment.project_id == project_id,
                SceneComment.scene_id == scene_id,
            )
            .first()
        )
        if parent is None:
            raise HTTPException(status_code=404, detail="The comment you're replying to was not found.")

        # Replies are capped at level 2 (root = 0). You can only reply to a level-0 or
        # level-1 comment; the parent's depth must be < 2.
        depth = 0
        cursor = parent
        while cursor.parent_id is not None and depth < 2:
            depth += 1
            cursor = (
                db.query(SceneComment).filter(SceneComment.id == cursor.parent_id).first()
            )
            if cursor is None:
                break
        if depth >= 2:
            raise HTTPException(
                status_code=400,
                detail="Replies can only go two levels deep.",
            )

    comment = SceneComment(
        project_id=project_id, scene_id=scene_id, user_id=user.id, body=body, parent_id=parent_id
    )
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

    # Cascade to all nested replies. Collect the subtree by walking parent_id within
    # this scene (guaranteed regardless of DB-level FK enforcement).
    scene_comments = (
        db.query(SceneComment)
        .filter(SceneComment.project_id == project_id, SceneComment.scene_id == scene_id)
        .all()
    )
    children_by_parent: dict[int, list[int]] = {}
    for c in scene_comments:
        if c.parent_id is not None:
            children_by_parent.setdefault(c.parent_id, []).append(c.id)

    to_delete: list[int] = []
    stack = [comment_id]
    while stack:
        cid = stack.pop()
        to_delete.append(cid)
        stack.extend(children_by_parent.get(cid, []))

    db.query(SceneComment).filter(SceneComment.id.in_(to_delete)).delete(
        synchronize_session=False
    )
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
