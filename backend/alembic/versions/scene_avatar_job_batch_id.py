"""Add scene_avatar_jobs.batch_id: real identity for "which run" a job belongs to.

Replaces guessing batch membership from created_at proximity / project-wide
state. See SceneAvatarJob.batch_id's docstring and
avatar_queue.py's _on_batch_settled for why the guess produced real bugs
(a scene's still-generating siblings dropping out of the progress view, and
a later batch's rows masking an earlier batch's terminal failure from ever
reaching the refund sweep).

Revision ID: scene_avatar_job_batch_id
Revises: avatar_motion_style
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "scene_avatar_job_batch_id"
down_revision: Union[str, None] = "avatar_motion_style"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scene_avatar_jobs",
        sa.Column("batch_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "ix_scene_avatar_jobs_batch_id", "scene_avatar_jobs", ["batch_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_scene_avatar_jobs_batch_id", table_name="scene_avatar_jobs")
    op.drop_column("scene_avatar_jobs", "batch_id")
