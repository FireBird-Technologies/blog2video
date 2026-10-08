"""API keys on the web app's own (core) endpoints.

``get_current_user`` accepts a session JWT or a ``b2v_live_`` API key. Keys are
limited to the routes in services/api_route_policy.py.
"""
import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.services.api_route_policy import API_KEY_NEVER, API_KEY_ROUTES
from tests.test_public_api import ARTICLE, _api_key


@pytest.fixture(autouse=True)
def _no_pipeline(monkeypatch):
    monkeypatch.setattr(
        "app.routers.public_api.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: None,
    )


def _project(db, user, **extra):
    project = Project(user_id=user.id, name="p", status=ProjectStatus.GENERATED, **extra)
    db.add(project)
    db.commit()
    scene = Scene(project_id=project.id, order=1, title="Intro", narration_text="Hi", visual_description="v", duration_seconds=5)
    db.add(scene)
    db.commit()
    return project, scene


def _error(resp):
    detail = resp.json().get("detail")
    return detail.get("error") if isinstance(detail, dict) else detail


# ─── API keys ───────────────────────────────────────────────────────────────

def test_api_key_reaches_core_endpoints_under_owner_plan(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    before = paid_user.videos_used_this_period or 0

    created = client.post("/api/v1/videos", headers=headers, json={"url": "https://example.com/a-post"})
    assert created.status_code == 202, created.text
    project_id = created.json()["video_id"]
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == before + 1

    assert client.get(f"/api/projects/{project_id}", headers=headers).status_code == 200
    assert client.get(f"/api/projects/{project_id}/status", headers=headers).status_code == 200
    assert client.get("/api/projects", headers=headers).status_code == 200
    assert client.get("/api/voices/saved", headers=headers).status_code == 200
    assert client.get("/api/video-styles", headers=headers).status_code == 200
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["email"] == paid_user.email

    project, scene = _project(db_session, paid_user)
    edited = client.put(f"/api/projects/{project.id}/scenes/{scene.id}", headers=headers, json={"title": "Edited"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Edited"


def test_invalid_keys_are_rejected_on_core_endpoints(client, db_session, paid_user, free_user, auth):
    from app.models.public_api import ApiKey
    from app.models.user import PlanTier
    from app.services.public_api_auth import generate_key, hash_key

    assert client.get("/api/projects", headers={"Authorization": "Bearer b2v_live_not-a-real-key"}).status_code == 401

    headers = _api_key(client, paid_user, auth)
    key_id = client.get("/api/api-keys", headers=auth(paid_user)).json()[0]["id"]
    client.delete(f"/api/api-keys/{key_id}", headers=auth(paid_user))
    assert client.get("/api/projects", headers=headers).status_code == 401

    # A key whose owner is (now) on the free plan.
    raw = generate_key()
    db_session.add(ApiKey(user_id=free_user.id, name="old", prefix=raw[:12], last4=raw[-4:], key_hash=hash_key(raw)))
    db_session.commit()
    assert free_user.plan == PlanTier.FREE
    assert client.get("/api/projects", headers={"Authorization": f"Bearer {raw}"}).status_code == 403


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/billing/status"),
        ("GET", "/api/api-keys"),
        ("POST", "/api/api-keys"),
        ("POST", "/api/auth/logout"),
        ("GET", "/api/projects/{pid}/members"),
        ("GET", "/api/projects/{pid}/history"),
        ("POST", "/api/projects/{pid}/review"),
        ("POST", "/api/projects/{pid}/launch-studio"),
        ("POST", "/api/integrations/projects/{pid}/publish"),
        ("GET", "/api/sources/connections"),
        ("POST", "/api/auth/delete-account"),
        ("POST", "/api/projects"),
        ("POST", "/api/projects/bulk"),
        ("POST", "/api/template-studio/template/plan"),
        ("GET", "/api/free-tools/quota"),
    ],
)
def test_api_key_blocked_outside_core(client, db_session, paid_user, auth, method, path):
    headers = _api_key(client, paid_user, auth)
    project, _ = _project(db_session, paid_user)
    resp = client.request(method, path.format(pid=project.id), headers=headers, json={"name": "x"})
    assert resp.status_code == 403, (path, resp.status_code, resp.text)
    assert _error(resp) == "endpoint_not_available_with_api_key"


def test_session_jwt_is_unaffected_by_the_policy(client, paid_user, auth):
    assert client.get("/api/api-keys", headers=auth(paid_user)).status_code == 200
    assert client.get("/api/billing/status", headers=auth(paid_user)).status_code == 200


def test_api_key_cannot_reach_another_users_project(client, db_session, paid_user, other_user, auth):
    headers = _api_key(client, paid_user, auth)
    theirs, scene = _project(db_session, other_user)
    assert client.get(f"/api/projects/{theirs.id}", headers=headers).status_code in (403, 404)
    assert client.put(
        f"/api/projects/{theirs.id}/scenes/{scene.id}", headers=headers, json={"title": "x"}
    ).status_code in (403, 404)


# ─── Custom templates, video styles, AI editing ─────────────────────────────

THEME = {"colors": {"accent": "#FF5A1F", "bg": "#0B0B0F", "text": "#FFFFFF"}, "fonts": {"heading": "Inter"}}


def test_api_key_can_create_and_use_a_custom_template(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)

    created = client.post("/api/custom-templates", headers=headers, json={"name": "Acme brand", "theme": THEME})
    assert created.status_code == 200, created.text
    template_id = created.json()["id"]
    assert template_id in [t["id"] for t in client.get("/api/custom-templates", headers=headers).json()]

    renamed = client.put(f"/api/custom-templates/{template_id}", headers=headers, json={"name": "Acme 2026"})
    assert renamed.status_code == 200 and renamed.json()["name"] == "Acme 2026"
    assert client.get(f"/api/custom-templates/{template_id}/versions", headers=headers).status_code == 200

    video = client.post(
        "/api/v1/videos", headers=headers,
        json={"content": ARTICLE, "title": "t", "template": f"custom_{template_id}"},
    )
    assert video.status_code == 202, video.text
    assert db_session.get(Project, video.json()["video_id"]).template == f"custom_{template_id}"


def test_api_key_cannot_touch_another_users_custom_template(client, paid_user, other_user, auth):
    theirs = client.post("/api/custom-templates", headers=auth(other_user), json={"name": "Theirs", "theme": THEME})
    assert theirs.status_code == 200, theirs.text
    headers = _api_key(client, paid_user, auth)
    tid = theirs.json()["id"]
    assert client.put(f"/api/custom-templates/{tid}", headers=headers, json={"name": "x"}).status_code == 404
    assert client.delete(f"/api/custom-templates/{tid}", headers=headers).status_code == 404


def test_api_key_can_manage_video_styles(client, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    created = client.post(
        "/api/video-styles/custom", headers=headers,
        json={"name": "Concise", "guidance": "Use short, direct sentences.", "creation_method": "manual"},
    )
    assert created.status_code == 200, created.text
    style_id = created.json()["custom_id"]
    updated = client.patch(
        f"/api/video-styles/custom/{style_id}", headers=headers,
        json={"name": "Direct", "guidance": "Direct sentences.", "version": created.json()["version"]},
    )
    assert updated.status_code == 200 and updated.json()["name"] == "Direct"
    pinned = client.put("/api/video-styles/pin", headers=headers, json={"target_ref": f"custom:{style_id}"})
    assert pinned.status_code == 200
    assert client.delete(f"/api/video-styles/custom/{style_id}", headers=headers).status_code == 200


def test_ai_editing_chat_is_app_only(client, db_session, paid_user, auth):
    project, _ = _project(db_session, paid_user)
    history = f"/api/projects/{project.id}/chat/history"
    assert client.get(history, headers=_api_key(client, paid_user, auth)).status_code == 403
    assert client.get(history, headers=auth(paid_user)).status_code == 200


# ─── Voice design ────────────────────────────────────────────────────────────

PROMPT = {"prompt": "A warm, confident narrator with a light British accent"}


def test_voice_design_requires_sign_in(client):
    for path in ("/api/voices/design-from-prompt", "/api/voices/design-from-preset"):
        assert client.post(path, json=PROMPT).status_code in (401, 403)


def test_voice_design_with_api_key_and_daily_limit(client, paid_user, auth, monkeypatch):
    import app.main as main

    monkeypatch.setattr(main.settings, "ELEVENLABS_API_KEY", "test")
    monkeypatch.setattr(main, "_call_elevenlabs_voice_design", lambda text: {"previews": [], "text": text})
    monkeypatch.setattr(main, "_voice_design_counts", {})
    headers = _api_key(client, paid_user, auth)

    ok = client.post("/api/voices/design-from-prompt", headers=headers, json=PROMPT)
    assert ok.status_code == 200, ok.text
    assert client.post("/api/voices/design-from-preset", headers=headers, json={"gender": "male"}).status_code == 200

    main._voice_design_counts[paid_user.id] = (main._time.monotonic(), main._VOICE_DESIGN_DAILY_LIMIT)
    assert client.post("/api/voices/design-from-prompt", headers=headers, json=PROMPT).status_code == 429


# ─── Policy integrity ───────────────────────────────────────────────────────

def test_every_policy_route_exists():
    from app.main import app

    real = {
        (method.upper(), path)
        for path, ops in app.openapi()["paths"].items()
        for method in ops
        if method in ("get", "post", "put", "patch", "delete")
    }
    missing = sorted(API_KEY_ROUTES - real)
    assert missing == [], f"policy lists routes that don't exist: {missing}"


def _signed_in_routes() -> set[tuple[str, str]]:
    """Every (method, path) whose dependencies include get_current_user."""
    from fastapi.routing import APIRoute

    from app.auth import get_current_user
    from app.main import app

    def needs_user(dep) -> bool:
        return dep.call is get_current_user or any(needs_user(d) for d in dep.dependencies)

    def walk(router):
        for route in router.routes:
            if isinstance(route, APIRoute):
                yield route
            elif hasattr(route, "original_router"):
                yield from walk(route.original_router)
            elif hasattr(route, "routes"):
                yield from walk(route)

    return {
        (method, route.path_format)
        for route in walk(app.router)
        if needs_user(route.dependant)
        for method in route.methods
    }


def test_every_signed_in_route_is_classified():
    """A new signed-in endpoint must be put in API_KEY_ROUTES or API_KEY_NEVER."""
    signed_in = _signed_in_routes()
    assert len(signed_in) > 100  # the walk found the app's routes
    assert API_KEY_ROUTES.isdisjoint(API_KEY_NEVER)
    unclassified = sorted(signed_in - API_KEY_ROUTES - API_KEY_NEVER)
    assert unclassified == [], f"decide whether API keys may call these: {unclassified}"
    stale = sorted(API_KEY_NEVER - signed_in)
    assert stale == [], f"API_KEY_NEVER lists routes that no longer exist: {stale}"
