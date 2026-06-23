"""Add captions_enabled and caption_position to projects.

Revision ID: add_captions_to_projects
Revises: add_custom_template_quota
Create Date: 2026-06-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_captions_to_projects"
down_revision: Union[str, None] = "add_custom_template_quota"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "captions_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "caption_position",
            sa.String(length=20),
            nullable=False,
            server_default="bottom_center",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "caption_position")
    op.drop_column("projects", "captions_enabled")
