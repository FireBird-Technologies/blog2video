from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Job lifecycle.
#   pending_render — waiting for a render to finish before there are bytes to upload
#   queued         — has an MP4, waiting for a dispatcher slot
#   running        — uploading now
#   succeeded / failed / cancelled — terminal
STATUS_PENDING_RENDER = "pending_render"
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_SUCCEEDED = "succeeded"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"

ACTIVE_STATUSES = (STATUS_PENDING_RENDER, STATUS_QUEUED, STATUS_RUNNING)
TERMINAL_STATUSES = (STATUS_SUCCEEDED, STATUS_FAILED, STATUS_CANCELLED)

# Which bytes to publish.
SOURCE_EXISTING = "existing"   # the MP4 already in R2
SOURCE_RERENDER = "rerender"   # re-render first, then publish the result

MAX_ATTEMPTS = 3


class SocialPublishJob(Base):
    """One upload of one project's video to one platform.

    ``queued`` rows ARE the publish queue (see services/publish_queue.py), claimed
    FIFO by (created_at, id) across all projects by a single in-process dispatcher
    — the same shape as SceneAvatarJob and the avatar queue, and correct for the
    same reason: the app runs with ``--workers 1``, so one process is the only
    writer transitioning queued -> running.

    Like the avatar queue and unlike the project-level jobs, this is deliberately
    NOT part of the one-job-per-project lock in ``_assert_no_active_job``. An
    upload reads a finished MP4 and mutates no project state, so blocking a
    re-render behind an in-flight upload would cost the user nothing but time.

    THE PENDING-RENDER CONTRACT
    ---------------------------
    A row in ``pending_render`` is the record that the user asked to publish a
    video that did not exist yet. This is the whole reason the unrendered flow
    survives a closed tab: the intent lives in the database, not in the client,
    so the upload fires from the render-completion hook
    (``remotion.upload_rendered_video_to_r2``) with nobody watching.

    ``render_run_id`` binds the row to exactly ONE render run. Without it a
    pending job is satisfied by whatever render happens to finish next, which is
    wrong in a real and reachable way: cancel the render, edit the project, hit
    render again, and the abandoned intent would publish content the user never
    approved for it. The hook promotes a row only when the run ids match.

    ``updated_at`` is the heartbeat, matching ProjectVoiceChangeJob: the upload
    bumps it as chunks land, and a stale value while still ``running`` means the
    run is stuck and should be reaped.
    """

    __tablename__ = "social_publish_jobs"
    __table_args__ = (
        # The dispatcher scans by status; the status endpoint and the duplicate
        # guard both scan by (project, status).
        Index("ix_social_publish_jobs_project_status", "project_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # SET NULL rather than CASCADE: disconnecting an account must not erase the
    # history of what was already published through it. A finished row keeps its
    # platform_post_url and stays readable with a null connection.
    connection_id: Mapped[int | None] = mapped_column(
        ForeignKey("social_connections.id", ondelete="SET NULL"), nullable=True
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(24), default=STATUS_PENDING_RENDER, index=True
    )

    # ─── Metadata, frozen at submit time ─────────────────────────────────────
    # Captured up front so the upload needs no further input from the user. It is
    # intentionally a snapshot: renaming the project after submitting does not
    # retitle a video that is already on its way to YouTube.
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array string
    privacy_status: Mapped[str] = mapped_column(String(12), default="private")
    made_for_kids: Mapped[bool] = mapped_column(Boolean, default=False)
    category_id: Mapped[str | None] = mapped_column(String(8), nullable=True)

    # ─── Which bytes, and from which render ──────────────────────────────────
    source: Mapped[str] = mapped_column(String(16), default=SOURCE_EXISTING)
    # Snapshot of the R2 key actually uploaded. Taken when the job is queued, not
    # read live from the project, because R2 video keys are versioned and a
    # concurrent re-render deletes the old one — the job must know which object
    # it promised to publish so a 404 is diagnosable as "superseded" rather than
    # as a generic storage failure.
    r2_video_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    render_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Provider-side resumable upload session URL. Persisted so a retry RESUMES an
    # interrupted upload instead of starting a new one — which matters beyond
    # bandwidth: YouTube bills uploads against a small daily bucket, so a restart
    # that re-uploaded from zero would spend quota twice for one video.
    resumable_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ─── Progress and result ─────────────────────────────────────────────────
    # BigInteger: a long 1080p render exceeds the 2^31 byte ceiling of Integer.
    uploaded_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    total_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    platform_post_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    platform_post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # True when the platform returned a stricter privacy than we asked for. For
    # YouTube this is the unverified-project case: an unaudited API project has
    # every upload forced to private. Recording what actually happened lets the
    # UI show the "switch it in YouTube Studio" hint only when it applies,
    # instead of warning everyone unconditionally forever.
    forced_private: Mapped[bool] = mapped_column(Boolean, default=False)

    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    retryable: Mapped[bool] = mapped_column(Boolean, default=True)
    # Machine-readable failure cause, so the client can choose its own copy and
    # its own affordance (reconnect / republish / wait) without parsing prose.
    error_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="social_publish_jobs")
    user = relationship("User", back_populates="social_publish_jobs")
    connection = relationship("SocialConnection", back_populates="publish_jobs")

    @property
    def progress(self) -> float:
        """Fraction uploaded in [0, 1]; 0.0 while there is nothing to measure."""
        if self.total_bytes <= 0:
            return 0.0
        return min(1.0, self.uploaded_bytes / self.total_bytes)
