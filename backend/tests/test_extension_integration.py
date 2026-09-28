"""Contract tests for the install-scoped browser-extension connector."""

from app.models.project import Project, ProjectStatus
from app.models.extension_integration import ExtensionConnection, ExtensionProjectLink


ROOT = "/api/integrations/extension/v1"


def _connect(client, user, auth):
    begun = client.post(
        f"{ROOT}/connections/begin",
        json={"browser_label": "Chrome — Test Machine"},
    )
    assert begun.status_code == 201
    challenge = begun.json()

    pending = client.post(
        f"{ROOT}/connections/token",
        json={"connection_id": challenge["connection_id"], "device_code": challenge["device_code"]},
    )
    assert pending.status_code == 200
    assert pending.json()["status"] == "authorization_pending"

    approved = client.post(
        f"{ROOT}/connections/approve",
        headers=auth(user),
        json={"user_code": challenge["user_code"]},
    )
    assert approved.status_code == 200
    assert approved.json()["browser_label"] == "Chrome — Test Machine"

    exchanged = client.post(
        f"{ROOT}/connections/token",
        json={"connection_id": challenge["connection_id"], "device_code": challenge["device_code"]},
    )
    assert exchanged.status_code == 200
    token = exchanged.json()["access_token"]
    assert token.startswith("b2v_ext_")
    return challenge["connection_id"], {"Authorization": f"Bearer {token}"}


def test_connection_token_is_install_scoped_and_returned_once(client, db_session, paid_user, auth):
    connection_id, headers = _connect(client, paid_user, auth)

    account = client.get(f"{ROOT}/account", headers=headers)
    assert account.status_code == 200
    assert account.json()["email"] == paid_user.email

    connection = db_session.get(ExtensionConnection, connection_id)
    assert connection.pending_access_token is None
    assert connection.access_token_hash
    assert "b2v_ext_" not in connection.access_token_hash

    catalog = client.get(f"{ROOT}/catalog", headers=headers)
    assert catalog.status_code == 200
    assert catalog.json()["templates"]
    nightfall = next(item for item in catalog.json()["templates"] if item["id"] == "nightfall")
    assert nightfall["preview_url"].endswith("/mcp-ui/template-previews/nightfall.png")
    assert "voices" in catalog.json()


def test_project_creation_is_idempotent_and_tracks_current_project(client, db_session, paid_user, auth, monkeypatch):
    _connection_id, headers = _connect(client, paid_user, auth)
    started = []
    monkeypatch.setattr(
        "app.routers.extension_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: started.append((project_id, user_id)),
    )
    payload = {
        "source_url": "https://example.com/an-article/",
        "content": "This is the article text extracted from the page. " * 8,
        "idempotency_key": "tab-42-revision-123",
        "content_hash": "a" * 64,
        "title": "An article",
        "template": "default",
        "video_style": "explainer",
        "video_length": "short",
        "aspect_ratio": "landscape",
        "logo_position": "top_right",
        "logo_opacity": 0.75,
        "voice_gender": "female",
        "voice_accent": "american",
        "stock_footage_enabled": True,
        "script_review_enabled": True,
    }

    first = client.post(f"{ROOT}/projects", headers=headers, json=payload)
    second = client.post(f"{ROOT}/projects", headers=headers, json=payload)
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["project_id"] == second.json()["project_id"]
    assert second.json()["state"] == "existing"
    assert len(started) == 1

    project = db_session.get(Project, first.json()["project_id"])
    assert project.status == ProjectStatus.SCRAPED
    assert project.blog_content.startswith("This is the article text")
    assert project.video_style == "explainer"
    assert project.video_length == "short"
    assert project.aspect_ratio == "landscape"
    assert project.logo_position == "top_right"
    assert project.logo_opacity == 0.75
    assert project.stock_footage_enabled is True
    assert project.script_review_enabled is True
    assert db_session.query(ExtensionProjectLink).count() == 1

    current = client.get(f"{ROOT}/projects/current", headers=headers)
    assert current.status_code == 200
    assert current.json()["project_id"] == first.json()["project_id"]

    # "Create another video" may use the same page with a different template
    # or voice after the current project is finished. A new idempotency key then
    # intentionally creates a new project.
    project.status = ProjectStatus.DONE
    db_session.commit()
    third = client.post(
        f"{ROOT}/projects",
        headers=headers,
        json={**payload, "idempotency_key": "tab-42-revision-456", "content_hash": "b" * 64},
    )
    assert third.status_code == 202
    assert third.json()["project_id"] != first.json()["project_id"]
    assert third.json()["state"] == "queued"
    assert len(started) == 2

    current = client.get(f"{ROOT}/projects/current", headers=headers)
    assert current.json()["project_id"] == third.json()["project_id"]

    cleared = client.delete(f"{ROOT}/projects/current", headers=headers)
    assert cleared.status_code == 204
    assert client.get(f"{ROOT}/projects/current", headers=headers).json() is None


def test_project_creation_rejects_short_content(client, paid_user, auth):
    _connection_id, headers = _connect(client, paid_user, auth)
    response = client.post(
        f"{ROOT}/projects",
        headers=headers,
        json={
            "source_url": "https://example.com/short/",
            "content": "Too short.",
            "idempotency_key": "tab-short-1",
            "content_hash": "c" * 64,
            "title": "Too short",
        },
    )
    assert response.status_code == 422


def test_status_and_render_are_scoped_to_the_linked_project(client, db_session, paid_user, auth, monkeypatch):
    _connection_id, headers = _connect(client, paid_user, auth)
    monkeypatch.setattr(
        "app.routers.extension_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: None,
    )
    created = client.post(
        f"{ROOT}/projects",
        headers=headers,
        json={
            "source_url": "https://example.com/status-check/",
            "content": "Content for the status/render scoping test. " * 6,
            "idempotency_key": "tab-status-1",
            "content_hash": "d" * 64,
            "title": "Status check",
        },
    )
    assert created.status_code == 202
    project_id = created.json()["project_id"]

    status_resp = client.get(f"{ROOT}/projects/{project_id}/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["project_id"] == project_id
    assert status_resp.json()["editor_available"] is True

    # A project this connection hasn't linked (or that doesn't exist) is 404,
    # not leaked across connections.
    other = client.get(f"{ROOT}/projects/{project_id + 999}/status", headers=headers)
    assert other.status_code == 404


def test_revocation_immediately_blocks_install_token(client, paid_user, auth):
    _connection_id, headers = _connect(client, paid_user, auth)
    revoked = client.post(f"{ROOT}/connections/revoke", headers=headers)
    assert revoked.status_code == 200
    assert client.get(f"{ROOT}/account", headers=headers).status_code == 401
