"""add standard plan tier

Revision ID: add_standard_plan
Revises: bc6d48f1b3be
Create Date: 2026-03-02

Adds STANDARD to the plantier enum so users.plan can be 'standard'.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "add_standard_plan"
down_revision: Union[str, None] = "bc6d48f1b3be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    dialect_name = conn.dialect.name
    if dialect_name == "postgresql":
        # Add STANDARD to the existing enum type. Without this, the DB only has FREE and PRO.
        op.execute("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'STANDARD'")
    # SQLite: no native enum; plan column is typically VARCHAR. App accepts 'standard'. No change needed.


def downgrade() -> None:
    # Removing an enum value in PostgreSQL requires recreating the type; skip for simplicity.
    pass
