"""Add embed_token to projects for shareable embed links.

Revision ID: add_embed_token_to_projects
Revises: add_is_active_to_projects
Create Date: 2026-04-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_embed_token_to_projects"
down_revision: Union[str, None] = "phase11_blast_campaigns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("embed_token", sa.String(64), nullable=True),
    )
    op.create_index("ix_projects_embed_token", "projects", ["embed_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_projects_embed_token", table_name="projects")
    op.drop_column("projects", "embed_token")
