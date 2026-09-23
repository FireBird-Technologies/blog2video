import asyncio
from contextlib import nullcontext
from datetime import datetime
from types import SimpleNamespace
import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene

pytestmark = pytest.mark.depth


def _paused_project(db, user):
    project = Project(
        user_id=user.id,
        name="Review me",
        blog_url="https://review.test",
        status=ProjectStatus.AWAITING_SCRIPT_REVIEW,
        script_review_enabled=True,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    scenes = [
        Scene(
            project_id=project.id,
            order=i,
            title=f"Scene {i}",
            narration_text=f"Narration {i}",
            display_text=f"Display {i}",
            visual_description=f"Visual {i}",
        )
        for i in (1, 2)
    ]
    db.add_all(scenes)
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return project, scenes


def test_approve_review_saves_all_scenes_then_resumes(client, db_session, paid_user, auth, monkeypatch):
    from app.routers import pipeline, projects
    from app.services import script_preferences
    from app.models.script_preference_learning_job import ScriptPreferenceLearningJob

    monkeypatch.setattr(pipeline, "_run_pipeline_sync", lambda *_args: None)
    monkeypatch.setattr(script_preferences, "dispatch_preference_learning_job", lambda *_args: None)
    project, scenes = _paused_project(db_session, paid_user)
    scenes[0].preferred_layout = "bullet_list"
    scenes[1].preferred_layout = "quote_callout"
    db_session.commit()
    response = client.post(
        f"/api/projects/{project.id}/script-review/approve",
        headers=auth(paid_user),
        json={
            "scenes": [
                {
                    "id": scene.id,
                    "title": f"Edited {scene.order}",
                    "narration_text": f"Approved narration {scene.order}",
                    "display_text": f"Approved display {scene.order}",
                    "source_fingerprint": projects._review_fingerprint(
                        f"Edited {scene.order}",
                        f"Approved display {scene.order}",
                        f"Approved narration {scene.order}",
                    ),
                    "preferred_layout": "quote_callout" if scene.order == 1 else "bullet_list",
                }
                for scene in scenes
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["project"]["id"] == project.id
    assert response.json()["preference_learning"] == "queued"
    db_session.expire_all()
    saved_project = db_session.get(Project, project.id)
    assert saved_project.status == ProjectStatus.SCRIPTED
    assert saved_project.script_review_approved_at is not None
    saved_scenes = db_session.query(Scene).filter_by(project_id=project.id).order_by(Scene.order).all()
    assert [scene.narration_text for scene in saved_scenes] == [
        "Approved narration 1",
        "Approved narration 2",
    ]
    assert [scene.visual_description for scene in saved_scenes] == ["Visual 1", "Visual 2"]
    assert [scene.preferred_layout for scene in saved_scenes] == ["quote_callout", "bullet_list"]
    # Voiceover generation starts only after this atomic approval boundary.
    assert all(scene.voiceover_path is None for scene in saved_scenes)
    job = db_session.query(ScriptPreferenceLearningJob).filter_by(project_id=project.id).one()
    assert job.user_id == paid_user.id
    assert "preferred_layout" not in job.evidence_json


def test_reopened_review_creates_a_new_evidence_specific_preference_job(
    client, db_session, paid_user, auth, monkeypatch
):
    from app.routers import pipeline, projects
    from app.services import script_preferences
    from app.models.script_preference_learning_job import ScriptPreferenceLearningJob

    dispatched = []
    monkeypatch.setattr(pipeline, "_run_pipeline_sync", lambda *_args: None)
    monkeypatch.setattr(
        script_preferences,
        "dispatch_preference_learning_job",
        lambda job_id: dispatched.append(job_id),
    )
    project, scenes = _paused_project(db_session, paid_user)

    def approve(first_title: str):
        payload = []
        for index, scene in enumerate(scenes):
            title = first_title if index == 0 else scene.title
            payload.append({
                "id": scene.id,
                "title": title,
                "narration_text": scene.narration_text,
                "display_text": scene.display_text,
                "source_fingerprint": projects._review_fingerprint(
                    title, scene.display_text or "", scene.narration_text or ""
                ) if title != scene.title else None,
                "preferred_layout": scene.preferred_layout,
            })
        return client.post(
            f"/api/projects/{project.id}/script-review/approve",
            headers=auth(paid_user),
            json={"scenes": payload},
        )

    first = approve("First accepted title")
    assert first.status_code == 200

    db_session.expire_all()
    project = db_session.get(Project, project.id)
    scenes = db_session.query(Scene).filter_by(project_id=project.id).order_by(Scene.order).all()
    project.status = ProjectStatus.AWAITING_SCRIPT_REVIEW
    project.script_review_approved_at = None
    db_session.commit()

    second = approve("Second accepted title")
    assert second.status_code == 200

    jobs = (
        db_session.query(ScriptPreferenceLearningJob)
        .filter_by(project_id=project.id)
        .order_by(ScriptPreferenceLearningJob.id)
        .all()
    )
    assert len(jobs) == 2
    assert jobs[0].idempotency_key != jobs[1].idempotency_key
    assert all(job.idempotency_key.startswith(f"initial-review:{project.id}:") for job in jobs)
    assert dispatched == [jobs[0].id, jobs[1].id]


def test_unchanged_review_skips_preference_job(client, db_session, paid_user, auth, monkeypatch):
    from app.routers import pipeline
    from app.models.script_preference_learning_job import ScriptPreferenceLearningJob

    monkeypatch.setattr(pipeline, "_run_pipeline_sync", lambda *_args: None)
    project, scenes = _paused_project(db_session, paid_user)
    response = client.post(
        f"/api/projects/{project.id}/script-review/approve",
        headers=auth(paid_user),
        json={"scenes": [{
            "id": scene.id,
            "title": scene.title,
            "narration_text": scene.narration_text,
            "display_text": scene.display_text,
        } for scene in scenes]},
    )
    assert response.status_code == 200
    assert response.json()["preference_learning"] == "unchanged"
    assert db_session.query(ScriptPreferenceLearningJob).filter_by(project_id=project.id).count() == 0


def test_review_allows_hidden_countdown_with_blank_title_and_display(
    client, db_session, paid_user, auth, monkeypatch
):
    from app.routers import pipeline

    monkeypatch.setattr(pipeline, "_run_pipeline_sync", lambda *_args: None)
    project, scenes = _paused_project(db_session, paid_user)
    countdown = scenes[0]
    countdown.preferred_layout = "docreel_countdown"
    countdown.title = ""
    countdown.display_text = ""
    db_session.commit()

    response = client.post(
        f"/api/projects/{project.id}/script-review/approve",
        headers=auth(paid_user),
        json={
            "scenes": [
                {
                    "id": scene.id,
                    "title": scene.title,
                    "narration_text": scene.narration_text,
                    "display_text": scene.display_text,
                    "preferred_layout": scene.preferred_layout,
                }
                for scene in scenes
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["preference_learning"] == "unchanged"
    db_session.refresh(project)
    assert project.status == ProjectStatus.SCRIPTED


def test_approve_review_rejects_partial_scene_list(client, db_session, paid_user, auth):
    project, scenes = _paused_project(db_session, paid_user)
    response = client.post(
        f"/api/projects/{project.id}/script-review/approve",
        headers=auth(paid_user),
        json={
            "scenes": [{
                "id": scenes[0].id,
                "title": "Only one",
                "narration_text": "Still only one",
                "display_text": "",
                "preferred_layout": None,
            }]
        },
    )

    assert response.status_code == 400
    db_session.refresh(project)
    assert project.status == ProjectStatus.AWAITING_SCRIPT_REVIEW
    assert project.script_review_approved_at is None


def test_title_and_display_preview_regenerates_read_only_narration(
    client, db_session, paid_user, auth, monkeypatch
):
    from app.dspy_modules import script_review

    project, scenes = _paused_project(db_session, paid_user)
    captured = {}

    async def fake_derive(**kwargs):
        captured.update(kwargs)
        return f"Narration from {kwargs['title']} and {kwargs['display_text']}"

    monkeypatch.setattr(script_review, "derive_narration", fake_derive)
    response = client.post(
        f"/api/projects/{project.id}/script-review/scenes/{scenes[0].id}/narration-preview",
        headers=auth(paid_user),
        json={
            "title": "A warmer title",
            "display_text": "A concise on-screen hook",
            "narration_text": scenes[0].narration_text,
            "revision": 7,
            "draft_scenes": [{
                "id": scene.id,
                "title": scene.title,
                "display_text": scene.display_text,
                "narration_text": scene.narration_text,
            } for scene in scenes],
        },
    )
    assert response.status_code == 200
    assert response.json()["revision"] == 7
    assert response.json()["narration_text"] == "Narration from A warmer title and A concise on-screen hook"
    assert captured["title"] == "A warmer title"
    assert captured["display_text"] == "A concise on-screen hook"
    assert len(response.json()["source_fingerprint"]) == 64


def test_ai_scene_instruction_is_applied_to_derived_narration(monkeypatch):
    from app.dspy_modules import script_review

    captured = {}

    async def fake_rewrite(**_kwargs):
        return SimpleNamespace(
            title_out="A funnier title",
            display_text_out="A playful on-screen setup",
        )

    async def fake_derive(**kwargs):
        captured.update(kwargs)
        return "A playful spoken follow-through."

    monkeypatch.setattr(script_review, "ensure_dspy_configured", lambda: None)
    monkeypatch.setattr(script_review, "get_scene_lm", lambda: object())
    monkeypatch.setattr(script_review.dspy, "ChainOfThought", lambda _signature: object())
    monkeypatch.setattr(script_review.dspy, "asyncify", lambda _predictor: fake_rewrite)
    monkeypatch.setattr(script_review.dspy, "context", lambda **_kwargs: nullcontext())
    monkeypatch.setattr(script_review, "derive_narration", fake_derive)

    title, display, narration = asyncio.run(script_review.rewrite_scene(
        source="Source facts",
        draft_scenes=[{
            "title": "Original title",
            "display_text": "Original display",
            "narration": "Original narration",
        }],
        scene_index=0,
        title="Original title",
        display_text="Original display",
        current_narration="Original narration",
        instruction="Make the entire scene funny but professional",
        style_guidance="Use an explanatory style",
        content_language="English",
    ))

    assert (title, display, narration) == (
        "A funnier title",
        "A playful on-screen setup",
        "A playful spoken follow-through.",
    )
    assert captured["scene_instruction"] == "Make the entire scene funny but professional"


def test_restarted_scripted_project_still_stops_before_voiceover(db_session, paid_user, monkeypatch):
    from app.routers import pipeline

    project = Project(
        user_id=paid_user.id,
        name="Restart boundary",
        blog_url="https://restart.test",
        status=ProjectStatus.SCRIPTED,
        script_review_enabled=True,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    project_id = project.id
    user_id = paid_user.id

    async def fail_if_called(*_args, **_kwargs):
        raise AssertionError("scene/voiceover generation must not run before review")

    monkeypatch.setattr(pipeline, "_generate_scenes", fail_if_called)
    monkeypatch.setattr(pipeline, "SessionLocal", lambda: db_session)
    pipeline._pipeline_progress[project_id] = {
        "step": 2,
        "running": True,
        "error": None,
        "notice": None,
    }
    asyncio.run(pipeline._run_pipeline(project_id, user_id))

    db_session.expire_all()
    assert db_session.get(Project, project_id).status == ProjectStatus.AWAITING_SCRIPT_REVIEW
    assert pipeline._pipeline_progress[project_id]["running"] is False


def test_pipeline_speaks_reviewed_narration_verbatim(db_session, paid_user, monkeypatch):
    """After approval, voiceover generation must not silently rephrase the user's edits."""
    from app.routers import pipeline

    project = Project(
        user_id=paid_user.id,
        name="Verbatim after review",
        blog_url="https://verbatim.test",
        status=ProjectStatus.SCRIPTED,
        script_review_enabled=True,
        script_review_approved_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    project_id = project.id
    user_id = paid_user.id

    calls = []

    async def record_call(*_args, **kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(pipeline, "_generate_scenes", record_call)
    monkeypatch.setattr(pipeline, "SessionLocal", lambda: db_session)
    pipeline._pipeline_progress[project_id] = {
        "step": 2,
        "running": True,
        "error": None,
        "notice": None,
    }
    asyncio.run(pipeline._run_pipeline(project_id, user_id))

    assert len(calls) == 1
    assert calls[0].get("verbatim_narration") is True


def test_pipeline_expands_narration_when_no_review_happened(db_session, paid_user, monkeypatch):
    """Normal (non-reviewed) generation must keep the existing AI-expansion behavior."""
    from app.routers import pipeline

    project = Project(
        user_id=paid_user.id,
        name="Normal generation",
        blog_url="https://normal.test",
        status=ProjectStatus.SCRIPTED,
        script_review_enabled=False,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    project_id = project.id
    user_id = paid_user.id

    calls = []

    async def record_call(*_args, **kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(pipeline, "_generate_scenes", record_call)
    monkeypatch.setattr(pipeline, "SessionLocal", lambda: db_session)
    pipeline._pipeline_progress[project_id] = {
        "step": 2,
        "running": True,
        "error": None,
        "notice": None,
    }
    asyncio.run(pipeline._run_pipeline(project_id, user_id))

    assert len(calls) == 1
    assert calls[0].get("verbatim_narration") is False
