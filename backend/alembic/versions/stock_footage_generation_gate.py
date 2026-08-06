"""Generation-time stock footage: projects.stock_footage_enabled + AWAITING_FOOTAGE status

Adds the creation-time opt-in flag and the paused pipeline state used by the
post-script verification gate.

On Postgres ``status`` is a NATIVE enum (``projectstatus``) holding member NAMES
(CREATED, SCRAPED, …). Adding a member to the Python enum is not enough — the
database type must be altered too, or every write of the new value fails with
``invalid input value for enum projectstatus``. ``ALTER TYPE … ADD VALUE`` cannot
run inside a transaction block on older Postgres, hence the autocommit block.
SQLite has no native enum, so that step is skipped there.

Revision ID: stock_footage_generation_gate
Revises: stock_footage_video_assets
Create Date: 2026-07-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "stock_footage_generation_gate"
down_revision: str = "stock_footage_video_assets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # database.py's additive bootstrap may already have created this on
    # long-lived dev databases; skip it there so the migration is idempotent.
    existing = {c["name"] for c in sa.inspect(bind).get_columns("projects")}
    if "stock_footage_enabled" not in existing:
        op.add_column(
            "projects",
            sa.Column(
                "stock_footage_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute(
                "ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'AWAITING_FOOTAGE'"
            )


def downgrade() -> None:
    op.drop_column("projects", "stock_footage_enabled")
    # The AWAITING_FOOTAGE enum member is intentionally left in place: Postgres
    # has no ALTER TYPE ... DROP VALUE, and removing it would mean recreating the
    # type and rewriting the column. Harmless if unused.
