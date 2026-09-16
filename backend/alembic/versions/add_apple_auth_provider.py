"""Add Apple sign-in: auth_provider + apple_id, google_id becomes nullable

Accounts are bound to exactly one provider for life (no linking), so we record
which one on every row and give Apple its own id column. google_id must become
nullable because an Apple-only account has none; it keeps its UNIQUE index,
and NULLs are never equal under Postgres/SQLite so any number of Apple rows may
leave it empty.

Existing rows are all Google sign-ups and take auth_provider='google' from the
server_default, so no data backfill is needed.

Revision ID: add_apple_auth_provider
Revises: add_get_started_email_sent_at
Create Date: 2026-09-14

"""
from alembic import op
import sqlalchemy as sa

revision = "add_apple_auth_provider"
down_revision = "add_get_started_email_sent_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(length=16),
            nullable=False,
            server_default="google",
        ),
    )
    op.add_column("users", sa.Column("apple_id", sa.String(length=255), nullable=True))
    op.create_index("ix_users_apple_id", "users", ["apple_id"], unique=True)

    # An Apple-only account has no google_id.
    op.alter_column(
        "users",
        "google_id",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade() -> None:
    # Apple-only rows cannot exist once google_id is NOT NULL again. Refuse
    # rather than silently deleting real accounts — an operator must decide.
    conn = op.get_bind()
    orphans = conn.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE google_id IS NULL")
    ).scalar()
    if orphans:
        raise RuntimeError(
            f"Cannot downgrade: {orphans} Apple-only user(s) have no google_id. "
            "Migrate or remove these accounts first."
        )

    op.alter_column(
        "users",
        "google_id",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_index("ix_users_apple_id", table_name="users")
    op.drop_column("users", "apple_id")
    op.drop_column("users", "auth_provider")
