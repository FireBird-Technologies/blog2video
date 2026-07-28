"""Add projects.is_bulk (bulk projects auto-approve stock footage, skip review)

Bulk-created projects run unattended: the pipeline still auto-picks a stock clip
per image-capable scene, but instead of parking at AWAITING_FOOTAGE for the
interactive review it stamps stock_footage_approved_at and continues straight to
generation. This column marks a project as bulk-created so the gate can make that
decision.

Revision ID: project_is_bulk
Revises: stock_footage_approved_at
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "project_is_bulk"
down_revision: str = "stock_footage_approved_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("projects")}
    if "is_bulk" not in existing:
        op.add_column(
            "projects",
            sa.Column(
                "is_bulk",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )


def downgrade() -> None:
    op.drop_column("projects", "is_bulk")
