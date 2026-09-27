"""Contract tests for the site-scoped WordPress connector."""

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.models.saved_voice import SavedVoice
from app.models.custom_video_style import CustomVideoStyle
from app.models.user_video_style import UserVideoStyleSlot
from app.models.wordpress_integration import WordPressConnection, WordPressProjectLink


ROOT = "/api/integrations/wordpress/v1"


def _connect(client, user, auth):
    begun = client.post(
        f"{ROOT}/connections/begin",
        json={"site_url": "https://publisher.example", "site_name": "Publisher"},
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
    assert approved.json()["site_url"] == "https://publisher.example"

    exchanged = client.post(
        f"{ROOT}/connections/token",
        json={"connection_id": challenge["connection_id"], "device_code": challenge["device_code"]},
    )
    assert exchanged.status_code == 200
    token = exchanged.json()["access_token"]
    assert token.startswith("b2v_wp_")
    return challenge["connection_id"], {"Authorization": f"Bearer {token}"}


def test_localwp_http_origin_is_allowed(client):
    response = client.post(
        f"{ROOT}/connections/begin",
        json={"site_url": "http://test.local", "site_name": "LocalWP test"},
    )
    assert response.status_code == 201


def test_connection_token_is_site_scoped_and_returned_once(client, db_session, paid_user, auth):
    connection_id, headers = _connect(client, paid_user, auth)

    custom_style = CustomVideoStyle(
        user_id=paid_user.id,
        name="Concise",
        guidance="Use concise sentences and move directly to the key insight.",
    )
    db_session.add(custom_style)
    db_session.flush()
    db_session.add_all([
        UserVideoStyleSlot(user_id=paid_user.id, position=0, builtin_key="explainer"),
        UserVideoStyleSlot(user_id=paid_user.id, position=1, builtin_key="storytelling"),
        UserVideoStyleSlot(user_id=paid_user.id, position=2, custom_style_id=custom_style.id),
    ])
    db_session.commit()

    account = client.get(f"{ROOT}/account", headers=headers)
    assert account.status_code == 200
    assert account.json()["email"] == paid_user.email
    assert account.json()["site_url"] == "https://publisher.example"

    connection = db_session.get(WordPressConnection, connection_id)
    assert connection.pending_access_token is None
    assert connection.access_token_hash
    assert "b2v_wp_" not in connection.access_token_hash

    catalog = client.get(f"{ROOT}/catalog", headers=headers)
    assert catalog.status_code == 200
    assert catalog.json()["templates"]
    nightfall = next(item for item in catalog.json()["templates"] if item["id"] == "nightfall")
    assert nightfall["preview_url"].endswith("/mcp-ui/template-previews/nightfall.png")
    assert "voices" in catalog.json()
    assert catalog.json()["video_styles"]["selected_ids"] == [
        "explainer",
        "storytelling",
        f"custom:{custom_style.id}",
    ]
    catalog_styles_by_id = {
        style["id"]: style for style in catalog.json()["video_styles"]["styles"]
    }
    assert catalog_styles_by_id[f"custom:{custom_style.id}"]["name"] == "Concise"
    video_styles = client.get(f"{ROOT}/video-styles", headers=headers)
    assert video_styles.status_code == 200
    styles_by_id = {style["id"]: style for style in video_styles.json()["styles"]}
    assert video_styles.json()["selected_ids"] == [
        "explainer",
        "storytelling",
        f"custom:{custom_style.id}",
    ]
    assert video_styles.json()["auto_style"]["id"] == "auto"
    assert styles_by_id[f"custom:{custom_style.id}"]["name"] == "Concise"
    assert [video_styles.json()["auto_style"]["id"], *video_styles.json()["selected_ids"]] == [
        "auto",
        "explainer",
        "storytelling",
        f"custom:{custom_style.id}",
    ]


def test_direct_post_ingestion_is_idempotent(client, db_session, paid_user, auth, monkeypatch):
    _connection_id, headers = _connect(client, paid_user, auth)
    started = []
    monkeypatch.setattr(
        "app.routers.wordpress_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: started.append((project_id, user_id)),
    )
    payload = {
        "external_post_id": "42",
        "idempotency_key": "publisher-42-revision-123",
        "content_hash": "a" * 64,
        "title": "A WordPress article",
        "canonical_url": "https://publisher.example/an-article/",
        "content": "This is the directly supplied article body. " * 8,
        "template": "default",
        "video_style": "explainer",
        "video_length": "short",
        "aspect_ratio": "landscape",
        "voice_gender": "female",
        "voice_accent": "american",
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
    assert project.blog_content.startswith("This is the directly supplied")
    assert db_session.query(WordPressProjectLink).count() == 1


def test_free_account_at_video_limit_cannot_create_wordpress_project(
    client, db_session, free_user, auth, monkeypatch
):
    free_user.videos_used_this_period = free_user.video_limit
    db_session.commit()
    _connection_id, headers = _connect(client, free_user, auth)
    started = []
    monkeypatch.setattr(
        "app.routers.wordpress_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: started.append((project_id, user_id)),
    )

    account = client.get(f"{ROOT}/account", headers=headers)
    assert account.status_code == 200
    assert account.json()["plan"] == "free"
    assert account.json()["videos_used"] == free_user.video_limit
    assert account.json()["video_limit"] == free_user.video_limit
    assert account.json()["can_create_video"] is False

    response = client.post(
        f"{ROOT}/projects",
        headers=headers,
        json={
            "external_post_id": "free-limit-post",
            "idempotency_key": "free-limit-revision",
            "content_hash": "f" * 64,
            "title": "Free account at its video limit",
            "canonical_url": "https://publisher.example/free-limit/",
            "content": "This content must not start a project when the account quota is exhausted. " * 3,
        },
    )

    assert response.status_code == 403
    assert "Video limit reached" in response.json()["detail"]
    assert started == []
    assert db_session.query(WordPressProjectLink).count() == 0


def test_url_source_is_scraped_by_pipeline(client, db_session, paid_user, auth, monkeypatch):
    _connection_id, headers = _connect(client, paid_user, auth)
    db_session.add(SavedVoice(user_id=paid_user.id, voice_id="saved-voice-123", name="Test narrator"))
    db_session.commit()
    started = []
    monkeypatch.setattr(
        "app.routers.wordpress_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: started.append((project_id, user_id)),
    )
    payload = {
        "external_post_id": "43",
        "idempotency_key": "publisher-43-url-revision-123",
        "content_hash": "b" * 64,
        "title": "A video from another article",
        "canonical_url": "https://publisher.example/video-post/",
        "source_type": "url",
        "source_url": "https://example.com/source-article/",
        "custom_voice_id": "saved-voice-123",
    }

    response = client.post(f"{ROOT}/projects", headers=headers, json=payload)
    assert response.status_code == 202
    project = db_session.get(Project, response.json()["project_id"])
    assert project.blog_url == "https://example.com/source-article/"
    assert project.blog_content is None
    assert project.custom_voice_id == "saved-voice-123"
    assert project.status == ProjectStatus.CREATED
    assert len(started) == 1

    editor = client.get(f"{ROOT}/projects/{project.id}/editor", headers=headers)
    assert editor.status_code == 200
    assert editor.json()["resolved_voice_id"] == "saved-voice-123"
    assert editor.json()["voice_name"] == "Test narrator"


def test_native_scene_editor_is_available_only_through_the_site_scoped_project(
    client, db_session, paid_user, auth, monkeypatch
):
    _connection_id, headers = _connect(client, paid_user, auth)
    monkeypatch.setattr(
        "app.routers.wordpress_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: None,
    )
    created = client.post(
        f"{ROOT}/projects",
        headers=headers,
        json={
            "external_post_id": "native-editor-1",
            "idempotency_key": "native-editor-revision-1",
            "content_hash": "c" * 64,
            "title": "Native scene editor",
            "canonical_url": "https://publisher.example/native-editor/",
            "content": "Content supplied directly by WordPress for the native scene editor. " * 3,
        },
    )
    assert created.status_code == 202
    project_id = created.json()["project_id"]
    assert created.json()["editor_available"] is True
    assert "editor_url" not in created.json()

    scene = Scene(
        project_id=project_id,
        order=1,
        title="Opening",
        display_text="Existing on-screen copy",
        narration_text="Existing narration",
        visual_description="Existing visual direction",
        duration_seconds=8.5,
        remotion_code='{"layout":"text_narration","layoutProps":{"titleFontSize":72}}',
    )
    db_session.add(scene)
    db_session.commit()
    editor = client.get(f"{ROOT}/projects/{project_id}/editor", headers=headers)
    assert editor.status_code == 200
    assert editor.json()["scenes"][0]["title"] == "Opening"
    assert editor.json()["scenes"][0]["display_text"] == "Existing on-screen copy"
    assert editor.json()["scenes"][0]["duration_seconds"] == 8.5
    assert "titleFontSize" in editor.json()["scenes"][0]["remotion_code"]
    assert editor.json()["resolved_voice_id"] == "dfeOmy6Uay63tNhyO99j"
    assert editor.json()["voice_name"] == "Kristen"

    library = client.get(f"{ROOT}/library/projects", headers=headers)
    assert library.status_code == 200
    library_project = next(item for item in library.json() if item["id"] == project_id)
    assert library_project["name"] == "Native scene editor"
    assert library_project["linked_to_site"] is True

    selected = client.post(
        f"{ROOT}/library/projects/{project_id}/link",
        headers=headers,
        json={"external_post_id": "wordpress-post-99"},
    )
    assert selected.status_code == 200
    assert selected.json()["project_id"] == project_id
    assert selected.json()["name"] == "Native scene editor"

    observed = {}

    def fake_update(project_id, scene_id, data, user, db):
        observed.update(
            project_id=project_id,
            scene_id=scene_id,
            title=data.title,
            narration_text=data.narration_text,
        )
        return {"id": scene_id, "title": data.title, "narration_text": data.narration_text}

    monkeypatch.setattr(
        "app.routers.wordpress_integration.projects.update_scene",
        fake_update,
    )
    updated = client.put(
        f"{ROOT}/projects/{project_id}/scenes/{scene.id}",
        headers=headers,
        json={"title": "Revised opening", "narration_text": "Read this revised line."},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Revised opening"
    assert observed == {
        "project_id": project_id,
        "scene_id": scene.id,
        "title": "Revised opening",
        "narration_text": "Read this revised line.",
    }

    async def fake_regenerate_script(project_id, body, user, db):
        observed.update(script_project_id=project_id, instruction=body.user_instruction)
        return {
            "id": 91,
            "project_id": project_id,
            "user_id": user.id,
            "status": "queued",
            "current_step": "analyzing_instruction",
            "total_scenes": 0,
            "processed_scenes": 0,
            "user_instruction": body.user_instruction,
            "created_at": "2026-09-24T00:00:00",
            "updated_at": "2026-09-24T00:00:00",
        }

    monkeypatch.setattr(
        "app.routers.wordpress_integration.projects.regenerate_script",
        fake_regenerate_script,
    )
    regenerated = client.post(
        f"{ROOT}/projects/{project_id}/script/regenerate",
        headers=headers,
        json={"user_instruction": "Make the full script shorter and friendlier."},
    )
    assert regenerated.status_code == 200
    assert regenerated.json()["status"] == "queued"
    assert observed["script_project_id"] == project_id
    assert observed["instruction"] == "Make the full script shorter and friendlier."

    async def fake_update_scene_image(project_id, scene_id, image, user, db):
        observed.update(
            image_project_id=project_id,
            image_scene_id=scene_id,
            image_filename=image.filename,
        )
        return {"id": scene_id, "uploaded": True}

    monkeypatch.setattr(
        "app.routers.wordpress_integration.projects.update_scene_image",
        fake_update_scene_image,
    )
    uploaded = client.post(
        f"{ROOT}/projects/{project_id}/scenes/{scene.id}/image",
        headers=headers,
        files={"image": ("replacement.png", b"test-image", "image/png")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["uploaded"] is True
    assert observed["image_project_id"] == project_id
    assert observed["image_scene_id"] == scene.id
    assert observed["image_filename"] == "replacement.png"


def test_embedded_preview_restores_its_wordpress_project_link(
    client, db_session, paid_user, auth, monkeypatch
):
    _connection_id, headers = _connect(client, paid_user, auth)
    monkeypatch.setattr(
        "app.routers.wordpress_integration.pipeline.start_pipeline_background",
        lambda project_id, user_id, loop: None,
    )
    created = client.post(
        f"{ROOT}/projects",
        headers=headers,
        json={
            "external_post_id": "embedded-post",
            "idempotency_key": "embedded-post-revision-1",
            "content_hash": "e" * 64,
            "title": "Persisted embedded video",
            "canonical_url": "https://publisher.example/embedded-post/",
            "content": "Content used to create a project whose embed remains in WordPress. " * 3,
        },
    )
    assert created.status_code == 202
    project = db_session.get(Project, created.json()["project_id"])
    # Legacy embeds used shorter tokens; these must still restore in WordPress.
    project.embed_token = "a" * 60
    db_session.commit()

    restored = client.post(
        f"{ROOT}/library/projects/resolve-embed",
        headers=headers,
        json={
            "external_post_id": "embedded-post",
            "embed_url": f"http://localhost:5173/preview/{project.embed_token}",
        },
    )
    assert restored.status_code == 200
    assert restored.json()["project_id"] == project.id
    assert restored.json()["name"] == "Persisted embedded video"

    invalid = client.post(
        f"{ROOT}/library/projects/resolve-embed",
        headers=headers,
        json={
            "external_post_id": "embedded-post",
            "embed_url": "http://localhost:5173/not-a-preview/token",
        },
    )
    assert invalid.status_code == 400


def test_revocation_immediately_blocks_site_token(client, paid_user, auth):
    _connection_id, headers = _connect(client, paid_user, auth)
    revoked = client.post(f"{ROOT}/connections/revoke", headers=headers)
    assert revoked.status_code == 200
    assert client.get(f"{ROOT}/account", headers=headers).status_code == 401
