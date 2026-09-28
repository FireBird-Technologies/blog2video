"""Depth tier — Ghost / Beehiiv content sources: connect, list, import, snippet.

Security properties pinned here, not to be relaxed:

* an API key never appears in any response body;
* no key is stored when SOCIAL_TOKEN_ENC_KEY is unset (no plaintext fallback);
* a Ghost site URL resolving to a private address is refused (SSRF).
"""
import json
import socket

import jwt
import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.social_connection import (
    PLATFORM_BEEHIIV,
    PLATFORM_GHOST,
    STATUS_ACTIVE,
    STATUS_REVOKED,
    SocialConnection,
)
from app.services import beehiiv_api, ghost_api, source_importer, token_crypto
from app.services.source_common import SourceError, normalize_site_url
from app.services.source_urls import is_placeholder_source_url, public_source_link

pytestmark = pytest.mark.depth

GHOST_KEY = "65f1c0ffee0123456789abcd:" + "ab" * 32
POST_HTML = "<h2>Intro</h2><p>" + ("Ghost makes publishing simple. " * 10) + "</p>"


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "ENVIRONMENT", "local")
    token_crypto.reset_cache()
    # Imports must never reach the network for images in tests.
    monkeypatch.setattr(source_importer, "_download_images", lambda *a, **k: [])
    yield
    token_crypto.reset_cache()


def _ghost_conn(db, user, **kwargs):
    conn = SocialConnection(
        user_id=user.id,
        platform=PLATFORM_GHOST,
        access_token_enc=token_crypto.encrypt(GHOST_KEY),
        site_url="https://blog.example.com",
        account_name="Example Blog",
        status=kwargs.pop("status", STATUS_ACTIVE),
        **kwargs,
    )
    db.add(conn)
    db.commit()
    return conn


def _beehiiv_conn(db, user):
    conn = SocialConnection(
        user_id=user.id,
        platform=PLATFORM_BEEHIIV,
        access_token_enc=token_crypto.encrypt("bh-secret-key"),
        account_id="pub_123",
        account_name="My Newsletter",
        status=STATUS_ACTIVE,
    )
    db.add(conn)
    db.commit()
    return conn


# ─── Pure helpers ───────────────────────────────────────────────────────────


def test_placeholder_urls():
    assert is_placeholder_source_url("upload://documents")
    assert is_placeholder_source_url("ghost://65f1")
    assert is_placeholder_source_url("beehiiv://post_1")
    assert not is_placeholder_source_url("https://blog.example.com/p")
    assert public_source_link("ghost://65f1") == ""
    assert public_source_link(" https://x.com/a ") == "https://x.com/a"


def test_ghost_admin_jwt_shape():
    token = ghost_api.make_admin_jwt(GHOST_KEY, now=1_700_000_000)
    header = jwt.get_unverified_header(token)
    assert header["kid"] == "65f1c0ffee0123456789abcd"
    assert header["alg"] == "HS256"
    claims = jwt.decode(
        token, bytes.fromhex("ab" * 32), algorithms=["HS256"], audience="/admin/",
        options={"verify_exp": False},
    )
    assert claims["exp"] - claims["iat"] == 300


@pytest.mark.parametrize("bad", ["", "no-colon", "id:not-hex!"])
def test_ghost_rejects_malformed_keys(bad):
    with pytest.raises(SourceError) as exc:
        ghost_api.parse_admin_key(bad)
    assert exc.value.code == "invalid_key"


@pytest.mark.parametrize("raw,expected", [
    ("blog.example.com", "https://blog.example.com"),
    ("https://blog.example.com/", "https://blog.example.com"),
    ("https://blog.example.com/ghost/#/dashboard", "https://blog.example.com"),
    ("https://example.com/blog/ghost/", "https://example.com/blog"),
    ("https://example.com/ghostwriting", "https://example.com/ghostwriting"),
])
def test_normalize_site_url(raw, expected):
    assert normalize_site_url(raw) == expected


def test_normalize_site_url_blocks_private_hosts(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(
        socket, "getaddrinfo",
        lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("169.254.169.254", 0))],
    )
    with pytest.raises(SourceError) as exc:
        normalize_site_url("https://metadata.evil.example")
    assert exc.value.code == "invalid_site"


def test_normalize_site_url_requires_https_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(SourceError):
        normalize_site_url("http://blog.example.com")


def test_lexical_insertion_top_and_bottom():
    lexical = json.dumps({"root": {"children": [{"type": "paragraph"}], "type": "root"}})
    card = ghost_api.build_video_card(
        src="https://x/v.mp4", thumbnail_src=None, file_name="v.mp4",
        width=1920, height=1080, duration=12.0,
    )
    top = json.loads(ghost_api.insert_video_into_lexical(lexical, card, "top"))
    assert top["root"]["children"][0]["type"] == "video"
    assert top["root"]["children"][0]["src"] == "https://x/v.mp4"
    bottom = json.loads(ghost_api.insert_video_into_lexical(lexical, card, "bottom"))
    assert bottom["root"]["children"][-1]["type"] == "video"


def test_mobiledoc_insertion():
    mobiledoc = json.dumps({"version": "0.3.1", "cards": [], "sections": [[1, "p", []]]})
    card = ghost_api.build_video_card(
        src="https://x/v.mp4", thumbnail_src=None, file_name="v.mp4",
        width=1, height=1, duration=1.0,
    )
    doc = json.loads(ghost_api.insert_video_into_mobiledoc(mobiledoc, card, "top"))
    assert doc["cards"][0][0] == "video"
    assert doc["sections"][0] == [10, 0]


def test_beehiiv_post_summary_maps_status_and_paywall():
    s = beehiiv_api._post_summary({
        "id": "post_1", "title": "Hi", "status": "confirmed", "audience": "premium",
        "web_url": "https://n.beehiiv.com/p/hi", "publish_date": 1_700_000_000,
    })
    assert s["status"] == "published"
    assert s["paid"] is True
    assert s["url"] == "https://n.beehiiv.com/p/hi"
    draft = beehiiv_api._post_summary({"id": "post_2", "status": "draft", "web_url": "x"})
    assert draft["url"] is None


# ─── Connect ────────────────────────────────────────────────────────────────


def test_connect_ghost_stores_encrypted_key_and_never_returns_it(
    client, free_user, auth, db_session, monkeypatch
):
    monkeypatch.setattr(ghost_api, "get_site", lambda creds: {
        "title": "Example Blog", "url": creds.site_url, "icon": None,
    })
    resp = client.post(
        "/api/sources/ghost/connect",
        json={"api_key": GHOST_KEY, "site_url": "blog.example.com/ghost/"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert GHOST_KEY not in resp.text
    body = resp.json()["connection"]
    assert body["connected"] is True
    assert body["site_url"] == "https://blog.example.com"

    row = db_session.query(SocialConnection).filter_by(user_id=free_user.id).one()
    assert row.access_token_enc and GHOST_KEY not in row.access_token_enc
    assert token_crypto.decrypt(row.access_token_enc) == GHOST_KEY

    listed = client.get("/api/sources/connections", headers=auth(free_user))
    assert GHOST_KEY not in listed.text


def test_connect_refused_without_encryption_key(client, free_user, auth, db_session, monkeypatch):
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", "")
    token_crypto.reset_cache()
    resp = client.post(
        "/api/sources/ghost/connect",
        json={"api_key": GHOST_KEY, "site_url": "blog.example.com"},
        headers=auth(free_user),
    )
    assert resp.status_code == 503
    assert db_session.query(SocialConnection).count() == 0


def test_connect_bad_key_is_409_not_401(client, free_user, auth, monkeypatch):
    """401 would log the user out of the app via the axios interceptor."""
    def _reject(creds):
        raise SourceError("nope", code="invalid_key")
    monkeypatch.setattr(ghost_api, "get_site", _reject)
    resp = client.post(
        "/api/sources/ghost/connect",
        json={"api_key": GHOST_KEY, "site_url": "blog.example.com"},
        headers=auth(free_user),
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "invalid_key"


def test_connect_beehiiv_asks_to_pick_publication(client, free_user, auth, db_session, monkeypatch):
    pubs = [{"id": "pub_a", "name": "A"}, {"id": "pub_b", "name": "B"}]
    monkeypatch.setattr(beehiiv_api, "list_publications", lambda key: pubs)
    first = client.post(
        "/api/sources/beehiiv/connect", json={"api_key": "k"}, headers=auth(free_user),
    )
    assert first.json() == {"needs_publication": pubs}
    assert db_session.query(SocialConnection).count() == 0

    second = client.post(
        "/api/sources/beehiiv/connect",
        json={"api_key": "k", "publication_id": "pub_b"}, headers=auth(free_user),
    )
    assert second.status_code == 200
    assert second.json()["connection"]["publication_id"] == "pub_b"


def test_disconnect(client, free_user, auth, db_session):
    _ghost_conn(db_session, free_user)
    assert client.delete("/api/sources/ghost", headers=auth(free_user)).status_code == 200
    assert db_session.query(SocialConnection).count() == 0


def test_unknown_platform_404(client, free_user, auth):
    assert client.get("/api/sources/medium/posts", headers=auth(free_user)).status_code == 404


# ─── Posts ──────────────────────────────────────────────────────────────────


def test_list_posts_requires_connection(client, free_user, auth):
    resp = client.get("/api/sources/ghost/posts", headers=auth(free_user))
    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "not_connected"


def test_list_posts_marks_revoked_on_bad_key(client, free_user, auth, db_session, monkeypatch):
    conn = _ghost_conn(db_session, free_user)

    def _reject(*a, **k):
        raise SourceError("revoked", code="invalid_key")
    monkeypatch.setattr(ghost_api, "list_posts", _reject)
    resp = client.get("/api/sources/ghost/posts", headers=auth(free_user))
    assert resp.status_code == 409
    db_session.refresh(conn)
    assert conn.status == STATUS_REVOKED


# ─── Import ─────────────────────────────────────────────────────────────────


def _fake_ghost_post(status="draft"):
    return {
        "id": "65f1c0ffee0123456789abcd", "title": "My Draft", "status": status,
        "url": "https://blog.example.com/my-draft/", "feature_image": None,
        "html": POST_HTML, "updated_at": "2026-09-01T00:00:00.000Z",
    }


def test_import_ghost_draft_creates_scraped_project_and_charges_one_credit(
    client, free_user, auth, db_session, monkeypatch
):
    _ghost_conn(db_session, free_user)
    monkeypatch.setattr(ghost_api, "get_post", lambda creds, pid: _fake_ghost_post())
    before = free_user.videos_used_this_period or 0

    resp = client.post(
        "/api/sources/ghost/import",
        json={"post_ids": ["65f1c0ffee0123456789abcd"]}, headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    [pid] = resp.json()["project_ids"]
    project = db_session.get(Project, pid)
    assert project.status == ProjectStatus.SCRAPED
    assert project.source_platform == PLATFORM_GHOST
    assert project.source_post_id == "65f1c0ffee0123456789abcd"
    # Drafts have no public URL -> placeholder, never scraped or linked.
    assert project.blog_url == "ghost://65f1c0ffee0123456789abcd"
    assert "Ghost makes publishing simple" in project.blog_content
    assert project.name == "My Draft"
    db_session.refresh(free_user)
    assert free_user.videos_used_this_period == before + 1


def test_single_post_import_marks_bulk_only_when_asked(client, paid_user, auth, db_session, monkeypatch):
    """A multi-post import split into per-post requests still yields bulk projects."""
    _ghost_conn(db_session, paid_user)
    monkeypatch.setattr(ghost_api, "get_post", lambda creds, pid: _fake_ghost_post())
    plain = client.post(
        "/api/sources/ghost/import",
        json={"post_ids": ["65f1c0ffee0123456789abcd"]}, headers=auth(paid_user),
    )
    split = client.post(
        "/api/sources/ghost/import",
        json={"post_ids": ["65f1c0ffee0123456789abce"], "bulk": True}, headers=auth(paid_user),
    )
    assert plain.status_code == 200, plain.text
    assert split.status_code == 200, split.text
    assert db_session.get(Project, plain.json()["project_ids"][0]).is_bulk is False
    assert db_session.get(Project, split.json()["project_ids"][0]).is_bulk is True


def test_import_published_post_keeps_public_url(client, free_user, auth, db_session, monkeypatch):
    _ghost_conn(db_session, free_user)
    monkeypatch.setattr(ghost_api, "get_post", lambda creds, pid: _fake_ghost_post("published"))
    resp = client.post(
        "/api/sources/ghost/import",
        json={"post_ids": ["65f1c0ffee0123456789abcd"]}, headers=auth(free_user),
    )
    project = db_session.get(Project, resp.json()["project_ids"][0])
    assert project.blog_url == "https://blog.example.com/my-draft/"


def test_import_empty_post_charges_nothing(client, free_user, auth, db_session, monkeypatch):
    _ghost_conn(db_session, free_user)
    monkeypatch.setattr(
        ghost_api, "get_post", lambda creds, pid: {**_fake_ghost_post(), "html": "<p>hi</p>"}
    )
    before = free_user.videos_used_this_period or 0
    resp = client.post(
        "/api/sources/ghost/import",
        json={"post_ids": ["65f1c0ffee0123456789abcd"]}, headers=auth(free_user),
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error_code"] == "empty_post"
    assert db_session.query(Project).filter_by(user_id=free_user.id).count() == 0
    db_session.refresh(free_user)
    assert (free_user.videos_used_this_period or 0) == before


def test_import_is_idempotent_for_in_flight_project(client, free_user, auth, db_session, monkeypatch):
    _ghost_conn(db_session, free_user)
    monkeypatch.setattr(ghost_api, "get_post", lambda creds, pid: _fake_ghost_post())
    body = {"post_ids": ["65f1c0ffee0123456789abcd"]}
    first = client.post("/api/sources/ghost/import", json=body, headers=auth(free_user)).json()
    second = client.post("/api/sources/ghost/import", json=body, headers=auth(free_user)).json()
    assert first["project_ids"] == second["project_ids"]
    db_session.refresh(free_user)
    assert free_user.videos_used_this_period == 1


def test_free_multi_import_beyond_quota_needs_upgrade(client, free_user, auth, db_session):
    _ghost_conn(db_session, free_user)
    ids = [f"{i:024x}" for i in range(free_user.video_limit + 2)]
    resp = client.post("/api/sources/ghost/import", json={"post_ids": ids}, headers=auth(free_user))
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "upgrade_required_bulk"


def test_import_rejects_path_unsafe_post_ids(client, free_user, auth, db_session):
    _ghost_conn(db_session, free_user)
    resp = client.post(
        "/api/sources/ghost/import", json={"post_ids": ["../../site"]}, headers=auth(free_user),
    )
    assert resp.status_code == 400


def test_import_beehiiv_uses_premium_content(client, paid_user, auth, db_session, monkeypatch):
    _beehiiv_conn(db_session, paid_user)
    captured = {}

    def _get(path_key, pub, pid):
        captured["pub"] = pub
        return {
            "id": pid, "title": "Weekly", "status": "published",
            "url": "https://n.beehiiv.com/p/weekly", "feature_image": None,
            "html": "<p>" + ("Premium insight for subscribers. " * 8) + "</p>",
        }
    monkeypatch.setattr(beehiiv_api, "get_post", _get)
    resp = client.post(
        "/api/sources/beehiiv/import", json={"post_ids": ["post_abc"]}, headers=auth(paid_user),
    )
    assert resp.status_code == 200, resp.text
    assert captured["pub"] == "pub_123"
    project = db_session.get(Project, resp.json()["project_ids"][0])
    assert project.blog_url == "https://n.beehiiv.com/p/weekly"
    assert "Premium insight" in project.blog_content


# ─── Ghost publish-back ─────────────────────────────────────────────────────


from app.models.social_publish_job import (  # noqa: E402
    STATUS_FAILED,
    STATUS_QUEUED,
    STATUS_RUNNING,
    STATUS_SUCCEEDED,
    SocialPublishJob,
)
from app.services import publish_queue  # noqa: E402
from app.services.youtube_publish import PublishError  # noqa: E402


def _rendered_project(db, user, **kwargs):
    project = Project(
        user_id=user.id, name="Rendered", status=ProjectStatus.DONE,
        r2_video_key="users/1/projects/1/output/video-v1.mp4",
        r2_video_url="https://cdn.test/video-v1.mp4",
        **kwargs,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@pytest.fixture()
def no_queue_wake(monkeypatch):
    monkeypatch.setattr(publish_queue, "wake", lambda: None)
    # The Ghost publish endpoint reads the plan cap; default to "none visible"
    # (self-hosted) so these tests never reach the network.
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: None)
    # Beehiiv's plan probe: assume a plan that may write posts.
    monkeypatch.setattr(beehiiv_api, "can_write_posts", lambda key, pub: True)


def test_ghost_publish_defaults_to_new_draft(client, free_user, auth, db_session, no_queue_wake):
    _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video", "privacy_status": "whatever"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    job = db_session.query(SocialPublishJob).one()
    assert job.status == STATUS_QUEUED
    assert job.target_mode == "new_draft"
    assert job.target_post_id is None


def test_ghost_publish_into_post_defaults_to_source_post(
    client, free_user, auth, db_session, no_queue_wake
):
    _ghost_conn(db_session, free_user)
    project = _rendered_project(
        db_session, free_user, source_platform="ghost", source_post_id="65f1c0ffee0123456789abcd",
    )
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video", "target_mode": "top"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    job = db_session.query(SocialPublishJob).one()
    assert (job.target_post_id, job.target_mode) == ("65f1c0ffee0123456789abcd", "top")


def test_ghost_publish_into_post_needs_a_post(client, free_user, auth, db_session, no_queue_wake):
    _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video", "target_mode": "bottom"},
        headers=auth(free_user),
    )
    assert resp.status_code == 400


def test_ghost_publish_requires_connection(client, free_user, auth, db_session, no_queue_wake):
    project = _rendered_project(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video"},
        headers=auth(free_user),
    )
    assert resp.status_code == 409


@pytest.fixture()
def ghost_worker(monkeypatch, tmp_path):
    """Stub the file + ffmpeg side of _publish_ghost; record Ghost API calls."""
    from app.services import video_thumbnail
    from app.services import youtube_publish as yt

    video = tmp_path / "video.mp4"
    video.write_bytes(b"\0" * 64)
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))
    monkeypatch.setattr(video_thumbnail, "probe_video", lambda p: (1280, 720, 30.0))
    monkeypatch.setattr(video_thumbnail, "extract_frame", lambda *a, **k: False)
    calls = {}

    def _upload(creds, path, name, on_progress=None):
        if on_progress:
            on_progress(64)
        calls["upload"] = name
        return "https://blog.example.com/content/media/v.mp4"

    def _add(creds, pid, card, pos, card_type="video"):
        calls["card"] = (card_type, card)
        calls.setdefault("add", (pid, pos, card.get("src")))
        return {"id": pid}

    def _draft(creds, title, card, card_type="video"):
        calls["card"] = (card_type, card)
        calls.setdefault("draft", title)
        return {"id": "newdraft0000000000000000"}

    monkeypatch.setattr(ghost_api, "upload_media", _upload)
    monkeypatch.setattr(ghost_api, "add_video_to_post", _add)
    monkeypatch.setattr(ghost_api, "create_draft_with_video", _draft)
    # Self-hosted by default (no plan cap); tests that need one override it.
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: None)
    return calls, str(tmp_path)


def _ghost_job(db, user, project, **kwargs):
    job = SocialPublishJob(
        project_id=project.id, user_id=user.id, platform="ghost",
        status=STATUS_RUNNING, title="My video", **kwargs,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def test_publish_ghost_inserts_into_target_post(db_session, free_user, ghost_worker):
    calls, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(
        db_session, free_user, project, target_post_id="65f1c0ffee0123456789abcd", target_mode="bottom",
    )
    publish_queue._publish_ghost(db_session, job, conn, work_dir)
    db_session.refresh(job)
    assert job.status == STATUS_SUCCEEDED
    assert calls["add"] == (
        "65f1c0ffee0123456789abcd", "bottom", "https://blog.example.com/content/media/v.mp4",
    )
    assert job.platform_post_url == (
        "https://blog.example.com/ghost/#/editor/post/65f1c0ffee0123456789abcd"
    )
    assert job.uploaded_bytes == job.total_bytes == 64


def test_publish_ghost_new_draft(db_session, free_user, ghost_worker):
    calls, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert calls["draft"] == "My video"
    assert "add" not in calls


def test_publish_ghost_too_large_is_terminal(db_session, free_user, ghost_worker, monkeypatch):
    _, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")

    def _too_big(*a, **k):
        raise SourceError("too big", code="upload_too_large")
    monkeypatch.setattr(ghost_api, "upload_media", _too_big)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert exc.value.code == "video_too_large"
    assert exc.value.retryable is False


def test_publish_ghost_bad_key_revokes_connection(db_session, free_user, ghost_worker, monkeypatch):
    _, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")

    def _reject(*a, **k):
        raise SourceError("bad key", code="invalid_key")
    monkeypatch.setattr(ghost_api, "upload_media", _reject)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert exc.value.code == "reauth_required"
    db_session.refresh(conn)
    assert conn.status == STATUS_REVOKED


# ─── Newsletter snippet ─────────────────────────────────────────────────────


def test_snippet_requires_a_render(client, free_user, auth, db_session):
    project = Project(user_id=free_user.id, name="Unrendered", status=ProjectStatus.CREATED)
    db_session.add(project)
    db_session.commit()
    resp = client.get(
        f"/api/sources/projects/{project.id}/newsletter-snippet", headers=auth(free_user),
    )
    assert resp.status_code == 409


def test_snippet_html_links_thumbnail_to_watch_page(
    client, free_user, auth, db_session, monkeypatch, tmp_path
):
    from PIL import Image

    from app.services import r2_storage, video_thumbnail
    from app.services import youtube_publish as yt

    project = _rendered_project(db_session, free_user)
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\0")
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))

    def _frame(src, out, at_seconds=1.0):
        Image.new("RGB", (320, 180), "navy").save(out, "JPEG")
        return True
    monkeypatch.setattr(video_thumbnail, "extract_frame", _frame)
    monkeypatch.setattr(r2_storage, "is_r2_configured", lambda: True)
    monkeypatch.setattr(r2_storage, "upload_bytes", lambda key, body, content_type=None: f"https://cdn.test/{key}")

    resp = client.get(
        f"/api/sources/projects/{project.id}/newsletter-snippet", headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    db_session.refresh(project)
    assert project.embed_token and body["watch_url"].endswith(f"/preview/{project.embed_token}")
    assert body["thumbnail_url"].startswith("https://cdn.test/")
    assert body["watch_url"] in body["html"] and body["thumbnail_url"] in body["html"]


def test_snippet_is_owner_only(client, free_user, other_user, auth, db_session):
    project = _rendered_project(db_session, free_user)
    resp = client.get(
        f"/api/sources/projects/{project.id}/newsletter-snippet", headers=auth(other_user),
    )
    assert resp.status_code in (403, 404)


def test_ghost_requests_recheck_host_every_call(monkeypatch):
    """DNS rebinding: a host that was public at connect time is re-resolved."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(
        socket, "getaddrinfo",
        lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 0))],
    )
    creds = ghost_api.GhostCredentials(site_url="https://blog.example.com", admin_key=GHOST_KEY)
    with pytest.raises(SourceError) as exc:
        ghost_api.list_posts(creds)
    assert exc.value.code == "invalid_site"


def test_beehiiv_both_audience_is_not_paid():
    assert beehiiv_api._post_summary({"id": "p", "audience": "both"})["paid"] is False


# ─── Beehiiv publish (write-back) ───────────────────────────────────────────


def test_beehiiv_publish_accepts_target_post(client, free_user, auth, db_session, no_queue_wake):
    _beehiiv_conn(db_session, free_user)
    project = _rendered_project(
        db_session, free_user, source_platform="beehiiv", source_post_id="post_abc123",
    )
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "beehiiv", "title": "My video", "target_mode": "top"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    job = db_session.query(SocialPublishJob).one()
    assert (job.platform, job.target_post_id, job.target_mode) == ("beehiiv", "post_abc123", "top")


def test_beehiiv_publish_requires_connection(client, free_user, auth, db_session, no_queue_wake):
    project = _rendered_project(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "beehiiv", "title": "My video"},
        headers=auth(free_user),
    )
    assert resp.status_code == 409


class _FakeResp:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body
        self.headers = {}

    def json(self):
        return self._body


@pytest.fixture()
def beehiiv_http(monkeypatch):
    """Record Beehiiv HTTP calls and answer with a queued response."""
    calls = []
    replies = []

    class _Client:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def request(self, method, url, headers=None, params=None, json=None):
            calls.append((method, url, json))
            return replies.pop(0) if replies else _FakeResp(200, {"data": {}})

    monkeypatch.setattr(beehiiv_api.httpx, "Client", _Client)
    return calls, replies


def test_beehiiv_create_draft_sends_explicit_draft_status(beehiiv_http):
    calls, replies = beehiiv_http
    replies.append(_FakeResp(201, {"data": {"id": "post_new", "web_url": "https://n.beehiiv.com/p/x"}}))
    blocks = beehiiv_api.video_blocks("https://cdn/t.jpg", "https://app/preview/tok", "Title")
    out = beehiiv_api.create_draft_post("key", "pub_1", "Title", blocks)
    method, url, body = calls[0]
    assert method == "POST" and url.endswith("/publications/pub_1/posts")
    assert body["status"] == "draft"
    assert body["blocks"][0] == {
        "type": "image", "imageUrl": "https://cdn/t.jpg",
        "url": "https://app/preview/tok", "alt_text": "Title",
    }
    assert out == {"id": "post_new", "web_url": "https://n.beehiiv.com/p/x"}


def test_beehiiv_add_to_post_prepends_for_top(beehiiv_http):
    calls, _ = beehiiv_http
    beehiiv_api.add_blocks_to_post("key", "pub_1", "post_9", [{"type": "image"}], "top")
    method, url, body = calls[0]
    assert method == "PATCH" and url.endswith("/publications/pub_1/posts/post_9")
    assert body["content_merge_strategy"] == "prepend"


def test_beehiiv_write_403_is_plan_required_not_bad_key(beehiiv_http):
    _, replies = beehiiv_http
    replies.append(_FakeResp(403, {"errors": [{"message": "Forbidden"}]}))
    with pytest.raises(SourceError) as exc:
        beehiiv_api.create_draft_post("key", "pub_1", "T", [])
    assert exc.value.code == "plan_required"
    assert exc.value.retryable is False


def test_publish_beehiiv_plan_required_keeps_connection(
    db_session, free_user, monkeypatch, tmp_path
):
    from app.services import youtube_publish as yt
    from app.routers import content_sources

    conn = _beehiiv_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\0")
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))
    monkeypatch.setattr(content_sources, "newsletter_thumbnail_url", lambda *a, **k: "https://cdn/t.jpg")

    def _plan(*a, **k):
        raise SourceError(beehiiv_api.PLAN_REQUIRED_MESSAGE, code="plan_required")
    monkeypatch.setattr(beehiiv_api, "create_draft_post", _plan)

    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id, platform="beehiiv",
        status=STATUS_RUNNING, title="My video", target_mode="new_draft",
    )
    db_session.add(job)
    db_session.commit()
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_beehiiv(db_session, job, conn, str(tmp_path))
    assert exc.value.code == "plan_required"
    assert exc.value.retryable is False
    db_session.refresh(conn)
    assert conn.status == STATUS_ACTIVE


def test_publish_beehiiv_new_draft_succeeds(db_session, free_user, monkeypatch, tmp_path):
    from app.services import youtube_publish as yt
    from app.routers import content_sources

    conn = _beehiiv_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\0")
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))
    monkeypatch.setattr(content_sources, "newsletter_thumbnail_url", lambda *a, **k: "https://cdn/t.jpg")
    seen = {}

    def _create(key, pub, title, blocks):
        seen.update(pub=pub, title=title, url=blocks[0]["url"])
        return {"id": "post_new", "web_url": "https://n.beehiiv.com/p/x"}
    monkeypatch.setattr(beehiiv_api, "create_draft_post", _create)

    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id, platform="beehiiv",
        status=STATUS_RUNNING, title="My video", target_mode="new_draft",
    )
    db_session.add(job)
    db_session.commit()
    publish_queue._publish_beehiiv(db_session, job, conn, str(tmp_path))
    db_session.refresh(job)
    db_session.refresh(project)
    assert job.status == STATUS_SUCCEEDED
    assert job.platform_post_url == "https://n.beehiiv.com/p/x"
    assert seen["pub"] == "pub_123" and seen["url"].endswith(f"/preview/{project.embed_token}")


def test_publish_ghost_5xx_on_big_upload_is_plan_limit(db_session, free_user, ghost_worker, monkeypatch):
    """Ghost(Pro) drops over-cap uploads with a bare 503; that must not be retried as an outage."""
    import os as _os
    _, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    monkeypatch.setattr(_os.path, "getsize", lambda p: 21 * 1024 * 1024)

    def _edge_503(*a, **k):
        raise SourceError("Ghost returned an error (503).", code="provider_error", retryable=True)
    monkeypatch.setattr(ghost_api, "upload_media", _edge_503)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert exc.value.code == "video_too_large"
    assert exc.value.retryable is False
    # No readable cap (the fixture's default) = self-hosted wording, no plan talk.
    assert "21.0 MB" in str(exc.value)  # MiB, like Ghost's own "5 MB"
    assert "embedded player" in str(exc.value)
    assert "plan" not in str(exc.value)


def test_publish_ghost_refused_with_known_cap_names_the_plan_limit(
    db_session, free_user, ghost_worker, monkeypatch
):
    """Under the reported cap but refused anyway: the plan wording, with its real limit."""
    _, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: 104_857_600)

    def _too_big(*a, **k):
        raise SourceError("too big", code="upload_too_large")
    monkeypatch.setattr(ghost_api, "upload_media", _too_big)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert exc.value.code == "video_too_large"
    assert "plan allows uploads up to 100 MB" in str(exc.value)


def test_publish_ghost_5xx_on_small_upload_stays_retryable(db_session, free_user, ghost_worker, monkeypatch):
    _, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")

    def _edge_503(*a, **k):
        raise SourceError("Ghost returned an error (503).", code="provider_error", retryable=True)
    monkeypatch.setattr(ghost_api, "upload_media", _edge_503)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert exc.value.code == "provider_error"
    assert exc.value.retryable is True


# ─── Ghost plan upload cap → embed player ───────────────────────────────────


def _config_response(monkeypatch, body_or_exc):
    def _fake(creds, method, path, **kw):
        assert (method, path) == ("GET", "config/")
        if isinstance(body_or_exc, Exception):
            raise body_or_exc
        return body_or_exc
    monkeypatch.setattr(ghost_api, "_request", _fake)


def test_ghost_upload_limit_reads_host_settings(monkeypatch):
    _config_response(
        monkeypatch, {"config": {"hostSettings": {"limits": {"uploads": {"max": 5000000}}}}}
    )
    creds = ghost_api.GhostCredentials("https://blog.example.com", "id:00")
    assert ghost_api.get_upload_limit(creds) == 5_000_000


@pytest.mark.parametrize("body_or_exc", [
    {"config": {}},  # self-hosted: no hostSettings
    {"config": {"hostSettings": {"limits": {"uploads": {"max": "lots"}}}}},
    SourceError("down", retryable=True),
])
def test_ghost_upload_limit_unknown_is_none(monkeypatch, body_or_exc):
    _config_response(monkeypatch, body_or_exc)
    creds = ghost_api.GhostCredentials("https://blog.example.com", "id:00")
    assert ghost_api.get_upload_limit(creds) is None


def test_html_card_goes_into_lexical_and_mobiledoc():
    card = ghost_api.build_html_card("<iframe></iframe>")
    lexical = json.dumps({"root": {"children": [{"type": "paragraph"}]}})
    doc = json.loads(ghost_api.insert_video_into_lexical(lexical, card, "bottom", "html"))
    assert doc["root"]["children"][-1] == {"type": "html", "version": 1, "html": "<iframe></iframe>"}

    mobiledoc = json.dumps({"cards": [], "sections": [[1, "p", []]]})
    doc = json.loads(ghost_api.insert_video_into_mobiledoc(mobiledoc, card, "top", "html"))
    assert doc["cards"] == [["html", {"html": "<iframe></iframe>"}]]
    assert doc["sections"][0] == [10, 0]

    draft = json.loads(ghost_api.empty_lexical_with_video(card, "html"))
    assert draft["root"]["children"][0]["type"] == "html"


def test_publish_ghost_embed_adds_player_without_upload(db_session, free_user, ghost_worker, monkeypatch):
    calls, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user, aspect_ratio="portrait")
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft", delivery="embed")
    monkeypatch.setattr(
        ghost_api, "upload_media", lambda *a, **k: pytest.fail("embed must not upload")
    )
    path, is_temp = publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert (path, is_temp) == (None, False)
    db_session.refresh(job)
    db_session.refresh(project)
    assert job.status == STATUS_SUCCEEDED
    card_type, card = calls["card"]
    assert card_type == "html"
    assert f"/preview/{project.embed_token}" in card["html"]
    assert "177.78%" in card["html"]  # portrait box


def test_publish_ghost_over_known_limit_fails_before_upload(db_session, free_user, ghost_worker, monkeypatch):
    _, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: 32)  # the stub file is 64 bytes
    monkeypatch.setattr(ghost_api, "SMALL_PLAN_MAX", 16)  # a tiny cap that isn't a "small plan"
    monkeypatch.setattr(
        ghost_api, "upload_media", lambda *a, **k: pytest.fail("must not upload over the cap")
    )
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert exc.value.code == "video_too_large"
    assert exc.value.retryable is False
    assert "embedded player" in str(exc.value)


def test_publish_ghost_under_known_limit_uploads(db_session, free_user, ghost_worker, monkeypatch):
    calls, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: 104_857_600)
    publish_queue._publish_ghost(db_session, job, conn, work_dir)
    assert "upload" in calls
    assert calls["card"][0] == "video"


def test_ghost_publish_embed_skips_render(client, free_user, auth, db_session, no_queue_wake):
    _ghost_conn(db_session, free_user)
    project = Project(user_id=free_user.id, name="Unrendered", status=ProjectStatus.CREATED)
    db_session.add(project)
    db_session.commit()
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video", "delivery": "embed"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["render_started"] is False
    assert resp.json()["job"]["delivery"] == "embed"
    job = db_session.query(SocialPublishJob).one()
    assert (job.status, job.delivery) == (STATUS_QUEUED, "embed")
    db_session.refresh(project)
    assert project.embed_token


def test_embed_delivery_is_ghost_only(client, free_user, auth, db_session, no_queue_wake):
    project = _rendered_project(db_session, free_user)
    _beehiiv_conn(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "beehiiv", "title": "My video", "delivery": "embed"},
        headers=auth(free_user),
    )
    assert resp.status_code == 400


@pytest.mark.parametrize("limit, size, expected", [
    (5_242_880, 3_000_000, "embed"),        # free trial / Starter as Ghost reports it (5 MiB)
    (5_000_000, 3_000_000, "embed"),        # a decimal 5 MB cap is still a small plan
    (104_857_600, 40_000_000, "video"),     # Publisher, fits
    (104_857_600, 140_000_000, "ask"),      # Publisher, too big
    (None, 900_000_000, "video"),           # self-hosted / unknown
])
def test_ghost_upload_check(client, free_user, auth, db_session, monkeypatch, limit, size, expected):
    from app.services import r2_storage
    _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: limit)
    monkeypatch.setattr(r2_storage, "object_size", lambda key: size)
    resp = client.get(
        f"/api/sources/ghost/publish-check?project_id={project.id}", headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "limit_bytes": limit, "video_bytes": size, "recommended": expected,
        "fallback": "embed", "reason": None, "plan_required": False,
    }


def test_publish_ghost_small_plan_embeds_without_touching_the_video(
    db_session, free_user, ghost_worker, monkeypatch
):
    """Free trial (5 MiB): a video job becomes an embed — no download, no upload."""
    from app.services import youtube_publish as yt
    calls, work_dir = ghost_worker
    conn = _ghost_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: 5_242_880)
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: pytest.fail("must not fetch the MP4"))
    monkeypatch.setattr(ghost_api, "upload_media", lambda *a, **k: pytest.fail("must not upload"))
    publish_queue._publish_ghost(db_session, job, conn, work_dir)
    db_session.refresh(job)
    assert job.delivery == "embed"
    assert job.status == STATUS_SUCCEEDED
    assert calls["card"][0] == "html"


def test_ghost_publish_small_plan_embeds_instead_of_rendering(
    client, free_user, auth, db_session, no_queue_wake, monkeypatch
):
    _ghost_conn(db_session, free_user)
    project = Project(user_id=free_user.id, name="Unrendered", status=ProjectStatus.CREATED)
    db_session.add(project)
    db_session.commit()
    monkeypatch.setattr(ghost_api, "get_upload_limit", lambda creds: 5_242_880)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video"},  # client asked for a video
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["render_started"] is False
    job = db_session.query(SocialPublishJob).one()
    assert (job.status, job.delivery) == (STATUS_QUEUED, "embed")


@pytest.mark.parametrize("platform, code, emailed", [
    ("ghost", "video_too_large", False),   # the modal offers the embed instead
    ("ghost", "reauth_required", True),
    ("youtube", "video_too_large", True),
])
def test_publish_failure_email_skips_only_ghost_size_problems(
    db_session, free_user, monkeypatch, platform, code, emailed
):
    sent = []
    monkeypatch.setattr(publish_queue, "_notify", lambda db, job, succeeded: sent.append(succeeded))
    project = _rendered_project(db_session, free_user)
    job = SocialPublishJob(
        project_id=project.id, user_id=free_user.id, platform=platform,
        status=STATUS_RUNNING, title="My video",
    )
    db_session.add(job)
    db_session.commit()
    publish_queue._fail(db_session, job, PublishError("x", code=code, retryable=False))
    assert sent == ([False] if emailed else [])


def test_ghost_success_still_emails(db_session, free_user, monkeypatch):
    sent = []
    monkeypatch.setattr(publish_queue, "_notify", lambda db, job, succeeded: sent.append(succeeded))
    project = _rendered_project(db_session, free_user)
    job = _ghost_job(db_session, free_user, project, target_mode="new_draft")
    publish_queue._succeed(db_session, job)
    assert sent == [True]


@pytest.mark.parametrize("limit, video, expected_limit, expected_video", [
    (104_857_600, 157_286_400, "up to 100 MB", "150.0 MB"),   # MiB-based cap
    (100_000_000, 150_000_000, "up to 100 MB", "150.0 MB"),   # decimal cap still reads "100 MB"
    (262_144_000, 314_572_800, "up to 250 MB", "300.0 MB"),
])
def test_ghost_too_large_message_reads_as_the_plan_limit(limit, video, expected_limit, expected_video):
    msg = publish_queue._ghost_too_large_message(limit, video)
    assert expected_limit in msg and expected_video in msg
