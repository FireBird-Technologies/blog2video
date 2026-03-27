"""Phase 1: BrandKit table, CustomTemplate code fields, Scene scene_type

Revision ID: phase1_brand_kit
Revises: 7ed594338d45
Create Date: 2026-03-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "phase1_brand_kit"
down_revision: Union[str, None] = "add_content_lang"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create brand_kits table
    op.create_table(
        "brand_kits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("brand_name", sa.String(length=255), nullable=True),
        sa.Column("colors", sa.Text(), nullable=True),
        sa.Column("fonts", sa.Text(), nullable=True),
        sa.Column("design_language", sa.Text(), nullable=True),
        sa.Column("logos", sa.Text(), nullable=True),
        sa.Column("images", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_brand_kits_user_id"), "brand_kits", ["user_id"], unique=False)

    # 2. Add nullable code fields to custom_templates
    op.add_column("custom_templates", sa.Column("component_code", sa.Text(), nullable=True))
    op.add_column("custom_templates", sa.Column("intro_code", sa.Text(), nullable=True))
    op.add_column("custom_templates", sa.Column("outro_code", sa.Text(), nullable=True))

    # 3. Add brand_kit_id FK to custom_templates
    op.add_column("custom_templates", sa.Column("brand_kit_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_custom_templates_brand_kit_id"), "custom_templates", ["brand_kit_id"], unique=False)
    op.create_foreign_key(None, "custom_templates", "brand_kits", ["brand_kit_id"], ["id"])

    # 4. Add scene_type to scenes
    op.add_column("scenes", sa.Column("scene_type", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("scenes", "scene_type")
    op.drop_constraint(None, "custom_templates", type_="foreignkey")
    op.drop_index(op.f("ix_custom_templates_brand_kit_id"), table_name="custom_templates")
    op.drop_column("custom_templates", "brand_kit_id")
    op.drop_column("custom_templates", "outro_code")
    op.drop_column("custom_templates", "intro_code")
    op.drop_column("custom_templates", "component_code")
    op.drop_index(op.f("ix_brand_kits_user_id"), table_name="brand_kits")
    op.drop_table("brand_kits")
