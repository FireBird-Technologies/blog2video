"""Talking-head avatar feature, ported onto the develop branch's migration chain.

This DB's alembic_version was stamped at ``pdf_narration_usage`` (develop's current
head) rather than anything in the ``feature/avatar`` branch's chain. Both branches
fork from the same point — ``support_escalation_count`` — after which develop added
``pdf_narration_usage`` while feature/avatar added the 4-revision avatar chain
(``avatar_feature_squash`` -> ``avatar_matte_error`` -> ``avatar_credits_refunded`` ->
``add_avatar_reviews``). This migration is the union of those four revisions' schema
changes, replayed on top of develop's actual head so this DB reaches the SAME end
state feature/avatar's chain produces, without editing any already-committed
migration file (several of which are already stamped/applied elsewhere).

Column semantics preserved exactly from the originals — see avatar_feature_squash.py,
avatar_matte_error.py, avatar_credits_refunded.py, and add_avatar_reviews_table.py for
the full rationale behind each column; this file only replays the DDL.

Revision ID: avatar_feature_on_develop
Revises: pdf_narration_usage
Create Date: 2026-09-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "avatar_feature_on_develop"
down_revision: Union[str, None] = "pdf_narration_usage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # ==== from avatar_feature_squash ====
    op.add_column("scenes", sa.Column("avatar_video_path", sa.String(length=512), nullable=True))
    op.add_column("scenes", sa.Column("avatar_preset", sa.String(length=64), nullable=True))
    op.add_column("scenes", sa.Column("avatar_matte_path", sa.String(length=512), nullable=True))
    op.add_column("scenes", sa.Column("avatar_shape", sa.String(length=16), nullable=True))
    op.add_column("scenes", sa.Column("avatar_size", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_position", sa.String(length=20), nullable=True))
    op.add_column("scenes", sa.Column("avatar_bg", sa.String(length=16), nullable=True))
    op.add_column("scenes", sa.Column("avatar_opacity", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_focus_x", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_focus_y", sa.Float(), nullable=True))
    op.add_column("scenes", sa.Column("avatar_zoom", sa.Float(), nullable=True))

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
    op.add_column("projects", sa.Column("avatar_bg", sa.String(length=16), nullable=True))
    op.add_column(
        "projects",
        sa.Column("avatar_opacity", sa.Float(), nullable=False, server_default=sa.text("1.0")),
    )
    op.add_column("projects", sa.Column("avatar_custom_image_path", sa.String(length=512), nullable=True))
    op.add_column("projects", sa.Column("avatar_custom_image_url", sa.String(length=1024), nullable=True))
    op.add_column(
        "projects",
        sa.Column("avatar_batch_unlocked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "scene_avatar_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="render"),
        sa.Column("avatar_preset", sa.String(length=64), nullable=True),
        sa.Column("phase", sa.String(length=24), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retryable", sa.Boolean(), nullable=True),
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

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'AVATAR'")

    # ==== from avatar_matte_error ====
    op.add_column("scenes", sa.Column("avatar_matte_error", sa.String(length=512), nullable=True))
    op.add_column("scenes", sa.Column("avatar_matte_failed_at", sa.DateTime(), nullable=True))

    # ==== from avatar_credits_refunded ====
    op.add_column("scene_avatar_jobs", sa.Column("credits_refunded", sa.Boolean(), nullable=True))

    # ==== from add_avatar_reviews_table ====
    op.create_table(
        "avatar_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("suggestion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "project_id", name="uq_avatar_reviews_user_project"),
    )
    op.create_index(op.f("ix_avatar_reviews_user_id"), "avatar_reviews", ["user_id"], unique=False)
    op.create_index(op.f("ix_avatar_reviews_project_id"), "avatar_reviews", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_avatar_reviews_project_id"), table_name="avatar_reviews")
    op.drop_index(op.f("ix_avatar_reviews_user_id"), table_name="avatar_reviews")
    op.drop_table("avatar_reviews")

    op.drop_column("scene_avatar_jobs", "credits_refunded")

    op.drop_column("scenes", "avatar_matte_failed_at")
    op.drop_column("scenes", "avatar_matte_error")

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
    # PostgreSQL enum values cannot be removed safely in-place -> leave AVATAR.
