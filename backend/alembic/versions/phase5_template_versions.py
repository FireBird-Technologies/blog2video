"""Phase 5: Template versioning for regeneration and rollback

Revision ID: phase5_template_versions
Revises: phase1_brand_kit_and_schema_fields
Create Date: 2026-03-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "phase5_template_versions"
down_revision: Union[str, None] = "phase1_brand_kit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "template_versions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("custom_templates.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("component_code", sa.Text(), nullable=True),
        sa.Column("intro_code", sa.Text(), nullable=True),
        sa.Column("outro_code", sa.Text(), nullable=True),
        sa.Column("label", sa.String(255), nullable=False, server_default="Generated"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=True,
            index=True,
        ),
    )

    # Add current_version_id to custom_templates
    op.add_column(
        "custom_templates",
        sa.Column("current_version_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "current_version_id")
    op.drop_table("template_versions")
