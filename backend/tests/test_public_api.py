"""Contract tests for the public video API (/api/v1) and API-key management.

One credential: a paid user's API key. An app serving its own users calls with
its owner's key and tags videos with ``external_user_id``; every video is
charged to the key owner's blog2video plan.
"""
import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene

V1 = "/api/v1"
ARTICLE = "This is the article text supplied directly by the calling app. " * 4


@pytest.fixture(autouse=True)
def no_pipeline(monkeypatch):
    started = []
    monkeypatch.setattr(
        "app.routers.public_api.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: started.append((project_id, user_id)),
    )
    return started


def _api_key(client, user, auth):
    created = client.post("/api/api-keys", headers=auth(user), json={"name": "My app"})
    assert created.status_code == 201, created.text
    return {"Authorization": f"Bearer {created.json()['key']}"}


def _create(client, headers, **extra):
    body = {"content": ARTICLE, "title": "An article", **extra}
    return client.post(f"{V1}/videos", headers=headers, json=body)


# ─── API keys ───────────────────────────────────────────────────────────────

def test_api_key_lifecycle(client, db_session, paid_user, free_user, auth):
    assert client.post("/api/api-keys", headers=auth(free_user), json={"name": "x"}).status_code == 403

    created = client.post("/api/api-keys", headers=auth(paid_user), json={"name": "My app"})
    assert created.status_code == 201
    raw = created.json()["key"]
    assert raw.startswith("b2v_live_")

    listed = client.get("/api/api-keys", headers=auth(paid_user)).json()
    assert len(listed) == 1 and "key" not in listed[0] and listed[0]["last4"] == raw[-4:]

    headers = {"Authorization": f"Bearer {raw}"}
    me = client.get(f"{V1}/me", headers=headers)
    assert me.status_code == 200 and me.json()["email"] == paid_user.email

    assert client.delete(f"/api/api-keys/{listed[0]['id']}", headers=auth(paid_user)).status_code == 204
    assert client.get(f"{V1}/me", headers=headers).status_code == 401


def test_api_key_can_be_copied_again_by_its_owner_only(client, db_session, paid_user, other_user, auth):
    from app.models.public_api import ApiKey

    created = client.post("/api/api-keys", headers=auth(paid_user), json={"name": "CMS"}).json()
    listed = client.get("/api/api-keys", headers=auth(paid_user)).json()
    assert listed[0]["can_reveal"] is True

    revealed = client.get(f"/api/api-keys/{created['id']}/reveal", headers=auth(paid_user))
    assert revealed.status_code == 200 and revealed.json()["key"] == created["key"]
    # Stored encrypted, never in plaintext.
    row = db_session.get(ApiKey, created["id"])
    assert created["key"] not in (row.key_encrypted or "")

    assert client.get(f"/api/api-keys/{created['id']}/reveal", headers=auth(other_user)).status_code == 404
    # A key can't be used to read keys.
    key_headers = {"Authorization": f"Bearer {created['key']}"}
    assert client.get(f"/api/api-keys/{created['id']}/reveal", headers=key_headers).status_code == 403

    client.delete(f"/api/api-keys/{created['id']}", headers=auth(paid_user))
    assert client.get(f"/api/api-keys/{created['id']}/reveal", headers=auth(paid_user)).status_code == 404


def test_key_without_a_stored_copy_asks_for_rotation(client, db_session, paid_user, auth):
    from app.models.public_api import ApiKey

    created = client.post("/api/api-keys", headers=auth(paid_user), json={"name": "Old"}).json()
    row = db_session.get(ApiKey, created["id"])
    row.key_encrypted = None  # e.g. created before copies were stored
    db_session.commit()
    assert client.get("/api/api-keys", headers=auth(paid_user)).json()[0]["can_reveal"] is False
    assert client.get(f"/api/api-keys/{created['id']}/reveal", headers=auth(paid_user)).status_code == 409
    # It still authenticates.
    assert client.get(f"{V1}/me", headers={"Authorization": f"Bearer {created['key']}"}).status_code == 200


def test_api_key_rotation(client, db_session, paid_user, other_user, auth):
    created = client.post("/api/api-keys", headers=auth(paid_user), json={"name": "CMS"}).json()
    old_headers = {"Authorization": f"Bearer {created['key']}"}
    video_id = _create(client, old_headers).json()["video_id"]

    # Someone else's key id is not rotatable.
    assert client.post(f"/api/api-keys/{created['id']}/rotate", headers=auth(other_user)).status_code == 404

    rotated = client.post(f"/api/api-keys/{created['id']}/rotate", headers=auth(paid_user))
    assert rotated.status_code == 201
    new = rotated.json()
    assert new["name"] == "CMS" and new["id"] != created["id"] and new["key"] != created["key"]
    new_headers = {"Authorization": f"Bearer {new['key']}"}

    assert client.get(f"{V1}/me", headers=old_headers).status_code == 401
    assert client.get(f"{V1}/me", headers=new_headers).status_code == 200
    # Videos made with the old key are still reachable with the new one.
    assert client.get(f"{V1}/videos/{video_id}", headers=new_headers).status_code == 200
    assert [k["id"] for k in client.get("/api/api-keys", headers=auth(paid_user)).json()] == [new["id"]]
    # The old id is gone, so rotating it again is a 404.
    assert client.post(f"/api/api-keys/{created['id']}/rotate", headers=auth(paid_user)).status_code == 404


def test_api_key_stops_working_after_downgrade(client, db_session, paid_user, auth):
    from app.models.user import PlanTier

    headers = _api_key(client, paid_user, auth)
    paid_user.plan = PlanTier.FREE
    db_session.commit()
    assert client.get(f"{V1}/me", headers=headers).status_code == 403


def test_missing_or_garbage_credentials_are_rejected(client):
    assert client.get(f"{V1}/me").status_code == 401
    assert client.get(f"{V1}/me", headers={"Authorization": "Bearer b2v_live_nope"}).status_code == 401
    assert client.get(f"{V1}/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401
    # A JWT-shaped bearer (e.g. a leftover partner-app token) is not an API key.
    jwtish = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl"
    assert client.get(f"{V1}/me", headers={"Authorization": f"Bearer {jwtish}"}).status_code == 401


def test_api_key_video_create_charges_owner_and_is_idempotent(client, db_session, paid_user, auth, no_pipeline):
    headers = _api_key(client, paid_user, auth)
    before = paid_user.videos_used_this_period or 0

    first = _create(client, headers, external_user_id="their-user-7", metadata={"k": "v"}, idempotency_key="req-000001")
    assert first.status_code == 202, first.text
    video_id = first.json()["video_id"]
    again = _create(client, headers, idempotency_key="req-000001")
    assert again.json() == {"video_id": video_id, "state": "existing"}

    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == before + 1
    assert no_pipeline == [(video_id, paid_user.id)]

    project = db_session.get(Project, video_id)
    assert project.user_id == paid_user.id
    assert project.status == ProjectStatus.SCRAPED and project.blog_content == ARTICLE

    listed = client.get(f"{V1}/videos", headers=headers, params={"external_user_id": "their-user-7"}).json()
    assert [v["video_id"] for v in listed["items"]] == [video_id]
    assert listed["items"][0]["metadata"] == {"k": "v"}


def test_create_accepts_every_form_option(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    created = _create(
        client, headers,
        bgm_track_id="corporate_upbeat", bgm_volume=0.2,
        caption_position="top_center", caption_font_size="42",
        playback_speed=1.1, logo_position="top_left", logo_size=80.0,
        avatar_shape="rounded", avatar_position="top_right", avatar_opacity=0.8,
    )
    assert created.status_code == 202, created.text
    project = db_session.get(Project, created.json()["video_id"])
    assert project.bgm_track_id == "corporate_upbeat" and project.bgm_volume == pytest.approx(0.2)
    assert project.caption_position == "top_center" and project.caption_font_size == "42"
    assert project.playback_speed == pytest.approx(1.1)
    assert project.logo_position == "top_left" and project.logo_size == pytest.approx(80.0)
    assert project.avatar_shape == "rounded" and project.avatar_position == "top_right"
    assert project.avatar_opacity == pytest.approx(0.8)

    # Options the caller didn't send keep the model's own defaults.
    plain = db_session.get(Project, _create(client, headers).json()["video_id"])
    assert plain.logo_size == pytest.approx(70.0) and plain.avatar_shape == "circle"


def test_invalid_option_is_422_and_charges_nothing(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    before = paid_user.videos_used_this_period or 0
    resp = _create(client, headers, avatar_shape="triangle-spaceship")
    assert resp.status_code == 422, resp.text
    db_session.refresh(paid_user)
    assert (paid_user.videos_used_this_period or 0) == before


def test_script_review_pauses_before_voiceovers(client, db_session, paid_user, auth, no_pipeline):
    headers = _api_key(client, paid_user, auth)
    created = _create(client, headers, script_review_enabled=True)
    assert created.status_code == 202, created.text
    video_id = created.json()["video_id"]
    assert db_session.get(Project, video_id).script_review_enabled is True
    assert (video_id, paid_user.id) in no_pipeline
    # Off by default.
    plain = _create(client, headers).json()["video_id"]
    assert db_session.get(Project, plain).script_review_enabled is False


def test_full_video_payload(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    video_id = _create(client, headers).json()["video_id"]
    db_session.add(Scene(project_id=video_id, order=1, title="Intro", narration_text="Hello", visual_description="v", duration_seconds=5))
    db_session.commit()

    full = client.get(f"{V1}/videos/{video_id}", headers=headers)
    assert full.status_code == 200, full.text
    body = full.json()
    assert "/embed/" in body["preview_url"] and "<iframe" in body["embed_html"]
    assert body["project"]["scenes"][0]["title"] == "Intro"
    assert "voiceover_url" in body["project"]["scenes"][0]
    assert "assets" in body["project"]


def test_api_key_cannot_reach_other_users_or_web_projects(client, db_session, paid_user, other_user, auth):
    mine = _api_key(client, paid_user, auth)
    theirs = _api_key(client, other_user, auth)
    video_id = _create(client, mine).json()["video_id"]
    assert client.get(f"{V1}/videos/{video_id}", headers=theirs).status_code == 404
    assert client.patch(f"{V1}/videos/{video_id}", headers=theirs, json={"accent_color": "#000000"}).status_code == 404

    # A project the user made in the web app is not an API video.
    web = Project(user_id=paid_user.id, name="web", status=ProjectStatus.CREATED)
    db_session.add(web)
    db_session.commit()
    assert client.get(f"{V1}/videos/{web.id}", headers=mine).status_code == 404


def test_edit_through_api_updates_project(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    video_id = _create(client, headers).json()["video_id"]
    scene = Scene(project_id=video_id, order=1, title="Intro", narration_text="Hello", visual_description="v", duration_seconds=5)
    db_session.add(scene)
    db_session.commit()

    patched = client.patch(f"{V1}/videos/{video_id}/scenes/{scene.id}", headers=headers, json={"title": "New title"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["title"] == "New title"



# ─── One key serving an app's own users ─────────────────────────────────────

def test_one_key_serves_many_end_users(client, db_session, paid_user, auth, no_pipeline):
    headers = _api_key(client, paid_user, auth)
    before = paid_user.videos_used_this_period or 0
    url = "https://example.com/same-article"

    a = client.post(f"{V1}/videos", headers=headers, json={"url": url, "external_user_id": "u1"})
    b = client.post(f"{V1}/videos", headers=headers, json={"url": url, "external_user_id": "u2"})
    assert a.status_code == 202 and b.status_code == 202, (a.text, b.text)
    # Same URL, same owner, still two videos: no in-flight dedup across end users.
    assert a.json()["video_id"] != b.json()["video_id"]

    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == before + 2
    for video_id in (a.json()["video_id"], b.json()["video_id"]):
        assert db_session.get(Project, video_id).user_id == paid_user.id

    only_u1 = client.get(f"{V1}/videos", headers=headers, params={"external_user_id": "u1"}).json()["items"]
    assert [v["video_id"] for v in only_u1] == [a.json()["video_id"]]
    assert only_u1[0]["external_user_id"] == "u1"
    everything = client.get(f"{V1}/videos", headers=headers).json()["items"]
    assert {v["video_id"] for v in everything} == {a.json()["video_id"], b.json()["video_id"]}


def test_quota_exhausted_returns_402_and_credits_raise_it(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    me = client.get(f"{V1}/me", headers=headers).json()
    paid_user.videos_used_this_period = me["video_limit"]
    db_session.commit()

    refused = _create(client, headers)
    assert refused.status_code == 402
    assert refused.json()["detail"]["error"] == "quota_exceeded"
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == me["video_limit"]
    assert client.get(f"{V1}/me", headers=headers).json()["can_create_video"] is False

    # Topping up with per-video credits lets the key create again.
    paid_user.video_limit_bonus = (paid_user.video_limit_bonus or 0) + 1
    db_session.commit()
    after = client.get(f"{V1}/me", headers=headers).json()
    assert after["video_limit"] == me["video_limit"] + 1
    assert after["videos_remaining"] == 1 and after["video_credits"] >= 1
    assert _create(client, headers).status_code == 202
    assert _create(client, headers).status_code == 402


def test_failed_video_whose_project_was_deleted_reports_failed(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    video_id = _create(client, headers).json()["video_id"]
    db_session.delete(db_session.get(Project, video_id))
    db_session.commit()
    polled = client.get(f"{V1}/videos/{video_id}/status", headers=headers)
    assert polled.status_code == 200 and polled.json()["status"] == "failed"
    assert client.get(f"{V1}/videos/{video_id}", headers=headers).status_code == 404


# ─── Live preview ───────────────────────────────────────────────────────────

def test_preview_socket_receives_api_edits(client, db_session, paid_user, auth, monkeypatch):
    headers = _api_key(client, paid_user, auth)
    video_id = _create(client, headers).json()["video_id"]
    scene = Scene(project_id=video_id, order=1, title="Intro", narration_text="Hello", visual_description="v", duration_seconds=5)
    db_session.add(scene)
    db_session.commit()
    token = client.get(f"{V1}/videos/{video_id}", headers=headers).json()["preview_url"].rsplit("/", 1)[-1]

    class _SharedSession:
        def __getattr__(self, name):
            return getattr(db_session, name)

        def close(self):
            pass

    monkeypatch.setattr("app.routers.embed.SessionLocal", lambda: _SharedSession())

    with client.websocket_connect(f"/api/embed/project/{token}/live") as ws:
        resp = client.patch(f"{V1}/videos/{video_id}/scenes/{scene.id}", headers=headers, json={"title": "Live title"})
        assert resp.status_code == 200
        message = ws.receive_json()
        assert message["type"] in ("edit", "project_reloaded")


def test_embed_lite_refresh_skips_template_code(client, db_session, paid_user, auth):
    headers = _api_key(client, paid_user, auth)
    theme = {"colors": {"accent": "#FF5A1F", "bg": "#0B0B0F", "text": "#FFFFFF"}, "fonts": {"heading": "Inter"}}
    created = client.post("/api/custom-templates", headers=headers, json={"name": "Brand", "theme": theme})
    assert created.status_code == 200, created.text
    template_id = created.json()["id"]
    video_id = _create(client, headers, template=f"custom_{template_id}").json()["video_id"]
    preview_url = client.get(f"{V1}/videos/{video_id}", headers=headers).json()["preview_url"]
    assert "/embed/" in preview_url
    token = preview_url.rsplit("/", 1)[-1]

    full = client.get(f"/api/embed/project/{token}").json()
    lite = client.get(f"/api/embed/project/{token}", params={"lite": 1}).json()
    assert full["custom_template_code"] is not None
    assert lite["custom_template_code"] is None and lite["crafted_template"] is None
    assert lite["layout_prop_schema"] is None
    # Same project data and theme, so the player can apply it without the code.
    assert lite["template"] == full["template"] == f"custom_{template_id}"
    assert lite["custom_theme"] == full["custom_theme"] and lite["custom_theme"]
    assert [s["id"] for s in lite["scenes"]] == [s["id"] for s in full["scenes"]]


def test_preview_socket_rejects_unknown_token(client, monkeypatch, db_session):
    from starlette.websockets import WebSocketDisconnect

    class _SharedSession:
        def __getattr__(self, name):
            return getattr(db_session, name)

        def close(self):
            pass

    monkeypatch.setattr("app.routers.embed.SessionLocal", lambda: _SharedSession())
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/embed/project/nope/live") as ws:
            ws.receive_text()
