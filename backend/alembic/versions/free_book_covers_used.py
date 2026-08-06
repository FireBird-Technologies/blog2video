"""Track free AI book-cover generations on users table

Revision ID: free_book_covers_used
Revises: add_project_add_scene_jobs
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "free_book_covers_used"
down_revision: Union[str, Sequence[str]] = "add_project_add_scene_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "free_book_covers_used",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "free_book_covers_used")
