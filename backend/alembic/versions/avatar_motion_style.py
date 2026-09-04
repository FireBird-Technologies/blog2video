"""Add avatar_motion_style: project-wide subtle/natural/expressive prompt choice.

See app/services/avatar_motion_styles.py. Project-wide only, deliberately no
per-scene override — no `scenes.avatar_motion_style` column, unlike
avatar_shape/_size/_position/_opacity which do support one.

Revision ID: avatar_motion_style
Revises: avatar_feature_on_develop
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "avatar_motion_style"
down_revision: Union[str, None] = "avatar_feature_on_develop"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "avatar_motion_style", sa.String(length=16),
            nullable=False, server_default=sa.text("'expressive'"),
        ),
    )
    op.add_column(
        "scene_avatar_jobs",
        sa.Column("motion_style", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scene_avatar_jobs", "motion_style")
    op.drop_column("projects", "avatar_motion_style")
