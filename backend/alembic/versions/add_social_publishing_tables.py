"""Add social publishing: social_connections + social_publish_jobs

Backs the "render & publish to YouTube/X" feature. Two tables in one revision
because they ship together and social_publish_jobs.connection_id references the
other — splitting them would create a revision that cannot stand alone.

social_connections holds per-user OAuth grants (Fernet-encrypted tokens); it is
the first per-user third-party credential store in this codebase. The unique
(user_id, platform) pair makes reconnecting an UPSERT.

social_publish_jobs holds one upload each, and its `pending_render` rows are the
record that a user asked to publish a video that has not finished rendering —
which is what lets that flow survive the user closing the tab.

NOTE ON down_revision: this repo's migration graph has several heads that
predate this change (add_user_instr_to_regen_jobs, add_video_length_to_projects,
bbedc2db8c83, drop_blast_campaigns, expand_category_varchar and this one's
parent). This revision chains off drop_apple_microsoft_auth, the most recent
head and the tip of the auth work on develop. It touches only new tables, so it
does not interact with the other heads' subject matter — but `alembic upgrade
head` remains ambiguous until those are merged, and deploys should keep naming
the revision explicitly.

Revision ID: add_social_publishing_tables
Revises: drop_apple_microsoft_auth
Create Date: 2026-09-17

"""
from alembic import op
import sqlalchemy as sa

revision = "add_social_publishing_tables"
down_revision = "drop_apple_microsoft_auth"
branch_labels = None
depends_on = None


def _table_names(conn) -> set[str]:
    """Tables actually present, so a re-run or a drifted DB doesn't hard-fail."""
    return set(sa.inspect(conn).get_table_names())


def _index_names(conn, table: str) -> set[str]:
    return {ix["name"] for ix in sa.inspect(conn).get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()
    tables = _table_names(conn)

    if "social_connections" not in tables:
        op.create_table(
            "social_connections",
            sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("platform", sa.String(length=20), nullable=False),
            sa.Column("access_token_enc", sa.Text(), nullable=True),
            sa.Column("refresh_token_enc", sa.Text(), nullable=True),
            sa.Column("token_expires_at", sa.DateTime(), nullable=True),
            sa.Column("scopes", sa.Text(), nullable=True),
            sa.Column("account_id", sa.String(length=128), nullable=True),
            sa.Column("account_handle", sa.String(length=255), nullable=True),
            sa.Column("account_name", sa.String(length=255), nullable=True),
            sa.Column("account_avatar_url", sa.Text(), nullable=True),
            # server_default alongside the ORM's Python-side default, matching
            # add_project_voice_change_jobs: the column stays NOT NULL even for a
            # row inserted outside the ORM (a backfill, a psql session).
            sa.Column(
                "status", sa.String(length=20), nullable=False, server_default="active"
            ),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
            ),
            sa.Column(
                "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "platform", name="uq_social_connections_user_platform"
            ),
        )

    indexes = _index_names(conn, "social_connections")
    if "ix_social_connections_user_id" not in indexes:
        op.create_index(
            "ix_social_connections_user_id", "social_connections", ["user_id"]
        )
    if "ix_social_connections_platform" not in indexes:
        op.create_index(
            "ix_social_connections_platform", "social_connections", ["platform"]
        )
    if "ix_social_connections_status" not in indexes:
        op.create_index(
            "ix_social_connections_status", "social_connections", ["status"]
        )

    tables = _table_names(conn)
    if "social_publish_jobs" not in tables:
        op.create_table(
            "social_publish_jobs",
            sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("connection_id", sa.Integer(), nullable=True),
            sa.Column("platform", sa.String(length=20), nullable=False),
            sa.Column(
                "status",
                sa.String(length=24),
                nullable=False,
                server_default="pending_render",
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("tags", sa.Text(), nullable=True),
            sa.Column(
                "privacy_status",
                sa.String(length=12),
                nullable=False,
                server_default="private",
            ),
            sa.Column(
                "made_for_kids",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column("category_id", sa.String(length=8), nullable=True),
            sa.Column(
                "source", sa.String(length=16), nullable=False, server_default="existing"
            ),
            sa.Column("r2_video_key", sa.String(length=512), nullable=True),
            sa.Column("render_run_id", sa.String(length=64), nullable=True),
            sa.Column("resumable_url", sa.Text(), nullable=True),
            # BigInteger: a long 1080p render exceeds Integer's 2^31 byte ceiling.
            sa.Column(
                "uploaded_bytes", sa.BigInteger(), nullable=False, server_default="0"
            ),
            sa.Column(
                "total_bytes", sa.BigInteger(), nullable=False, server_default="0"
            ),
            sa.Column("platform_post_id", sa.String(length=128), nullable=True),
            sa.Column("platform_post_url", sa.Text(), nullable=True),
            sa.Column(
                "forced_private",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column(
                "attempt_count", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column(
                "retryable", sa.Boolean(), nullable=False, server_default=sa.true()
            ),
            sa.Column("error_code", sa.String(length=48), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
            ),
            sa.Column(
                "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
            ),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            # SET NULL: disconnecting an account must not erase the record of
            # what was already published through it.
            sa.ForeignKeyConstraint(
                ["connection_id"], ["social_connections.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = _index_names(conn, "social_publish_jobs")
    if "ix_social_publish_jobs_project_id" not in indexes:
        op.create_index(
            "ix_social_publish_jobs_project_id", "social_publish_jobs", ["project_id"]
        )
    if "ix_social_publish_jobs_user_id" not in indexes:
        op.create_index(
            "ix_social_publish_jobs_user_id", "social_publish_jobs", ["user_id"]
        )
    if "ix_social_publish_jobs_platform" not in indexes:
        op.create_index(
            "ix_social_publish_jobs_platform", "social_publish_jobs", ["platform"]
        )
    if "ix_social_publish_jobs_status" not in indexes:
        op.create_index(
            "ix_social_publish_jobs_status", "social_publish_jobs", ["status"]
        )
    # Serves both the per-project status endpoint and the duplicate-in-flight guard.
    if "ix_social_publish_jobs_project_status" not in indexes:
        op.create_index(
            "ix_social_publish_jobs_project_status",
            "social_publish_jobs",
            ["project_id", "status"],
        )


def downgrade() -> None:
    """Drop both tables.

    Every stored OAuth grant goes with them: re-upgrading brings back the shape,
    not the data, so anyone who had connected an account reconnects from scratch.
    """
    conn = op.get_bind()
    tables = _table_names(conn)

    # Jobs first — it carries the FK to connections.
    if "social_publish_jobs" in tables:
        op.drop_table("social_publish_jobs")
    if "social_connections" in tables:
        op.drop_table("social_connections")
