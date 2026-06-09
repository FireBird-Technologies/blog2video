"""Shared primitives for stall recovery of background project jobs.

Each long-running job (template change, script regenerate, voice change) writes a
heartbeat (``updated_at``) as it makes progress. When the status-polling endpoint
(or the boot sweep) sees an active job whose heartbeat is stale, it reaps the job:
best-effort cancels the in-flight work, reverts the project, and refunds the credit.

This module holds the cross-module pieces:
- ``STALL_RETRY_MESSAGE`` — the user-facing copy surfaced as a retry popup.
- a tiny in-memory cancel registry so a reaper can signal a still-running worker.

The cancel registry is best-effort and process-local (which is fine: a job runs in
the same single worker process that serves its status polls). For ``run_in_executor``
thread jobs Python can't force-kill the thread, so cancellation is cooperative — the
worker checks ``is_cancel_requested`` and a DB ``status`` supersede guard before each
commit. For the asyncio voice-change task we also keep the Task so it can be cancelled
for real.
"""
from __future__ import annotations

import threading
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    import asyncio

# Shown to the user (popup) whenever a stuck job is reaped and reverted.
STALL_RETRY_MESSAGE = (
    "We faced an unforeseen error while processing your request. "
    "Please retry — your video count has not been deducted."
)

_lock = threading.Lock()
# (kind, job_id) -> Event set when a reaper requests cancellation.
_cancel_events: dict[tuple[str, int], threading.Event] = {}
# (kind, job_id) -> asyncio.Task for jobs that run as a real coroutine (voice change).
_tasks: dict[tuple[str, int], "asyncio.Task"] = {}


def arm(kind: str, job_id: int) -> threading.Event:
    """Register a job at startup; returns the Event the worker should poll."""
    key = (kind, job_id)
    with _lock:
        ev = _cancel_events.get(key)
        if ev is None:
            ev = threading.Event()
            _cancel_events[key] = ev
        return ev


def register_task(kind: str, job_id: int, task: "asyncio.Task") -> None:
    """Register the asyncio Task for a coroutine-based job (enables real cancel)."""
    with _lock:
        _tasks[(kind, job_id)] = task


def request_cancel(kind: str, job_id: int) -> None:
    """Best-effort cancel: set the cooperative flag and cancel the task if any."""
    key = (kind, job_id)
    with _lock:
        ev = _cancel_events.get(key)
        task = _tasks.get(key)
    if ev is not None:
        ev.set()
    if task is not None:
        try:
            task.cancel()
        except Exception:
            pass


def is_cancel_requested(kind: str, job_id: int) -> bool:
    with _lock:
        ev = _cancel_events.get((kind, job_id))
    return bool(ev and ev.is_set())


def clear(kind: str, job_id: int) -> None:
    """Drop registry entries for a finished job."""
    key = (kind, job_id)
    with _lock:
        _cancel_events.pop(key, None)
        _tasks.pop(key, None)
