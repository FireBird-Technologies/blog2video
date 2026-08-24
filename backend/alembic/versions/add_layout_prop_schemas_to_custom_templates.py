"""add layout_prop_schemas to custom_templates

Stores the per-layout editable props each generated scene declared (P3), shaped
{"intro": [...], "content": [[...], ...], "outro": [...]} — the same indexing
convention as image_box_aspect_ratios.

This is what makes custom-template scenes editable. build_custom_meta turns it
into meta.layout_prop_schema, which SceneEditModal's existing generic field
renderer already consumes for built-in and crafted templates.

Nullable: templates generated before P3 stay NULL, meta omits the key, and the
editor falls through to the fixed structured-content fields exactly as today.

Revision ID: add_layout_prop_schemas
Revises: add_design_blueprint
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_layout_prop_schemas"
down_revision: Union[str, None] = "add_design_blueprint"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("layout_prop_schemas", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "layout_prop_schemas")
