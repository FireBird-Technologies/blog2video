"""System-wide FIFO queue for social publish (upload) jobs.

THE MODEL
``social_publish_jobs`` rows with status="queued" ARE the queue, ordered by
(created_at, id) across every project and user. A single in-process asyncio
dispatcher claims the oldest queued row and runs it, up to
``SOCIAL_PUBLISH_CONCURRENCY`` at a time. Same shape as avatar_queue, and
correct for the same reason: the app runs ``--workers 1`` (see main.py's boot
comment), so one process is the only writer moving queued -> running and a plain
conditional UPDATE is already race-free.

A queue rather than a bare thread because an upload runs for minutes, has to
survive a restart mid-flight, has to be rate-limited app-wide against YouTube's
daily bucket, and has to stay pollable by a client that reconnects later.

Like avatar_queue and unlike the project-level jobs, this is deliberately NOT
part of the one-job-per-project lock in ``_assert_no_active_job``. An upload
reads a finished MP4 and mutates no project state, so making a re-render wait
behind one would cost the user time and buy nothing.

THE PENDING_RENDER HANDOFF
A job created before its video exists sits in ``pending_render`` until the
render-completion hook promotes it (see ``promote_pending_jobs_sync``, called
from remotion.upload_rendered_video_to_r2). That hook runs on the render's
daemon thread, which has no event loop — hence ``wake_threadsafe``. The
promotion is a plain DB write, so a missed wake only delays the upload until the
next tick or the next boot sweep; it can never lose the job.

RETRY POLICY
``PublishError.retryable`` decides. Retries happen in-place (the row stays
`running` and holds its slot) so a transient failure does not cost the job its
queue position, bounded by ``MAX_ATTEMPTS`` on the row. Non-retryable codes —
reauth_required, video_superseded, session_expired — fail immediately, because
retrying them would only burn the daily upload quota to fail the same way.

QUOTA
YouTube bills videos.insert to a bucket of ~100 uploads/day that is APP-WIDE,
not per user. When the local cap is reached the dispatcher simply stops claiming
YouTube jobs; they stay `queued` and go out as the 24h window rolls. Failing
them instead would throw away the user's intent over something that self-heals.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import time
from datetime import datetime, timedelta

from sqlalchemy import or_

from app.config import settings
from app.database import SessionLocal
from app.models.social_connection import PLATFORM_X, PLATFORM_YOUTUBE, SocialConnection
from app.models.social_publish_job import (
    MAX_ATTEMPTS,
    SOURCE_RERENDER,
    STATUS_CANCELLED,
    STATUS_FAILED,
    STATUS_PENDING_RENDER,
    STATUS_QUEUED,
    STATUS_RUNNING,
    STATUS_SUCCEEDED,
    SocialPublishJob,
)
from app.services.youtube_publish import PublishError

logger = logging.getLogger(__name__)

# Idle tick. The dispatcher normally sleeps on _wake_event; this bounds how long
# a job parked by the quota cap waits before being reconsidered.
POLL_INTERVAL_SECONDS = 60
# A `running` row whose heartbeat is older than this is presumed dead.
STALE_RUNNING_MINUTES = 30
# How often the periodic sweep runs (pending_render whose render died, and
# stale running rows).
SWEEP_INTERVAL_SECONDS = 600
# Don't spam the DB with progress writes on a fast connection.
# Below the client's 3s poll, so each poll usually sees a fresh number. Any
# higher and a short upload finishes having written progress only once or twice.
PROGRESS_WRITE_INTERVAL_SECONDS = 1

_dispatcher_task: "asyncio.Task | None" = None
_sweep_task: "asyncio.Task | None" = None
_wake_event: "asyncio.Event | None" = None
_loop: "asyncio.AbstractEventLoop | None" = None
_running_job_ids: set[int] = set()


# ─── Waking ──────────────────────────────────────────────────────────────────


def wake() -> None:
    """Nudge the dispatcher from async context (a request handler)."""
    if _wake_event is not None:
        _wake_event.set()


def wake_threadsafe() -> None:
    """Nudge the dispatcher from a non-async thread.

    The render-completion hook runs on remotion's daemon thread, where there is
    no running loop. ``asyncio.Event.set`` is not thread-safe, so calling
    ``wake()`` from there is a real (if usually silent) bug — it can mutate the
    event while the loop is inspecting it, and the wake can simply be lost.

    A no-op when the queue was never started: the job row is already committed,
    so the worst case is that it waits for the next tick or the next boot sweep.
    """
    if _loop is not None and _wake_event is not None:
        try:
            _loop.call_soon_threadsafe(_wake_event.set)
        except RuntimeError:
            # Loop already closed (shutting down). The row survives.
            logger.debug("[PUBLISH_QUEUE] Could not wake dispatcher: loop closed")


# ─── Quota ───────────────────────────────────────────────────────────────────


def _youtube_uploads_last_24h(db) -> int:
    since = datetime.utcnow() - timedelta(hours=24)
    return (
        db.query(SocialPublishJob)
        .filter(
            SocialPublishJob.platform == PLATFORM_YOUTUBE,
            SocialPublishJob.status == STATUS_SUCCEEDED,
            SocialPublishJob.completed_at >= since,
        )
        .count()
    )


def youtube_quota_available(db) -> bool:
    cap = max(1, int(settings.YOUTUBE_UPLOAD_DAILY_CAP or 90))
    return _youtube_uploads_last_24h(db) < cap


# ─── Claiming ────────────────────────────────────────────────────────────────


def _claim_next_job(db=None) -> SocialPublishJob | None:
    """Atomically claim the oldest claimable queued job, or None.

    Skips YouTube rows while the daily cap is reached, so an X job (or a
    YouTube job tomorrow) is not blocked behind them.

    Opens its own short-lived session by default (like every other DB touch in
    the queue). ``db`` injects one instead — for tests, whose rows live in an
    uncommitted transaction a separate connection could not see.
    """
    owns_session = db is None
    db = db or SessionLocal()
    try:
        query = db.query(SocialPublishJob).filter(
            SocialPublishJob.status == STATUS_QUEUED
        )
        if not youtube_quota_available(db):
            logger.info(
                "[PUBLISH_QUEUE] YouTube daily upload cap reached — leaving those jobs queued."
            )
            query = query.filter(SocialPublishJob.platform != PLATFORM_YOUTUBE)

        job = query.order_by(
            SocialPublishJob.created_at.asc(), SocialPublishJob.id.asc()
        ).first()
        if not job:
            return None

        updated = (
            db.query(SocialPublishJob)
            .filter(
                SocialPublishJob.id == job.id,
                SocialPublishJob.status == STATUS_QUEUED,
            )
            .update({SocialPublishJob.status: STATUS_RUNNING}, synchronize_session=False)
        )
        db.commit()
        if not updated:
            # Lost a claim race (defensive under --workers 1).
            return None
        db.refresh(job)
        return job
    finally:
        if owns_session:
            db.close()


# ─── Pending-render promotion ────────────────────────────────────────────────


def promote_pending_jobs_sync(
    project_id: int,
    render_run_id: str | None,
    r2_video_key: str,
    db,
    local_path: str | None = None,
) -> int:
    """Move this project's pending_render jobs to queued. Returns how many.

    SYNC and session-borrowing on purpose: the caller is
    remotion.upload_rendered_video_to_r2, running on the render's daemon thread
    with its own open session and an uncommitted r2_video_key. Using that
    session means the promotion lands in the SAME transaction as the DONE
    transition — either the render completed and the publish is queued, or
    neither happened. Does not commit; the caller does.

    Only promotes rows whose render_run_id matches the run that just finished
    (or that have none). Without that check, an intent abandoned by a cancelled
    render would be satisfied by whatever render happened to finish next —
    publishing content the user never approved for it.
    """
    query = db.query(SocialPublishJob).filter(
        SocialPublishJob.project_id == project_id,
        SocialPublishJob.status == STATUS_PENDING_RENDER,
    )
    if render_run_id:
        query = query.filter(
            or_(
                SocialPublishJob.render_run_id == render_run_id,
                SocialPublishJob.render_run_id.is_(None),
            )
        )

    jobs = query.all()
    if not jobs:
        return 0

    total_bytes = 0
    if local_path:
        try:
            total_bytes = os.path.getsize(local_path)
        except OSError:
            total_bytes = 0

    for job in jobs:
        job.status = STATUS_QUEUED
        job.r2_video_key = r2_video_key
        if total_bytes:
            job.total_bytes = total_bytes
        job.updated_at = datetime.utcnow()

    logger.info(
        "[PUBLISH_QUEUE] Promoted %s pending publish job(s) for project %s",
        len(jobs), project_id,
    )
    return len(jobs)


def cancel_pending_jobs_sync(project_id: int, db, reason: str = "render_cancelled") -> int:
    """Cancel pending_render jobs for a project whose render is not going to land."""
    jobs = (
        db.query(SocialPublishJob)
        .filter(
            SocialPublishJob.project_id == project_id,
            SocialPublishJob.status == STATUS_PENDING_RENDER,
        )
        .all()
    )
    for job in jobs:
        job.status = STATUS_CANCELLED
        job.error_code = reason
        job.error_message = "The render did not complete, so nothing was published."
        job.completed_at = datetime.utcnow()
    return len(jobs)


# ─── Running one job ─────────────────────────────────────────────────────────


def _run_publish_job_sync(job_id: int) -> None:
    """Execute one publish job to a terminal state. Never raises."""
    db = SessionLocal()
    work_dir = os.path.join(settings.MEDIA_DIR, "tmp", f"publish_{job_id}")
    temp_file = None
    try:
        job = db.query(SocialPublishJob).filter(SocialPublishJob.id == job_id).first()
        if job is None:
            # The project (and its jobs) were deleted mid-flight.
            logger.info("[PUBLISH_QUEUE] Job %s vanished before it ran", job_id)
            return

        conn = (
            db.query(SocialConnection)
            .filter(
                SocialConnection.user_id == job.user_id,
                SocialConnection.platform == job.platform,
            )
            .first()
        )
        if conn is None or conn.status != "active":
            _fail(db, job, PublishError(
                "Your account is no longer connected. Please reconnect and publish again.",
                code="reauth_required", retryable=False,
            ))
            return

        while True:
            job.attempt_count = (job.attempt_count or 0) + 1
            db.commit()
            try:
                if job.platform == PLATFORM_YOUTUBE:
                    path, is_temp = _publish_youtube(db, job, conn, work_dir)
                elif job.platform == PLATFORM_X:
                    path, is_temp = _publish_x(db, job, conn, work_dir)
                else:
                    raise PublishError(
                        f"Unsupported platform '{job.platform}'.",
                        code="unsupported_platform", retryable=False,
                    )
                temp_file = path if is_temp else None
                return
            except PublishError as exc:
                if not exc.retryable or job.attempt_count >= MAX_ATTEMPTS:
                    _fail(db, job, exc)
                    return
                backoff = min(5 * (2 ** (job.attempt_count - 1)), 120)
                logger.warning(
                    "[PUBLISH_QUEUE] Job %s attempt %s failed (%s); retrying in %ss",
                    job.id, job.attempt_count, exc.code, backoff,
                )
                job.error_code = exc.code
                job.error_message = str(exc)
                db.commit()
                time.sleep(backoff)
            except Exception as exc:  # noqa: BLE001
                logger.exception("[PUBLISH_QUEUE] Job %s crashed", job_id)
                _fail(db, job, PublishError(
                    "Something went wrong while publishing.",
                    code="internal_error", retryable=False,
                ))
                return
    finally:
        try:
            if temp_file and os.path.exists(work_dir):
                shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass
        db.close()


def _publish_youtube(db, job: SocialPublishJob, conn: SocialConnection, work_dir: str):
    from app.services import youtube_publish as yt

    path, is_temp = yt.resolve_local_video(job.project_id, job.r2_video_key, work_dir)
    total_bytes = os.path.getsize(path)
    if total_bytes <= 0:
        raise PublishError(
            "The rendered video is empty.", code="video_missing", retryable=False
        )

    job.total_bytes = total_bytes
    db.commit()

    access_token = yt.get_access_token(conn, db)

    # Reuse an interrupted session rather than starting a new upload: a fresh
    # videos.insert would spend another slot from the small daily bucket.
    start_offset = 0
    if job.resumable_url:
        try:
            start_offset = yt.query_offset(job.resumable_url, access_token, total_bytes)
        except PublishError as exc:
            if exc.code != "session_expired":
                raise
            job.resumable_url = None
            db.commit()

    if not job.resumable_url:
        tags = []
        if job.tags:
            try:
                tags = json.loads(job.tags)
            except (ValueError, TypeError):
                tags = []
        job.resumable_url = yt.start_resumable_session(
            access_token,
            title=job.title,
            description=job.description,
            tags=tags,
            privacy_status=job.privacy_status,
            made_for_kids=job.made_for_kids,
            category_id=job.category_id,
            total_bytes=total_bytes,
        )
        start_offset = 0
        db.commit()

    last_write = [0.0]

    def on_progress(done: int, total: int) -> None:
        now = time.time()
        if now - last_write[0] < PROGRESS_WRITE_INTERVAL_SECONDS and done < total:
            return
        last_write[0] = now
        job.uploaded_bytes = done
        job.updated_at = datetime.utcnow()  # heartbeat for the stale sweep
        db.commit()

    result = yt.upload_file(
        upload_url=job.resumable_url,
        file_path=path,
        total_bytes=total_bytes,
        access_token=access_token,
        refresh_access_token=lambda: yt.get_access_token(conn, db, force=True),
        start_offset=start_offset,
        on_progress=on_progress,
    )

    video_id = result.get("id")
    if not video_id:
        raise PublishError(
            "YouTube did not confirm the upload.", code="upload_failed", retryable=True
        )

    returned_privacy = ((result.get("status") or {}).get("privacyStatus")) or ""
    job.platform_post_id = video_id
    job.platform_post_url = yt.video_url(video_id)
    # An unaudited API project has every upload forced private. Recording that
    # it actually happened is what lets the UI show the Studio link only when it
    # applies, instead of warning everyone unconditionally.
    job.forced_private = bool(
        returned_privacy and returned_privacy != job.privacy_status
        and returned_privacy == "private"
    )
    _succeed(db, job)
    return path, is_temp


def _publish_x(db, job: SocialPublishJob, conn: SocialConnection, work_dir: str):
    from app.services import x_publish
    from app.services import youtube_publish as yt

    path, is_temp = yt.resolve_local_video(job.project_id, job.r2_video_key, work_dir)
    total_bytes = os.path.getsize(path)
    if total_bytes <= 0:
        raise PublishError(
            "The rendered video is empty.", code="video_missing", retryable=False
        )
    job.total_bytes = total_bytes
    db.commit()

    def on_progress(done: int, total: int) -> None:
        job.uploaded_bytes = done
        job.updated_at = datetime.utcnow()
        db.commit()

    result = x_publish.publish_video(
        conn=conn,
        db=db,
        file_path=path,
        total_bytes=total_bytes,
        text=x_publish.compose_text(job.title, job.description),
        on_progress=on_progress,
    )
    job.platform_post_id = result["post_id"]
    job.platform_post_url = result["post_url"]
    _succeed(db, job)
    return path, is_temp


def _platform_label(platform: str) -> str:
    return "YouTube" if platform == PLATFORM_YOUTUBE else "X"


def _notify(db, job: SocialPublishJob, *, succeeded: bool) -> None:
    """Email the publisher the outcome. Best effort, never raises.

    Addressed to ``job.user_id`` — the person who pressed publish — rather than
    the project owner, since on a shared project they can differ and the owner
    did not ask for this.

    Swallows everything for the same reason the render's download email does
    (remotion.py): the upload has already happened, and a mail problem must not
    turn a finished job into a failed one.
    """
    try:
        from app.models.project import Project
        from app.models.user import User
        from app.services.email import EmailServiceError, email_service

        user = db.query(User).filter(User.id == job.user_id).first()
        if not user or not user.email:
            return
        project = db.query(Project).filter(Project.id == job.project_id).first()
        project_name = project.name if project else "your video"
        label = _platform_label(job.platform)

        try:
            if succeeded:
                email_service.send_publish_succeeded_email(
                    user_email=user.email,
                    user_name=user.name,
                    project_name=project_name,
                    platform_label=label,
                    post_url=job.platform_post_url or "",
                )
            else:
                email_service.send_publish_failed_email(
                    user_email=user.email,
                    user_name=user.name,
                    project_name=project_name,
                    platform_label=label,
                    reason=job.error_message or "The upload could not be completed.",
                    project_url=f"{settings.FRONTEND_URL.rstrip('/')}/project/{job.project_id}",
                )
        except EmailServiceError as email_err:
            logger.error(
                "[PUBLISH_QUEUE] Publish email failed for job %s: %s", job.id, email_err
            )
    except Exception as email_err:
        logger.error(
            "[PUBLISH_QUEUE] Unexpected error sending publish email for job %s: %s",
            job.id, email_err, exc_info=True,
        )


def _succeed(db, job: SocialPublishJob) -> None:
    job.status = STATUS_SUCCEEDED
    job.uploaded_bytes = job.total_bytes
    job.error_code = None
    job.error_message = None
    job.completed_at = datetime.utcnow()
    db.commit()
    logger.info(
        "[PUBLISH_QUEUE] Job %s published to %s: %s",
        job.id, job.platform, job.platform_post_url,
    )
    _notify(db, job, succeeded=True)


def _fail(db, job: SocialPublishJob, exc: PublishError) -> None:
    job.status = STATUS_FAILED
    job.error_code = exc.code
    job.error_message = str(exc)
    job.retryable = exc.retryable
    job.completed_at = datetime.utcnow()
    db.commit()
    logger.warning("[PUBLISH_QUEUE] Job %s failed (%s): %s", job.id, exc.code, exc)
    # Only reached once the job is terminally failed — the retry loop in
    # _run_publish_job_sync does not call this between attempts, so a transient
    # error that recovers never mails the user about it.
    _notify(db, job, succeeded=False)


# ─── Reaping ─────────────────────────────────────────────────────────────────


def reap_orphaned_publish_jobs(db=None) -> int:
    """Clean up rows left mid-flight by a previous process. Call at boot.

    Under --workers 1 anything still `running` at boot is orphaned by
    definition. A row with a resumable session goes back to `queued` so the
    upload RESUMES — restarting it would re-spend a slot of the daily bucket.

    ``db`` injects a session (see ``_claim_next_job``).
    """
    owns_session = db is None
    db = db or SessionLocal()
    try:
        requeued = failed = 0
        for job in db.query(SocialPublishJob).filter(
            SocialPublishJob.status == STATUS_RUNNING
        ).all():
            if job.resumable_url:
                job.status = STATUS_QUEUED
                job.error_code = None
                job.error_message = None
                requeued += 1
            else:
                job.status = STATUS_FAILED
                job.error_code = "interrupted"
                job.error_message = "The upload was interrupted. You can try again."
                job.retryable = True
                job.completed_at = datetime.utcnow()
                failed += 1
        if requeued or failed:
            db.commit()
            logger.info(
                "[PUBLISH_QUEUE] Reaped orphaned jobs: %s requeued, %s failed",
                requeued, failed,
            )
        return requeued + failed
    except Exception:
        logger.exception("[PUBLISH_QUEUE] Reaper failed")
        return 0
    finally:
        if owns_session:
            db.close()


def sweep_stuck_jobs(db=None) -> int:
    """Periodic: cancel pending_render jobs whose render died, fail stale runners.

    ``db`` injects a session (see ``_claim_next_job``).
    """
    from app.models.project import Project, ProjectStatus

    owns_session = db is None
    db = db or SessionLocal()
    try:
        touched = 0

        pending = (
            db.query(SocialPublishJob)
            .filter(SocialPublishJob.status == STATUS_PENDING_RENDER)
            .all()
        )
        for job in pending:
            project = db.query(Project).filter(Project.id == job.project_id).first()
            if project is None:
                job.status = STATUS_CANCELLED
                job.error_code = "project_deleted"
                job.completed_at = datetime.utcnow()
                touched += 1
                continue
            # Still rendering: leave it alone. Otherwise the render finished
            # without promoting this row (failed, cancelled, or superseded).
            if project.status != ProjectStatus.RENDERING:
                job.status = STATUS_CANCELLED
                job.error_code = "render_did_not_complete"
                job.error_message = (
                    "The render did not complete, so nothing was published."
                )
                job.completed_at = datetime.utcnow()
                touched += 1

        cutoff = datetime.utcnow() - timedelta(minutes=STALE_RUNNING_MINUTES)
        for job in (
            db.query(SocialPublishJob)
            .filter(
                SocialPublishJob.status == STATUS_RUNNING,
                SocialPublishJob.updated_at < cutoff,
            )
            .all()
        ):
            if job.id in _running_job_ids:
                continue  # actually in flight in this process
            job.status = STATUS_FAILED
            job.error_code = "stalled"
            job.error_message = "The upload stopped responding. You can try again."
            job.retryable = True
            job.completed_at = datetime.utcnow()
            touched += 1

        if touched:
            db.commit()
            logger.info("[PUBLISH_QUEUE] Sweep updated %s stuck job(s)", touched)
        return touched
    except Exception:
        logger.exception("[PUBLISH_QUEUE] Sweep failed")
        return 0
    finally:
        if owns_session:
            db.close()


# ─── Dispatcher ──────────────────────────────────────────────────────────────


def _max_concurrency() -> int:
    return max(1, int(settings.SOCIAL_PUBLISH_CONCURRENCY or 1))


async def _run_job(job: SocialPublishJob) -> None:
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _run_publish_job_sync, job.id)
    except Exception:
        # _run_publish_job_sync swallows its own errors; this guards against the
        # handler itself dying and leaving a permanently `running` row.
        logger.exception("[PUBLISH_QUEUE] Job %s handler crashed", job.id)
        db = SessionLocal()
        try:
            row = (
                db.query(SocialPublishJob)
                .filter(SocialPublishJob.id == job.id)
                .first()
            )
            if row and row.status == STATUS_RUNNING:
                row.status = STATUS_FAILED
                row.error_code = "internal_error"
                row.error_message = "The upload failed unexpectedly."
                row.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()
    finally:
        _running_job_ids.discard(job.id)
        wake()


async def _dispatcher_loop() -> None:
    logger.info(
        "[PUBLISH_QUEUE] Dispatcher started (concurrency %s).", _max_concurrency()
    )
    while True:
        try:
            while len(_running_job_ids) < _max_concurrency():
                job = _claim_next_job()
                if job is None:
                    break
                _running_job_ids.add(job.id)
                asyncio.create_task(_run_job(job))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[PUBLISH_QUEUE] Dispatcher tick failed")

        assert _wake_event is not None
        _wake_event.clear()
        try:
            # Bounded wait so quota-parked jobs get reconsidered even with no wake.
            await asyncio.wait_for(_wake_event.wait(), timeout=POLL_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass


async def _sweep_loop() -> None:
    while True:
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
        try:
            await asyncio.get_running_loop().run_in_executor(None, sweep_stuck_jobs)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[PUBLISH_QUEUE] Sweep loop error")


def start() -> None:
    """Start the dispatcher. Call from the lifespan AFTER reap_orphaned_publish_jobs()."""
    global _dispatcher_task, _sweep_task, _wake_event, _loop
    _running_job_ids.clear()
    _wake_event = asyncio.Event()
    _loop = asyncio.get_running_loop()
    if _dispatcher_task is None or _dispatcher_task.done():
        _dispatcher_task = asyncio.create_task(_dispatcher_loop())
    if _sweep_task is None or _sweep_task.done():
        _sweep_task = asyncio.create_task(_sweep_loop())


def stop() -> None:
    global _dispatcher_task, _sweep_task, _loop
    for task in (_dispatcher_task, _sweep_task):
        if task is not None and not task.done():
            task.cancel()
    _dispatcher_task = None
    _sweep_task = None
    _loop = None
