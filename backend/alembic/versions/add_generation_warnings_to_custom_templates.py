"""add generation_warnings to custom_templates

Stores a JSON array of human-readable warnings from the last code generation —
currently, scenes that exhausted their repair attempts and fell back to the
deterministic stub scene (§R Layer 3). Persisting them lets the UI show which
scene is degraded instead of the user discovering it in the rendered video.

Nullable with no default: existing rows stay NULL and are treated as "no
warnings", so this is a purely additive change.

Revision ID: add_generation_warnings
Revises: pdf_narration_usage
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_generation_warnings"
# Chained onto the revision the live database is actually stamped at, so this
# batch applies cleanly with `alembic upgrade head` rather than requiring a
# merge. The repo carries several other unmerged heads from older branches;
# those are untouched here.
down_revision: Union[str, None] = "pdf_narration_usage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("generation_warnings", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "generation_warnings")
