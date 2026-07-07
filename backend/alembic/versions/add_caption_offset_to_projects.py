"""Add caption_offset to projects.

Vertical shift for bottom-anchored captions: -100..+100, 0 = default position,
positive = move up, negative = move down.

Revision ID: add_caption_offset_to_projects
Revises: add_caption_font_columns
Create Date: 2026-06-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_caption_offset_to_projects"
down_revision: Union[str, None] = "add_caption_font_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "caption_offset",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "caption_offset")
