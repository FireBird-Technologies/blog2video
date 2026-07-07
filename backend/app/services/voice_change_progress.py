"""In-memory progress tracking for project voice-change voiceover regeneration.

Mirrors the lightweight style of the render progress store. Progress is keyed by
project_id and advanced once per scene as its voiceover finishes regenerating, so
the frontend can show a bar that moves forward scene by scene.
"""
from __future__ import annotations

import threading

_lock = threading.Lock()
_progress: dict[int, dict] = {}


def start(project_id: int, total: int, kind: str = "voice_change", user_id: int | None = None) -> None:
    """Seed a fresh progress record before regeneration begins.

    ``kind`` distinguishes the operation ("voice_change" for add/change voice,
    "delete" for removing the voiceover) so a client resuming after a refresh can
    re-open the correct modal.

    ``user_id`` is the collaborator who triggered the op. It is recorded so the
    completion reload broadcast can EXCLUDE them — their own client already handles
    completion locally (the progress modal soft-reloads), and forcing a hard reload
    on the actor races their auth re-check and can spuriously log them out.
    """
    with _lock:
        _progress[project_id] = {
            "total": max(int(total), 0),
            "completed": 0,
            "done": False,
            "error": None,
            "kind": kind,
            "user_id": user_id,
        }


def advance(project_id: int, step: int = 1) -> None:
    """Mark one (or more) scenes as finished. Thread-safe."""
    with _lock:
        p = _progress.get(project_id)
        if p and not p["done"]:
            p["completed"] = min(p["completed"] + step, p["total"])


def finish(project_id: int, error: str | None = None) -> None:
    """Mark regeneration as terminal (success or failure)."""
    with _lock:
        p = _progress.get(project_id)
        if p:
            p["done"] = True
            p["error"] = error
            if error is None:
                p["completed"] = p["total"]


def get(project_id: int) -> dict | None:
    """Return a copy of the current progress record, or None if unknown."""
    with _lock:
        p = _progress.get(project_id)
        return dict(p) if p else None


def clear(project_id: int) -> None:
    with _lock:
        _progress.pop(project_id, None)
