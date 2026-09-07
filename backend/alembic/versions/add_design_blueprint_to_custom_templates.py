"""add design_blueprint to custom_templates

Stores the per-brand Design Blueprint (P2): the template's own layouts with
authored geometry, its persistent structure (chrome / dividers / panel
numbering), type system, safe-area policy, bookend design, and per-layout image
capability.

Persisted rather than recomputed because a per-scene AI edit must regenerate one
scene against the SAME design its siblings were built from, and because
build_custom_meta derives layouts_without_image from the layouts' supports_image
flags.

Nullable: templates generated before the blueprint path existed stay NULL and
fall back to the legacy behaviour.

Revision ID: add_design_blueprint
Revises: add_generation_warnings
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_design_blueprint"
down_revision: Union[str, None] = "add_generation_warnings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("design_blueprint", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "design_blueprint")
