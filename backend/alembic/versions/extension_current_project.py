"""Persist the browser extension's current project.

Revision ID: extension_current_project
Revises: add_extension_integration
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "extension_current_project"
down_revision: Union[str, None] = "add_extension_integration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("extension_connections") as batch_op:
        batch_op.add_column(sa.Column("current_project_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_extension_connections_current_project",
            "projects",
            ["current_project_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_extension_connections_current_project_id",
            ["current_project_id"],
        )

    # Idempotency-Key already protects retries. Removing this revision-level
    # uniqueness lets "Create another video" intentionally use the same page.
    with op.batch_alter_table("extension_project_links") as batch_op:
        batch_op.drop_constraint("uq_ext_project_revision", type_="unique")


def downgrade() -> None:
    with op.batch_alter_table("extension_project_links") as batch_op:
        batch_op.create_unique_constraint(
            "uq_ext_project_revision",
            ["connection_id", "source_url", "content_hash"],
        )

    with op.batch_alter_table("extension_connections") as batch_op:
        batch_op.drop_index("ix_extension_connections_current_project_id")
        batch_op.drop_constraint(
            "fk_extension_connections_current_project",
            type_="foreignkey",
        )
        batch_op.drop_column("current_project_id")
