"""Remove Apple and Microsoft sign-in: drop users.apple_id and users.microsoft_id

Undoes add_apple_auth_provider and add_microsoft_auth_provider. It has to be a
new forward revision rather than an alembic downgrade of those two: both sit
upstream of add_email_password_auth and add_user_token_version, so reverting
them would take the built-in email/password provider down with them.

google_id deliberately stays NULLABLE. add_apple_auth_provider made it nullable
because an Apple-only account has none, but email/password accounts have none
either — restoring NOT NULL here would break every account created by our own
provider. Nullability is now owned by add_email_password_auth's world, not by
Apple's.

auth_provider stays: it still distinguishes 'google' from 'email'. Only the two
removed providers' id columns go.

Revision ID: drop_apple_microsoft_auth
Revises: add_user_token_version
Create Date: 2026-09-16

"""
from alembic import op
import sqlalchemy as sa

revision = "drop_apple_microsoft_auth"
down_revision = "add_user_token_version"
branch_labels = None
depends_on = None


def _index_names(conn, table: str) -> set[str]:
    """Indexes actually present, so a re-run or a drifted DB doesn't hard-fail."""
    return {ix["name"] for ix in sa.inspect(conn).get_indexes(table)}


def _column_names(conn, table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(conn).get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()

    # An Apple/Microsoft account's ONLY credential is the id column dropped
    # below: no password_hash, no google_id. Dropping it would strand real
    # accounts with an auth_provider the code no longer understands, unable to
    # sign in and unable to recover. Refuse and let an operator decide — the
    # same guard the two original migrations' downgrades use.
    stranded = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM users WHERE auth_provider IN ('apple', 'microsoft')"
        )
    ).scalar()
    if stranded:
        raise RuntimeError(
            f"Cannot drop Apple/Microsoft sign-in: {stranded} account(s) still use it "
            "and would lose their only credential. Migrate or remove these accounts "
            "first (e.g. move them to email/password, or soft-delete them)."
        )

    indexes = _index_names(conn, "users")
    columns = _column_names(conn, "users")

    if "ix_users_apple_id" in indexes:
        op.drop_index("ix_users_apple_id", table_name="users")
    if "apple_id" in columns:
        op.drop_column("users", "apple_id")

    if "ix_users_microsoft_id" in indexes:
        op.drop_index("ix_users_microsoft_id", table_name="users")
    if "microsoft_id" in columns:
        op.drop_column("users", "microsoft_id")


def downgrade() -> None:
    """Restore both columns, empty.

    The ids themselves are gone — this brings back the shape, not the data, so
    re-enabling either provider means every affected user signs in afresh.
    """
    conn = op.get_bind()
    columns = _column_names(conn, "users")

    if "apple_id" not in columns:
        op.add_column("users", sa.Column("apple_id", sa.String(length=255), nullable=True))
        op.create_index("ix_users_apple_id", "users", ["apple_id"], unique=True)

    if "microsoft_id" not in columns:
        op.add_column(
            "users", sa.Column("microsoft_id", sa.String(length=255), nullable=True)
        )
        op.create_index("ix_users_microsoft_id", "users", ["microsoft_id"], unique=True)
