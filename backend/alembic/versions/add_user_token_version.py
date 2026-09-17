"""Add users.token_version for JWT revocation

Our access tokens are stateless, so until now nothing could invalidate one
before it expired: logging out only cleared the browser's copy, and changing a
password left any already-issued token working for the rest of its 72 hours (30
days for an MCP refresh token). Every token now carries the account's counter as
a "tv" claim, and get_current_user rejects any token whose claim no longer
matches — so bumping this column revokes them all at once.

Defaults to 0, which is also how a token minted before the claim existed is read,
so deploying this signs nobody out.

Purely additive: one NOT NULL column with a server default, no backfill.

Revision ID: add_user_token_version
Revises: add_email_password_auth
Create Date: 2026-09-15

"""
from alembic import op
import sqlalchemy as sa

revision = "add_user_token_version"
down_revision = "add_email_password_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    # Safe to drop: losing the column means tokens stop being checked against it,
    # which restores the previous (weaker) behaviour rather than locking anyone
    # out. Tokens already issued keep working until they expire.
    op.drop_column("users", "token_version")
