"""Contract tier — beehiiv_api against the Beehiiv v2 mock (dev/beehiiv_mock.py).

Unlike test_content_sources.py, which stubs whole beehiiv_api functions, these
run the client's real request/parse code over HTTP-shaped traffic. The mock
answers from spec-shaped fixtures (tests/fixtures/beehiiv/), and it is the same
app used for clicking through the UI locally, so the two cannot drift.

When Beehiiv is reachable, ``BEEHIIV_LIVE_API_KEY=… pytest -m live`` runs the
read-only smoke test at the bottom against the real API.
"""
import _socket
import json
import os
import socket
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from starlette.testclient import TestClient

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.social_connection import (
    PLATFORM_BEEHIIV,
    STATUS_ACTIVE,
    SocialConnection,
)
from app.models.social_publish_job import STATUS_RUNNING, STATUS_SUCCEEDED, SocialPublishJob
from app.services import beehiiv_api, publish_queue, source_importer, token_crypto
from app.services.source_common import SourceError
from app.services.youtube_publish import PublishError
from dev import beehiiv_mock

pytestmark = pytest.mark.depth

FIXTURES = Path(__file__).parent / "fixtures" / "beehiiv"
_PUBS = json.loads((FIXTURES / "publications.json").read_text())["data"]
PUB_A, PUB_B = _PUBS[0]["id"], _PUBS[1]["id"]
_POSTS = json.loads((FIXTURES / "posts.json").read_text())


def _served_url(post):
    """Where the mock serves a fixture post's page (its web_url, rewritten)."""
    site = post["web_url"].split("://", 1)[1].split(".", 1)[0]
    return f"http://beehiiv.mock/_mock/site/{site}/p/{post['slug']}"


def _fixture_post(pub, status, audience):
    return next(p for p in _POSTS[pub] if p["status"] == status and p["audience"] == audience)


@pytest.fixture(autouse=True)
def mock_beehiiv(monkeypatch):
    """Route every beehiiv_api HTTP call into the in-process mock."""
    beehiiv_mock.reset()
    monkeypatch.setattr(settings, "BEEHIIV_API_BASE_URL", "http://beehiiv.mock/v2")
    monkeypatch.setattr(beehiiv_api.httpx, "Client", lambda *a, **k: TestClient(beehiiv_mock.app))
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", Fernet.generate_key().decode())
    token_crypto.reset_cache()
    monkeypatch.setattr(source_importer, "_download_images", lambda *a, **k: [])
    yield beehiiv_mock.requests_log()
    token_crypto.reset_cache()


def _conn(db, user, key="test_key", pub=PUB_A):
    conn = SocialConnection(
        user_id=user.id, platform=PLATFORM_BEEHIIV,
        access_token_enc=token_crypto.encrypt(key),
        account_id=pub, account_name="The Weekly Brief", status=STATUS_ACTIVE,
    )
    db.add(conn)
    db.commit()
    return conn


# ─── Base URL ───────────────────────────────────────────────────────────────


def test_base_url_override_and_default(monkeypatch):
    monkeypatch.setattr(settings, "BEEHIIV_API_BASE_URL", "http://127.0.0.1:4010/v2/")
    assert beehiiv_api._base_url() == "http://127.0.0.1:4010/v2"
    monkeypatch.setattr(settings, "BEEHIIV_API_BASE_URL", "")
    assert beehiiv_api._base_url() == "https://api.beehiiv.com/v2"


# ─── Reads ──────────────────────────────────────────────────────────────────


def test_list_publications_maps_id_and_name(mock_beehiiv):
    pubs = beehiiv_api.list_publications("test_key")
    assert pubs == [{"id": p["id"], "name": p["name"]} for p in _PUBS]
    assert mock_beehiiv[0]["key"] == "test_key"
    assert ("limit", "100") in mock_beehiiv[0]["query"]


def test_list_posts_pages_newest_first_and_hides_archived(mock_beehiiv):
    first = beehiiv_api.list_posts("test_key", PUB_A, page=1)
    query = dict(mock_beehiiv[-1]["query"])
    assert query["status"] == "all" and query["direction"] == "desc" and query["order_by"] == "created"
    assert first["pages"] == 2 and first["has_more"] is True
    assert first["total"] == len(_POSTS[PUB_A])
    assert all(p["status"] != "archived" for p in first["posts"])
    created = {p["id"]: p["created"] for p in _POSTS[PUB_A]}
    ids = [p["id"] for p in first["posts"]]
    assert ids == sorted(ids, key=created.get, reverse=True)

    last = beehiiv_api.list_posts("test_key", PUB_A, page=2)
    assert last["page"] == 2 and last["has_more"] is False
    assert not set(ids) & {p["id"] for p in last["posts"]}


def _all_summaries(key="test_key", pub=PUB_A):
    out, page = {}, 1
    while True:
        body = beehiiv_api.list_posts(key, pub, page=page)
        out.update({p["id"]: p for p in body["posts"]})
        if not body["has_more"]:
            return out
        page += 1


def test_list_posts_summary_shape(mock_beehiiv):
    published = _fixture_post(PUB_A, "confirmed", "premium")
    draft = _fixture_post(PUB_A, "draft", "free")
    posts = _all_summaries()
    p = posts[published["id"]]
    assert p["status"] == "published" and p["paid"] is True
    assert p["url"] == _served_url(published)
    assert p["feature_image"].endswith(f"/_mock/thumb/{published['id']}.svg")
    assert p["excerpt"] == published["subtitle"]
    assert p["published_at"].startswith("20")
    assert posts[draft["id"]]["status"] == "draft" and posts[draft["id"]]["url"] is None
    assert len(posts) == sum(1 for x in _POSTS[PUB_A] if x["status"] != "archived")


def test_list_posts_search_filters_the_page(mock_beehiiv):
    target = beehiiv_api.list_posts("test_key", PUB_A)["posts"][0]
    out = beehiiv_api.list_posts("test_key", PUB_A, search=target["title"].upper())
    assert [p["id"] for p in out["posts"]] == [target["id"]]


def test_get_post_prefers_premium_html(mock_beehiiv):
    post = _fixture_post(PUB_A, "confirmed", "premium")
    out = beehiiv_api.get_post("test_key", PUB_A, post["id"])
    expands = [v for k, v in mock_beehiiv[-1]["query"] if k == "expand[]"]
    assert set(expands) == {"free_web_content", "premium_web_content"}
    assert "Premium deep dive" in out["html"]
    assert "Upgrade to read the rest" not in out["html"]


def test_get_post_free_only_uses_free_html(mock_beehiiv):
    post = _fixture_post(PUB_A, "confirmed", "free")
    out = beehiiv_api.get_post("test_key", PUB_A, post["id"])
    assert out["html"] == post["content"]["free"]["web"]


def test_post_links_and_thumbnails_are_served_by_the_mock():
    post = _fixture_post(PUB_A, "confirmed", "premium")
    summary = beehiiv_api.get_post("test_key", PUB_A, post["id"])
    web = TestClient(beehiiv_mock.app)
    page = web.get(summary["url"])
    assert page.status_code == 200 and "Premium deep dive" in page.text
    thumb = web.get(summary["feature_image"])
    assert thumb.status_code == 200 and thumb.headers["content-type"].startswith("image/svg")


# ─── Writes ─────────────────────────────────────────────────────────────────


def test_create_draft_is_a_draft_on_beehiiv(mock_beehiiv):
    blocks = beehiiv_api.video_blocks("https://cdn.test/t.jpg", "https://app.test/preview/tok", "My video")
    out = beehiiv_api.create_draft_post("test_key", PUB_A, "My video", blocks)
    sent = mock_beehiiv[-1]
    assert sent["method"] == "POST" and sent["json"]["status"] == "draft"
    assert out["id"].startswith("post_") and out["web_url"]

    stored = beehiiv_api.get_post("test_key", PUB_A, out["id"])
    assert stored["status"] == "draft"
    assert 'href="https://app.test/preview/tok"' in stored["html"]
    assert 'src="https://cdn.test/t.jpg"' in stored["html"]


@pytest.mark.parametrize("position,strategy", [("top", "prepend"), ("bottom", "append")])
def test_add_blocks_to_post_positions(mock_beehiiv, position, strategy):
    post = _fixture_post(PUB_A, "draft", "free")
    blocks = beehiiv_api.video_blocks("https://cdn.test/t.jpg", "https://app.test/w", "Watch")
    out = beehiiv_api.add_blocks_to_post("test_key", PUB_A, post["id"], blocks, position)
    assert mock_beehiiv[-1]["json"]["content_merge_strategy"] == strategy
    assert out["id"] == post["id"]
    html = beehiiv_api.get_post("test_key", PUB_A, post["id"])["html"]
    link = '<a href="https://app.test/w">'
    assert html.startswith(link) is (position == "top")
    assert html.endswith("</a>") is (position == "bottom")
    assert html.count(link) == 1


# ─── Errors ─────────────────────────────────────────────────────────────────


def test_bad_key_is_invalid_key():
    with pytest.raises(SourceError) as exc:
        beehiiv_api.list_publications("bad_key")
    assert exc.value.code == "invalid_key"


def test_rate_limit_is_retryable():
    with pytest.raises(SourceError) as exc:
        beehiiv_api.list_posts("ratelimit_key", PUB_A)
    assert exc.value.code == "rate_limited" and exc.value.retryable is True


def test_missing_post_is_post_not_found():
    with pytest.raises(SourceError) as exc:
        beehiiv_api.get_post("test_key", PUB_A, "post_does-not-exist")
    assert exc.value.code == "post_not_found"


@pytest.mark.parametrize("key", ["free-key", "Free_Key"])
def test_mock_key_prefix_ignores_case_and_hyphens(key):
    assert beehiiv_api.can_write_posts(key, PUB_A) is False


def test_free_plan_can_read_but_write_is_plan_required():
    assert beehiiv_api.list_posts("free_key", PUB_A)["posts"]
    with pytest.raises(SourceError) as exc:
        beehiiv_api.create_draft_post("free_key", PUB_A, "T", [])
    assert exc.value.code == "plan_required" and exc.value.retryable is False
    with pytest.raises(SourceError) as exc:
        beehiiv_api.add_blocks_to_post("free_key", PUB_A, _POSTS[PUB_A][0]["id"], [], "top")
    assert exc.value.code == "plan_required"


def test_write_401_with_plan_code_is_plan_required_but_plain_401_is_bad_key():
    class _Resp:
        def __init__(self, status, text):
            self.status_code, self.text = status, text
    assert beehiiv_api._is_plan_error(_Resp(401, '{"errors":[{"code":"SEND_API_NOT_ENTERPRISE_PLAN"}]}'))
    assert beehiiv_api._is_plan_error(_Resp(403, ""))
    assert not beehiiv_api._is_plan_error(_Resp(401, '{"errors":[{"message":"Invalid API key"}]}'))
    with pytest.raises(SourceError) as exc:
        beehiiv_api.create_draft_post("bad_key", PUB_A, "T", [])
    assert exc.value.code == "invalid_key"


@pytest.mark.parametrize("key,expected", [("test_key", True), ("free_key", False)])
def test_can_write_posts_probe(mock_beehiiv, key, expected):
    before = len(beehiiv_mock._state["posts"][PUB_A])
    assert beehiiv_api.can_write_posts(key, PUB_A) is expected
    probe = mock_beehiiv[-1]
    assert probe["method"] == "POST" and probe["json"] == {}
    assert len(beehiiv_mock._state["posts"][PUB_A]) == before  # nothing created


@pytest.mark.parametrize("key,pub,code", [
    ("bad_key", PUB_A, "invalid_key"),
    ("ratelimit_key", PUB_A, "rate_limited"),
    ("test_key", "pub_gone", "publication_not_found"),
])
def test_can_write_posts_raises_a_reason_when_it_cannot_tell(key, pub, code):
    with pytest.raises(SourceError) as exc:
        beehiiv_api.can_write_posts(key, pub)
    assert exc.value.code == code


def test_can_write_posts_unreachable_is_retryable(monkeypatch):
    def _down(*a, **k):
        raise SourceError("We couldn't reach Beehiiv. Please try again.", retryable=True)
    monkeypatch.setattr(beehiiv_api, "_send", _down)
    with pytest.raises(SourceError) as exc:
        beehiiv_api.can_write_posts("test_key", PUB_A)
    assert exc.value.retryable is True


@pytest.mark.parametrize("key,method,path,status", [
    ("bad_key", "GET", "/v2/publications", 401),
    ("ratelimit_key", "GET", "/v2/publications", 429),
    ("outage_key", "GET", "/v2/publications", 503),
    ("gone_key", "GET", f"/v2/publications/{PUB_A}/posts", 404),
    ("flaky_key", "GET", f"/v2/publications/{PUB_A}/posts", 500),
    ("free_key", "POST", f"/v2/publications/{PUB_A}/posts", 401),
    ("test_key", "POST", f"/v2/publications/{PUB_A}/posts", 400),
])
def test_mock_failure_keys_answer_with_their_status(key, method, path, status):
    """The mock's own answers — so a missing error fixture (a crash = 500) can't pass as an outage."""
    resp = TestClient(beehiiv_mock.app, raise_server_exceptions=False).request(
        method, path, headers={"Authorization": f"Bearer {key}"}, json={} if method == "POST" else None,
    )
    assert resp.status_code == status, resp.text
    assert resp.json()["errors"]


@pytest.mark.parametrize("key,call,code,retryable", [
    ("outage_key", lambda k: beehiiv_api.list_publications(k), "provider_error", True),
    ("gone_key", lambda k: beehiiv_api.list_posts(k, PUB_A), "publication_not_found", False),
    ("gone_key", lambda k: beehiiv_api.can_write_posts(k, PUB_A), "publication_not_found", False),
    ("flaky_key", lambda k: beehiiv_api.list_posts(k, PUB_A), "provider_error", True),
])
def test_failure_keys_map_to_their_error(key, call, code, retryable):
    with pytest.raises(SourceError) as exc:
        call(key)
    assert exc.value.code == code and exc.value.retryable is retryable
    if code == "provider_error":
        assert str(exc.value) == beehiiv_api.OUTAGE_MESSAGE


def test_gone_key_still_connects():
    assert len(beehiiv_api.list_publications("gone_key")) == 2


# ─── End to end through the API ─────────────────────────────────────────────


def test_connect_pick_list_import(client, paid_user, auth, db_session):
    first = client.post("/api/sources/beehiiv/connect", json={"api_key": "test_key"}, headers=auth(paid_user))
    assert first.status_code == 200, first.text
    assert [p["id"] for p in first.json()["needs_publication"]] == [PUB_A, PUB_B]

    second = client.post(
        "/api/sources/beehiiv/connect",
        json={"api_key": "test_key", "publication_id": PUB_A}, headers=auth(paid_user),
    )
    assert second.status_code == 200, second.text
    assert "test_key" not in second.text

    listed = client.get("/api/sources/beehiiv/posts", headers=auth(paid_user))
    assert listed.status_code == 200, listed.text
    assert listed.json()["pages"] == 2

    premium = _fixture_post(PUB_A, "confirmed", "premium")
    resp = client.post(
        "/api/sources/beehiiv/import", json={"post_ids": [premium["id"]]}, headers=auth(paid_user),
    )
    assert resp.status_code == 200, resp.text
    project = db_session.get(Project, resp.json()["project_ids"][0])
    assert project.blog_url == _served_url(premium)
    assert "Premium deep dive" in project.blog_content


def test_connect_with_bad_key_is_409(client, free_user, auth, db_session):
    resp = client.post("/api/sources/beehiiv/connect", json={"api_key": "bad_key"}, headers=auth(free_user))
    assert resp.status_code == 409
    assert db_session.query(SocialConnection).count() == 0


def _publish_job(db, user, tmp_path, monkeypatch, key):
    from app.routers import content_sources
    from app.services import youtube_publish as yt

    conn = _conn(db, user, key=key)
    project = Project(
        user_id=user.id, name="Rendered", status=ProjectStatus.DONE,
        r2_video_key="users/1/projects/1/output/video-v1.mp4",
        r2_video_url="https://cdn.test/video-v1.mp4",
    )
    db.add(project)
    db.commit()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\0")
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))
    monkeypatch.setattr(content_sources, "newsletter_thumbnail_url", lambda *a, **k: "https://cdn.test/t.jpg")
    job = SocialPublishJob(
        project_id=project.id, user_id=user.id, platform="beehiiv",
        status=STATUS_RUNNING, title="My video", target_mode="new_draft",
    )
    db.add(job)
    db.commit()
    return conn, job


def test_publish_new_draft_lands_on_beehiiv(db_session, free_user, tmp_path, monkeypatch, mock_beehiiv):
    conn, job = _publish_job(db_session, free_user, tmp_path, monkeypatch, "test_key")
    publish_queue._publish_beehiiv(db_session, job, conn, str(tmp_path))
    db_session.refresh(job)
    assert job.status == STATUS_SUCCEEDED
    posted = [r for r in mock_beehiiv if r["method"] == "POST"]
    assert len(posted) == 1 and posted[0]["json"]["status"] == "draft"
    assert posted[0]["json"]["blocks"][0]["type"] == "image"
    assert job.platform_post_url.endswith("/p/my-video")


def test_publish_on_free_plan_is_plan_required_and_keeps_connection(
    db_session, free_user, tmp_path, monkeypatch
):
    conn, job = _publish_job(db_session, free_user, tmp_path, monkeypatch, "free_key")
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_beehiiv(db_session, job, conn, str(tmp_path))
    assert exc.value.code == "plan_required" and exc.value.retryable is False
    db_session.refresh(conn)
    assert conn.status == STATUS_ACTIVE


@pytest.mark.parametrize("key,blocked", [("test_key", False), ("free_key", True)])
def test_publish_check_reports_plan(client, free_user, auth, db_session, key, blocked):
    _conn(db_session, free_user, key=key)
    project = Project(user_id=free_user.id, name="P", status=ProjectStatus.DONE)
    db_session.add(project)
    db_session.commit()
    resp = client.get(
        "/api/sources/beehiiv/publish-check", params={"project_id": project.id}, headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["plan_required"] is blocked
    assert (body["reason"] == beehiiv_api.PLAN_REQUIRED_MESSAGE) is blocked


def test_publish_check_bad_key_is_an_error_and_revokes(client, free_user, auth, db_session):
    _conn(db_session, free_user, key="bad_key")
    project = Project(user_id=free_user.id, name="P", status=ProjectStatus.DONE)
    db_session.add(project)
    db_session.commit()
    resp = client.get(
        "/api/sources/beehiiv/publish-check", params={"project_id": project.id}, headers=auth(free_user),
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error_code"] == "invalid_key"
    assert db_session.query(SocialConnection).one().status != STATUS_ACTIVE


def test_publish_endpoint_outage_fails_before_any_job(client, free_user, auth, db_session, monkeypatch):
    monkeypatch.setattr(publish_queue, "wake", lambda: None)
    _conn(db_session, free_user, key="ratelimit_key")
    project = Project(
        user_id=free_user.id, name="Rendered", status=ProjectStatus.DONE,
        r2_video_key="users/1/projects/1/output/video-v1.mp4", r2_video_url="https://cdn.test/v.mp4",
    )
    db_session.add(project)
    db_session.commit()
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "beehiiv", "title": "My video"}, headers=auth(free_user),
    )
    assert resp.status_code == 429, resp.text
    assert resp.json()["detail"]["error_code"] == "rate_limited"
    assert db_session.query(SocialPublishJob).count() == 0


def test_publish_endpoint_refuses_plan_without_a_job(client, free_user, auth, db_session, monkeypatch):
    monkeypatch.setattr(publish_queue, "wake", lambda: None)
    _conn(db_session, free_user, key="free_key")
    project = Project(
        user_id=free_user.id, name="Rendered", status=ProjectStatus.DONE,
        r2_video_key="users/1/projects/1/output/video-v1.mp4", r2_video_url="https://cdn.test/v.mp4",
    )
    db_session.add(project)
    db_session.commit()
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "beehiiv", "title": "My video"}, headers=auth(free_user),
    )
    assert resp.status_code == 402, resp.text
    assert resp.json()["detail"]["error_code"] == "plan_required"
    assert db_session.query(SocialPublishJob).count() == 0
    assert db_session.query(SocialConnection).one().status == STATUS_ACTIVE


def test_publish_endpoint_allows_max_plan(client, free_user, auth, db_session, monkeypatch):
    monkeypatch.setattr(publish_queue, "wake", lambda: None)
    _conn(db_session, free_user, key="test_key")
    project = Project(
        user_id=free_user.id, name="Rendered", status=ProjectStatus.DONE,
        r2_video_key="users/1/projects/1/output/video-v1.mp4", r2_video_url="https://cdn.test/v.mp4",
    )
    db_session.add(project)
    db_session.commit()
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "beehiiv", "title": "My video"}, headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert db_session.query(SocialPublishJob).count() == 1


# ─── Live smoke (opt-in) ────────────────────────────────────────────────────


@pytest.mark.live
@pytest.mark.skipif(not os.environ.get("BEEHIIV_LIVE_API_KEY"), reason="BEEHIIV_LIVE_API_KEY not set")
def test_beehiiv_live_smoke(monkeypatch):
    """Read-only check of the real API: same client, no mock, real network."""
    monkeypatch.undo()  # drop the mock routing and the suite's socket guard
    monkeypatch.setattr(socket.socket, "connect", _socket.socket.connect)
    monkeypatch.setattr(socket.socket, "connect_ex", _socket.socket.connect_ex)
    monkeypatch.setattr(settings, "BEEHIIV_API_BASE_URL", beehiiv_api.BASE_URL)
    key = os.environ["BEEHIIV_LIVE_API_KEY"]
    pubs = beehiiv_api.list_publications(key)
    assert pubs and all(p["id"].startswith("pub_") for p in pubs)
    page = beehiiv_api.list_posts(key, pubs[0]["id"])
    assert {"posts", "page", "pages", "has_more"} <= set(page)
