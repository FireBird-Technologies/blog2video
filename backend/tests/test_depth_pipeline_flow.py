"""
Depth tier — pipeline failure / refund integration (Part D).

The money-safety invariant of the generation pipeline: when a generation FAILS,
the project is soft-deleted AND the video credit reserved at create-time is
refunded — exactly once, never below zero. This drives the real cleanup function
the pipeline calls on failure
(remove_failed_generation_project, used by _abort_generation_pipeline /
_rollback_project_after_endpoint_failure). External cleanup (R2 / workspace) is
skipped/ tolerant in tests, so no live I/O occurs.
"""
import pytest

from app.models.project import Project, ProjectStatus
from app.services.project_cleanup import remove_failed_generation_project

pytestmark = pytest.mark.depth


def _active_project(db, user):
    project = Project(
        user_id=user.id, name="Failing", blog_url="https://f.test",
        status=ProjectStatus.CREATED,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def test_failed_generation__refunds_one_credit_and_soft_deletes(db_session, paid_user):
    # Simulate the create-time deduction.
    paid_user.videos_used_this_period = 1
    project = _active_project(db_session, paid_user)

    remove_failed_generation_project(db_session, project, decrement_user_video_quota=True)

    db_session.refresh(paid_user)
    db_session.refresh(project)
    assert project.is_active is False          # soft-deleted
    assert paid_user.videos_used_this_period == 0  # credit refunded exactly once


def test_failed_generation__refund_never_below_zero(db_session, paid_user):
    paid_user.videos_used_this_period = 0
    project = _active_project(db_session, paid_user)

    remove_failed_generation_project(db_session, project, decrement_user_video_quota=True)

    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == 0  # guarded, no negative


def test_failed_generation__no_decrement_flag__keeps_quota(db_session, paid_user):
    # Some paths soft-delete WITHOUT refunding (the flag controls it).
    paid_user.videos_used_this_period = 2
    project = _active_project(db_session, paid_user)

    remove_failed_generation_project(db_session, project, decrement_user_video_quota=False)

    db_session.refresh(paid_user)
    db_session.refresh(project)
    assert project.is_active is False
    assert paid_user.videos_used_this_period == 2  # unchanged
