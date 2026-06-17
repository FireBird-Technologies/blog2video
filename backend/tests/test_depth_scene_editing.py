"""
Depth tier — scene-editing logic (the actual mutation, not just ownership).

Tier A swept these routes for ownership; this asserts they correctly mutate
scene state. Workspace rebuild (file I/O) is tolerated/no-op in tests.
"""
import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene

pytestmark = pytest.mark.depth


def _project_with_scenes(db, user, n=3):
    project = Project(user_id=user.id, name="Editable", blog_url="https://e.test",
                      status=ProjectStatus.GENERATED)
    db.add(project)
    db.commit()
    db.refresh(project)
    scenes = []
    for i in range(1, n + 1):
        s = Scene(project_id=project.id, order=i, title=f"Scene {i}",
                  narration_text="n", visual_description="v")
        db.add(s)
        scenes.append(s)
    db.commit()
    for s in scenes:
        db.refresh(s)
    return project, scenes


# ─── POST /{project_id}/scenes/reorder ──────────────────────────────────────

def test_reorder__moves_last_scene_to_front_and_resequences(client, db_session, paid_user, auth):
    project, scenes = _project_with_scenes(db_session, paid_user, n=3)
    s1, s2, s3 = scenes

    # Put the originally-last scene first.
    resp = client.post(
        f"/api/projects/{project.id}/scenes/reorder",
        headers=auth(paid_user),
        json={"scene_orders": [
            {"scene_id": s3.id, "order": 1},
            {"scene_id": s1.id, "order": 2},
            {"scene_id": s2.id, "order": 3},
        ]},
    )
    assert resp.status_code == 200

    db_session.expire_all()
    # Orders are resequenced to a clean 1..3 and "Scene 3" is now first.
    by_id = {s.id: s for s in db_session.query(Scene).filter_by(project_id=project.id)}
    assert by_id[s3.id].order == 1
    assert by_id[s1.id].order == 2
    assert by_id[s2.id].order == 3


def test_reorder__unknown_scene_id__returns_404(client, db_session, paid_user, auth):
    project, scenes = _project_with_scenes(db_session, paid_user, n=2)
    resp = client.post(
        f"/api/projects/{project.id}/scenes/reorder",
        headers=auth(paid_user),
        json={"scene_orders": [{"scene_id": 999999, "order": 1}]},
    )
    assert resp.status_code == 404


def test_reorder__other_user__returns_404(client, db_session, paid_user, other_user, auth):
    project, scenes = _project_with_scenes(db_session, paid_user, n=2)
    resp = client.post(
        f"/api/projects/{project.id}/scenes/reorder",
        headers=auth(other_user),
        json={"scene_orders": [{"scene_id": scenes[0].id, "order": 1}]},
    )
    assert resp.status_code == 404
