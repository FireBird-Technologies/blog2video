"""Add LANGUAGE_REGENERATING to projectstatus enum.

The change-language job parks the project in a dedicated status while it runs (so the
status endpoints and stall reapers can tell it apart from a voice change). Postgres
enforces enum membership, so the new label must be added before any project can be
written with it. SQLite (tests/dev) stores the value as text and needs no change.

Revision ID: add_language_regenerating_status
Revises: add_project_language_change_jobs
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op


revision: str = "add_language_regenerating_status"
down_revision: Union[str, None] = "add_project_language_change_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # SQLAlchemy persists the enum's NAME, so the label is upper-case.
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'LANGUAGE_REGENERATING'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
