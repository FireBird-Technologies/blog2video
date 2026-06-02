"""In-memory progress tracking for project voice-change voiceover regeneration.

Mirrors the lightweight style of the render progress store. Progress is keyed by
project_id and advanced once per scene as its voiceover finishes regenerating, so
the frontend can show a bar that moves forward scene by scene.
"""
from __future__ import annotations

import threading

_lock = threading.Lock()
_progress: dict[int, dict] = {}


def start(project_id: int, total: int) -> None:
    """Seed a fresh progress record before regeneration begins."""
    with _lock:
        _progress[project_id] = {
            "total": max(int(total), 0),
            "completed": 0,
            "done": False,
            "error": None,
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
