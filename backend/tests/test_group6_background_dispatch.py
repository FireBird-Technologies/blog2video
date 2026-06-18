"""
Group 6 — Long-running / background-dispatch endpoints.

Tier A only checks that these endpoints ACCEPT the request, enforce their
guards, persist the job row, and register the background task with the right
arguments. It does NOT run the background work (regenerating voiceovers, calling
ElevenLabs/R2) — that is the depth tier.

To keep the work from actually executing under TestClient (which runs background
tasks synchronously after the response), ``BackgroundTasks.add_task`` is patched
to a spy that records calls without invoking them.

  POST /api/projects/{id}/change-voice     -> dispatches _run_voice_change
  POST /api/projects/{id}/delete-voiceover -> dispatches _run_delete_voiceover
"""
import pytest
from starlette.background import BackgroundTasks

from app.models.project import Project, ProjectStatus
from app.models.project_voice_change_job import ProjectVoiceChangeJob
from app.models.scene import Scene
from app.services import voice_change_progress

pytestmark = pytest.mark.smoke


@pytest.fixture()
def captured_tasks(monkeypatch):
    """Record background tasks instead of running them. Returns the list of
    (function_name, args) tuples registered during the test."""
    recorded: list[tuple[str, tuple]] = []

    def _spy(self, func, *args, **kwargs):
        recorded.append((getattr(func, "__name__", str(func)), args))

    monkeypatch.setattr(BackgroundTasks, "add_task", _spy, raising=True)
    return recorded


@pytest.fixture(autouse=True)
def _reset_progress():
    """voice_change_progress keeps in-memory per-project state; rolled-back test
    projects reuse ids, so clear it around each test to avoid a stale
    'already in progress' 409 leaking across tests."""
    voice_change_progress._progress.clear()
    yield
    voice_change_progress._progress.clear()


def _project_with_scenes(db, user, n=2) -> Project:
    project = Project(
        user_id=user.id, name="Has Scenes", blog_url="https://s.test",
        status=ProjectStatus.GENERATED, voice_gender="female",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    for i in range(n):
        db.add(Scene(
            project_id=project.id, order=i, title=f"Scene {i}",
            narration_text="hello", visual_description="a visual",
        ))
    db.commit()
    return project


# ─── POST /api/projects/{id}/change-voice ───────────────────────────────────

def test_change_voice__valid__dispatches_and_creates_job(
    client, db_session, paid_user, auth, captured_tasks
):
    project = _project_with_scenes(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/change-voice",
        headers=auth(paid_user),
        json={"voice_gender": "male"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"started": True, "total": 2}
    # A job row was persisted...
    job = db_session.query(ProjectVoiceChangeJob).filter_by(project_id=project.id).first()
    assert job is not None
    # ...and the background worker was registered with (project_id, job_id).
    names = [name for name, _ in captured_tasks]
    assert "_run_voice_change" in names
    args = next(a for n, a in captured_tasks if n == "_run_voice_change")
    assert args[0] == project.id


def test_change_voice__other_user__returns_404(
    client, db_session, paid_user, other_user, auth, captured_tasks
):
    project = _project_with_scenes(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/change-voice",
        headers=auth(other_user), json={"voice_gender": "male"},
    )
    assert resp.status_code == 404


def test_change_voice__no_scenes__returns_400(
    client, db_session, paid_user, auth, captured_tasks
):
    project = Project(user_id=paid_user.id, name="Empty", blog_url="https://e.test",
                      status=ProjectStatus.GENERATED, voice_gender="female")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    resp = client.post(
        f"/api/projects/{project.id}/change-voice",
        headers=auth(paid_user), json={"voice_gender": "male"},
    )
    assert resp.status_code == 400


def test_change_voice__without_token__returns_401(client, db_session, paid_user):
    project = _project_with_scenes(db_session, paid_user)
    resp = client.post(f"/api/projects/{project.id}/change-voice", json={})
    assert resp.status_code == 401


# ─── POST /api/projects/{id}/delete-voiceover ───────────────────────────────

def test_delete_voiceover__valid__dispatches_and_creates_job(
    client, db_session, paid_user, auth, captured_tasks
):
    project = _project_with_scenes(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/delete-voiceover", headers=auth(paid_user),
    )
    assert resp.status_code == 200
    assert resp.json() == {"started": True, "total": 2}
    names = [name for name, _ in captured_tasks]
    assert "_run_delete_voiceover" in names


def test_delete_voiceover__other_user__returns_404(
    client, db_session, paid_user, other_user, auth, captured_tasks
):
    project = _project_with_scenes(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/delete-voiceover", headers=auth(other_user),
    )
    assert resp.status_code == 404
