"""Add reusable script style profiles and durable learning jobs.

Revision ID: add_script_style_preferences
Revises: add_initial_script_review
"""
from alembic import op
import sqlalchemy as sa


revision = "add_script_style_preferences"
down_revision = "add_initial_script_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("script_preferences", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("script_preferences_version", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "users", sa.Column("script_preferences_updated_at", sa.DateTime(), nullable=True)
    )
    op.add_column("projects", sa.Column("script_style_snapshot", sa.Text(), nullable=True))
    op.add_column(
        "projects", sa.Column("script_preferences_version_used", sa.Integer(), nullable=True)
    )
    op.create_table(
        "script_preference_learning_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False, unique=True),
        sa.Column("evidence_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="queued", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("profile_version_at_enqueue", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_script_preference_jobs_user_id", "script_preference_learning_jobs", ["user_id"])
    op.create_index("ix_script_preference_jobs_project_id", "script_preference_learning_jobs", ["project_id"])
    op.create_index("ix_script_preference_jobs_status", "script_preference_learning_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("script_preference_learning_jobs")
    op.drop_column("projects", "script_preferences_version_used")
    op.drop_column("projects", "script_style_snapshot")
    op.drop_column("users", "script_preferences_updated_at")
    op.drop_column("users", "script_preferences_version")
    op.drop_column("users", "script_preferences")
