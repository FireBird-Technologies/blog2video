"""Ad-hoc scene saves (PUT /scenes/{id}) should feed the same writing-style
preference learner used by the Review Script approval flow, not just the
explicit review/regenerate approval endpoints."""
import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.models.script_preference_learning_job import ScriptPreferenceLearningJob

pytestmark = pytest.mark.depth


def _project_with_scene(db, user):
    project = Project(
        user_id=user.id,
        name="Editable",
        blog_url="https://e.test",
        status=ProjectStatus.GENERATED,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    scene = Scene(
        project_id=project.id,
        order=1,
        title="Original title",
        narration_text="Original narration",
        display_text="Original display",
        visual_description="v",
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return project, scene


def test_scene_save_with_text_change_queues_preference_job(client, db_session, paid_user, auth, monkeypatch):
    from app.services import script_preferences

    dispatched = []
    monkeypatch.setattr(
        script_preferences, "dispatch_preference_learning_job", lambda job_id: dispatched.append(job_id)
    )
    project, scene = _project_with_scene(db_session, paid_user)

    response = client.put(
        f"/api/projects/{project.id}/scenes/{scene.id}",
        headers=auth(paid_user),
        json={"title": "Edited title", "display_text": "Edited display"},
    )

    assert response.status_code == 200
    job = db_session.query(ScriptPreferenceLearningJob).filter_by(project_id=project.id).one()
    assert job.user_id == paid_user.id
    assert job.status == "queued"
    assert job.idempotency_key.startswith("scene-edit:")
    assert "Edited title" in job.evidence_json
    assert "Original title" in job.evidence_json
    # The untouched narration field must still round-trip unchanged in both
    # before/after so build_edit_evidence doesn't report a false diff on it.
    assert job.evidence_json.count("Original narration") == 2
    assert dispatched == [job.id]


def test_scene_save_with_no_text_change_skips_preference_job(client, db_session, paid_user, auth, monkeypatch):
    from app.services import script_preferences

    monkeypatch.setattr(script_preferences, "dispatch_preference_learning_job", lambda job_id: None)
    project, scene = _project_with_scene(db_session, paid_user)

    response = client.put(
        f"/api/projects/{project.id}/scenes/{scene.id}",
        headers=auth(paid_user),
        json={"duration_seconds": 5.0},
    )

    assert response.status_code == 200
    assert db_session.query(ScriptPreferenceLearningJob).filter_by(project_id=project.id).count() == 0


def test_two_saves_on_same_scene_create_two_distinct_jobs(client, db_session, paid_user, auth, monkeypatch):
    from app.services import script_preferences

    monkeypatch.setattr(script_preferences, "dispatch_preference_learning_job", lambda job_id: None)
    project, scene = _project_with_scene(db_session, paid_user)

    r1 = client.put(
        f"/api/projects/{project.id}/scenes/{scene.id}",
        headers=auth(paid_user),
        json={"title": "First edit"},
    )
    r2 = client.put(
        f"/api/projects/{project.id}/scenes/{scene.id}",
        headers=auth(paid_user),
        json={"title": "Second edit"},
    )

    assert r1.status_code == 200
    assert r2.status_code == 200
    jobs = db_session.query(ScriptPreferenceLearningJob).filter_by(project_id=project.id).all()
    assert len(jobs) == 2
    assert jobs[0].idempotency_key != jobs[1].idempotency_key
