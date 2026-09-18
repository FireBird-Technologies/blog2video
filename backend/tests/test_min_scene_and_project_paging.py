"""
Two independent guarantees on the projects router.

1. A video always keeps at least one scene. ``delete_scene`` soft-deletes, so a
   user could previously delete every scene and be left with a project that
   renders an empty video. The guard counts only ``is_active`` scenes, so a
   project whose other scenes are already soft-deleted is still protected.

2. ``GET /projects`` paginates ONLY when asked. The bare-array response is load
   bearing for existing callers (the MCP server's list_projects, and the
   frontend's onboarding-tour project count, which reads ``res.data.length``),
   so passing no params must keep returning a plain JSON list.
"""
from __future__ import annotations

import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene

pytestmark = pytest.mark.depth


def _project(db, user, n_scenes=1):
    project = Project(
        user_id=user.id, name="P", blog_url="https://a.test",
        status=ProjectStatus.GENERATED,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    scenes = []
    for i in range(1, n_scenes + 1):
        scene = Scene(
            project_id=project.id, order=i, title=f"S{i}",
            narration_text="n", visual_description="v",
        )
        db.add(scene)
        scenes.append(scene)
    db.commit()
    for s in scenes:
        db.refresh(s)
    return project, scenes


# ─── Minimum one scene ──────────────────────────────────────────────────────

def test_deleting_the_last_scene_is_rejected(client, db_session, paid_user, auth):
    project, scenes = _project(db_session, paid_user, n_scenes=1)

    res = client.delete(
        f"/api/projects/{project.id}/scenes/{scenes[0].id}",
        headers=auth(paid_user),
    )

    assert res.status_code == 400
    assert res.json()["detail"] == "At least one scene is required for a video."
    db_session.refresh(scenes[0])
    assert scenes[0].is_active is True, "scene must survive the rejected delete"


def test_deleting_down_to_one_scene_works_then_stops(client, db_session, paid_user, auth):
    project, scenes = _project(db_session, paid_user, n_scenes=3)
    hdr = auth(paid_user)

    # First two deletes succeed.
    for scene in scenes[:2]:
        res = client.delete(f"/api/projects/{project.id}/scenes/{scene.id}", headers=hdr)
        assert res.status_code == 204

    # The third is the last ACTIVE one, so it is refused even though the project
    # still has two soft-deleted scene rows in the table.
    res = client.delete(f"/api/projects/{project.id}/scenes/{scenes[2].id}", headers=hdr)
    assert res.status_code == 400

    remaining = (
        db_session.query(Scene)
        .filter(Scene.project_id == project.id, Scene.is_active == True)  # noqa: E712
        .count()
    )
    assert remaining == 1


# ─── Project list pagination ────────────────────────────────────────────────

def test_list_projects_without_params_returns_bare_array(client, db_session, paid_user, auth):
    for _ in range(3):
        _project(db_session, paid_user)

    res = client.get("/api/projects", headers=auth(paid_user))

    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list), "existing callers depend on a bare array"
    assert len(body) == 3


def test_list_projects_paginates_when_page_given(client, db_session, paid_user, auth):
    for _ in range(12):
        _project(db_session, paid_user)
    hdr = auth(paid_user)

    first = client.get("/api/projects?page=1&per_page=10", headers=hdr).json()
    assert first["total"] == 12
    assert first["page"] == 1
    assert len(first["items"]) == 10

    second = client.get("/api/projects?page=2&per_page=10", headers=hdr).json()
    assert second["total"] == 12, "total is the unpaginated count, not the page size"
    assert len(second["items"]) == 2

    # Pages must not overlap.
    assert not {p["id"] for p in first["items"]} & {p["id"] for p in second["items"]}


def test_pagination_is_newest_first_across_pages(client, db_session, paid_user, auth):
    for _ in range(12):
        _project(db_session, paid_user)
    hdr = auth(paid_user)

    everything = client.get("/api/projects", headers=hdr).json()
    paged = (
        client.get("/api/projects?page=1&per_page=10", headers=hdr).json()["items"]
        + client.get("/api/projects?page=2&per_page=10", headers=hdr).json()["items"]
    )

    assert [p["id"] for p in paged] == [p["id"] for p in everything]


def test_page_past_the_end_is_empty_but_reports_total(client, db_session, paid_user, auth):
    for _ in range(3):
        _project(db_session, paid_user)

    body = client.get("/api/projects?page=9&per_page=10", headers=auth(paid_user)).json()

    assert body["items"] == []
    assert body["total"] == 3, "the frontend clamps back using this total"


def test_pagination_does_not_leak_other_users_projects(
    client, db_session, paid_user, other_user, auth
):
    for _ in range(4):
        _project(db_session, paid_user)
    for _ in range(4):
        _project(db_session, other_user)

    body = client.get("/api/projects?page=1&per_page=10", headers=auth(paid_user)).json()

    assert body["total"] == 4
    assert len(body["items"]) == 4
