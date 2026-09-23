"""Add the opt-in initial script review gate.

Revision ID: add_initial_script_review
Revises: add_social_publishing_tables
"""
from alembic import op
import sqlalchemy as sa

revision = "add_initial_script_review"
down_revision = "add_social_publishing_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute(
                "ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'AWAITING_SCRIPT_REVIEW'"
            )
    op.add_column(
        "projects",
        sa.Column("script_review_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "projects",
        sa.Column("script_review_approved_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "script_review_approved_at")
    op.drop_column("projects", "script_review_enabled")
    # PostgreSQL enum members cannot be removed without recreating the type.
