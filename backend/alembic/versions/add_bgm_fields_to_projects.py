"""Add bgm_track_id and bgm_volume to projects.

Revision ID: add_bgm_fields_to_projects
Revises: template_change_jobs_cascade
Create Date: 2026-04-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_bgm_fields_to_projects"
down_revision: Union[str, None] = "template_change_jobs_cascade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("bgm_track_id", sa.String(50), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column(
            "bgm_volume",
            sa.Float(),
            nullable=False,
            server_default="0.10",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "bgm_volume")
    op.drop_column("projects", "bgm_track_id")
