"""In-memory progress tracking for project language-change runs.

Mirrors ``voice_change_progress``. A language change has TWO passes over the scenes —
first translate the copy, then regenerate every voiceover — so ``total`` is seeded as
``2 * len(scenes)`` and the bar keeps moving through the (slower) audio pass instead of
sitting at 50%. ``phase`` lets the client label what is happening right now.
"""
from __future__ import annotations

import threading

_lock = threading.Lock()
_progress: dict[int, dict] = {}

PHASE_TRANSLATING = "translating"
PHASE_VOICEOVER = "voiceover"


def start(project_id: int, total: int, user_id: int | None = None, target_language: str | None = None) -> None:
    """Seed a fresh progress record before the run begins.

    ``user_id`` is the collaborator who triggered the op. It is recorded so the
    completion reload broadcast can EXCLUDE them — their own client already handles
    completion locally (the progress modal soft-reloads), and forcing a hard reload on
    the actor races their auth re-check and can spuriously log them out.
    """
    with _lock:
        _progress[project_id] = {
            "total": max(int(total), 0),
            "completed": 0,
            "done": False,
            "error": None,
            "kind": "language_change",
            "phase": PHASE_TRANSLATING,
            "target_language": target_language,
            "user_id": user_id,
        }


def set_phase(project_id: int, phase: str) -> None:
    """Switch the reported phase (translating -> voiceover)."""
    with _lock:
        p = _progress.get(project_id)
        if p and not p["done"]:
            p["phase"] = phase


def advance(project_id: int, step: int = 1) -> None:
    """Mark one (or more) scenes as finished in the current phase. Thread-safe."""
    with _lock:
        p = _progress.get(project_id)
        if p and not p["done"]:
            p["completed"] = min(p["completed"] + step, p["total"])


def finish(project_id: int, error: str | None = None) -> None:
    """Mark the run as terminal (success or failure)."""
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
