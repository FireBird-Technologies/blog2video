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
    a single in-process dispatcher runs up to ``AVATAR_CONCURRENCY`` of these at a
    time, claimed strictly FIFO by (created_at, id) within a kind, across ALL
    projects and scenes — the provider (LongCat on Modal) allows several
    containers at once, bounded by its own ``max_containers``, so this is
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
    # Which single authorize/retry/per-scene-generate CALL created this row — a
    # UUID stamped once per call, shared by every row it creates. NULL on
    # legacy rows predating this column.
    #
    # Exists because nothing else in this table answers "which run does this
    # belong to." Before this column, code that needed that answer (the
    # avatar-progress rollup's "most recent batch" grouping, and
    # _on_batch_settled's "is this batch fully done") could only guess from
    # created_at proximity or from project-wide state — both of which produced
    # real bugs: the progress rollup could drop a still-running scene from the
    # visible list once a second batch's rows existed, and _on_batch_settled's
    # project-wide "anything still active?" check let a LATER batch's still-
    # queued rows mask an EARLIER batch's terminal failure from ever reaching
    # the refund sweep — see refund_exhausted_avatar_failures's batch_id
    # scoping in avatar_queue.py. A retry gets its OWN fresh batch_id rather
    # than inheriting the original's: it is its own coherent run, and there is
    # no single "original batch" to attribute it to when retrying scenes drawn
    # from several past runs at once.
    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Which operation this job performs:
    #   "render"  generate the clip via the LongCat service on Modal
    #   "matte"   cut the presenter out of the ALREADY-RENDERED mp4 (~1 min, CPU only,
    #             no provider call) so a custom background can show through
    # Both are per-scene and share this table because the progress model is
    # identical: indeterminate spinner + poll status. See services/avatar_matte.py.
    kind: Mapped[str] = mapped_column(String(16), default="render", nullable=False)
    # Roster preset this run rendered with (see services/avatar_presets.py).
    avatar_preset: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Motion-style prompt this run rendered with (see
    # services/avatar_motion_styles.py) — copied from Project.avatar_motion_style
    # at enqueue time, purely for record-keeping (same reason avatar_preset is
    # here): a retry inherits THIS value rather than the project's possibly
    # since-changed current setting, so it reproduces the original render.
    motion_style: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Which stage a running job is in, so the UI can explain a long wait:
    #   "starting_service" no container was up yet and one is being started
    #   "rendering"        the GPU is actually working
    # NULL on older rows and on terminal states.
    phase: Mapped[str | None] = mapped_column(String(24), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Set only when status becomes "failed": True = transient (container
    # cold-start, 5xx, network) — worth an automatic/manual retry. False =
    # terminal (missing voiceover, missing portrait, scene deleted, provider
    # workspace disabled) — retrying is guaranteed to reproduce the same failure,
    # so the UI should not offer it. NULL for any non-failed status.
    #
    # False ALSO triggers the credit refund on the first attempt rather than at
    # the attempt cap — see refund_exhausted_avatar_failures in avatar_queue.py.
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
    # Were this scene's credits given back? Set once, by the refund sweep, when
    # a render has failed for good (see services/avatar_queue.py).
    #
    # ONE COLUMN, THREE JOBS — deliberate, and the only non-obvious decision in
    # the refund feature:
    #
    #   1. IDEMPOTENCY GUARD. The sweep selects only rows where this is not true
    #      and sets it in the SAME transaction as the balance change. Without it
    #      a second sweep — two jobs settling together, a restart mid-sweep, a
    #      retry row for the same scene — would silently hand out free credits,
    #      with nothing in the data to show it happened.
    #
    #   2. PERMANENT-BLOCK MARKER. A refunded scene is a closed matter: the
    #      money is back, so re-rendering it would be free GPU work. Every gate
    #      that could start one checks this — the bulk retry endpoint, the
    #      per-scene endpoint, and batch eligibility in authorize_avatar_batch.
    #      NOTE this is NOT `retryable`, which records whether the ERROR CLASS
    #      was transient and stays true even on a refunded scene. Two different
    #      questions; do not collapse them.
    #
    #   3. OPERATOR UNBLOCK LEVER. Because every gate keys off this one column,
    #      clearing it is the whole undo:
    #          UPDATE scene_avatar_jobs SET credits_refunded = NULL WHERE ...
    #      Clearing it on a scene that was refunded but NOT re-charged lets the
    #      next sweep pay again — an escape hatch for someone who knows that,
    #      not something to put a button on.
    #
    # NULL = not refunded, which is the right reading for every legacy row.
    credits_refunded: Mapped[bool | None] = mapped_column(nullable=True)
    # Wall-clock seconds for the whole render, so the UI can say how long it took
    # without anyone reading provider logs.
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="scene_avatar_jobs")
    scene = relationship("Scene", back_populates="avatar_jobs")
    user = relationship("User", back_populates="scene_avatar_jobs")


# ── DIAGNOSTIC (2026-08-10) ───────────────────────────────────────────────────
# "Server restarted during processing." keeps landing on jobs whose renders were
# still running, and the only code that writes it — reap_orphaned_avatar_jobs in
# routers/projects.py — is currently disabled by an early `return` that the
# disassembly confirms sits BEFORE any DB access (LOAD_CONST 'DISABLED' ->
# RETURN_VALUE at offset 12). The write still happened on a server that booted
# after that edit and logged "boot sweep: DISABLED".
#
# So the origin is not established. An ORM-level listener cannot be bypassed by
# whichever path turns out to be responsible: it fires on the attribute set
# itself, wherever in the process that happens, and prints the stack that did it.
# Remove this once the writer is identified.
def _trace_error_message_set(target, value, oldvalue, initiator):
    if value and "Server restarted" in str(value):
        import logging, traceback
        logging.getLogger(__name__).warning(
            "[AVATAR_WRITE_TRACE] job id=%s error_message <- %r (was %r)\n%s",
            getattr(target, "id", "?"), value, oldvalue,
            "".join(traceback.format_stack(limit=15)[:-1]),
        )
    return value


from sqlalchemy import event as _sa_event  # noqa: E402  (kept next to its use)

_sa_event.listen(
    SceneAvatarJob.error_message, "set", _trace_error_message_set, retval=True
)
