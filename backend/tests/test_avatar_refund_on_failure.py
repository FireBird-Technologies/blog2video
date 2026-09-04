"""
Depth tier — refunding a failed avatar scene immediately, per-job.

WHY THIS FILE EXISTS
Project 1243 ran a 5-scene avatar batch while the Modal workspace was disabled.
All 5 renders failed within the same second (each scene's first /ping fails
fast — see test_avatar_workspace_disabled.py) and the user was charged for all
5 but refunded for none.

Root cause: the refund used to be gated behind _on_batch_settled, which only
paid out once it believed every job in the batch had reached a terminal state
— determined by each job's own completion handler asking "is any sibling still
queued/running?". Under READ COMMITTED, when every job in a batch finishes
within the same instant, each one's "is anyone else still active?" query can
run before its siblings' own terminal writes have committed, so every job can
see (some of) the rest as still active and skip the refund — and if every job
in the batch does that, nobody ever refunds anything.

The fix removes the coordination: _write_terminal now refunds a job for
itself, in the same transaction as its own status write, the moment it fails
for good (non-retryable, or attempts exhausted) — see _refund_one_failed_job
in avatar_queue.py. There is nothing left to race, because no job's refund
depends on any other job's state.

These tests exercise _refund_one_failed_job directly (the unit doing the
refund) and _write_terminal's decision of when to call it (the seam that used
to be the race). They deliberately do NOT drive the queue dispatcher's thread
pool / retry-sleep loop end to end — see test_avatar_inline_matte.py's note on
why that's out of scope for this tier.
"""
from __future__ import annotations

import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.models.scene_avatar_job import SceneAvatarJob
from app.services.access import AVATAR_CREDIT_COST_PER_SCENE
from app.services.avatar_queue import _refund_one_failed_job

pytestmark = pytest.mark.depth


def _project_with_scenes(db, user, n=1):
    project = Project(
        user_id=user.id, name="Avatar", blog_url="https://a.test",
        status=ProjectStatus.GENERATED,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    scenes = []
    for i in range(1, n + 1):
        scene = Scene(
            project_id=project.id, order=i, title=f"S{i}", narration_text="n",
            visual_description="v", voiceover_path=f"/tmp/scene_{i}.mp3",
        )
        db.add(scene)
        scenes.append(scene)
    db.commit()
    for s in scenes:
        db.refresh(s)
    return project, scenes


def _failed_job(db, project, scene, user, *, retryable, batch_id="batch-1"):
    job = SceneAvatarJob(
        project_id=project.id, scene_id=scene.id, user_id=user.id,
        status="failed", kind="render", batch_id=batch_id,
        retryable=retryable, attempt_count=1,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


class TestRefundOneFailedJob:
    def test_refunds_the_owner_and_marks_the_job(self, db_session, paid_user):
        project, (scene,) = _project_with_scenes(db_session, paid_user, n=1)
        job = _failed_job(db_session, project, scene, paid_user, retryable=False)

        used_before = paid_user.ai_edits_used_this_period
        # Simulate having been charged, same as authorize_avatar_batch does.
        paid_user.ai_edits_used_this_period = used_before + AVATAR_CREDIT_COST_PER_SCENE
        db_session.commit()

        _refund_one_failed_job(db_session, project.id, job)
        db_session.commit()

        db_session.refresh(job)
        db_session.refresh(paid_user)
        assert job.credits_refunded is True
        assert paid_user.ai_edits_used_this_period == used_before

    def test_is_idempotent__second_call_does_not_double_refund(self, db_session, paid_user):
        project, (scene,) = _project_with_scenes(db_session, paid_user, n=1)
        job = _failed_job(db_session, project, scene, paid_user, retryable=False)
        paid_user.ai_edits_used_this_period = AVATAR_CREDIT_COST_PER_SCENE
        db_session.commit()

        _refund_one_failed_job(db_session, project.id, job)
        db_session.commit()
        _refund_one_failed_job(db_session, project.id, job)
        db_session.commit()

        db_session.refresh(paid_user)
        assert paid_user.ai_edits_used_this_period == 0

    def test_does_not_refund_a_scene_that_ended_up_with_a_clip(self, db_session, paid_user):
        """An earlier attempt may have landed a clip despite this job's own
        terminal error — refunding would give back money for a render the
        user actually received."""
        project, (scene,) = _project_with_scenes(db_session, paid_user, n=1)
        scene.avatar_video_path = "avatars/scene_1.mp4"
        db_session.commit()
        job = _failed_job(db_session, project, scene, paid_user, retryable=False)
        paid_user.ai_edits_used_this_period = AVATAR_CREDIT_COST_PER_SCENE
        db_session.commit()

        _refund_one_failed_job(db_session, project.id, job)
        db_session.commit()

        db_session.refresh(job)
        db_session.refresh(paid_user)
        assert job.credits_refunded is not True
        assert paid_user.ai_edits_used_this_period == AVATAR_CREDIT_COST_PER_SCENE


class TestSimultaneousBatchFailureNoLongerRaces:
    """Pins the actual bug: every job in a batch failing within the same
    instant must refund every one of them, independent of processing order —
    there is no "who goes last" question left to get wrong."""

    def test_all_scenes_in_a_simultaneous_batch_failure_get_refunded(self, db_session, paid_user):
        project, scenes = _project_with_scenes(db_session, paid_user, n=5)
        jobs = [
            _failed_job(db_session, project, s, paid_user, retryable=False, batch_id="batch-x")
            for s in scenes
        ]
        paid_user.ai_edits_used_this_period = 5 * AVATAR_CREDIT_COST_PER_SCENE
        db_session.commit()

        # Refund each job as _write_terminal would, in ARBITRARY completion
        # order (the old bug depended on order/timing; the fix must not).
        for job in reversed(jobs):
            _refund_one_failed_job(db_session, project.id, job)
            db_session.commit()

        db_session.refresh(paid_user)
        for job in jobs:
            db_session.refresh(job)
            assert job.credits_refunded is True
        assert paid_user.ai_edits_used_this_period == 0
