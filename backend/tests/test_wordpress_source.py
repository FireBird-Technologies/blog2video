"""Depth tier — WordPress content source: self-hosted (application password)
and WordPress.com (OAuth) connect, list, import, and publish-back.

Pinned here:

* the application password / OAuth token never appears in a response body;
* a self-hosted site URL resolving to a private address is refused (SSRF);
* what a video becomes (video / embed / thumbnail link) follows the site's
  plan and the user's role, and a too-large upload never sends a failure email.
"""
import json
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.social_connection import (
    PLATFORM_WORDPRESS,
    STATUS_ACTIVE,
    STATUS_REVOKED,
    WP_AUTH_APP_PASSWORD,
    WP_AUTH_WPCOM_OAUTH,
    SocialConnection,
)
from app.models.social_publish_job import (
    STATUS_QUEUED,
    STATUS_RUNNING,
    STATUS_SUCCEEDED,
    SocialPublishJob,
)
from app.services import publish_queue, source_importer, token_crypto, wordpress_api
from app.services.source_common import SourceError
from app.services.youtube_publish import PublishError

pytestmark = pytest.mark.depth

SITE = "https://blog.example.com"
ROOT = f"{SITE}/wp-json/"
APP_PASSWORD = "abcd EFGH ijkl MNOP qrst UVWX"
POST_HTML = "<h2>Intro</h2><p>" + ("WordPress powers a lot of the web. " * 10) + "</p>"

ADMIN_CAPS = {"edit_posts": True, "upload_files": True, "unfiltered_html": True, "edit_others_posts": True}
AUTHOR_CAPS = {"edit_posts": True, "upload_files": True, "unfiltered_html": False}
CONTRIBUTOR_CAPS = {"edit_posts": True, "upload_files": False}


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "ENVIRONMENT", "local")
    token_crypto.reset_cache()
    monkeypatch.setattr(source_importer, "_download_images", lambda *a, **k: [])
    yield
    token_crypto.reset_cache()


# ─── A fake WordPress ─────────────────────────────────────────────────────────


def _resp(status=200, body=None, headers=None, url="https://x/"):
    content = json.dumps(body).encode() if body is not None and not isinstance(body, (bytes, str)) else (
        body.encode() if isinstance(body, str) else (body or b"")
    )
    hdrs = {"content-type": "application/json"} if body is not None and not isinstance(body, str) else {"content-type": "text/html"}
    hdrs.update(headers or {})
    return httpx.Response(status, content=content, headers=hdrs, request=httpx.Request("GET", url))


class FakeWP:
    """Routes ``wordpress_api._send`` by (method, REST route). Records calls."""

    def __init__(self):
        self.routes = {}
        self.calls = []

    def on(self, method, route, handler):
        self.routes[(method, route)] = handler
        return self

    def __call__(self, method, url, *, headers, timeout=None, **kwargs):
        params = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
        params.update(kwargs.get("params") or {})
        route = params.get("rest_route") or urlparse(url).path
        for prefix in ("/wp-json", "/wp/v2/sites/123"):
            if route.startswith(prefix):
                route = route[len(prefix):] or "/"
        if "/wp/v2/sites/123" in url and not route.startswith("/wp/v2"):
            route = "/wp/v2" + route
        self.calls.append((method, route, params, kwargs, headers))
        handler = self.routes.get((method, route)) or self.routes.get((method, url))
        if handler is None:
            return _resp(404, {"code": "rest_no_route", "message": "No route"}, url=url)
        rest = {k: v for k, v in kwargs.items() if k != "params"}
        return handler(params=params, **rest) if callable(handler) else handler


@pytest.fixture()
def wp(monkeypatch):
    fake = FakeWP()
    monkeypatch.setattr(wordpress_api, "_send", fake)
    return fake


def _index(app_passwords=True, **extra):
    body = {
        "name": "Example &amp; Co", "home": SITE, "url": SITE,
        "namespaces": ["oembed/1.0", "wp/v2"],
        "authentication": {"application-passwords": {"endpoints": {}}} if app_passwords else {},
        "site_icon_url": f"{SITE}/icon.png",
    }
    body.update(extra)
    return body


def _self_hosted_site(wp, caps=ADMIN_CAPS, **index):
    wp.on("GET", SITE, _resp(200, "<html></html>", headers={"link": f'<{ROOT}>; rel="https://api.w.org/"'}))
    wp.on("GET", "/", _resp(200, _index(**index)))
    wp.on("GET", "/wp/v2/users/me", _resp(200, {"id": 1, "username": "editor", "capabilities": caps}))
    wp.on("GET", "/wp-block-editor/v1/settings", _resp(404, {"code": "rest_no_route"}))
    return wp


def _wp_conn(db, user, kind=WP_AUTH_APP_PASSWORD, **kwargs):
    secret = f"editor:{wordpress_api.clean_app_password(APP_PASSWORD)}" if kind == WP_AUTH_APP_PASSWORD else "wpcom-token"
    conn = SocialConnection(
        user_id=user.id, platform=PLATFORM_WORDPRESS,
        access_token_enc=token_crypto.encrypt(secret),
        auth_kind=kind,
        api_root=ROOT if kind == WP_AUTH_APP_PASSWORD else wordpress_api.wpcom_api_root("123"),
        site_url=SITE,
        account_id=None if kind == WP_AUTH_APP_PASSWORD else "123",
        account_handle="editor" if kind == WP_AUTH_APP_PASSWORD else None,
        account_name="Example",
        status=kwargs.pop("status", STATUS_ACTIVE),
        **kwargs,
    )
    db.add(conn)
    db.commit()
    return conn


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


# ─── Discovery / connect (self-hosted) ────────────────────────────────────────


def test_discover_uses_link_header(wp):
    _self_hosted_site(wp)
    site = wordpress_api.discover_site(SITE)
    assert site["api_root"] == ROOT
    assert site["name"] == "Example & Co"
    assert site["app_passwords"] is True


def test_discover_falls_back_to_rest_route_for_plain_permalinks(wp):
    wp.on("GET", SITE, _resp(200, "<html></html>"))  # no Link header
    wp.on("GET", "/", lambda params, **k: (
        _resp(200, _index()) if params.get("rest_route") == "/" else _resp(404, {"code": "rest_no_route"})
    ))
    site = wordpress_api.discover_site(SITE)
    assert "rest_route" in site["api_root"]


def test_discover_follows_redirects_and_stores_final_site(wp):
    wp.on("GET", "http://old.example.com", _resp(301, "", headers={"location": SITE}))
    _self_hosted_site(wp)
    site = wordpress_api.discover_site("http://old.example.com")
    assert site["site_url"] == SITE


def test_discover_blocked_by_firewall(wp):
    wp.on("GET", SITE, _resp(403, "<html>Just a moment…</html>"))
    wp.on("GET", "/", _resp(403, "<html>Attention required</html>"))
    with pytest.raises(SourceError) as exc:
        wordpress_api.discover_site(SITE)
    assert exc.value.code == "blocked_by_firewall"


def test_connect_self_hosted_stores_encrypted_password_and_never_returns_it(
    client, free_user, auth, db_session, wp
):
    _self_hosted_site(wp)
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": "blog.example.com/wp-admin/", "username": "editor", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "ijkl" not in resp.text.lower() and "abcdefgh" not in resp.text.lower()
    assert body["connection"]["auth_kind"] == WP_AUTH_APP_PASSWORD
    assert body["connection"]["username"] == "editor"
    assert body["capabilities"]["can_embed"] is True
    conn = db_session.query(SocialConnection).filter_by(platform=PLATFORM_WORDPRESS).one()
    assert conn.api_root == ROOT
    assert token_crypto.decrypt(conn.access_token_enc) == "editor:abcdEFGHijklMNOPqrstUVWX"
    # Basic auth carried the space-stripped password.
    me_call = next(c for c in wp.calls if c[1] == "/wp/v2/users/me")
    assert me_call[4]["Authorization"].startswith("Basic ")


WPCOM_SITE = "https://myblog.wordpress.com"


def test_connect_wordpress_com_site_with_app_passwords(client, free_user, auth, db_session, wp):
    """Paid WordPress.com plans with hosting features offer site application passwords."""
    wp.on("GET", WPCOM_SITE, _resp(200, "<html></html>", headers={"link": f'<{WPCOM_SITE}/wp-json/>; rel="https://api.w.org/"'}))
    wp.on("GET", "/", _resp(200, _index(home=WPCOM_SITE, url=WPCOM_SITE)))
    wp.on("GET", "/wp/v2/users/me", _resp(200, {"id": 1, "username": "me", "capabilities": ADMIN_CAPS}))
    wp.on("GET", "/wp-block-editor/v1/settings", _resp(404, {"code": "rest_no_route"}))
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": "myblog.wordpress.com", "username": "me", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["connection"]["auth_kind"] == WP_AUTH_APP_PASSWORD


@pytest.mark.parametrize("setup", ["no_app_passwords", "not_logged_in"])
def test_connect_wordpress_com_site_without_app_passwords_points_to_oauth(
    client, free_user, auth, wp, setup
):
    wp.on("GET", WPCOM_SITE, _resp(200, "<html></html>", headers={"link": f'<{WPCOM_SITE}/wp-json/>; rel="https://api.w.org/"'}))
    wp.on("GET", "/", _resp(200, _index(app_passwords=setup != "no_app_passwords", home=WPCOM_SITE)))
    wp.on("GET", "/wp/v2/users/me", _resp(401, {"code": "rest_not_logged_in", "message": "x"}))
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": "myblog.wordpress.com", "username": "me", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["error_code"] == "app_passwords_disabled"
    assert "Connect with WordPress.com" in detail["message"]


def test_connect_app_passwords_disabled(client, free_user, auth, wp):
    _self_hosted_site(wp, app_passwords=False)
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": SITE, "username": "editor", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == "app_passwords_disabled"


@pytest.mark.parametrize("wp_code, expected", [
    ("rest_not_logged_in", "auth_header_stripped"),
    ("incorrect_password", "invalid_key"),
])
def test_connect_auth_failures_are_409_never_401(client, free_user, auth, wp, wp_code, expected):
    _self_hosted_site(wp)
    wp.on("GET", "/wp/v2/users/me", _resp(401, {"code": wp_code, "message": "nope"}))
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": SITE, "username": "editor", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error_code"] == expected


def test_connect_refuses_subscriber(client, free_user, auth, wp):
    _self_hosted_site(wp, caps={"read": True})
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": SITE, "username": "reader", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error_code"] == "permission_denied"


def test_connect_refuses_private_host(client, free_user, auth, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    import socket
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("10.0.0.5", 0))])
    resp = client.post(
        "/api/sources/wordpress/connect",
        json={"site_url": "https://intranet.example.com", "username": "u", "api_key": APP_PASSWORD},
        headers=auth(free_user),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error_code"] == "invalid_site"


# ─── WordPress.com OAuth ─────────────────────────────────────────────────────


def test_wpcom_connect_url_needs_config(client, free_user, auth, monkeypatch):
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "")
    assert client.get("/api/sources/wordpress/connect-url", headers=auth(free_user)).status_code == 503


def test_wpcom_connect_url_carries_state(client, free_user, auth, monkeypatch):
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_SECRET", "secret")
    resp = client.get("/api/sources/wordpress/connect-url", headers=auth(free_user))
    assert resp.status_code == 200
    q = parse_qs(urlparse(resp.json()["authorize_url"]).query)
    assert q["client_id"] == ["cid"] and q["response_type"] == ["code"] and q["state"][0]
    assert q["redirect_uri"][0].endswith("/api/sources/wordpress/callback")


def test_wpcom_callback_denied_and_bad_state(client, monkeypatch):
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_SECRET", "secret")
    denied = client.get("/api/sources/wordpress/callback?error=access_denied")
    assert denied.status_code == 200 and "cancelled" in denied.text
    bad = client.get("/api/sources/wordpress/callback?code=x&state=garbage")
    assert bad.status_code == 200 and "ok: false" in bad.text


def test_wpcom_callback_stores_site(client, free_user, db_session, wp, monkeypatch):
    from app.services import social_oauth
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_SECRET", "secret")
    wp.on("POST", wordpress_api.WPCOM_TOKEN_URL, _resp(200, {
        "access_token": "tok-123", "blog_id": 123, "blog_url": "https://mysite.wordpress.com",
    }))
    wp.on("GET", "/rest/v1.1/sites/123", _resp(200, {
        "ID": 123,
        "name": "My Site", "URL": "https://mysite.wordpress.com", "icon": {"img": "https://i/icon.png"},
        "plan": {"product_slug": "free_plan"}, "capabilities": {"upload_files": True},
    }))
    state = social_oauth.build_state(free_user.id, PLATFORM_WORDPRESS)
    resp = client.get(f"/api/sources/wordpress/callback?code=abc&state={state}")
    assert resp.status_code == 200 and "ok: true" in resp.text
    assert "tok-123" not in resp.text
    conn = db_session.query(SocialConnection).filter_by(platform=PLATFORM_WORDPRESS).one()
    assert (conn.auth_kind, conn.account_id) == (WP_AUTH_WPCOM_OAUTH, "123")
    assert conn.api_root == wordpress_api.wpcom_api_root("123")
    assert token_crypto.decrypt(conn.access_token_enc) == "tok-123"


def test_wpcom_callback_falls_back_to_domain_when_blog_id_is_zero(client, free_user, db_session, wp, monkeypatch):
    """WordPress.com can return blog_id 0; /sites/0 is "Unknown blog", so use the domain."""
    from app.services import social_oauth
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_SECRET", "secret")
    wp.on("POST", wordpress_api.WPCOM_TOKEN_URL, _resp(200, {
        "access_token": "tok-9", "blog_id": 0, "blog_url": "https://other.wordpress.com",
    }))
    wp.on("GET", "/rest/v1.1/sites/0", _resp(404, {"error": "unknown_blog", "message": "Unknown blog"}))
    wp.on("GET", "/rest/v1.1/sites/other.wordpress.com", _resp(200, {
        "ID": 456, "name": "Other", "URL": "https://other.wordpress.com", "plan": {"product_slug": "free_plan"},
    }))
    state = social_oauth.build_state(free_user.id, PLATFORM_WORDPRESS)
    resp = client.get(f"/api/sources/wordpress/callback?code=abc&state={state}")
    assert "ok: true" in resp.text, resp.text
    conn = db_session.query(SocialConnection).filter_by(platform=PLATFORM_WORDPRESS).one()
    assert conn.account_id == "456" and conn.api_root == wordpress_api.wpcom_api_root("456")


def test_wpcom_callback_account_without_sites(client, free_user, wp, monkeypatch):
    from app.services import social_oauth
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_SECRET", "secret")
    wp.on("POST", wordpress_api.WPCOM_TOKEN_URL, _resp(200, {"access_token": "t", "blog_id": 0, "blog_url": ""}))
    wp.on("GET", "/rest/v1.1/me/sites", _resp(200, {"sites": []}))
    state = social_oauth.build_state(free_user.id, PLATFORM_WORDPRESS)
    resp = client.get(f"/api/sources/wordpress/callback?code=abc&state={state}")
    assert "ok: false" in resp.text and "have a site yet" in resp.text


def test_sources_config_reports_wpcom(client, monkeypatch):
    monkeypatch.setattr(settings, "WORDPRESS_COM_CLIENT_ID", "")
    body = client.get("/api/sources/config").json()
    assert "wordpress" in body["platforms"] and body["wordpress_com_enabled"] is False


# ─── Listing / import ─────────────────────────────────────────────────────────


def _wp_post(pid, status="publish", **extra):
    post = {
        "id": pid, "status": status,
        "title": {"raw": f"Post {pid}", "rendered": f"Post {pid}"},
        "date_gmt": "2026-09-01T10:00:00", "modified_gmt": "2026-09-02T10:00:00",
        "link": f"{SITE}/?p={pid}", "excerpt": {"rendered": "<p>Hello</p>"},
        "password": "", "featured_media": 0,
    }
    post.update(extra)
    return post


def test_list_posts_maps_statuses_and_totals(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user)
    wp.on("GET", "/wp/v2/posts", _resp(200, [
        _wp_post(1), _wp_post(2, "draft"), _wp_post(3, "future"),
        _wp_post(4, "private"), _wp_post(5, password="secret"), _wp_post(6, "pending"),
    ], headers={"x-wp-total": "26", "x-wp-totalpages": "2"}))
    page = wordpress_api.list_posts(source_importer.wordpress_credentials(conn))
    by_id = {p["id"]: p for p in page["posts"]}
    assert [by_id[str(i)]["status"] for i in range(1, 7)] == [
        "published", "draft", "scheduled", "private", "published", "pending",
    ]
    assert by_id["1"]["url"] == f"{SITE}/?p=1" and by_id["2"]["url"] is None
    assert by_id["4"]["paid"] and by_id["5"]["paid"] and not by_id["1"]["paid"]
    assert (page["total"], page["pages"], page["has_more"]) == (26, 2, True)


def test_list_posts_narrows_statuses_for_limited_roles(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user)

    def posts(params, **k):
        if "private" in params["status"]:
            return _resp(400, {"code": "rest_invalid_param", "message": "Status is forbidden."})
        return _resp(200, [_wp_post(1, "draft")], headers={"x-wp-totalpages": "1"})
    wp.on("GET", "/wp/v2/posts", posts)
    page = wordpress_api.list_posts(source_importer.wordpress_credentials(conn))
    assert [p["id"] for p in page["posts"]] == ["1"]


def test_list_posts_past_last_page_is_empty(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user)
    wp.on("GET", "/wp/v2/posts", _resp(400, {"code": "rest_post_invalid_page_number"}))
    page = wordpress_api.list_posts(source_importer.wordpress_credentials(conn), page=5)
    assert page["posts"] == [] and page["has_more"] is False


def test_wpcom_requests_go_through_the_proxy_with_bearer(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user, kind=WP_AUTH_WPCOM_OAUTH)
    wp.on("GET", "/wp/v2/posts", _resp(200, [], headers={"x-wp-totalpages": "1"}))
    wordpress_api.list_posts(source_importer.wordpress_credentials(conn))
    method, route, params, kwargs, headers = wp.calls[-1]
    assert route == "/wp/v2/posts" and headers["Authorization"] == "Bearer wpcom-token"


def test_import_draft_uses_placeholder_url(client, free_user, auth, db_session, wp):
    _wp_conn(db_session, free_user)
    wp.on("GET", "/wp/v2/posts/42", _resp(200, _wp_post(
        42, "draft", content={"rendered": POST_HTML, "raw": POST_HTML},
    )))
    resp = client.post(
        "/api/sources/wordpress/import",
        json={"post_ids": ["42"], "template": "default", "video_style": "explainer"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    project = db_session.get(Project, resp.json()["project_ids"][0])
    assert project.blog_url == "wordpress://42"
    assert project.source_platform == PLATFORM_WORDPRESS and project.status == ProjectStatus.SCRAPED


def test_list_with_revoked_password_marks_connection(client, free_user, auth, db_session, wp):
    conn = _wp_conn(db_session, free_user)
    wp.on("GET", "/wp/v2/posts", _resp(401, {"code": "incorrect_password", "message": "bad"}))
    resp = client.get("/api/sources/wordpress/posts", headers=auth(free_user))
    assert resp.status_code == 409
    db_session.refresh(conn)
    assert conn.status == STATUS_REVOKED


# ─── Capabilities → delivery ──────────────────────────────────────────────────


@pytest.mark.parametrize("caps, size, expected", [
    ({"can_upload_video": True, "can_embed": True, "upload_limit_bytes": None}, 50_000_000, ("video", "embed")),
    ({"can_upload_video": True, "can_embed": True, "upload_limit_bytes": 10_000_000}, 50_000_000, ("ask", "embed")),
    ({"can_upload_video": True, "can_embed": False, "upload_limit_bytes": 10_000_000}, 50_000_000, ("ask", "link")),
    ({"can_upload_video": False, "can_embed": True}, None, ("embed", "embed")),
    ({"can_upload_video": False, "can_embed": False}, None, ("link", "link")),
])
def test_choose_delivery(caps, size, expected):
    assert wordpress_api.choose_delivery(caps, size) == expected


def test_wpcom_free_plan_gets_link(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user, kind=WP_AUTH_WPCOM_OAUTH)
    wp.on("GET", "/rest/v1.1/sites/123", _resp(200, {
        "plan": {"product_slug": "free_plan"}, "capabilities": {"upload_files": True},
    }))
    caps = wordpress_api.capabilities(source_importer.wordpress_credentials(conn))
    assert not caps["can_upload_video"] and not caps["can_embed"] and caps["can_upload_images"]
    assert wordpress_api.choose_delivery(caps, 1)[0] == "link"


@pytest.mark.parametrize("slug, hosting, video, embed", [
    ("free_plan", False, False, False),
    ("personal-bundle", False, False, False),   # no video; embeds need hosting features
    ("personal-bundle", True, False, True),     # hosting on: our player, still no video
    ("value_bundle", False, True, False),       # Premium: MP4 uploads, no custom code yet
    ("value_bundle", True, True, True),
    ("business-bundle", False, True, False),    # VideoPress; custom code needs activation
    ("business-bundle", True, True, True),
])
def test_wpcom_plan_capabilities(db_session, free_user, wp, slug, hosting, video, embed):
    conn = _wp_conn(db_session, free_user, kind=WP_AUTH_WPCOM_OAUTH)
    wp.on("GET", "/rest/v1.1/sites/123", _resp(200, {
        "plan": {"product_slug": slug}, "capabilities": {"upload_files": True},
        "options": {"is_wpcom_atomic": hosting},
    }))
    caps = wordpress_api.capabilities(source_importer.wordpress_credentials(conn))
    assert (caps["can_upload_video"], caps["can_embed"]) == (video, embed)


# ─── Cards ────────────────────────────────────────────────────────────────────


def test_cards_block_vs_classic():
    assert wordpress_api.video_card("https://s/v.mp4", "https://s/p.jpg", 7, True).startswith('<!-- wp:video {"id": 7} -->')
    assert wordpress_api.video_card("https://s/v.mp4", None, None, False) == '[video src="https://s/v.mp4"][/video]'
    assert wordpress_api.embed_card("<iframe></iframe>", True).startswith("<!-- wp:html -->")
    assert wordpress_api.embed_card("<iframe></iframe>", False) == "<iframe></iframe>"
    link = wordpress_api.link_card("https://s/t.jpg", "https://w/p", "T", 9, True)
    assert "wp:image" in link and 'href="https://w/p"' in link and "wp-image-9" in link
    assert "<!-- wp:" not in wordpress_api.link_card("https://s/t.jpg", "https://w/p", "T", None, False)


def test_is_block_content():
    assert wordpress_api.is_block_content("<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->")
    assert not wordpress_api.is_block_content("<p>classic</p>")
    assert wordpress_api.is_block_content("")


def _post_with_content(raw, modified="2026-09-02T10:00:00"):
    return _resp(200, {"id": 42, "content": {"raw": raw, "rendered": raw}, "modified_gmt": modified})


def test_add_to_post_prepends_and_appends(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user)
    creds = source_importer.wordpress_credentials(conn)
    wp.on("GET", "/wp/v2/posts/42", _post_with_content("<p>classic body</p>"))
    saved = {}
    wp.on("POST", "/wp/v2/posts/42", lambda params, **k: saved.update(k["json"]) or _resp(200, {"id": 42}))
    wordpress_api.add_to_post(creds, "42", lambda block: "CARD-block" if block else "CARD-classic", "bottom")
    assert saved["content"] == "<p>classic body</p>\n\nCARD-classic"
    wordpress_api.add_to_post(creds, "42", lambda block: "CARD", "top")
    assert saved["content"].startswith("CARD\n\n")


def test_add_to_post_detects_concurrent_edit(db_session, free_user, wp):
    conn = _wp_conn(db_session, free_user)
    reads = iter(["2026-09-02T10:00:00", "2026-09-02T10:05:00"])
    wp.on("GET", "/wp/v2/posts/42", lambda params, **k: _post_with_content("<p>x</p>", next(reads)))
    with pytest.raises(SourceError) as exc:
        wordpress_api.add_to_post(source_importer.wordpress_credentials(conn), "42", lambda b: "C", "top")
    assert exc.value.code == "conflict" and exc.value.retryable


# ─── Publish endpoint + worker ────────────────────────────────────────────────


@pytest.fixture()
def no_queue_wake(monkeypatch):
    monkeypatch.setattr(publish_queue, "wake", lambda: None)


def test_publish_switches_to_link_when_site_cant_take_video(
    client, free_user, auth, db_session, no_queue_wake, monkeypatch
):
    _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    monkeypatch.setattr(wordpress_api, "capabilities", lambda creds: {
        "can_upload_video": False, "can_upload_images": False, "can_embed": False,
    })
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "wordpress", "title": "My video"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    job = db_session.query(SocialPublishJob).one()
    assert (job.status, job.delivery) == (STATUS_QUEUED, "link")


def test_publish_embed_skips_render(client, free_user, auth, db_session, no_queue_wake):
    _wp_conn(db_session, free_user)
    project = Project(user_id=free_user.id, name="Unrendered", status=ProjectStatus.CREATED)
    db_session.add(project)
    db_session.commit()
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "wordpress", "title": "My video", "delivery": "embed"},
        headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["render_started"] is False
    assert db_session.query(SocialPublishJob).one().delivery == "embed"


def test_link_delivery_is_wordpress_only(client, free_user, auth, db_session, no_queue_wake):
    project = _rendered_project(db_session, free_user)
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "ghost", "title": "My video", "delivery": "link"},
        headers=auth(free_user),
    )
    assert resp.status_code == 400


@pytest.fixture()
def wp_worker(monkeypatch, tmp_path):
    from app.services import video_thumbnail
    from app.services import youtube_publish as yt

    video = tmp_path / "video.mp4"
    video.write_bytes(b"\0" * 64)
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: (str(video), False))
    monkeypatch.setattr(video_thumbnail, "extract_frame", lambda *a, **k: False)
    calls = {"uploads": []}

    def _upload(creds, path, name, mime, on_progress=None):
        if on_progress:
            on_progress(64)
        calls["uploads"].append(mime)
        return {"id": 77, "source_url": f"{SITE}/wp-content/uploads/{name}"}

    def _place(creds, pid, build_card, position):
        calls["card"] = build_card(True)
        calls["target"] = (pid, position)
        return {"id": int(pid)}

    def _draft(creds, title, build_card):
        calls["card"] = build_card(True)
        calls["draft"] = title
        return {"id": 99}

    monkeypatch.setattr(wordpress_api, "upload_media", _upload)
    monkeypatch.setattr(wordpress_api, "add_to_post", _place)
    monkeypatch.setattr(wordpress_api, "create_draft", _draft)
    monkeypatch.setattr(wordpress_api, "capabilities", lambda creds: {
        "can_upload_video": True, "can_upload_images": True, "can_embed": True,
        "upload_limit_bytes": None,
    })
    return calls, str(tmp_path)


def _wp_job(db, user, project, **kwargs):
    job = SocialPublishJob(
        project_id=project.id, user_id=user.id, platform=PLATFORM_WORDPRESS,
        status=STATUS_RUNNING, title="My video", **kwargs,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def test_worker_uploads_video_into_post(db_session, free_user, wp_worker):
    calls, work_dir = wp_worker
    conn = _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _wp_job(db_session, free_user, project, target_post_id="42", target_mode="bottom")
    publish_queue._publish_wordpress(db_session, job, conn, work_dir)
    db_session.refresh(job)
    assert job.status == STATUS_SUCCEEDED
    assert calls["uploads"] == ["video/mp4"]
    assert calls["card"].startswith('<!-- wp:video {"id": 77} -->')
    assert calls["target"] == ("42", "bottom")
    assert job.platform_post_url == f"{SITE}/wp-admin/post.php?post=42&action=edit"


def test_worker_too_large_upload_fails_without_email(db_session, free_user, wp_worker, monkeypatch):
    _, work_dir = wp_worker
    conn = _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _wp_job(db_session, free_user, project, target_mode="new_draft")

    def _too_big(*a, **k):
        raise SourceError("too big", code="upload_too_large")
    monkeypatch.setattr(wordpress_api, "upload_media", _too_big)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_wordpress(db_session, job, conn, work_dir)
    assert exc.value.code == "video_too_large" and exc.value.retryable is False
    assert "embedded player" in str(exc.value)

    sent = []
    monkeypatch.setattr(publish_queue, "_notify", lambda db, job, succeeded: sent.append(succeeded))
    publish_queue._fail(db_session, job, exc.value)
    assert sent == []


def test_worker_downgrades_to_link_when_capabilities_change(db_session, free_user, wp_worker, monkeypatch):
    from app.routers import content_sources
    calls, work_dir = wp_worker
    conn = _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _wp_job(db_session, free_user, project, target_mode="new_draft")
    monkeypatch.setattr(wordpress_api, "capabilities", lambda creds: {
        "can_upload_video": False, "can_upload_images": False, "can_embed": False,
    })
    monkeypatch.setattr(content_sources, "newsletter_thumbnail_url", lambda *a, **k: "https://cdn.test/thumb.jpg")
    publish_queue._publish_wordpress(db_session, job, conn, work_dir)
    db_session.refresh(job)
    assert job.delivery == "link" and job.status == STATUS_SUCCEEDED
    assert calls["uploads"] == []  # no media rights: the thumbnail is hotlinked
    assert "https://cdn.test/thumb.jpg" in calls["card"] and "/embed/" in calls["card"]


def test_worker_embed_needs_no_video(db_session, free_user, wp_worker, monkeypatch):
    from app.services import youtube_publish as yt
    calls, work_dir = wp_worker
    conn = _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _wp_job(db_session, free_user, project, target_mode="new_draft", delivery="embed")
    monkeypatch.setattr(yt, "resolve_local_video", lambda *a, **k: pytest.fail("embed must not fetch the MP4"))
    publish_queue._publish_wordpress(db_session, job, conn, work_dir)
    assert calls["card"].startswith("<!-- wp:html -->") and "/embed/" in calls["card"]


def test_worker_bad_password_revokes(db_session, free_user, wp_worker, monkeypatch):
    _, work_dir = wp_worker
    conn = _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    job = _wp_job(db_session, free_user, project, target_mode="new_draft")

    def _reject(creds):
        raise SourceError("bad", code="invalid_key")
    monkeypatch.setattr(wordpress_api, "capabilities", _reject)
    with pytest.raises(PublishError) as exc:
        publish_queue._publish_wordpress(db_session, job, conn, work_dir)
    assert exc.value.code == "reauth_required"
    db_session.refresh(conn)
    assert conn.status == STATUS_REVOKED


def test_publish_check_wordpress(client, free_user, auth, db_session, monkeypatch):
    from app.services import r2_storage
    _wp_conn(db_session, free_user)
    project = _rendered_project(db_session, free_user)
    monkeypatch.setattr(r2_storage, "object_size", lambda key: 50_000_000)
    monkeypatch.setattr(wordpress_api, "capabilities", lambda creds: {
        "can_upload_video": True, "can_embed": False, "upload_limit_bytes": 10_000_000, "reason": None,
    })
    resp = client.get(
        f"/api/sources/wordpress/publish-check?project_id={project.id}", headers=auth(free_user),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["recommended"], body["fallback"], body["limit_bytes"]) == ("ask", "link", 10_000_000)


def test_disconnect_leaves_the_application_password_on_the_site(client, free_user, auth, db_session, wp):
    """Disconnect only forgets the credential here; nothing is revoked on the site."""
    _wp_conn(db_session, free_user)
    resp = client.delete("/api/sources/wordpress", headers=auth(free_user))
    assert resp.status_code == 200
    assert wp.calls == []
    assert db_session.query(SocialConnection).filter_by(platform=PLATFORM_WORDPRESS).count() == 0


# ─── "Source" post only on the site it came from ─────────────────────────────


@pytest.mark.parametrize("source_site, blog_url, conn_site, expected", [
    ("blog.example.com", "wordpress://9", SITE, True),                      # same site
    ("blog2video-tets.local", "wordpress://9", SITE, False),                # other site, same id
    (None, "http://blog2video-tets.local/the-post/", SITE, False),          # legacy: URL on another site
    (None, f"{SITE}/2026/09/the-post/", SITE, True),                        # legacy: URL under this site
    (None, "wordpress://9", SITE, False),                                   # legacy draft: unknown, don't guess
])
def test_source_matches_connection(source_site, blog_url, conn_site, expected):
    from types import SimpleNamespace
    from app.services.source_urls import source_matches_connection
    project = SimpleNamespace(
        source_platform="wordpress", source_post_id="9", source_site=source_site, blog_url=blog_url,
    )
    conn = SimpleNamespace(platform="wordpress", site_url=conn_site, account_id=None)
    assert source_matches_connection(project, conn) is expected


def test_import_records_source_site(client, free_user, auth, db_session, wp):
    _wp_conn(db_session, free_user)
    wp.on("GET", "/wp/v2/posts/42", _resp(200, _wp_post(
        42, "draft", content={"rendered": POST_HTML, "raw": POST_HTML},
    )))
    resp = client.post(
        "/api/sources/wordpress/import",
        json={"post_ids": ["42"], "template": "default", "video_style": "explainer"},
        headers=auth(free_user),
    )
    project = db_session.get(Project, resp.json()["project_ids"][0])
    assert project.source_site == "blog.example.com"


def test_publish_into_post_ignores_source_from_another_site(
    client, free_user, auth, db_session, monkeypatch
):
    monkeypatch.setattr(publish_queue, "wake", lambda: None)
    monkeypatch.setattr(wordpress_api, "capabilities", lambda creds: {"can_upload_video": True})
    _wp_conn(db_session, free_user)
    project = _rendered_project(
        db_session, free_user, source_platform="wordpress", source_post_id="9",
        source_site="blog2video-tets.local",
    )
    resp = client.post(
        f"/api/integrations/projects/{project.id}/publish",
        json={"platform": "wordpress", "title": "My video", "target_mode": "top"},
        headers=auth(free_user),
    )
    assert resp.status_code == 400  # no post chosen, and the source is on another site


@pytest.mark.parametrize("slug, hosting, expected, not_expected", [
    ("personal-bundle", False, "Activate hosting features to embed", None),
    ("personal-bundle", True, "doesn't include video uploads", "Activate"),
    ("free_plan", False, "doesn't include video uploads", "Activate"),
])
def test_wpcom_reason_for_plans_without_video(db_session, free_user, wp, slug, hosting, expected, not_expected):
    conn = _wp_conn(db_session, free_user, kind=WP_AUTH_WPCOM_OAUTH)
    wp.on("GET", "/rest/v1.1/sites/123", _resp(200, {
        "plan": {"product_slug": slug}, "capabilities": {"upload_files": True},
        "options": {"is_wpcom_atomic": hosting},
    }))
    caps = wordpress_api.capabilities(source_importer.wordpress_credentials(conn))
    assert not caps["can_upload_video"] and expected in caps["reason"]
    if not_expected:
        assert not_expected not in caps["reason"]
