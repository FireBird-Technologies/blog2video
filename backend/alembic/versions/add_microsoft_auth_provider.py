"""Add Microsoft sign-in: microsoft_id column

Third provider alongside Google and Apple. Accounts stay bound to exactly one
provider for life (no linking), so this only needs the new id column — the
auth_provider column and the nullable google_id already landed with Apple.

Purely additive: a nullable column plus an index, no constraint changes and no
backfill, so it takes no disruptive lock on `users`.

Revision ID: add_microsoft_auth_provider
Revises: add_apple_auth_provider
Create Date: 2026-09-14

"""
from alembic import op
import sqlalchemy as sa

revision = "add_microsoft_auth_provider"
down_revision = "add_apple_auth_provider"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("microsoft_id", sa.String(length=255), nullable=True))
    op.create_index("ix_users_microsoft_id", "users", ["microsoft_id"], unique=True)


def downgrade() -> None:
    # Microsoft accounts have no other identity column to fall back on, so
    # dropping this would strand them. Refuse rather than silently orphan real
    # accounts — an operator must migrate or remove them first.
    conn = op.get_bind()
    orphans = conn.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE auth_provider = 'microsoft'")
    ).scalar()
    if orphans:
        raise RuntimeError(
            f"Cannot downgrade: {orphans} Microsoft user(s) would lose their identity. "
            "Migrate or remove these accounts first."
        )

    op.drop_index("ix_users_microsoft_id", table_name="users")
    op.drop_column("users", "microsoft_id")
