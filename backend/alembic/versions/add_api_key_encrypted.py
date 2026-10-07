"""Add api_keys.key_encrypted

An encrypted copy of each API key, so its owner can copy it again from the API
keys page (services/api_key_crypto.py). Authentication still uses key_hash
only. Nullable: keys created before this column exist stay usable but can't be
copied until they are rotated.

Its own revision because add_public_api was already applied in some
environments before this column existed.

Revision ID: add_api_key_encrypted
Revises: add_public_api
Create Date: 2026-09-29

"""
from alembic import op
import sqlalchemy as sa

revision = "add_api_key_encrypted"
down_revision = "add_public_api"
branch_labels = None
depends_on = None


def _columns(conn) -> set[str]:
    insp = sa.inspect(conn)
    if "api_keys" not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns("api_keys")}


def upgrade() -> None:
    cols = _columns(op.get_bind())
    if cols and "key_encrypted" not in cols:
        op.add_column("api_keys", sa.Column("key_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    if "key_encrypted" in _columns(op.get_bind()):
        op.drop_column("api_keys", "key_encrypted")
