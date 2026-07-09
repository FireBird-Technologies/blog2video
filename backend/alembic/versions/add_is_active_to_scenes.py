"""Add is_active to scenes for soft-delete support (revertable scene deletion).

Revision ID: add_is_active_to_scenes
Revises: backfill_legacy_history
Create Date: 2026-07-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_is_active_to_scenes"
down_revision: Union[str, None] = "backfill_legacy_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scenes",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    # The Project.scenes ORM relationship is now filtered to active scenes, so ORM
    # delete-orphan would not cascade to soft-deleted rows on project delete. Recreate
    # the FK with ON DELETE CASCADE so the DB removes ALL scene rows regardless.
    op.drop_constraint("scenes_project_id_fkey", "scenes", type_="foreignkey")
    op.create_foreign_key(
        "scenes_project_id_fkey",
        "scenes",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("scenes_project_id_fkey", "scenes", type_="foreignkey")
    op.create_foreign_key(
        "scenes_project_id_fkey",
        "scenes",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.drop_column("scenes", "is_active")
