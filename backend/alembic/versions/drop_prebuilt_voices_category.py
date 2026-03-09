"""drop category from prebuilt_voices

Revision ID: drop_prebuilt_category
Revises: add_prebuilt_voices
Create Date: 2026-03-04

If prebuilt_voices does not exist (e.g. add_prebuilt_voices was stamped but not run),
creates the table without the category column. Otherwise drops the category column.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_prebuilt_category"
down_revision: Union[str, None] = "add_prebuilt_voices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(connection, table_name: str) -> bool:
    result = connection.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = CURRENT_SCHEMA() AND table_name = :name)"
        ),
        {"name": table_name},
    )
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "prebuilt_voices"):
        op.create_table(
            "prebuilt_voices",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("voice_id", sa.String(length=100), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("preview_url", sa.String(length=2048), nullable=True),
            sa.Column("labels", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("plan", sa.String(length=20), nullable=False, server_default="paid"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("voice_id", name="uq_prebuilt_voices_voice_id"),
            sa.CheckConstraint("plan IN ('free', 'paid')", name="prebuilt_voice_plan_check"),
        )
        op.create_index(op.f("ix_prebuilt_voices_voice_id"), "prebuilt_voices", ["voice_id"], unique=True)
    else:
        op.drop_column("prebuilt_voices", "category")


def downgrade() -> None:
    op.add_column("prebuilt_voices", sa.Column("category", sa.String(length=50), nullable=True))
