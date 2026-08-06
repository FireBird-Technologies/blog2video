from datetime import datetime
from sqlalchemy import String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SceneAvatarJob(Base):
    """Tracks one on-demand talking-head render for a SINGLE scene.

    Unlike the project-level jobs (voice change, template change, script regen)
    this is scoped to a scene: the user asks for an avatar from the Scene Edit
    modal and only that scene renders. There is deliberately no
    total_scenes/processed_scenes pair — a single render has no sub-progress, so
    the UI shows an indeterminate spinner and polls ``status``.

    ``queued`` rows ARE the system-wide avatar queue (see services/avatar_queue.py):
    a single in-process dispatcher runs exactly ONE of these jobs at a time,
    strictly FIFO by (created_at, id), across ALL projects and scenes — the shared
    OmniAvatar HuggingFace Space is a single GPU render slot, so this is
    intentionally NOT part of the one-job-per-project lock in
    ``_assert_no_active_job`` (that lock is about mutually-exclusive PROJECT
    state; this queue is a global resource scheduler). The only per-scene
    invariant is that a given scene never has two active (queued/running) jobs
    at once — enforced at enqueue time, not by the dispatcher.

    ``updated_at`` is the heartbeat: a stale value while still active means the
    run is stuck, matching the convention in ProjectVoiceChangeJob.
    """

    __tablename__ = "scene_avatar_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # queued -> running -> completed | failed
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    # Which operation this job performs:
    #   "render"  generate the clip via the OmniAvatar Space (the original, ~2.6 min)
    #   "matte"   cut the presenter out of the ALREADY-RENDERED mp4 (~1 min, CPU only,
    #             no Space call) so a custom background can show through
    # Both are per-scene and share this table because the progress model is
    # identical: indeterminate spinner + poll status. See services/avatar_matte.py.
    kind: Mapped[str] = mapped_column(String(16), default="render", nullable=False)
    # Roster preset this run rendered with (see services/avatar_presets.py).
    avatar_preset: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Which stage a running job is in, so the UI can explain a long wait:
    #   "starting_service" the Space was asleep and is being woken (minutes)
    #   "rendering"        the GPU is actually working
    # NULL on older rows and on terminal states.
    phase: Mapped[str | None] = mapped_column(String(24), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Set only when status becomes "failed": True = transient (Space cold-start,
    # 5xx, network) — worth an automatic/manual retry. False = terminal (missing
    # voiceover, missing portrait, scene deleted) — retrying is guaranteed to
    # reproduce the same failure, so the UI should not offer it. NULL for any
    # non-failed status.
    retryable: Mapped[bool | None] = mapped_column(nullable=True)
    # How many render attempts this SCENE has burned, carried across job rows.
    # The dispatcher writes it live (so the UI can say "attempt 2 of 3" while
    # running), and a successor row created by the bulk retry endpoint INHERITS
    # the predecessor's count — so an unattended retry loop can never exceed
    # settings.AVATAR_MAX_ATTEMPTS renders for one scene however many times it
    # is called. An explicit per-scene Generate click resets it to 0, since a
    # human asking again should never be refused. NULL on legacy rows predating
    # this column, treated as 0.
    attempt_count: Mapped[int | None] = mapped_column(nullable=True)
    # Wall-clock seconds for the whole render, so the UI can say how long it took
    # without anyone reading Space logs.
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="scene_avatar_jobs")
    scene = relationship("Scene", back_populates="avatar_jobs")
    user = relationship("User", back_populates="scene_avatar_jobs")
