"""Depth tier — the publish endpoints.

The rule worth stating plainly: publishing is OWNER-ONLY. A social connection is
a personal credential, so an editor pushing the owner's video to their own
channel — or to the owner's — is an authorisation bug, not a convenience.
Collaborators may watch progress, and nothing more.
"""
import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.project_member import MemberRole, MemberStatus, ProjectMember
from app.models.social_connection import (
    PLATFORM_LINKEDIN,
    PLATFORM_YOUTUBE,
    STATUS_ACTIVE,
    SocialConnection,
)
from app.models.social_publish_job import (
    STATUS_CANCELLED,
    STATUS_FAILED,
    STATUS_PENDING_RENDER,
    STATUS_QUEUED,
    STATUS_RUNNING,
    STATUS_SUCCEEDED,
    SocialPublishJob,
)
from app.services import token_crypto

pytestmark = pytest.mark.depth

YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload"


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_ID", "yt-client")
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_SECRET", "yt-secret")
    monkeypatch.setattr(settings, "X_CLIENT_ID", "")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "")
    token_crypto.reset_cache()
    yield
    token_crypto.reset_cache()


@pytest.fixture()
def linkedin_enabled(monkeypatch):
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "li-client")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "li-secret")


def _connect_linkedin(db, user, **kwargs):
    conn = SocialConnection(
        user_id=user.id,
        platform=PLATFORM_LINKEDIN,
        account_id="urn:li:person:abc",
        account_name="Test Member",
        scopes=kwargs.pop("scopes", "openid profile w_member_social"),
        status=kwargs.pop("status", STATUS_ACTIVE),
        **kwargs,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@pytest.fixture(autouse=True)
def _no_dispatcher(monkeypatch):
    """Never actually start an upload from an endpoint test."""
    from app.services import publish_queue

    monkeypatch.setattr(publish_queue, "wake", lambda: None)


def _project(db, user, *, rendered=True, **kwargs) -> Project:
    project = Project(
        user_id=user.id,
        name="Test Project",
        status=ProjectStatus.DONE if rendered else ProjectStatus.GENERATED,
        r2_video_url="https://cdn.test/v.mp4" if rendered else None,
        r2_video_key="users/1/projects/1/output/video_1.mp4" if rendered else None,
        **kwargs,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _connect(db, user, *, scopes=YOUTUBE_SCOPE, status=STATUS_ACTIVE) -> SocialConnection:
    conn = SocialConnection(
        user_id=user.id,
        platform=PLATFORM_YOUTUBE,
        account_name="My Channel",
        scopes=scopes,
        status=status,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _publish_body(**overrides) -> dict:
    body = {"platform": "youtube", "title": "My video", "source": "existing"}
    body.update(overrides)
    return body


def _add_member(db, project, user, role) -> None:
    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=user.id,
            invited_email=user.email,
            role=role,
            status=MemberStatus.ACCEPTED,
        )
    )
    db.commit()


# ─── Auth and ownership ─────────────────────────────────────────────────────

def test_publish_requires_auth(client, db_session, free_user):
    project = _project(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish", json=_publish_body()
    )
    assert resp.status_code == 401


def test_a_stranger_cannot_see_that_the_project_exists(
    client, db_session, free_user, other_user, auth
):
    project = _project(db_session, free_user)
    _connect(db_session, other_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(other_user),
    )

    assert resp.status_code == 404


def test_an_editor_cannot_publish(client, db_session, free_user, other_user, auth):
    """The core authorisation rule.

    The editor even has their own connected account — they still must not push
    someone else's video to it.
    """
    project = _project(db_session, free_user)
    _add_member(db_session, project, other_user, MemberRole.EDITOR)
    _connect(db_session, other_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(other_user),
    )

    assert resp.status_code == 404


def test_an_editor_may_read_publish_status(
    client, db_session, free_user, other_user, auth
):
    project = _project(db_session, free_user)
    _add_member(db_session, project, other_user, MemberRole.EDITOR)

    resp = client.get(
        f"/api/integrations/projects/{project.id}/publish-status",
        headers=auth(other_user),
    )

    assert resp.status_code == 200
    assert resp.json() == {"jobs": []}


def test_the_owner_can_publish(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["render_started"] is False
    assert body["job"]["status"] == STATUS_QUEUED


# ─── Connection preconditions ───────────────────────────────────────────────

def test_publishing_without_a_connection_is_409(client, db_session, free_user, auth):
    project = _project(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "not_connected"


def test_a_revoked_connection_is_409(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    _connect(db_session, free_user, status="revoked")

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "not_connected"


def test_a_connection_missing_upload_scope_is_rejected_up_front(
    client, db_session, free_user, auth
):
    """Better to say "reconnect" now than to fail after the upload starts."""
    project = _project(db_session, free_user)
    _connect(db_session, free_user, scopes="https://www.googleapis.com/auth/youtube.readonly")

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "insufficient_scope"


def test_a_disabled_platform_is_503(client, db_session, free_user, auth, monkeypatch):
    monkeypatch.setattr(settings, "X_CLIENT_ID", "")
    project = _project(db_session, free_user)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(platform="x"),
        headers=auth(free_user),
    )

    assert resp.status_code == 503


# ─── Request validation ─────────────────────────────────────────────────────

def test_publishing_an_unrendered_video_as_existing_is_400(
    client, db_session, free_user, auth
):
    project = _project(db_session, free_user, rendered=False)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(source="existing"),
        headers=auth(free_user),
    )

    assert resp.status_code == 400


def test_an_invalid_privacy_value_is_rejected(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(privacy_status="everyone"),
        headers=auth(free_user),
    )

    assert resp.status_code == 400


def test_linkedin_accepts_connections_visibility(
    client, db_session, free_user, auth, linkedin_enabled
):
    project = _project(db_session, free_user)
    _connect_linkedin(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(platform="linkedin", privacy_status="connections"),
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    assert resp.json()["job"]["privacy_status"] == "connections"


def test_linkedin_accepts_public_visibility(
    client, db_session, free_user, auth, linkedin_enabled
):
    project = _project(db_session, free_user)
    _connect_linkedin(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(platform="linkedin", privacy_status="public"),
        headers=auth(free_user),
    )

    assert resp.status_code == 200


@pytest.mark.parametrize("privacy", ["unlisted", "private"])
def test_linkedin_rejects_youtube_only_visibilities(
    client, db_session, free_user, auth, linkedin_enabled, privacy
):
    """LinkedIn has no unlisted/private notion — accepting them would store a
    value the publisher then has to guess how to map."""
    project = _project(db_session, free_user)
    _connect_linkedin(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(platform="linkedin", privacy_status=privacy),
        headers=auth(free_user),
    )

    assert resp.status_code == 400


def test_youtube_still_rejects_connections(client, db_session, free_user, auth):
    """Proves the per-platform validator narrowed rather than widened the rule."""
    project = _project(db_session, free_user)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(privacy_status="connections"),
        headers=auth(free_user),
    )

    assert resp.status_code == 400


def test_a_linkedin_connection_without_w_member_social_is_rejected_up_front(
    client, db_session, free_user, auth, linkedin_enabled
):
    project = _project(db_session, free_user)
    _connect_linkedin(db_session, free_user, scopes="openid profile")

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        # privacy_status must be set explicitly: PublishRequest defaults to
        # "private", which is a YouTube-only value and is rejected for LinkedIn
        # before the scope check is ever reached.
        json=_publish_body(platform="linkedin", privacy_status="public"),
        headers=auth(free_user),
    )

    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "insufficient_scope"


def test_an_empty_title_is_rejected(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(title=""),
        headers=auth(free_user),
    )

    assert resp.status_code == 422


def test_privacy_and_tags_are_persisted(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    _connect(db_session, free_user)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(privacy_status="public", tags=["a", "b"]),
        headers=auth(free_user),
    )

    job = db_session.query(SocialPublishJob).filter_by(id=resp.json()["job"]["id"]).first()
    assert job.privacy_status == "public"
    assert "a" in job.tags and "b" in job.tags


# ─── Duplicate protection ───────────────────────────────────────────────────

@pytest.mark.parametrize(
    "status", [STATUS_PENDING_RENDER, STATUS_QUEUED, STATUS_RUNNING]
)
def test_a_second_publish_while_one_is_in_flight_is_409(
    client, db_session, free_user, auth, status
):
    """A double click must not post the same video twice."""
    project = _project(db_session, free_user)
    _connect(db_session, free_user)
    db_session.add(
        SocialPublishJob(
            project_id=project.id,
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            status=status,
            title="Already going",
        )
    )
    db_session.commit()

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "already_publishing"


@pytest.mark.parametrize("status", [STATUS_SUCCEEDED, STATUS_FAILED, STATUS_CANCELLED])
def test_a_finished_job_does_not_block_a_new_one(
    client, db_session, free_user, auth, status
):
    project = _project(db_session, free_user)
    _connect(db_session, free_user)
    db_session.add(
        SocialPublishJob(
            project_id=project.id,
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            status=status,
            title="Old one",
        )
    )
    db_session.commit()

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 200


def test_publishing_to_a_different_platform_is_allowed_concurrently(
    client, db_session, free_user, auth, monkeypatch
):
    """The guard is per (project, platform), not per project."""
    monkeypatch.setattr(settings, "X_CLIENT_ID", "x-client")
    project = _project(db_session, free_user)
    _connect(db_session, free_user)
    db_session.add(
        SocialConnection(
            user_id=free_user.id, platform="x",
            scopes="tweet.write media.write", status=STATUS_ACTIVE,
        )
    )
    db_session.add(
        SocialPublishJob(
            project_id=project.id, user_id=free_user.id,
            platform="x", status=STATUS_RUNNING, title="On X",
        )
    )
    db_session.commit()

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(),
        headers=auth(free_user),
    )

    assert resp.status_code == 200


# ─── Render-first flow ──────────────────────────────────────────────────────

def test_an_unrendered_project_starts_a_render_and_binds_the_job(
    client, db_session, free_user, auth, monkeypatch
):
    """The intent row must carry the run id of the render it triggered."""
    project = _project(db_session, free_user, rendered=False)
    _connect(db_session, free_user)

    async def _fake_render(*args, **kwargs):
        return {"detail": "Render started", "progress": 0, "render_run_id": "run-42"}

    import app.routers.pipeline as pipeline
    monkeypatch.setattr(pipeline, "start_render_for_project", _fake_render)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(source="auto"),
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["render_started"] is True
    assert body["render_run_id"] == "run-42"
    job = db_session.query(SocialPublishJob).filter_by(id=body["job"]["id"]).first()
    assert job.status == STATUS_PENDING_RENDER
    assert job.render_run_id == "run-42"


def test_a_failed_render_start_leaves_no_orphan_intent(
    client, db_session, free_user, auth, monkeypatch
):
    """A billing refusal must not strand a row waiting for a render forever."""
    from fastapi import HTTPException

    project = _project(db_session, free_user, rendered=False)
    _connect(db_session, free_user)

    async def _refuse(*args, **kwargs):
        raise HTTPException(status_code=403, detail="Video limit reached")

    import app.routers.pipeline as pipeline
    monkeypatch.setattr(pipeline, "start_render_for_project", _refuse)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(source="auto"),
        headers=auth(free_user),
    )

    assert resp.status_code == 403
    assert db_session.query(SocialPublishJob).count() == 0


def test_rerender_forces_a_render_of_an_already_rendered_project(
    client, db_session, free_user, auth, monkeypatch
):
    """force_render is what bills the owner, so it must be set deliberately."""
    project = _project(db_session, free_user, rendered=True)
    _connect(db_session, free_user)
    seen = {}

    async def _capture(project, *, resolution, force_render, user, db):
        seen["force"] = force_render
        return {"render_run_id": "run-9"}

    import app.routers.pipeline as pipeline
    monkeypatch.setattr(pipeline, "start_render_for_project", _capture)

    client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(source="rerender"),
        headers=auth(free_user),
    )

    assert seen["force"] is True


def test_a_first_render_is_not_billed_as_a_rerender(
    client, db_session, free_user, auth, monkeypatch
):
    project = _project(db_session, free_user, rendered=False)
    _connect(db_session, free_user)
    seen = {}

    async def _capture(project, *, resolution, force_render, user, db):
        seen["force"] = force_render
        return {"render_run_id": "run-1"}

    import app.routers.pipeline as pipeline
    monkeypatch.setattr(pipeline, "start_render_for_project", _capture)

    client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(source="auto"),
        headers=auth(free_user),
    )

    assert seen["force"] is False


# ─── Cancel and retry ───────────────────────────────────────────────────────

def test_a_queued_job_can_be_cancelled(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id,
        platform=PLATFORM_YOUTUBE, status=STATUS_QUEUED, title="t",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish/{job.id}/cancel",
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    db_session.refresh(job)
    assert job.status == STATUS_CANCELLED


def test_a_running_upload_cannot_be_cancelled(client, db_session, free_user, auth):
    """The bytes are already moving; a "cancelled" that didn't cancel is a lie."""
    project = _project(db_session, free_user)
    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id,
        platform=PLATFORM_YOUTUBE, status=STATUS_RUNNING, title="t",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish/{job.id}/cancel",
        headers=auth(free_user),
    )

    assert resp.status_code == 409


def test_retry_requeues_and_resets_the_attempt_budget(
    client, db_session, free_user, auth
):
    """A human asking again is a fresh decision, not more automatic retries."""
    project = _project(db_session, free_user)
    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id,
        platform=PLATFORM_YOUTUBE, status=STATUS_FAILED, title="t",
        retryable=True, attempt_count=3, uploaded_bytes=500,
        resumable_url="https://upload.test/dead", error_code="network_error",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish/{job.id}/retry",
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    db_session.refresh(job)
    assert job.status == STATUS_QUEUED
    assert job.attempt_count == 0
    assert job.uploaded_bytes == 0
    assert job.resumable_url is None
    assert job.error_code is None


def test_a_non_retryable_job_cannot_be_retried(client, db_session, free_user, auth):
    project = _project(db_session, free_user)
    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id,
        platform=PLATFORM_YOUTUBE, status=STATUS_FAILED, title="t",
        retryable=False, error_code="reauth_required",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish/{job.id}/retry",
        headers=auth(free_user),
    )

    assert resp.status_code == 409


def test_a_job_from_another_project_is_not_reachable(
    client, db_session, free_user, auth
):
    mine = _project(db_session, free_user)
    theirs = _project(db_session, free_user)
    job = SocialPublishJob(
        project_id=theirs.id, user_id=free_user.id,
        platform=PLATFORM_YOUTUBE, status=STATUS_QUEUED, title="t",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    resp = client.post(
        f"/api/integrations/projects/{mine.id}/publish/{job.id}/cancel",
        headers=auth(free_user),
    )

    assert resp.status_code == 404


# ─── Status reporting ───────────────────────────────────────────────────────

def test_status_reports_progress_and_the_forced_private_flag(
    client, db_session, free_user, auth
):
    project = _project(db_session, free_user)
    db_session.add(
        SocialPublishJob(
            project_id=project.id, user_id=free_user.id,
            platform=PLATFORM_YOUTUBE, status=STATUS_SUCCEEDED, title="t",
            uploaded_bytes=50, total_bytes=100, forced_private=True,
            platform_post_url="https://youtu.be/abc",
        )
    )
    db_session.commit()

    body = client.get(
        f"/api/integrations/projects/{project.id}/publish-status",
        headers=auth(free_user),
    ).json()

    job = body["jobs"][0]
    assert job["progress"] == 0.5
    assert job["forced_private"] is True
    assert job["post_url"] == "https://youtu.be/abc"


# ─── Re-upload ──────────────────────────────────────────────────────────────

def test_a_published_video_can_be_published_again(
    client, db_session, free_user, auth
):
    """Regression: the UI used to trap the user on the success screen forever.

    The API always allowed this — the duplicate guard only blocks ACTIVE
    statuses — so this test pins the behaviour the frontend now relies on.
    Note each re-upload creates a NEW YouTube video; the API cannot replace an
    existing video's file.
    """
    project = _project(db_session, free_user)
    _connect(db_session, free_user)
    db_session.add(
        SocialPublishJob(
            project_id=project.id,
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            status=STATUS_SUCCEEDED,
            title="First upload",
            platform_post_id="vid_1",
            platform_post_url="https://youtu.be/vid_1",
        )
    )
    db_session.commit()

    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json=_publish_body(title="Second upload"),
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    assert resp.json()["job"]["status"] == STATUS_QUEUED
    assert (
        db_session.query(SocialPublishJob)
        .filter(SocialPublishJob.project_id == project.id)
        .count()
        == 2
    ), "the original upload's record must survive alongside the new one"


def test_publish_status_returns_metadata_for_prefilling(
    client, db_session, free_user, auth
):
    """The re-upload form prefills from the last attempt rather than starting blank."""
    project = _project(db_session, free_user)
    db_session.add(
        SocialPublishJob(
            project_id=project.id,
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            status=STATUS_SUCCEEDED,
            title="Original title",
            description="Original description",
            tags='["alpha", "beta"]',
        )
    )
    db_session.commit()

    job = client.get(
        f"/api/integrations/projects/{project.id}/publish-status",
        headers=auth(free_user),
    ).json()["jobs"][0]

    assert job["title"] == "Original title"
    assert job["description"] == "Original description"
    assert job["tags"] == ["alpha", "beta"]


def test_unparseable_tags_do_not_break_the_response(
    client, db_session, free_user, auth
):
    project = _project(db_session, free_user)
    db_session.add(
        SocialPublishJob(
            project_id=project.id, user_id=free_user.id,
            platform=PLATFORM_YOUTUBE, status=STATUS_SUCCEEDED,
            title="t", tags="not json at all",
        )
    )
    db_session.commit()

    resp = client.get(
        f"/api/integrations/projects/{project.id}/publish-status",
        headers=auth(free_user),
    )

    assert resp.status_code == 200
    assert resp.json()["jobs"][0]["tags"] == []


def test_jobs_with_the_same_timestamp_are_ordered_newest_first(
    client, db_session, free_user, auth
):
    """Re-uploading right after a publish can produce two rows in one second.

    Without an id tiebreak the older, succeeded row could come back first, and
    the client would show "your video is on YouTube" while the re-upload ran
    invisibly behind it.
    """
    from datetime import datetime

    project = _project(db_session, free_user)
    stamp = datetime(2026, 9, 17, 12, 0, 0)
    for title, status in (("First upload", STATUS_SUCCEEDED), ("Re-upload", STATUS_QUEUED)):
        db_session.add(
            SocialPublishJob(
                project_id=project.id,
                user_id=free_user.id,
                platform=PLATFORM_YOUTUBE,
                status=status,
                title=title,
                created_at=stamp,
            )
        )
        db_session.commit()

    jobs = client.get(
        f"/api/integrations/projects/{project.id}/publish-status",
        headers=auth(free_user),
    ).json()["jobs"]

    assert jobs[0]["title"] == "Re-upload"
    assert jobs[0]["status"] == STATUS_QUEUED
