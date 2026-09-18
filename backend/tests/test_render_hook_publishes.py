"""Depth tier — the render-completion -> publish handoff.

``upload_rendered_video_to_r2`` is the seam that makes "render & publish" work
with the tab closed. It runs on the render's daemon thread, and it already owns
three things the user cares about more than publishing: marking the project DONE,
telling live collaborators, and sending the download email.

So the contract has two halves, and the second matters more than the first:

1. a pending publish job for THIS render becomes queued; and
2. nothing about publishing can stop the render from being recorded as finished.
"""
import pytest

from app.models.project import Project, ProjectStatus
from app.models.social_publish_job import (
    STATUS_PENDING_RENDER,
    STATUS_QUEUED,
    SocialPublishJob,
)
from app.services import remotion

pytestmark = pytest.mark.depth


@pytest.fixture()
def rendered_project(db_session, free_user, tmp_path, monkeypatch):
    """A project mid-render, with the output file on disk, R2 and email stubbed."""
    project = Project(
        user_id=free_user.id, name="Test Project", status=ProjectStatus.RENDERING
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    video = tmp_path / "video.mp4"
    video.write_bytes(b"\0" * 2048)

    # The hook opens its own SessionLocal(); point it at the test's session so
    # it sees rows that live in the test's uncommitted transaction.
    monkeypatch.setattr(remotion, "SessionLocal", lambda: _NonClosing(db_session), raising=False)
    import app.database as database_module
    monkeypatch.setattr(database_module, "SessionLocal", lambda: _NonClosing(db_session))

    monkeypatch.setattr(remotion.r2_storage, "is_r2_configured", lambda: True)
    monkeypatch.setattr(remotion.r2_storage, "delete_object", lambda *a, **k: True)
    monkeypatch.setattr(
        remotion.r2_storage, "upload_project_video_versioned",
        lambda *a, **k: "https://cdn.test/video_1.mp4",
    )
    monkeypatch.setattr(
        remotion.r2_storage, "video_key_versioned",
        lambda *a, **k: "users/1/projects/1/output/video_1.mp4",
    )
    monkeypatch.setattr(
        remotion.email_service, "send_download_ready_email", lambda *a, **k: None
    )
    return project, str(video)


class _NonClosing:
    """Wrap the test session so the code under test can't close it."""

    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass


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


# ─── The handoff ────────────────────────────────────────────────────────────

def test_a_finished_render_queues_the_pending_publish(
    db_session, free_user, rendered_project, monkeypatch
):
    project, video_path = rendered_project
    monkeypatch.setattr(
        remotion, "get_render_progress", lambda _pid: {"_run_id": "run-1"}
    )
    job = _job(db_session, project, free_user, render_run_id="run-1")

    remotion.upload_rendered_video_to_r2(project.id, video_path)
    db_session.refresh(job)
    db_session.refresh(project)

    assert job.status == STATUS_QUEUED
    assert job.r2_video_key.endswith("video_1.mp4")
    assert job.total_bytes == 2048
    assert project.status == ProjectStatus.DONE


def test_a_job_from_a_different_render_is_left_pending(
    db_session, free_user, rendered_project, monkeypatch
):
    """A cancelled render's abandoned intent must not ride on a later one."""
    project, video_path = rendered_project
    monkeypatch.setattr(
        remotion, "get_render_progress", lambda _pid: {"_run_id": "run-new"}
    )
    job = _job(db_session, project, free_user, render_run_id="run-abandoned")

    remotion.upload_rendered_video_to_r2(project.id, video_path)
    db_session.refresh(job)
    db_session.refresh(project)

    assert job.status == STATUS_PENDING_RENDER
    assert project.status == ProjectStatus.DONE, "the render still completes"


def test_the_dispatcher_is_woken_thread_safely(
    db_session, free_user, rendered_project, monkeypatch
):
    """The hook runs on a daemon thread, so the wake must go via the loop."""
    project, video_path = rendered_project
    monkeypatch.setattr(remotion, "get_render_progress", lambda _pid: {"_run_id": "r"})
    _job(db_session, project, free_user, render_run_id="r")

    calls = []
    from app.services import publish_queue
    monkeypatch.setattr(publish_queue, "wake_threadsafe", lambda: calls.append(1))

    remotion.upload_rendered_video_to_r2(project.id, video_path)

    assert calls == [1]


def test_no_wake_when_there_was_nothing_to_promote(
    db_session, free_user, rendered_project, monkeypatch
):
    project, video_path = rendered_project
    monkeypatch.setattr(remotion, "get_render_progress", lambda _pid: {"_run_id": "r"})

    calls = []
    from app.services import publish_queue
    monkeypatch.setattr(publish_queue, "wake_threadsafe", lambda: calls.append(1))

    remotion.upload_rendered_video_to_r2(project.id, video_path)

    assert calls == []


# ─── The render must survive publishing bugs ────────────────────────────────

def test_a_promotion_crash_does_not_cost_the_user_their_render(
    db_session, free_user, rendered_project, monkeypatch
):
    """The half that matters most.

    Publishing is a nice-to-have bolted onto the end of an expensive render. If
    it throws, the project must still be DONE with its video URL set — otherwise
    a bug here silently destroys work the user paid for.
    """
    project, video_path = rendered_project
    monkeypatch.setattr(remotion, "get_render_progress", lambda _pid: {"_run_id": "r"})

    from app.services import publish_queue

    def _boom(*args, **kwargs):
        raise RuntimeError("publishing is broken")

    monkeypatch.setattr(publish_queue, "promote_pending_jobs_sync", _boom)

    result = remotion.upload_rendered_video_to_r2(project.id, video_path)
    db_session.refresh(project)

    assert result == "https://cdn.test/video_1.mp4"
    assert project.status == ProjectStatus.DONE
    assert project.r2_video_url == "https://cdn.test/video_1.mp4"


def test_a_wake_crash_does_not_cost_the_user_their_render(
    db_session, free_user, rendered_project, monkeypatch
):
    project, video_path = rendered_project
    monkeypatch.setattr(remotion, "get_render_progress", lambda _pid: {"_run_id": "r"})
    job = _job(db_session, project, free_user, render_run_id="r")

    from app.services import publish_queue

    def _boom():
        raise RuntimeError("no event loop")

    monkeypatch.setattr(publish_queue, "wake_threadsafe", _boom)

    remotion.upload_rendered_video_to_r2(project.id, video_path)
    db_session.refresh(project)
    db_session.refresh(job)

    assert project.status == ProjectStatus.DONE
    # The promotion still committed — only the nudge failed, so the dispatcher
    # picks it up on its next tick.
    assert job.status == STATUS_QUEUED
