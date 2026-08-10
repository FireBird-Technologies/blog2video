"""System-wide FIFO queue for avatar render/matte jobs.

WHY THIS EXISTS
The OmniAvatar HuggingFace Space is a single shared GPU render slot (see
services/avatar.py's module docstring). Before this module, "one render at a
time" was enforced per-PROJECT only, via a 409-reject-and-hope-the-client-
retries check in routers/projects.py — two different projects' scenes could
still hit the Space concurrently, and a client had to poll/retry on 409 to
make any progress on a batch. That is fragile and produces exactly the
"409 conflicts from retrying" symptom this module replaces.

THE MODEL
``scene_avatar_jobs`` rows with status="queued" ARE the queue, ordered by
(created_at, id) — strict first-come-first-served across EVERY project and
scene in the system, WITHIN each kind (see below). A single in-process asyncio
dispatcher claims the oldest queued rows and runs each kind up to its own
ceiling, freeing each slot as its job finishes. No per-project reservation
bookkeeping is needed: "a project's scenes start in order" and "two projects'
requests interleave fairly" both still fall out of plain FIFO order.

TWO INDEPENDENT CEILINGS, because the two kinds are bound by different
resources entirely. Counting them together (which this once did) meant cutouts
inherited a limit chosen for GPUs, and five of them thrashed one CPU.

  render (``AVATAR_CONCURRENCY``, default 5) is PROVIDER-BOUND. It was
  hard-coded to 1 for the HF Space, which was a single shared GPU render slot —
  sending it two renders only made them fight. The provider is now Modal, where
  each render gets its OWN container and GPU on demand, so N scenes render on N
  GPUs and a batch takes as long as its slowest scene instead of the sum of all
  of them, at the same total cost (per-GPU-second billing). It MUST NOT exceed
  the provider's own ceiling — on Modal that is ``max_containers`` in
  modal-service/omniavatar/app.py — or the surplus jobs just queue at the
  provider while holding a `running` row here. Set it to 1 for sequential renders.

  matte (``AVATAR_MATTE_CONCURRENCY``, default 1) is LOCAL-CPU-BOUND. No
  provider is involved at all: it is rembg running in this process's executor
  pool, so the only constraint is cores on this machine. Cutouts contend rather
  than parallelise — see config.py for the measurements behind the default of 1.

A queued job of one kind can therefore never consume the other kind's slot, and
an empty queue of one kind never stops the other from dispatching.

This is correct only because the app runs `--workers 1` (see main.py's boot
comment) — a single process is the only writer transitioning queued -> running,
so no distributed lock is needed.

RETRY POLICY
``generate_scene_avatar_sync`` (render) returns an ``AvatarRenderError`` with a
``retryable`` flag. ``matte_scene_avatar_sync`` (matte) returns a bare string;
matte failures are local ffmpeg/subprocess/file issues rather than a remote
GPU service, so they are classified with a small heuristic here instead of
threading a new return type through avatar_matte.py. Either way, a job that
exhausts its retryable attempts is left `failed` with `retryable` persisted,
so the UI can decide whether to offer/auto-run a retry.

The attempt ceiling is PER SCENE, not per job row. Retries happen in-place here
(the row stays `running` and holds its concurrency slot) so a transient failure
never costs the scene its queue position — but the bulk retry endpoint creates
a NEW row, so the count is carried forward via ``attempt_count`` and this loop
resumes the tally rather than restarting it. That bounds an unattended retry
loop at ``AVATAR_MAX_ATTEMPTS`` renders per scene no matter how many times the
endpoint is called. An explicit per-scene Generate click resets the count (see
routers/projects.py), because a human asking again should never be refused.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime

from sqlalchemy import func, or_, select, text

from app.config import settings
from app.database import SessionLocal
from app.models.scene_avatar_job import SceneAvatarJob
from app.schemas.schemas import avatar_bg_wants_cutout

logger = logging.getLogger(__name__)

_ACTIVE_AVATAR_STATUSES = ("queued", "running")

# How often the dispatcher checks for the next queued job. Cheap (one indexed
# query) — matches the poll cadence already used elsewhere in the avatar code
# (avatar.py's _wait_for_service).
_POLL_INTERVAL_SECONDS = 2.0

# Matte failures that ARE worth retrying (transient fetch/processing hiccups),
# matched against avatar_matte.matte_scene_avatar_sync's known failure strings.
# Anything else (missing avatar, unsupported server) is terminal.
_MATTE_RETRYABLE_MESSAGES = (
    "Could not fetch the avatar clip. Please try again.",
    "Could not process the avatar video. Please try again.",
    "Background removal took too long. Please try again.",
    "Could not remove the background. Please try again.",
)

# Jobs currently in flight. This was a single `_current_job_id` back when the
# provider was the HF Space — one shared GPU meant concurrency could only ever
# be 1. On Modal each render gets its OWN container/GPU on demand, so N jobs run
# on N GPUs and a batch finishes in the time of its slowest scene instead of the
# sum of all of them. Cost is unchanged (billing is per GPU-second either way).
_running_job_ids: set[int] = set()
# Which KIND each in-flight job is, so render and matte slots are counted
# separately (see _max_concurrency). Deliberately a dict keyed by job id rather
# than two sets: teardown stays a single unconditional pop() beside the set's
# discard, so the two can never desynchronise and leak a slot.
_running_kinds: dict[int, str] = {}
_dispatcher_task: "asyncio.Task | None" = None


def _job_kind(job: SceneAvatarJob) -> str:
    """Normalise a job's kind to exactly "matte" or "render".

    Mirrors _run_job's `if job.kind == "matte"` branch, so a row with a NULL,
    legacy or unrecognised kind is treated as a render in BOTH places — the
    dispatcher must never account for a job differently from how it runs it."""
    return "matte" if job.kind == "matte" else "render"


def _max_concurrency(kind: str) -> int:
    """How many jobs of this KIND may be in flight at once.

    The two kinds are bound by completely different resources, which is why they
    have independent ceilings:

    - "render" is PROVIDER-bound. It MUST NOT exceed the provider's own ceiling
      or the extra jobs just queue at the provider while holding a `running` row
      here: on Modal that is `max_containers` in modal-service/omniavatar/app.py.
      Set AVATAR_CONCURRENCY=1 to restore the old strictly-sequential behaviour
      (which is what the HF Space required, since it had one shared render slot).
    - "matte" is LOCAL-CPU-bound — rembg in this process's executor pool, no
      provider involved and therefore no provider ceiling to respect. It defaults
      to 1 because cutouts contend rather than parallelise; see
      AVATAR_MATTE_CONCURRENCY in config.py for the measurements.

    max(1, ...) guarantees a zero or garbage env value can never deadlock the
    queue by making every slot unfillable."""
    raw = (
        settings.AVATAR_MATTE_CONCURRENCY
        if kind == "matte"
        else settings.AVATAR_CONCURRENCY
    )
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        return 1


def _running_count(kind: str) -> int:
    """How many jobs of this kind are in flight. A linear scan is free at these
    sizes (a handful of entries) and avoids a second counter that could drift
    out of step with _running_kinds."""
    return sum(1 for k in _running_kinds.values() if k == kind)


def _max_attempts() -> int:
    """Render attempts allowed per SCENE, across job rows (see the model's
    ``attempt_count`` docstring). Config-driven so it can be tuned without a
    deploy, the same way AVATAR_CONCURRENCY is."""
    try:
        return max(1, int(settings.AVATAR_MAX_ATTEMPTS))
    except (TypeError, ValueError):
        return 3


def is_running() -> bool:
    """True while at least one job is in flight. Informational only — the real
    single-writer guarantee comes from the dispatcher being one asyncio task."""
    return bool(_running_job_ids)


def _kind_filter(kind: str):
    """SQL predicate selecting rows of one kind, treating NULL/legacy kinds as
    renders so they stay claimable — matching _job_kind's normalisation."""
    if kind == "matte":
        return SceneAvatarJob.kind == "matte"
    return or_(SceneAvatarJob.kind != "matte", SceneAvatarJob.kind.is_(None))


def _claim_next_job(kind: str) -> SceneAvatarJob | None:
    """Atomically claim the single oldest queued job OF THIS KIND, or None if
    that kind's queue is empty. Runs in its own short-lived session, like every
    other DB touch in the avatar code (see avatar.py's module docstring on Neon
    idle connections).

    Ordering is still strict FIFO by (created_at, id) WITHIN the kind. The
    deliberate consequence is that the queue is no longer globally FIFO ACROSS
    kinds — a matte can start while an older render is still queued. That is
    harmless here because the two are already phase-separated:
    _chain_matte_if_background_chosen only queues cutouts once every render for
    the project has landed, so in practice the kinds rarely compete at all.

    Under --workers 1 there is only ever one process claiming jobs, so a plain
    conditional UPDATE (rather than SELECT ... FOR UPDATE SKIP LOCKED) is
    already race-free; the WHERE status='queued' guard is defensive belt-and-
    suspenders in case this is ever run with more than one worker.
    """
    db = SessionLocal()
    try:
        job = (
            db.query(SceneAvatarJob)
            .filter(SceneAvatarJob.status == "queued", _kind_filter(kind))
            .order_by(SceneAvatarJob.created_at.asc(), SceneAvatarJob.id.asc())
            .first()
        )
        if not job:
            return None
        updated = (
            db.query(SceneAvatarJob)
            .filter(
                SceneAvatarJob.id == job.id,
                SceneAvatarJob.status == "queued",
                # Kind in the UPDATE too, so both queries describe the same row.
                _kind_filter(kind),
            )
            .update({SceneAvatarJob.status: "running"}, synchronize_session=False)
        )
        db.commit()
        if not updated:
            # Lost a race to claim this row (defensive; see docstring) — the
            # next tick will pick up whatever is next in line instead.
            return None
        db.refresh(job)
        return job
    finally:
        db.close()


def _run_scene_avatar_job(
    job_id: int,
    scene_id: int,
    project_id: int,
    preset: str | None,
    attempt_count_so_far: int | None = None,
) -> None:
    """Render one scene's avatar clip. Runs in a worker thread (via
    run_in_executor) so the long blocking HTTP render never touches the event
    loop. Opens its OWN sessions throughout — mirrors the discipline documented
    in services/avatar.py (never hold a DB connection across the render)."""
    from app.services.avatar import generate_scene_avatar_sync

    last_phase = "not_started"

    def _set_phase(phase: str) -> None:
        nonlocal last_phase
        last_phase = phase
        d = SessionLocal()
        try:
            row = d.query(SceneAvatarJob).filter(SceneAvatarJob.id == job_id).first()
            if row:
                row.phase = phase
                d.commit()
        except Exception:
            logger.warning("[AVATAR_QUEUE] Could not record phase %s for job %s", phase, job_id)
        finally:
            d.close()

    def _set_attempt(n: int) -> None:
        """Persist the attempt number BEFORE each try, so a job that dies
        mid-attempt still leaves an honest count behind. Same short-lived-session
        discipline as _set_phase."""
        d = SessionLocal()
        try:
            row = d.query(SceneAvatarJob).filter(SceneAvatarJob.id == job_id).first()
            if row:
                row.attempt_count = n
                d.commit()
        except Exception:
            logger.warning("[AVATAR_QUEUE] Could not record attempt %s for job %s", n, job_id)
        finally:
            d.close()

    # Avatar renders run 2-7+ minutes with no DB activity in between; ping the
    # pool with a real query the whole time so idle pooled connections don't
    # die mid-request for some OTHER endpoint that checks one out later (see
    # the identical heartbeat in the pre-queue implementation this replaces).
    import threading

    heartbeat_stop = threading.Event()

    def _heartbeat() -> None:
        while not heartbeat_stop.wait(30):
            try:
                d = SessionLocal()
                try:
                    d.execute(text("SELECT 1"))
                    d.commit()
                finally:
                    d.close()
            except Exception:
                logger.debug("[AVATAR_QUEUE] Heartbeat ping failed for job %s", job_id)

    heartbeat_thread = threading.Thread(
        target=_heartbeat, name=f"avatar-heartbeat-{job_id}", daemon=True
    )
    heartbeat_thread.start()

    error = None
    started_at = time.time()
    # The ceiling is per SCENE, not per job row: a successor row created by the
    # bulk retry endpoint arrives pre-seeded with its predecessor's count, so
    # this loop resumes the tally rather than restarting it. `inherited` is
    # therefore how many attempts this scene has ALREADY burned before now.
    max_attempts = _max_attempts()
    inherited = attempt_count_so_far or 0
    remaining = max(0, max_attempts - inherited)
    if remaining <= 0:
        # Defensive: the enqueue endpoints refuse to create a row at the cap, so
        # this should be unreachable. Fail explicitly rather than falling through
        # the empty loop with error=None, which would mark the job "completed"
        # without ever having rendered anything.
        from app.services.avatar import AvatarRenderError
        error = AvatarRenderError(
            f"This scene has already failed {inherited} times. "
            "Generate it again to start over.",
            retryable=False,
        )
    try:
        for offset in range(1, remaining + 1):
            attempt = inherited + offset
            last_phase = "not_started"
            attempt_started_at = time.time()
            _set_attempt(attempt)
            logger.info(
                "[AVATAR_QUEUE] Scene %s job %s: starting attempt %s/%s",
                scene_id, job_id, attempt, max_attempts,
            )
            try:
                error = generate_scene_avatar_sync(
                    scene_id, project_id, preset, on_status=_set_phase
                )
            except Exception as e:  # defensive: the service is meant to return, not raise
                logger.exception(
                    "[AVATAR_QUEUE] Scene %s job %s: attempt %s/%s crashed (last phase=%s)",
                    scene_id, job_id, attempt, max_attempts, last_phase,
                )
                from app.services.avatar import AvatarRenderError
                error = AvatarRenderError(f"Unexpected error: {e}", retryable=True)

            if not error:
                logger.info(
                    "[AVATAR_QUEUE] Scene %s job %s: attempt %s/%s succeeded in %.1fs",
                    scene_id, job_id, attempt, max_attempts, time.time() - attempt_started_at,
                )
                break
            logger.warning(
                "[AVATAR_QUEUE] Scene %s job %s: attempt %s/%s failed after %.1fs "
                "(retryable=%s, last phase=%s): %s",
                scene_id, job_id, attempt, max_attempts,
                time.time() - attempt_started_at, error.retryable, last_phase, error.reason,
            )
            # A non-retryable failure will reproduce identically — don't burn
            # the remaining attempts (and 15s sleeps) on a guaranteed repeat.
            if not error.retryable:
                break
            if attempt < max_attempts:
                time.sleep(15)
    finally:
        heartbeat_stop.set()
        heartbeat_thread.join(timeout=5)

    def _write_terminal(db) -> None:
        """Record this job's outcome. ONE definition, used by both paths below.

        It used to be copy-pasted into the recovery branch, which is how that
        branch came to skip everything that runs after it — see _on_batch_settled.
        """
        job = db.query(SceneAvatarJob).filter(SceneAvatarJob.id == job_id).first()
        if not job:
            return
        job.status = "failed" if error else "completed"
        job.phase = None
        job.error_message = error.reason if error else None
        job.retryable = error.retryable if error else None
        job.duration_seconds = round(time.time() - started_at, 1)
        job.completed_at = datetime.utcnow()
        # Flush so the "are any renders still active?" query in _on_batch_settled
        # sees THIS job as terminal. Autoflush would do it anyway; being explicit
        # means the hook can't silently stop firing if that default ever changes.
        db.flush()

    db = SessionLocal()
    try:
        _write_terminal(db)
        # Runs on BOTH outcomes. It used to be `if not error: _chain_matte...`,
        # which meant a batch whose LAST render FAILED never noticed it had
        # finished — precisely the case the refund exists for.
        _on_batch_settled(project_id, db)
        db.commit()
    except Exception:
        # Recording the job's outcome is the critical write here; everything the
        # settle hook does is best-effort. Roll back rather than leave the session
        # dirty, then retry the status write alone so a hook problem can never
        # lose the result of a render that actually succeeded.
        logger.exception(
            "[AVATAR_QUEUE] Failed to persist job %s outcome; retrying status only",
            job_id,
        )
        try:
            db.rollback()
            _write_terminal(db)
            db.commit()
        except Exception:
            logger.exception("[AVATAR_QUEUE] Job %s status write failed", job_id)
    finally:
        db.close()


def _on_batch_settled(project_id: int, db) -> None:
    """Everything that must happen once a project's LAST render lands.

    Called from BOTH terminal paths — success and failure. The failure case is
    the point: the matte chain used to be called under `if not error:`, so a
    batch whose last render failed never noticed it had finished, and a refund
    hung off that hook would never have fired for the very scenes it exists for.

    Takes the caller's session and does NOT commit, so the job's status, the
    credit refund and any queued cutouts land in one transaction. Never raises —
    a render that actually succeeded must not be recorded as failed because a
    follow-up step had a bad day.
    """
    try:
        # Matte completions re-enter this too (they are SceneAvatarJob rows as
        # well). Nothing here concerns them, so skip before spending any queries.
        renders_left = (
            db.query(SceneAvatarJob)
            .filter(
                SceneAvatarJob.project_id == project_id,
                SceneAvatarJob.kind == "render",
                SceneAvatarJob.status.in_(_ACTIVE_AVATAR_STATUSES),
            )
            .first()
        )
        if renders_left:
            return
        refund_exhausted_avatar_failures(project_id, db)
        _chain_matte_if_background_chosen(project_id, db)
    except Exception:
        logger.exception(
            "[AVATAR_QUEUE] Batch-settled hook failed for project %s", project_id
        )


def refund_exhausted_avatar_failures(project_id: int, db) -> int:
    """Return the credits for scenes that failed for good. Returns the amount.

    A batch charges AVATAR_CREDIT_COST_PER_SCENE up front, so a scene that will
    never render has been paid for and produced nothing.

    "For good" is two cases, and both matter:
      - attempts exhausted: burned the whole budget against, say, an outage;
      - retryable=False: died on the first attempt with a terminal error (no
        portrait, no voiceover). Same money, same dead end.

    SAFE TO CALL FROM ANYWHERE, as often as you like. `credits_refunded` is set
    in the same transaction as the balance change, and only unset rows are
    selected — so a second sweep is a no-op rather than free credits. That is
    what lets this run from the settle hook AND from the boot reaper, instead of
    needing one perfect chokepoint that every terminal path has to route through.

    Public (no underscore) because routers/projects.py calls it at boot.
    """
    from app.models.project import Project
    from app.models.scene import Scene
    from app.services.access import refund_avatar_credits

    max_attempts = _max_attempts()

    # Latest job per scene. A scene with three historical failed rows was charged
    # ONCE, so refunding per row would pay three times over.
    latest_ids = (
        db.query(func.max(SceneAvatarJob.id))
        .filter(
            SceneAvatarJob.project_id == project_id,
            SceneAvatarJob.kind == "render",
        )
        .group_by(SceneAvatarJob.scene_id)
        .subquery()
    )
    candidates = (
        db.query(SceneAvatarJob)
        .filter(
            SceneAvatarJob.id.in_(select(latest_ids)),
            SceneAvatarJob.status == "failed",
            SceneAvatarJob.credits_refunded.isnot(True),
            or_(
                SceneAvatarJob.attempt_count >= max_attempts,
                SceneAvatarJob.retryable.is_(False),
            ),
        )
        .all()
    )
    if not candidates:
        return 0

    # Never refund a scene that ended up with a clip anyway — an earlier attempt
    # may have landed, or the user generated it another way.
    with_clip = {
        sid
        for (sid,) in db.query(Scene.id).filter(
            Scene.id.in_([j.scene_id for j in candidates]),
            Scene.avatar_video_path.isnot(None),
        )
    }
    payable = [j for j in candidates if j.scene_id not in with_clip]
    if not payable:
        return 0

    # THE OWNER PAYS, so the owner is refunded. The job row's user_id is whoever
    # CLICKED — on a shared project that is the collaborator, and crediting them
    # would leave the person actually charged out of pocket. authorize_avatar_batch
    # charges project_owner(project, db); this is the same person.
    owner_id = (
        db.query(Project.user_id).filter(Project.id == project_id).scalar()
    )
    if owner_id is None:
        # Project mid-delete. Leave the flags UNSET so the money is still
        # reconcilable by hand rather than silently written off.
        logger.warning(
            "[AVATAR_QUEUE] Project %s has no owner — skipping refund of %d scene(s)",
            project_id, len(payable),
        )
        return 0

    amount = refund_avatar_credits(db, owner_id, len(payable))
    for job in payable:
        job.credits_refunded = True
    db.flush()
    # This is money moving: log enough to reconcile it without a debugger.
    logger.info(
        "[AVATAR_QUEUE] Refunded %d credits to user %s for %d failed scene(s) "
        "in project %s (scene_ids=%s)",
        amount, owner_id, len(payable), project_id,
        sorted(j.scene_id for j in payable),
    )
    return amount


def scene_needs_matte_filters():
    """SQLAlchemy predicates selecting scenes an AUTOMATIC sweep should matte.

    Shared by the two automatic sweeps — the post-render chain below and
    ``/avatar-matte-all`` in routers/projects.py — so they can never drift apart
    on which scenes they consider owed a cutout.

    ``avatar_matte_failed_at`` is the backoff, and it is the reason this helper
    exists. Matting now happens INLINE inside the Modal render container and gets
    exactly ONE attempt there, because its failures are deterministic (a bad
    frame, a codec, an ffmpeg crash) rather than transient. Selecting purely on
    ``avatar_matte_path IS NULL`` therefore meant a scene that fails matting is
    re-enqueued every single time any other render in the project completes — an
    unbounded retry loop burning a queue slot and CPU to fail identically.

    Deliberately NOT applied to the single-scene ``/avatar-matte`` endpoint: that
    one is a human explicitly asking again, and must always be allowed. It clears
    both columns as it enqueues, so a scene that succeeds on manual retry rejoins
    these sweeps (avatar_matte.py does the same on success).
    """
    from app.models.scene import Scene

    return (
        Scene.avatar_video_path.isnot(None),
        Scene.avatar_matte_path.is_(None),
        Scene.avatar_matte_failed_at.is_(None),
    )


def _chain_matte_if_background_chosen(project_id: int, db) -> None:
    """Queue the project's cutouts once its LAST render lands, if a background
    other than the portrait's own was chosen.

    WHY HERE AND NOT IN THE BROWSER
    The cutout is what makes a chosen background VISIBLE — without it the render
    pipeline falls back to the plain mp4 and the user's choice silently does
    nothing. Driving it from the client meant it only ran while the Avatar tab
    happened to be open on a settled batch: switch tabs, close the laptop, or
    just reload at the wrong moment and the work was never queued, leaving a
    "Remove them now" button to press by hand. Queued here it is part of the
    job's own lifecycle — it survives navigation, reloads and a closed browser.

    WHY IT WAITS FOR EVERY RENDER
    Deliberately NOT per-scene. Queueing each scene's cutout the moment its own
    render finished let mattes run ALONGSIDE the remaining renders, so a project
    could hold ~5 concurrent jobs' worth of DB connections at once. That drained
    the pool (size 5 + 10 overflow) and a still-rendering scene then failed to
    save its result — a clip that had already been paid for on the GPU was
    recorded as a failed attempt. Renders and cutouts therefore stay in strict
    phases, exactly as they were before this chaining existed.

    Does nothing when no cutout is wanted — avatar_bg NULL at both levels, or the
    explicit "original" — which is the case where the presenter keeps their
    filmed room and there is nothing to cut out.

    Takes the CALLER's session and does not commit — it is part of the same
    transaction that marks the render complete, so it adds no connection of its
    own to an already-contended pool.

    Never raises — a scene that renders fine must not be marked failed because
    the follow-up cutout could not be enqueued. The settings card's manual
    "Remove them now" is still there as the backstop.
    """
    try:
        from app.models.project import Project
        from app.models.scene import Scene

        # Any render still queued or in flight for this project? If so this is
        # not the last one, and starting cutouts now would overlap the phases.
        # The row for THIS job is already marked terminal on this session above,
        # so it is correctly excluded.
        renders_left = (
            db.query(SceneAvatarJob)
            .filter(
                SceneAvatarJob.project_id == project_id,
                SceneAvatarJob.kind == "render",
                SceneAvatarJob.status.in_(_ACTIVE_AVATAR_STATUSES),
            )
            .first()
        )
        if renders_left:
            return

        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        # Sweep every scene that now has a clip but no cutout — including ones
        # whose renders finished earlier in this batch and were skipped above.
        # Scenes whose inline matte already failed are excluded by
        # scene_needs_matte_filters (see its docstring): retrying them here would
        # loop, and the user can still retry one explicitly from the UI.
        scenes = (
            db.query(Scene)
            .filter(
                Scene.project_id == project_id,
                Scene.is_active.is_(True),
                *scene_needs_matte_filters(),
            )
            .order_by(Scene.order)
            .all()
        )
        queued = 0
        for scene in scenes:
            # Scene override wins, else the project default. Both NULL and the
            # explicit "original" mean "keep the portrait's background" — nothing
            # to cut out, so no job (and no CPU) is spent on this scene.
            bg = scene.avatar_bg if scene.avatar_bg is not None else project.avatar_bg
            if not avatar_bg_wants_cutout(bg):
                continue
            # Don't double-queue: _queue_matte's own guard covers the same ground
            # when the user also pressed the button.
            existing = (
                db.query(SceneAvatarJob)
                .filter(
                    SceneAvatarJob.scene_id == scene.id,
                    SceneAvatarJob.kind == "matte",
                    SceneAvatarJob.status.in_(_ACTIVE_AVATAR_STATUSES),
                )
                .first()
            )
            if existing:
                continue
            db.add(
                SceneAvatarJob(
                    project_id=project_id,
                    scene_id=scene.id,
                    user_id=project.user_id,
                    status="queued",
                    kind="matte",
                    avatar_preset=scene.avatar_preset,
                )
            )
            queued += 1
        if queued:
            logger.info(
                "[AVATAR_QUEUE] Project %s renders all done — auto-queued %s matte job(s)",
                project_id,
                queued,
            )
    except Exception:
        logger.exception(
            "[AVATAR_QUEUE] Could not auto-queue mattes for project %s", project_id
        )


def _classify_matte_error(message: str | None) -> bool:
    """Matte failures don't carry a structured retryable flag (see module
    docstring) — match against the small set of known transient messages."""
    if message is None:
        return False
    return message in _MATTE_RETRYABLE_MESSAGES


def _run_scene_matte_job(job_id: int, scene_id: int, project_id: int) -> None:
    """Cut the presenter out of one scene's EXISTING avatar mp4. CPU-only, no
    Space call — deliberately simpler than the render job (no phase/heartbeat
    needed, matte is a single ~1-min subprocess pipeline)."""
    from app.services.avatar_matte import matte_scene_avatar_sync

    error_message: str | None = None
    started_at = time.time()
    try:
        error_message = matte_scene_avatar_sync(scene_id, project_id)
    except Exception as e:  # defensive: the service is meant to return, not raise
        logger.exception("[AVATAR_QUEUE] Scene %s matte job %s crashed", scene_id, job_id)
        error_message = f"Unexpected error: {e}"

    db = SessionLocal()
    try:
        job = db.query(SceneAvatarJob).filter(SceneAvatarJob.id == job_id).first()
        if job:
            job.status = "failed" if error_message else "completed"
            job.error_message = error_message
            job.retryable = _classify_matte_error(error_message) if error_message else None
            job.duration_seconds = round(time.time() - started_at, 1)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


async def _run_job(job: SceneAvatarJob) -> None:
    """Run one claimed job to completion off the event loop, then free its slot
    so the dispatcher can claim another queued row. This is the ONLY place a job
    is removed from `_running_job_ids`, so a stuck render (however long) simply
    occupies its one slot rather than corrupting queue state.

    Each job already opens its OWN short-lived DB sessions inside the executor
    thread (see _run_scene_avatar_job), so concurrent jobs never share a session."""
    loop = asyncio.get_event_loop()
    try:
        if job.kind == "matte":
            await loop.run_in_executor(
                None, _run_scene_matte_job, job.id, job.scene_id, job.project_id
            )
        else:
            await loop.run_in_executor(
                None, _run_scene_avatar_job, job.id, job.scene_id, job.project_id,
                job.avatar_preset, job.attempt_count,
            )
    except Exception:
        logger.exception("[AVATAR_QUEUE] Job %s crashed outside its own handler", job.id)
        db = SessionLocal()
        try:
            row = db.query(SceneAvatarJob).filter(SceneAvatarJob.id == job.id).first()
            if row and row.status == "running":
                row.status = "failed"
                row.error_message = "Unexpected server error."
                row.retryable = True
                row.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()
    finally:
        # discard/pop, not remove: never raise here or the slot would leak
        # forever. Both must be cleared together or the per-kind count drifts
        # above the real occupancy and that kind stops dispatching.
        _running_job_ids.discard(job.id)
        _running_kinds.pop(job.id, None)


async def _dispatcher_loop() -> None:
    logger.info(
        "[AVATAR_QUEUE] Dispatcher started (render concurrency %s, matte concurrency %s).",
        _max_concurrency("render"),
        _max_concurrency("matte"),
    )
    while True:
        try:
            # Each kind has its OWN ceiling and its own queue, so they must be
            # filled independently: a full matte queue must not block renders,
            # and — the failure mode to watch — an EMPTY render queue must not
            # stop mattes dispatching. The `break` below therefore exits only
            # the inner while (this kind's queue is empty), never this for.
            for kind in ("render", "matte"):
                # Fill every free slot of this kind on this tick, so a batch of
                # N queued scenes starts N renders at once rather than one per
                # 2s poll.
                while _running_count(kind) < _max_concurrency(kind):
                    job = _claim_next_job(kind)
                    if job is None:
                        break  # this kind's queue is empty; try the next kind
                    _running_job_ids.add(job.id)
                    _running_kinds[job.id] = kind
                    logger.info(
                        "[AVATAR_QUEUE] Claimed job %s (scene=%s project=%s kind=%s) "
                        "[%s/%s %s slots in use]",
                        job.id, job.scene_id, job.project_id, job.kind,
                        _running_count(kind), _max_concurrency(kind), kind,
                    )
                    asyncio.create_task(_run_job(job))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[AVATAR_QUEUE] Dispatcher tick failed")
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)


def start() -> None:
    """Start the dispatcher task. Call once from the FastAPI lifespan, after
    reap_orphaned_avatar_jobs() has cleaned up any rows left `running` by a
    previous process."""
    global _dispatcher_task
    _running_job_ids.clear()
    _running_kinds.clear()
    if _dispatcher_task is None or _dispatcher_task.done():
        _dispatcher_task = asyncio.create_task(_dispatcher_loop())


async def stop() -> None:
    """Cancel the dispatcher task on shutdown, matching the other
    `_periodic_*` tasks' teardown in main.py."""
    global _dispatcher_task
    if _dispatcher_task is not None:
        _dispatcher_task.cancel()
        try:
            await _dispatcher_task
        except asyncio.CancelledError:
            pass
        _dispatcher_task = None
