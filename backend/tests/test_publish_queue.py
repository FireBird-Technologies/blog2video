"""Depth tier — the social publish queue.

Covers the parts that only misbehave when something has already gone wrong: a
render that was cancelled, a process that died mid-upload, a daily quota that
ran out. These paths are hard to reach by hand and expensive to get wrong, since
each one either loses a user's intent or spends scarce upload quota.
"""
from datetime import datetime, timedelta

import pytest

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.social_publish_job import (
    STATUS_CANCELLED,
    STATUS_FAILED,
    STATUS_PENDING_RENDER,
    STATUS_QUEUED,
    STATUS_RUNNING,
    STATUS_SUCCEEDED,
    SocialPublishJob,
)
from app.services import publish_queue
from app.services.youtube_publish import PublishError

pytestmark = pytest.mark.depth


def _project(db, user, **kwargs) -> Project:
    project = Project(user_id=user.id, name="Test Project", **kwargs)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _job(db, project, user, **kwargs) -> SocialPublishJob:
    defaults = dict(
        project_id=project.id,
        user_id=user.id,
        platform="youtube",
        status=STATUS_PENDING_RENDER,
        title="A video",
    )
    defaults.update(kwargs)
    job = SocialPublishJob(**defaults)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# ─── Promotion: the render-completion handoff ───────────────────────────────

def test_promotes_a_pending_job_for_the_matching_render(db_session, free_user):
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user, render_run_id="run-1")

    promoted = publish_queue.promote_pending_jobs_sync(
        project.id, "run-1", "users/1/projects/1/output/video_123.mp4", db_session
    )
    db_session.commit()
    db_session.refresh(job)

    assert promoted == 1
    assert job.status == STATUS_QUEUED
    assert job.r2_video_key.endswith("video_123.mp4")


def test_does_not_promote_a_job_bound_to_a_different_render(db_session, free_user):
    """The load-bearing guard.

    Cancel a render, edit the project, render again: the abandoned intent must
    NOT be satisfied by the new render, or we publish something the user never
    approved for it.
    """
    project = _project(db_session, free_user)
    stale = _job(db_session, project, free_user, render_run_id="run-cancelled")

    promoted = publish_queue.promote_pending_jobs_sync(
        project.id, "run-new", "key.mp4", db_session
    )
    db_session.commit()
    db_session.refresh(stale)

    assert promoted == 0
    assert stale.status == STATUS_PENDING_RENDER


def test_promotes_a_job_with_no_run_id(db_session, free_user):
    """Legacy/unbound rows stay claimable rather than being stranded forever."""
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user, render_run_id=None)

    promoted = publish_queue.promote_pending_jobs_sync(
        project.id, "run-1", "key.mp4", db_session
    )
    db_session.commit()
    db_session.refresh(job)

    assert promoted == 1
    assert job.status == STATUS_QUEUED


def test_promotion_ignores_other_projects(db_session, free_user):
    project_a = _project(db_session, free_user)
    project_b = _project(db_session, free_user)
    other = _job(db_session, project_b, free_user, render_run_id="run-1")

    publish_queue.promote_pending_jobs_sync(project_a.id, "run-1", "key.mp4", db_session)
    db_session.commit()
    db_session.refresh(other)

    assert other.status == STATUS_PENDING_RENDER


def test_promotion_does_not_touch_terminal_jobs(db_session, free_user):
    project = _project(db_session, free_user)
    done = _job(db_session, project, free_user, status=STATUS_SUCCEEDED)

    publish_queue.promote_pending_jobs_sync(project.id, None, "key.mp4", db_session)
    db_session.commit()
    db_session.refresh(done)

    assert done.status == STATUS_SUCCEEDED


def test_promotion_records_the_file_size(db_session, free_user, tmp_path):
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user)
    video = tmp_path / "video.mp4"
    video.write_bytes(b"x" * 4096)

    publish_queue.promote_pending_jobs_sync(
        project.id, None, "key.mp4", db_session, local_path=str(video)
    )
    db_session.commit()
    db_session.refresh(job)

    assert job.total_bytes == 4096


def test_cancel_pending_marks_jobs_cancelled(db_session, free_user):
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user)

    count = publish_queue.cancel_pending_jobs_sync(project.id, db_session)
    db_session.commit()
    db_session.refresh(job)

    assert count == 1
    assert job.status == STATUS_CANCELLED


# ─── Waking ─────────────────────────────────────────────────────────────────

def test_wake_threadsafe_is_a_noop_when_the_queue_never_started(monkeypatch):
    """Called from the render thread; must not raise when the loop is absent.

    The row is already committed at that point, so a missed wake only delays the
    upload to the next tick.
    """
    monkeypatch.setattr(publish_queue, "_loop", None)
    monkeypatch.setattr(publish_queue, "_wake_event", None)

    publish_queue.wake_threadsafe()  # must not raise


def test_wake_threadsafe_uses_the_thread_safe_call(monkeypatch):
    """asyncio.Event.set() from a foreign thread is unsafe; must go via the loop."""
    calls = []

    class _Loop:
        def call_soon_threadsafe(self, fn):
            calls.append(fn)

    monkeypatch.setattr(publish_queue, "_loop", _Loop())
    monkeypatch.setattr(publish_queue, "_wake_event", type("E", (), {"set": lambda self: None})())

    publish_queue.wake_threadsafe()

    assert len(calls) == 1


# ─── Quota ──────────────────────────────────────────────────────────────────

def test_quota_available_when_under_the_cap(db_session, monkeypatch):
    monkeypatch.setattr(settings, "YOUTUBE_UPLOAD_DAILY_CAP", 5)
    assert publish_queue.youtube_quota_available(db_session) is True


def test_quota_exhausted_at_the_cap(db_session, free_user, monkeypatch):
    monkeypatch.setattr(settings, "YOUTUBE_UPLOAD_DAILY_CAP", 2)
    project = _project(db_session, free_user)
    for _ in range(2):
        _job(
            db_session, project, free_user,
            status=STATUS_SUCCEEDED, completed_at=datetime.utcnow(),
        )

    assert publish_queue.youtube_quota_available(db_session) is False


def test_uploads_older_than_24h_do_not_count(db_session, free_user, monkeypatch):
    """The bucket rolls, so yesterday's uploads must not block today's."""
    monkeypatch.setattr(settings, "YOUTUBE_UPLOAD_DAILY_CAP", 1)
    project = _project(db_session, free_user)
    _job(
        db_session, project, free_user,
        status=STATUS_SUCCEEDED,
        completed_at=datetime.utcnow() - timedelta(hours=25),
    )

    assert publish_queue.youtube_quota_available(db_session) is True


def test_quota_exhaustion_leaves_youtube_jobs_queued(db_session, free_user, monkeypatch):
    """Parked, never failed — failing would throw away the user's intent."""
    monkeypatch.setattr(settings, "YOUTUBE_UPLOAD_DAILY_CAP", 1)
    project = _project(db_session, free_user)
    _job(
        db_session, project, free_user,
        status=STATUS_SUCCEEDED, completed_at=datetime.utcnow(),
    )
    waiting = _job(db_session, project, free_user, status=STATUS_QUEUED)

    claimed = publish_queue._claim_next_job(db_session)

    assert claimed is None
    db_session.refresh(waiting)
    assert waiting.status == STATUS_QUEUED


def test_a_linkedin_job_is_claimed_while_the_youtube_quota_is_exhausted(
    db_session, free_user, monkeypatch
):
    """The quota filter is YouTube's alone.

    LinkedIn's limits are per-member and not knowable app-wide, so parking its
    jobs behind YouTube's cap would stall uploads for no reason.
    """
    monkeypatch.setattr(settings, "YOUTUBE_UPLOAD_DAILY_CAP", 1)
    project = _project(db_session, free_user)
    _job(
        db_session, project, free_user,
        status=STATUS_SUCCEEDED, completed_at=datetime.utcnow(),
    )
    linkedin = _job(
        db_session, project, free_user, platform="linkedin", status=STATUS_QUEUED
    )

    claimed = publish_queue._claim_next_job(db_session)

    assert claimed is not None
    assert claimed.id == linkedin.id


# ─── Platform labels ────────────────────────────────────────────────────────

def test_platform_label_covers_every_supported_platform():
    """Regression: the label used to be `"YouTube" if youtube else "X"`.

    That ternary silently told every non-YouTube platform's users their video had
    gone to X — in the success email, the one place they would believe it.
    """
    from app.services import social_oauth

    for platform in social_oauth.SUPPORTED_PLATFORMS:
        label = publish_queue._platform_label(platform)
        assert label != platform, f"{platform} has no human label"


def test_platform_label_falls_back_to_the_slug_rather_than_lying():
    assert publish_queue._platform_label("tiktok") == "tiktok"


# ─── LinkedIn handler ───────────────────────────────────────────────────────

def test_an_oversized_video_fails_before_any_network_call(
    db_session, free_user, tmp_path, monkeypatch
):
    """LinkedIn's 500 MB ceiling is far below YouTube's.

    Checked locally so the user gets a sentence they can act on, rather than an
    opaque 400 arriving after a multi-minute render — and so no bytes move first.
    """
    from app.services import linkedin_publish as li

    video = tmp_path / "video.mp4"
    video.write_bytes(b"\0" * 2048)
    monkeypatch.setattr(li, "MAX_VIDEO_BYTES", 1024)

    def _boom(*a, **k):
        raise AssertionError("publish_video must not be reached")

    monkeypatch.setattr(li, "publish_video", _boom)
    from app.services import youtube_publish as yt

    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))

    project = _project(db_session, free_user)
    job = _job(
        db_session, project, free_user, platform="linkedin", status=STATUS_RUNNING
    )

    with pytest.raises(PublishError) as exc:
        publish_queue._publish_linkedin(db_session, job, object(), str(tmp_path))

    assert exc.value.code == "video_too_large"
    assert exc.value.retryable is False


@pytest.mark.parametrize(
    "privacy,expected",
    [("connections", "CONNECTIONS"), ("public", "PUBLIC"), (None, "PUBLIC")],
)
def test_privacy_status_maps_onto_linkedin_visibility(
    db_session, free_user, tmp_path, monkeypatch, privacy, expected
):
    from app.services import linkedin_publish as li
    from app.services import youtube_publish as yt

    video = tmp_path / "video.mp4"
    video.write_bytes(b"\0" * 32)
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))

    seen = {}

    def _capture(**kwargs):
        seen.update(kwargs)
        return {"post_id": "urn:li:ugcPost:1", "post_url": "https://li.test/1"}

    monkeypatch.setattr(li, "publish_video", _capture)

    project = _project(db_session, free_user)
    job = _job(
        db_session, project, free_user,
        platform="linkedin", status=STATUS_RUNNING, privacy_status=privacy,
    )

    publish_queue._publish_linkedin(db_session, job, object(), str(tmp_path))

    assert seen["visibility"] == expected
    db_session.refresh(job)
    assert job.status == STATUS_SUCCEEDED
    assert job.platform_post_url == "https://li.test/1"


# ─── Reaping ────────────────────────────────────────────────────────────────

def test_reaper_requeues_a_resumable_upload(db_session, free_user):
    """Resuming costs no extra quota; restarting would spend another slot."""
    project = _project(db_session, free_user)
    job = _job(
        db_session, project, free_user,
        status=STATUS_RUNNING, resumable_url="https://upload.test/session",
    )

    publish_queue.reap_orphaned_publish_jobs(db_session)
    db_session.refresh(job)

    assert job.status == STATUS_QUEUED


def test_reaper_fails_a_running_job_with_no_session(db_session, free_user):
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user, status=STATUS_RUNNING, resumable_url=None)

    publish_queue.reap_orphaned_publish_jobs(db_session)
    db_session.refresh(job)

    assert job.status == STATUS_FAILED
    assert job.retryable is True


def test_reaper_leaves_queued_and_pending_jobs_alone(db_session, free_user):
    project = _project(db_session, free_user)
    queued = _job(db_session, project, free_user, status=STATUS_QUEUED)
    pending = _job(db_session, project, free_user, status=STATUS_PENDING_RENDER)

    publish_queue.reap_orphaned_publish_jobs(db_session)
    db_session.refresh(queued)
    db_session.refresh(pending)

    assert queued.status == STATUS_QUEUED
    assert pending.status == STATUS_PENDING_RENDER


# ─── Sweep ──────────────────────────────────────────────────────────────────

def test_sweep_cancels_a_pending_job_whose_render_is_over(db_session, free_user):
    """The render finished (or died) without promoting this row."""
    project = _project(db_session, free_user, status=ProjectStatus.ERROR)
    job = _job(db_session, project, free_user, status=STATUS_PENDING_RENDER)

    publish_queue.sweep_stuck_jobs(db_session)
    db_session.refresh(job)

    assert job.status == STATUS_CANCELLED
    assert job.error_code == "render_did_not_complete"


def test_sweep_leaves_a_job_alone_while_its_render_runs(db_session, free_user):
    project = _project(db_session, free_user, status=ProjectStatus.RENDERING)
    job = _job(db_session, project, free_user, status=STATUS_PENDING_RENDER)

    publish_queue.sweep_stuck_jobs(db_session)
    db_session.refresh(job)

    assert job.status == STATUS_PENDING_RENDER


def test_sweep_fails_a_running_job_with_a_dead_heartbeat(db_session, free_user):
    project = _project(db_session, free_user, status=ProjectStatus.DONE)
    job = _job(db_session, project, free_user, status=STATUS_RUNNING)
    job.updated_at = datetime.utcnow() - timedelta(
        minutes=publish_queue.STALE_RUNNING_MINUTES + 5
    )
    db_session.commit()

    publish_queue.sweep_stuck_jobs(db_session)
    db_session.refresh(job)

    assert job.status == STATUS_FAILED
    assert job.error_code == "stalled"


def test_sweep_spares_a_job_actually_running_in_this_process(db_session, free_user, monkeypatch):
    """A slow-but-alive upload must not be reaped out from under itself."""
    project = _project(db_session, free_user, status=ProjectStatus.DONE)
    job = _job(db_session, project, free_user, status=STATUS_RUNNING)
    job.updated_at = datetime.utcnow() - timedelta(
        minutes=publish_queue.STALE_RUNNING_MINUTES + 5
    )
    db_session.commit()
    monkeypatch.setattr(publish_queue, "_running_job_ids", {job.id})

    publish_queue.sweep_stuck_jobs(db_session)
    db_session.refresh(job)

    assert job.status == STATUS_RUNNING


# ─── Claiming ───────────────────────────────────────────────────────────────

def test_claims_strictly_oldest_first(db_session, free_user):
    project = _project(db_session, free_user)
    first = _job(db_session, project, free_user, status=STATUS_QUEUED, platform="x")
    second = _job(db_session, project, free_user, status=STATUS_QUEUED, platform="x")
    first.created_at = datetime.utcnow() - timedelta(minutes=5)
    db_session.commit()

    claimed = publish_queue._claim_next_job(db_session)

    assert claimed is not None
    assert claimed.id == first.id
    assert claimed.status == STATUS_RUNNING


def test_claiming_an_empty_queue_returns_none(db_session):
    assert publish_queue._claim_next_job(db_session) is None


# ─── Completion emails ──────────────────────────────────────────────────────

@pytest.fixture()
def captured_emails(monkeypatch):
    """Capture outgoing publish emails instead of sending them."""
    from app.services import email as email_module

    sent = {"succeeded": [], "failed": []}
    monkeypatch.setattr(
        email_module.EmailService, "send_publish_succeeded_email",
        lambda self, **kw: sent["succeeded"].append(kw), raising=True,
    )
    monkeypatch.setattr(
        email_module.EmailService, "send_publish_failed_email",
        lambda self, **kw: sent["failed"].append(kw), raising=True,
    )
    return sent


def test_success_emails_the_publisher(db_session, free_user, captured_emails):
    project = _project(db_session, free_user)
    job = _job(
        db_session, project, free_user,
        status=STATUS_RUNNING, total_bytes=100,
        platform_post_url="https://youtu.be/abc",
    )

    publish_queue._succeed(db_session, job)

    assert len(captured_emails["succeeded"]) == 1
    sent = captured_emails["succeeded"][0]
    assert sent["user_email"] == free_user.email
    assert sent["post_url"] == "https://youtu.be/abc"
    assert sent["platform_label"] == "YouTube"
    assert captured_emails["failed"] == []


def test_failure_emails_the_publisher_with_the_reason(
    db_session, free_user, captured_emails
):
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user, status=STATUS_RUNNING)

    publish_queue._fail(
        db_session, job,
        PublishError("Your YouTube connection expired.", code="reauth_required", retryable=False),
    )

    assert len(captured_emails["failed"]) == 1
    sent = captured_emails["failed"][0]
    assert sent["user_email"] == free_user.email
    assert "expired" in sent["reason"]
    assert captured_emails["succeeded"] == []


def test_the_email_goes_to_whoever_published_not_the_owner(
    db_session, free_user, other_user, captured_emails
):
    """On a shared project the publisher and the owner can differ."""
    project = _project(db_session, free_user)
    job = _job(
        db_session, project, other_user,
        status=STATUS_RUNNING, platform_post_url="https://youtu.be/x",
    )

    publish_queue._succeed(db_session, job)

    assert captured_emails["succeeded"][0]["user_email"] == other_user.email


def test_a_broken_email_service_does_not_undo_a_successful_upload(
    db_session, free_user, monkeypatch
):
    """The upload already happened — mail must never turn it into a failure."""
    from app.services import email as email_module

    def _explode(self, **kwargs):
        raise RuntimeError("SMTP is on fire")

    monkeypatch.setattr(
        email_module.EmailService, "send_publish_succeeded_email", _explode, raising=True
    )
    project = _project(db_session, free_user)
    job = _job(
        db_session, project, free_user,
        status=STATUS_RUNNING, total_bytes=50,
        platform_post_url="https://youtu.be/abc",
    )

    publish_queue._succeed(db_session, job)
    db_session.refresh(job)

    assert job.status == STATUS_SUCCEEDED
    assert job.completed_at is not None


def test_an_email_service_error_is_swallowed_on_failure_too(
    db_session, free_user, monkeypatch
):
    from app.services import email as email_module

    def _explode(self, **kwargs):
        raise email_module.EmailServiceError("no API key")

    monkeypatch.setattr(
        email_module.EmailService, "send_publish_failed_email", _explode, raising=True
    )
    project = _project(db_session, free_user)
    job = _job(db_session, project, free_user, status=STATUS_RUNNING)

    publish_queue._fail(
        db_session, job, PublishError("nope", code="upload_failed", retryable=False)
    )
    db_session.refresh(job)

    assert job.status == STATUS_FAILED
