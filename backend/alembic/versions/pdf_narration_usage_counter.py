"""Track pdf2vid narration usage on users table

Adds ``pdf_narrations_used`` to back the one-per-account cap on the PDF → Audio
tool. Unlike the other /tools counters this allowance is lifetime on EVERY plan
(see LIFETIME_TOOLS in app/models/user.py), so the column is never cleared by a
billing-period reset.

Backfilled to 0, which grants every existing account one narration from the
moment this ships. The endpoint was previously unmetered, so there is no prior
usage recorded to preserve.

Revision ID: pdf_narration_usage
Revises: support_escalation_count
Create Date: 2026-08-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "pdf_narration_usage"
down_revision: Union[str, Sequence[str]] = "support_escalation_count"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("pdf_narrations_used", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "pdf_narrations_used")
