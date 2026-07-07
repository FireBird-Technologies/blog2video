"""Add embed_token to projects for shareable embed links.

Revision ID: add_embed_token_to_projects
Revises: add_is_active_to_projects
Create Date: 2026-04-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_embed_token_to_projects"
down_revision: Union[str, None] = "drop_blast_email_sends"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    project_columns = {col["name"] for col in inspector.get_columns("projects")}
    if "embed_token" not in project_columns:
        op.add_column(
            "projects",
            sa.Column("embed_token", sa.String(64), nullable=True),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("projects")}
    if "ix_projects_embed_token" not in existing_indexes:
        op.create_index("ix_projects_embed_token", "projects", ["embed_token"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("projects")}
    if "ix_projects_embed_token" in existing_indexes:
        op.drop_index("ix_projects_embed_token", table_name="projects")

    project_columns = {col["name"] for col in inspector.get_columns("projects")}
    if "embed_token" in project_columns:
        op.drop_column("projects", "embed_token")
