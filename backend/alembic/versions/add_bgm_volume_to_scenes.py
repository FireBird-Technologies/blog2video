"""Add per-scene bgm_volume override to scenes.

Revision ID: add_bgm_volume_to_scenes
Revises: add_bgm_fields_to_projects
Create Date: 2026-06-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_bgm_volume_to_scenes"
down_revision: Union[str, None] = "add_bgm_fields_to_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scenes",
        sa.Column("bgm_volume", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scenes", "bgm_volume")
