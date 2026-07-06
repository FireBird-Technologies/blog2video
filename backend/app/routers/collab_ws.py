"""Real-time collaboration websocket: live co-editing + presence.

One "room" per project holds every connected collaborator's socket. Inbound
``edit`` messages apply directly to the live Scene/Project rows (see
services/collab_draft.py), write attributed history, and are broadcast to everyone
else in the room. Presence and soft per-scene locks are broadcast but not
persisted.

PROD CAVEAT: rooms are in-process. With multiple uvicorn workers/instances a
message only reaches sockets on the same process. For horizontal scaling, back
``ConnectionManager`` with Redis pub/sub (publish every broadcast, each worker
subscribes and fans out to its local sockets) or run collaboration on a single
worker. This is documented as the scaling requirement; the single-process path
is correct and complete.
"""

import asyncio
import json
import logging
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from app.database import SessionLocal
from app.auth import decode_access_token
from app.models.user import User
from app.models.project import Project
from app.services.access import get_member
from app.services import collab_draft
from app.services.edit_tracker import new_change_set_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["collaboration"])


class _Conn:
    __slots__ = ("ws", "user_id", "name", "picture")

    def __init__(self, ws: WebSocket, user_id: int, name: str, picture: Optional[str]):
        self.ws = ws
        self.user_id = user_id
        self.name = name
        self.picture = picture


class ConnectionManager:
    """In-process room registry: project_id -> set of live connections."""

    def __init__(self) -> None:
        self._rooms: dict[int, set[_Conn]] = defaultdict(set)
        # The event loop the websockets run on, captured when the first client
        # connects. Sync REST endpoints use it to schedule broadcasts (they run in
        # a threadpool, off the loop) so their edits reach live collaborators.
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def broadcast_from_sync(self, project_id: int, message: dict) -> None:
        """Schedule a broadcast from a sync (threadpool) context, best-effort.

        Called by REST edit endpoints so a normal save propagates live to everyone
        in the room. No-op if no socket has ever connected (no loop bound) or the
        room is empty — those clients get the change on their next fetch anyway.
        """
        loop = self._loop
        room = self._rooms.get(project_id)
        if loop is None or not room:
            logger.info(
                "[COLLAB_WS] broadcast_from_sync skipped project=%s loop=%s room_size=%d",
                project_id, "bound" if loop else "none", len(room) if room else 0,
            )
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(project_id, message), loop)
            logger.info(
                "[COLLAB_WS] broadcast_from_sync project=%s scope=%s field=%s room_size=%d",
                project_id, message.get("scope"), message.get("field"), len(room),
            )
        except Exception as e:
            logger.warning("[COLLAB_WS] broadcast_from_sync failed project=%s: %s", project_id, e)

    def add(self, project_id: int, conn: _Conn) -> None:
        self._rooms[project_id].add(conn)

    def remove(self, project_id: int, conn: _Conn) -> None:
        self._rooms.get(project_id, set()).discard(conn)
        if not self._rooms.get(project_id):
            self._rooms.pop(project_id, None)

    def peers(self, project_id: int) -> list[dict]:
        seen: dict[int, dict] = {}
        for c in self._rooms.get(project_id, set()):
            seen[c.user_id] = {"user_id": c.user_id, "name": c.name, "picture": c.picture}
        return list(seen.values())

    async def broadcast(self, project_id: int, message: dict, *, exclude: Optional[_Conn] = None) -> None:
        payload = json.dumps(message, default=str)
        for c in list(self._rooms.get(project_id, set())):
            if c is exclude:
                continue
            try:
                if c.ws.application_state == WebSocketState.CONNECTED:
                    await c.ws.send_text(payload)
            except Exception:
                # Drop dead sockets; disconnect handler will clean up too.
                self.remove(project_id, c)

    def kick_user(self, project_id: int, user_id: int) -> None:
        """Remove a revoked user's connections from the room (called on revoke).

        This stops further broadcasts reaching them immediately. Their socket is
        fully closed on their next ``edit`` message, which re-checks access and
        closes with 4403 — so a revoked collaborator cannot keep writing.
        """
        for c in list(self._rooms.get(project_id, set())):
            if c.user_id == user_id:
                self.remove(project_id, c)


collab_manager = ConnectionManager()


def broadcast_project_edit(
    project_id: int, field: str, value, *, user_id: int, name: str, change_set_id: str
) -> None:
    """Fan a project-field edit out to live collaborators (called from REST saves)."""
    collab_manager.broadcast_from_sync(project_id, {
        "type": "edit", "scope": "project", "field": field, "value": value,
        "user_id": user_id, "name": name, "change_set_id": change_set_id,
    })


def broadcast_scene_edit(
    project_id: int, scene_id: int, field: str, value, *, user_id: int, name: str, change_set_id: str
) -> None:
    """Fan a scene-field edit out to live collaborators (called from REST saves)."""
    collab_manager.broadcast_from_sync(project_id, {
        "type": "edit", "scope": "scene", "scene_id": scene_id, "field": field, "value": value,
        "user_id": user_id, "name": name, "change_set_id": change_set_id,
    })


def broadcast_project_reload(project_id: int) -> None:
    """Tell live collaborators to refetch the whole project.

    Used after bulk jobs (template change, script/voice regen) that rewrite many
    fields + scene descriptors at once — too much to sync field-by-field, so the
    client reloads authoritative state.
    """
    collab_manager.broadcast_from_sync(project_id, {"type": "project_reloaded"})


def _authenticate(token: Optional[str], db) -> Optional[User]:
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
    except Exception:
        return None
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        return None
    return user


def _can_access(project: Project, user: User, db) -> bool:
    if project.user_id == user.id:
        return True
    return get_member(project.id, user.id, db) is not None


@router.websocket("/api/projects/{project_id}/collab")
async def collab_socket(
    websocket: WebSocket,
    project_id: int,
    token: Optional[str] = Query(default=None),
):
    conn: Optional[_Conn] = None
    try:
        # Auth + seed use a short-lived session that is CLOSED before the receive
        # loop — a socket must not hold a pool connection while idle, or many open
        # sockets exhaust the pool (QueuePool timeout). Per-edit handling opens its
        # own session on demand.
        db = SessionLocal()
        try:
            user = _authenticate(token, db)
            if user is None:
                await websocket.close(code=4401)  # unauthorized
                return

            project = db.query(Project).filter(Project.id == project_id, Project.is_active == True).first()  # noqa: E712
            if project is None or not _can_access(project, user, db):
                await websocket.close(code=4404)  # not found / no access
                return

            await websocket.accept()
            collab_manager.bind_loop(asyncio.get_running_loop())
            conn = _Conn(websocket, user.id, user.name, user.picture)
            collab_manager.add(project_id, conn)

            # Seed the joining client with the current published state + peers.
            snapshot = collab_draft.build_published_snapshot(project, db)
        finally:
            db.close()

        await websocket.send_text(json.dumps({
            "type": "init",
            "state": snapshot,
            "peers": collab_manager.peers(project_id),
            "you": {"user_id": user.id, "name": user.name, "picture": user.picture},
        }, default=str))

        # Announce presence to others.
        await collab_manager.broadcast(
            project_id,
            {"type": "presence", "event": "join", "peers": collab_manager.peers(project_id)},
            exclude=conn,
        )

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            await _handle_message(msg, project_id, user, conn)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("[COLLAB_WS] socket error on project %s: %s", project_id, e)
    finally:
        if conn is not None:
            collab_manager.remove(project_id, conn)
            remaining = collab_manager.peers(project_id)
            logger.info("[COLLAB_WS] disconnect user=%s project=%s remaining=%d", conn.user_id, project_id, len(remaining))
            try:
                await collab_manager.broadcast(
                    project_id,
                    {"type": "presence", "event": "leave", "peers": remaining},
                )
            except Exception:
                pass


async def _handle_message(msg: dict, project_id: int, user: User, conn: _Conn) -> None:
    mtype = msg.get("type")

    if mtype == "leave":
        # Explicit leave (client navigating away): drop this connection and tell the
        # room immediately, then close. More reliable than waiting for the TCP
        # disconnect, which an idle socket may not surface for a while.
        collab_manager.remove(project_id, conn)
        remaining = collab_manager.peers(project_id)
        logger.info("[COLLAB_WS] leave msg user=%s project=%s remaining=%d", user.id, project_id, len(remaining))
        await collab_manager.broadcast(
            project_id,
            {"type": "presence", "event": "leave", "peers": remaining},
        )
        try:
            await conn.ws.close()
        except Exception:
            pass
        return

    if mtype == "cursor":
        # Ephemeral presence — relay to peers, don't persist.
        await collab_manager.broadcast(
            project_id,
            {"type": "cursor", "user_id": user.id, "scene_id": msg.get("scene_id"), "pos": msg.get("pos")},
            exclude=conn,
        )
        return

    if mtype in ("lock", "unlock"):
        # Soft per-scene lock hint. Advisory only — reduces clobber, not enforced.
        await collab_manager.broadcast(
            project_id,
            {"type": mtype, "user_id": user.id, "name": user.name, "scene_id": msg.get("scene_id")},
            exclude=conn,
        )
        return

    if mtype == "edit":
        # Open a short-lived session only for this edit — never hold a pool
        # connection across the idle receive loop.
        db = SessionLocal()
        try:
            # Re-check access on every edit so a revoked user can't keep writing.
            project = db.query(Project).filter(Project.id == project_id, Project.is_active == True).first()  # noqa: E712
            if project is None or not _can_access(project, user, db):
                await conn.ws.close(code=4403)
                return

            scope = msg.get("scope")  # "scene" | "project"
            field = msg.get("field")
            value = msg.get("value")
            change_set_id = msg.get("change_set_id") or new_change_set_id()

            try:
                if scope == "scene":
                    collab_draft.apply_scene_field(
                        project, int(msg["scene_id"]), field, value,
                        user_id=user.id, change_set_id=change_set_id, db=db,
                    )
                    await collab_manager.broadcast(
                        project_id,
                        {
                            "type": "edit", "scope": "scene", "scene_id": msg["scene_id"],
                            "field": field, "value": value, "user_id": user.id,
                            "name": user.name, "change_set_id": change_set_id,
                        },
                    )
                elif scope == "project":
                    collab_draft.apply_project_field(
                        project, field, value,
                        user_id=user.id, change_set_id=change_set_id, db=db,
                    )
                    await collab_manager.broadcast(
                        project_id,
                        {
                            "type": "edit", "scope": "project", "field": field, "value": value,
                            "user_id": user.id, "name": user.name, "change_set_id": change_set_id,
                        },
                    )
            except ValueError as e:
                await conn.ws.send_text(json.dumps({"type": "error", "detail": str(e)}))
        finally:
            db.close()
        return
