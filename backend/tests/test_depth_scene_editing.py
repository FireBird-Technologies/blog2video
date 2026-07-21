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


# ─── Audio-filename resync on reorder (voiceover-shuffle regression) ──────────

def _write_scene_audio(project_id, scene, order):
    """Create scene_{order}.mp3 whose bytes encode the scene id, and point the
    scene's voiceover_path at it. The byte-marker lets a test prove a scene still
    resolves to its OWN audio (not a sibling's) after a renumber."""
    import os
    from app.config import settings

    audio_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/audio")
    os.makedirs(audio_dir, exist_ok=True)
    path = os.path.join(audio_dir, f"scene_{order}.mp3")
    with open(path, "wb") as f:
        f.write(f"AUDIO-FOR-SCENE-{scene.id}".encode())
    scene.voiceover_path = path
    return path


def test_reorder__renames_audio_files_and_paths_to_new_order(
    client, db_session, paid_user, auth
):
    """Reordering renumbers scene.order; audio files are named by order, so the files
    and voiceover_paths must be resynced or scenes play each other's voiceover."""
    import os
    from app.config import settings

    project, scenes = _project_with_scenes(db_session, paid_user, n=3)
    s1, s2, s3 = scenes
    for s in scenes:
        _write_scene_audio(project.id, s, s.order)
    db_session.commit()

    # Move the last scene to the front → orders become s3=1, s1=2, s2=3.
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
    by_id = {s.id: s for s in db_session.query(Scene).filter_by(project_id=project.id)}
    audio_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/audio")

    # Each scene's file is renamed to scene_{new order}.mp3, its voiceover_path points
    # there, and the bytes still identify that same scene — no cross-wiring.
    for sid, expected_order in ((s3.id, 1), (s1.id, 2), (s2.id, 3)):
        s = by_id[sid]
        assert s.order == expected_order
        assert s.voiceover_path.endswith(f"scene_{expected_order}.mp3")
        with open(s.voiceover_path, "rb") as f:
            assert f.read() == f"AUDIO-FOR-SCENE-{sid}".encode()

    # No file left behind under a stale order name that a sibling would misread.
    for order in (1, 2, 3):
        p = os.path.join(audio_dir, f"scene_{order}.mp3")
        with open(p, "rb") as f:
            data = f.read()
        assert data.startswith(b"AUDIO-FOR-SCENE-")

    # Cleanup.
    import shutil
    shutil.rmtree(os.path.join(settings.MEDIA_DIR, f"projects/{project.id}"),
                  ignore_errors=True)


def test_sync_audio_filenames__cyclic_swap_no_clobber(db_session, paid_user):
    """A 2↔3 swap must not overwrite either file mid-rename (two-phase rename)."""
    import os
    from app.config import settings
    from app.routers.projects import _sync_audio_filenames_to_order

    project, scenes = _project_with_scenes(db_session, paid_user, n=3)
    s1, s2, s3 = scenes
    for s in scenes:
        _write_scene_audio(project.id, s, s.order)
    # Swap orders 2 and 3 directly (files still named scene_2/scene_3 for the old owners).
    s2.order, s3.order = 3, 2
    db_session.flush()

    _sync_audio_filenames_to_order(db_session, project)
    db_session.commit()
    db_session.expire_all()

    by_id = {s.id: s for s in db_session.query(Scene).filter_by(project_id=project.id)}
    # s2 now at order 3, s3 at order 2 — each keeps its own bytes.
    with open(by_id[s2.id].voiceover_path, "rb") as f:
        assert f.read() == f"AUDIO-FOR-SCENE-{s2.id}".encode()
    with open(by_id[s3.id].voiceover_path, "rb") as f:
        assert f.read() == f"AUDIO-FOR-SCENE-{s3.id}".encode()
    assert by_id[s2.id].voiceover_path.endswith("scene_3.mp3")
    assert by_id[s3.id].voiceover_path.endswith("scene_2.mp3")

    import shutil
    shutil.rmtree(os.path.join(settings.MEDIA_DIR, f"projects/{project.id}"),
                  ignore_errors=True)
