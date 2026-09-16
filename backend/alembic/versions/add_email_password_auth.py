"""Add built-in email/password sign-in: users.password_hash + verification codes

Our own provider alongside Google/Apple/Microsoft. Accounts stay bound to exactly
one provider for life (no linking), so an email account needs no id column — the
credential is the password hash added here, and mailbox control is proven by a
one-time code before the users row is created at all.

`email_verification_codes` holds pending signups (email + the hashed password the
user typed) and password-reset codes. Pending signups deliberately do NOT live in
`users`: is_active=False already means soft-deleted, and users.email is UNIQUE, so
an abandoned signup parked there would squat the address permanently.

Purely additive: one nullable column plus a new table, no backfill and no
constraint changes, so it takes no disruptive lock on `users`.

Revision ID: add_email_password_auth
Revises: add_microsoft_auth_provider
Create Date: 2026-09-15

"""
from alembic import op
import sqlalchemy as sa

revision = "add_email_password_auth"
down_revision = "add_microsoft_auth_provider"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))

    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("pending_password_hash", sa.String(length=255), nullable=True),
        sa.Column("pending_name", sa.String(length=255), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_sent_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_email_verification_codes_email", "email_verification_codes", ["email"]
    )
    # Every lookup is by (email, purpose) — codes are scoped to one purpose so a
    # signup code can never be replayed as a password reset.
    op.create_index(
        "ix_email_verification_codes_email_purpose",
        "email_verification_codes",
        ["email", "purpose"],
    )


def downgrade() -> None:
    # An email/password account's ONLY credential is password_hash — there is no
    # external identity provider to fall back on, so dropping it would lock these
    # users out permanently. Refuse rather than silently orphan real accounts; an
    # operator must migrate or remove them first.
    conn = op.get_bind()
    orphans = conn.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE auth_provider = 'email'")
    ).scalar()
    if orphans:
        raise RuntimeError(
            f"Cannot downgrade: {orphans} email/password user(s) would lose their only "
            "credential. Migrate or remove these accounts first."
        )

    op.drop_index(
        "ix_email_verification_codes_email_purpose", table_name="email_verification_codes"
    )
    op.drop_index("ix_email_verification_codes_email", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")
    op.drop_column("users", "password_hash")
