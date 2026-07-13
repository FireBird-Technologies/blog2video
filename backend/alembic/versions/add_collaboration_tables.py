"""Add collaboration: project_members table, project draft columns, edit-history attribution.

Revision ID: add_collaboration
Revises: clamp_stranded_free_video_usage
Create Date: 2026-07-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_collaboration"
down_revision: Union[str, Sequence[str], None] = "clamp_stranded_free_video_usage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, table):
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # ─── project_members ─────────────────────────────────────────────
    if "project_members" not in tables:
        op.create_table(
            "project_members",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("invited_email", sa.String(320), nullable=False),
            sa.Column("role", sa.String(20), nullable=False, server_default="editor"),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("invited_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("invite_token", sa.String(64), nullable=False),
            sa.Column("error_message", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("project_id", "invited_email", name="uq_project_member_email"),
            sa.UniqueConstraint("invite_token", name="uq_project_member_token"),
        )
        op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
        op.create_index("ix_project_members_user_id", "project_members", ["user_id"])
        op.create_index("ix_project_members_invited_email", "project_members", ["invited_email"])
        op.create_index("ix_project_members_invite_token", "project_members", ["invite_token"])

    # ─── projects draft columns ──────────────────────────────────────
    proj_cols = _cols(inspector, "projects")
    if "draft_state" not in proj_cols:
        op.add_column("projects", sa.Column("draft_state", sa.Text(), nullable=True))
    if "draft_updated_at" not in proj_cols:
        op.add_column("projects", sa.Column("draft_updated_at", sa.DateTime(), nullable=True))

    # ─── edit-history attribution columns ────────────────────────────
    for tbl in ("scene_edit_history", "project_edit_history"):
        if tbl not in tables:
            continue
        cols = _cols(inspector, tbl)
        if "user_id" not in cols:
            op.add_column(tbl, sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
            op.create_index(f"ix_{tbl}_user_id", tbl, ["user_id"])
        if "change_set_id" not in cols:
            op.add_column(tbl, sa.Column("change_set_id", sa.Text(), nullable=True))
            op.create_index(f"ix_{tbl}_change_set_id", tbl, ["change_set_id"])
        if "target" not in cols:
            op.add_column(tbl, sa.Column("target", sa.Text(), nullable=False, server_default="published"))
        if "reverted" not in cols:
            op.add_column(tbl, sa.Column("reverted", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "revert_of_change_set_id" not in cols:
            op.add_column(tbl, sa.Column("revert_of_change_set_id", sa.Text(), nullable=True))

    # ─── backfill OWNER member for every existing project ────────────
    op.execute(
        sa.text(
            """
            INSERT INTO project_members
                (project_id, user_id, invited_email, role, status,
                 invited_by_id, invite_token, created_at, accepted_at)
            SELECT p.id, p.user_id, u.email, 'owner', 'accepted',
                   p.user_id, md5(random()::text || p.id::text), NOW(), NOW()
            FROM projects p
            JOIN users u ON u.id = p.user_id
            WHERE NOT EXISTS (
                SELECT 1 FROM project_members m
                WHERE m.project_id = p.id AND m.role = 'owner'
            )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    for tbl in ("scene_edit_history", "project_edit_history"):
        if tbl not in tables:
            continue
        cols = _cols(inspector, tbl)
        for col in ("revert_of_change_set_id", "reverted", "target", "change_set_id", "user_id"):
            if col in cols:
                op.drop_column(tbl, col)

    proj_cols = _cols(inspector, "projects")
    for col in ("draft_updated_at", "draft_state"):
        if col in proj_cols:
            op.drop_column("projects", col)

    if "project_members" in tables:
        op.drop_table("project_members")
