"""Add avatar_shadow: drop-shadow intensity for the presenter overlay.

Project-wide default plus a nullable per-scene override, same pattern as
avatar_shape/_size/_position/_opacity (unlike avatar_motion_style, which is
project-only). NULL on a scene means "inherit the project setting". Stored as
a float 0.0 (no shadow) - 1.0 (strongest), same slider convention as opacity,
rather than a boolean, so the user can dial in intensity.

Revision ID: avatar_shadow
Revises: add_scene_font_defaults
Create Date: 2026-09-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "avatar_shadow"
down_revision: Union[str, None] = "add_scene_font_defaults"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "avatar_shadow", sa.Float(),
            nullable=False, server_default=sa.text("1.0"),
        ),
    )
    op.add_column(
        "scenes",
        sa.Column("avatar_shadow", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scenes", "avatar_shadow")
    op.drop_column("projects", "avatar_shadow")
