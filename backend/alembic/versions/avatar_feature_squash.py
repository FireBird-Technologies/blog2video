"""Talking-head avatar feature, as one revision.

Squashes the 11-revision avatar chain that was developed incrementally between
2026-07-24 and 2026-08-03 (add_avatar_to_scenes_projects .. avatar_job_attempts).
Those revisions never ran outside local dev, so collapsing them is safe; nothing
in the wild is stamped with an id this replaces.

What the collapse removes, beyond file count:

  - projects.add_avatar / projects.avatar_preset were added by the first revision
    and dropped by the fourth, when avatar moved from an all-or-nothing project
    toggle to a per-scene on-demand action. A fresh DB no longer creates them
    just to drop them, and the data-migration that carried the project preset
    onto scenes is gone with them — it could only ever match rows written by the
    superseded pipeline, of which a fresh DB has none.
  - scene_avatar_jobs was created with 11 columns and then ALTERed four times
    (kind, phase, retryable, attempt_count). It is now created once, complete.

Column semantics are preserved exactly, because the application depends on them:

  - The per-scene override columns on `scenes` (avatar_shape/_size/_position/_bg/
    _opacity, and the focus/zoom trio) are nullable with NO server_default. NULL
    means "inherit the project setting" — that nullability IS the inheritance
    mechanism (see remotion.resolve_avatar_settings), so giving them defaults
    would silently pin every scene to a concrete value.
  - The matching columns on `projects` are NOT NULL with server_defaults, because
    ProjectResponse types them as non-optional and existing rows must read back
    the overlay's own fallbacks rather than NULL.
  - scene_avatar_jobs.attempt_count and .retryable stay nullable: NULL means
    "legacy row / not yet a terminal failure" and the queue reads it that way.

Revision ID: avatar_feature_squash
Revises: tool_usage_counters
Create Date: 2026-08-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
# NB: alembic_version.version_num is varchar(32) in this DB — keep ids short.
revision: str = "avatar_feature_squash"
down_revision: Union[str, None] = "tool_usage_counters"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # ---- scenes: the clip, its matte twin, and the per-scene overrides --------
    # Local MEDIA_DIR path of the rendered clip; the R2 copy lives on an AVATAR asset.
    op.add_column("scenes", sa.Column("avatar_video_path", sa.String(length=512), nullable=True))
    # Which roster presenter THIS scene uses (see services/avatar_presets.py).
    op.add_column("scenes", sa.Column("avatar_preset", sa.String(length=64), nullable=True))
    # Matted transparent twin of avatar_video_path, produced on demand by
    # services/avatar_matte.py and stored BESIDE the mp4 so the original always
    # survives for re-matting or fallback.
    op.add_column("scenes", sa.Column("avatar_matte_path", sa.String(length=512), nullable=True))

    # Nullable, no defaults — NULL means "inherit from the project".
    op.add_column("scenes", sa.Column("avatar_shape", sa.String(length=16), nullable=True))
    op.add_column("scenes", sa.Column("avatar_size", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_position", sa.String(length=20), nullable=True))
    op.add_column("scenes", sa.Column("avatar_bg", sa.String(length=16), nullable=True))
    op.add_column("scenes", sa.Column("avatar_opacity", sa.Float(), nullable=True))
    # Which part of the rendered frame to keep: focal point + zoom, applied as CSS
    # in both AvatarOverlay twins so it never re-encodes the mp4. NULL = default framing.
    op.add_column("scenes", sa.Column("avatar_focus_x", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_focus_y", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_zoom", sa.Float(), nullable=True))

    # ---- projects: overlay presentation defaults -----------------------------
    op.add_column(
        "projects",
        sa.Column("avatar_shape", sa.String(length=16), nullable=False, server_default=sa.text("'circle'")),
    )
    op.add_column(
        "projects",
        sa.Column("avatar_size", sa.Float(), nullable=False, server_default=sa.text("0.16")),
    )
    op.add_column(
        "projects",
        sa.Column("avatar_position", sa.String(length=20), nullable=False, server_default=sa.text("'bottom_left'")),
    )
    # NULL | "transparent" | "#RRGGBB". NULL means "keep the portrait's own background".
    op.add_column("projects", sa.Column("avatar_bg", sa.String(length=16), nullable=True))
    op.add_column(
        "projects",
        sa.Column("avatar_opacity", sa.Float(), nullable=False, server_default=sa.text("1.0")),
    )
    # User-supplied presenter portrait, an alternative to the bundled roster.
    op.add_column("projects", sa.Column("avatar_custom_image_path", sa.String(length=512), nullable=True))
    op.add_column("projects", sa.Column("avatar_custom_image_url", sa.String(length=1024), nullable=True))
    # Has the user cleared the batch-generate paywall (cf. projects.studio_unlocked).
    op.add_column(
        "projects",
        sa.Column("avatar_batch_unlocked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # ---- scene_avatar_jobs: created complete ---------------------------------
    op.create_table(
        "scene_avatar_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        # "render" (OmniAvatar) | "matte" (cut the presenter out).
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="render"),
        sa.Column("avatar_preset", sa.String(length=64), nullable=True),
        # "starting_service" | "rendering", so a cold start reads as progress, not a hang.
        sa.Column("phase", sa.String(length=24), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        # Set only when a job lands on status='failed'; NULL = not a terminal failure.
        sa.Column("retryable", sa.Boolean(), nullable=True),
        # Renders this SCENE has burned, inherited by successor rows so the automatic
        # retry path cannot exceed AVATAR_MAX_ATTEMPTS. NULL = legacy row, 0 burned.
        sa.Column("attempt_count", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scene_avatar_jobs_project_id", "scene_avatar_jobs", ["project_id"])
    op.create_index("ix_scene_avatar_jobs_scene_id", "scene_avatar_jobs", ["scene_id"])
    op.create_index("ix_scene_avatar_jobs_user_id", "scene_avatar_jobs", ["user_id"])
    op.create_index("ix_scene_avatar_jobs_status", "scene_avatar_jobs", ["status"])

    # ---- assettype enum ------------------------------------------------------
    # Native PG enum → ALTER TYPE. Safe in this transaction because no AVATAR row
    # is inserted here (the "can't use a new enum value in the same transaction"
    # caveat only applies when the value is referenced). SQLite stores the enum as
    # plain text, so there is nothing to do there.
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'AVATAR'")


def downgrade() -> None:
    op.drop_index("ix_scene_avatar_jobs_status", table_name="scene_avatar_jobs")
    op.drop_index("ix_scene_avatar_jobs_user_id", table_name="scene_avatar_jobs")
    op.drop_index("ix_scene_avatar_jobs_scene_id", table_name="scene_avatar_jobs")
    op.drop_index("ix_scene_avatar_jobs_project_id", table_name="scene_avatar_jobs")
    op.drop_table("scene_avatar_jobs")

    op.drop_column("projects", "avatar_batch_unlocked")
    op.drop_column("projects", "avatar_custom_image_url")
    op.drop_column("projects", "avatar_custom_image_path")
    op.drop_column("projects", "avatar_opacity")
    op.drop_column("projects", "avatar_bg")
    op.drop_column("projects", "avatar_position")
    op.drop_column("projects", "avatar_size")
    op.drop_column("projects", "avatar_shape")

    op.drop_column("scenes", "avatar_zoom")
    op.drop_column("scenes", "avatar_focus_y")
    op.drop_column("scenes", "avatar_focus_x")
    op.drop_column("scenes", "avatar_opacity")
    op.drop_column("scenes", "avatar_bg")
    op.drop_column("scenes", "avatar_position")
    op.drop_column("scenes", "avatar_size")
    op.drop_column("scenes", "avatar_shape")
    op.drop_column("scenes", "avatar_matte_path")
    op.drop_column("scenes", "avatar_preset")
    op.drop_column("scenes", "avatar_video_path")
    # PostgreSQL enum values cannot be removed safely in-place → leave AVATAR.
