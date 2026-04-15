"""Remove a project and its storage when initial generation fails (quota rollback)."""

from __future__ import annotations

import os
import shutil

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.project import Project
from app.models.project_template_change_job import ProjectTemplateChangeJob
from app.models.subscription import Subscription
from app.models.user import User
from app.observability.logging import get_logger
from app.services import r2_storage
from app.services.remotion import cancel_running_render, get_workspace_dir, safe_remove_workspace

logger = get_logger(__name__)

# User-facing copy (also returned from /status after rollback).


def format_scrape_failed_public_message(blog_url: str | None) -> str:
    """Message when URL/document extraction fails; quota is rolled back (no video count deducted)."""
    raw = (blog_url or "").strip()
    if raw.startswith("upload://"):
        return (
            "(Your uploaded document) This document does not allow automated extraction "
            "(or we could not read its content). "
            "We apologise for the inconvenience. No video count has been deducted."
            "please try uploading another document."
        )
    if not raw:
        display = "This link"
    else:
        display = raw
    return (
        f"({display}) does not allow scraping (or we could not read its content). "
        "We apologise for the inconvenience. No video count has been deducted. Please try another link."
    )


PUBLIC_MSG_PIPELINE_FAILED = (
    "An unexpected error occurred while generating your video. "
    "We apologise for the inconvenience. No video count has been deducted. Please try again or contact support for help."
)


def remove_failed_generation_project(
    db: Session,
    project: Project,
    *,
    decrement_user_video_quota: bool = True,
) -> None:
    """
    Delete project row (ORM cascades scenes/assets/etc.), remove local + R2 files,
    and optionally decrement the user's per-period video counter (reverses create-time increment).
    """
    pid = project.id
    uid = project.user_id

    try:
        cancel_running_render(pid, reason="Project removed after generation failure.")
    except Exception as e:
        logger.warning(
            "[PROJECT_CLEANUP] cancel_running_render failed for project %s: %s",
            pid,
            e,
            extra={"project_id": pid, "user_id": uid},
        )

    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_project_files(uid, pid)
        except Exception as e:
            logger.warning(
                "[PROJECT_CLEANUP] R2 cleanup failed for project %s: %s",
                pid,
                e,
                extra={"project_id": pid, "user_id": uid},
            )

    try:
        safe_remove_workspace(get_workspace_dir(pid))
    except Exception as e:
        logger.warning(
            "[PROJECT_CLEANUP] Workspace cleanup failed for project %s: %s",
            pid,
            e,
            extra={"project_id": pid, "user_id": uid},
        )

    project_media = os.path.join(settings.MEDIA_DIR, f"projects/{pid}")
    if os.path.isdir(project_media):
        shutil.rmtree(project_media, ignore_errors=True)

    db.query(ProjectTemplateChangeJob).filter(ProjectTemplateChangeJob.project_id == pid).delete(
        synchronize_session=False
    )
    db.query(Subscription).filter(Subscription.project_id == pid).update(
        {Subscription.project_id: None},
        synchronize_session=False,
    )

    db.delete(project)

    # Atomic decrement so concurrent pipeline failures (e.g. bulk URLs) each refund
    # one credit. Read-modify-write on User in separate sessions loses updates.
    if decrement_user_video_quota:
        db.execute(
            update(User)
            .where(User.id == uid, User.videos_used_this_period > 0)
            .values(videos_used_this_period=User.videos_used_this_period - 1)
        )

    db.commit()
