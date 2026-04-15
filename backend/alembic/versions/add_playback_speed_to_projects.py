"""Add playback_speed to projects.

Revision ID: add_playback_speed_to_projects
Revises: add_generating_to_project_status
Create Date: 2026-04-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_playback_speed_to_projects"
down_revision: Union[str, None] = "add_generating_to_project_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "playback_speed",
            sa.Float(),
            nullable=False,
            server_default="1.0",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "playback_speed")
