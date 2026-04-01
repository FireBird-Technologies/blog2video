"""Add video_length in projects to control scene count.

Revision ID: add_video_length_to_projects
Revises: add_content_lang
Create Date: 2026-03-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "add_video_length_to_projects"
down_revision: Union[str, None] = "add_content_lang"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "video_length",
            sa.String(length=10),
            nullable=False,
            server_default="auto",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "video_length")

