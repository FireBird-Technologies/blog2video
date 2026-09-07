"""add design_system to custom_templates

Caches the shared visual design system a template's scenes were generated
against, so a single-scene AI edit (P4) reuses it instead of regenerating.
Regenerating would drift the styling and leave the edited scene subtly out of
step with its siblings — the opposite of what an edit should do.

Revision ID: add_design_system
Revises: add_template_version_metadata
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_design_system"
down_revision: Union[str, None] = "add_template_version_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("custom_templates", sa.Column("design_system", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("custom_templates", "design_system")
