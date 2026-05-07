"""Add crafted templates and entitlements.

Revision ID: add_crafted_templates
Revises: add_affiliate_user_columns
Create Date: 2026-05-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_crafted_templates"
down_revision: Union[str, None] = "add_affiliate_user_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "crafted_templates" not in table_names:
        op.create_table(
            "crafted_templates",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("template_key", sa.String(length=120), nullable=False),
            sa.Column("public_template_id", sa.String(length=140), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("category", sa.String(length=255), nullable=False, server_default="blog"),
            sa.Column("supported_video_style", sa.String(length=30), nullable=False, server_default="explainer"),
            sa.Column("r2_prefix", sa.String(length=1024), nullable=False),
            sa.Column("manifest_path", sa.String(length=1024), nullable=False),
            sa.Column("checksum", sa.String(length=128), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_by_admin_id", sa.Integer(), nullable=True),
            sa.Column("cached_meta_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["created_by_admin_id"], ["users.id"]),
            sa.UniqueConstraint("template_key", name="uq_crafted_templates_template_key"),
            sa.UniqueConstraint("public_template_id", name="uq_crafted_templates_public_template_id"),
        )
        op.create_index("ix_crafted_templates_template_key", "crafted_templates", ["template_key"])
        op.create_index("ix_crafted_templates_public_template_id", "crafted_templates", ["public_template_id"])
        op.create_index("ix_crafted_templates_status", "crafted_templates", ["status"])
        op.create_index("ix_crafted_templates_created_by_admin_id", "crafted_templates", ["created_by_admin_id"])

    if "crafted_template_entitlements" not in table_names:
        op.create_table(
            "crafted_template_entitlements",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("crafted_template_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("starts_at", sa.DateTime(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["crafted_template_id"], ["crafted_templates.id"]),
            sa.UniqueConstraint("user_id", "crafted_template_id", name="uq_user_crafted_template"),
        )
        op.create_index("ix_crafted_template_entitlements_user_id", "crafted_template_entitlements", ["user_id"])
        op.create_index("ix_crafted_template_entitlements_crafted_template_id", "crafted_template_entitlements", ["crafted_template_id"])
        op.create_index("ix_crafted_template_entitlements_status", "crafted_template_entitlements", ["status"])

    if "projects" in table_names:
        project_cols = {c["name"] for c in inspector.get_columns("projects")}
        if "crafted_template_id" not in project_cols:
            op.add_column("projects", sa.Column("crafted_template_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                "fk_projects_crafted_template_id",
                "projects",
                "crafted_templates",
                ["crafted_template_id"],
                ["id"],
            )
            op.create_index("ix_projects_crafted_template_id", "projects", ["crafted_template_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "projects" in table_names:
        project_cols = {c["name"] for c in inspector.get_columns("projects")}
        if "crafted_template_id" in project_cols:
            try:
                op.drop_index("ix_projects_crafted_template_id", table_name="projects")
            except Exception:
                pass
            try:
                op.drop_constraint("fk_projects_crafted_template_id", "projects", type_="foreignkey")
            except Exception:
                pass
            op.drop_column("projects", "crafted_template_id")

    if "crafted_template_entitlements" in table_names:
        for idx in (
            "ix_crafted_template_entitlements_status",
            "ix_crafted_template_entitlements_crafted_template_id",
            "ix_crafted_template_entitlements_user_id",
        ):
            try:
                op.drop_index(idx, table_name="crafted_template_entitlements")
            except Exception:
                pass
        op.drop_table("crafted_template_entitlements")

    if "crafted_templates" in table_names:
        for idx in (
            "ix_crafted_templates_created_by_admin_id",
            "ix_crafted_templates_status",
            "ix_crafted_templates_public_template_id",
            "ix_crafted_templates_template_key",
        ):
            try:
                op.drop_index(idx, table_name="crafted_templates")
            except Exception:
                pass
        op.drop_table("crafted_templates")
