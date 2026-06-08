"""drop unused columns from mcp_oauth tables

Revision ID: drop_mcp_oauth_unused_cols
Revises: bbedc2db8c83, add_user_instr_to_regen_jobs
Create Date: 2026-06-08

Drops columns that are stored but never read or used in any code path:

mcp_oauth_clients:
  - client_secret_hash  (always NULL; only PKCE/public clients supported)
  - client_uri          (echoed back to SDK but never used in logic)
  - logo_uri            (no consent screen to display it)
  - contacts            (never used)
  - tos_uri             (never used)
  - policy_uri          (never used)
  - jwks_uri            (JWT-key auth not implemented)
  - software_id         (never used)
  - software_version    (never used)

mcp_oauth_codes:
  - code_challenge_method  (hardcoded to "S256" on every insert, never read back)
  - created_at             (never read in any code path)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "drop_mcp_oauth_unused_cols"
down_revision: Union[str, tuple] = ("bbedc2db8c83", "add_user_instr_to_regen_jobs")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # mcp_oauth_clients — drop 9 unused columns
    with op.batch_alter_table("mcp_oauth_clients") as batch_op:
        batch_op.drop_column("client_secret_hash")
        batch_op.drop_column("client_uri")
        batch_op.drop_column("logo_uri")
        batch_op.drop_column("contacts")
        batch_op.drop_column("tos_uri")
        batch_op.drop_column("policy_uri")
        batch_op.drop_column("jwks_uri")
        batch_op.drop_column("software_id")
        batch_op.drop_column("software_version")

    # mcp_oauth_codes — drop 2 unused columns
    with op.batch_alter_table("mcp_oauth_codes") as batch_op:
        batch_op.drop_column("code_challenge_method")
        batch_op.drop_column("created_at")


def downgrade() -> None:
    # mcp_oauth_codes — restore
    with op.batch_alter_table("mcp_oauth_codes") as batch_op:
        batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("code_challenge_method", sa.String(16), nullable=True))

    # mcp_oauth_clients — restore
    with op.batch_alter_table("mcp_oauth_clients") as batch_op:
        batch_op.add_column(sa.Column("software_version", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("software_id", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("jwks_uri", sa.String(2048), nullable=True))
        batch_op.add_column(sa.Column("policy_uri", sa.String(2048), nullable=True))
        batch_op.add_column(sa.Column("tos_uri", sa.String(2048), nullable=True))
        batch_op.add_column(sa.Column("contacts", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("logo_uri", sa.String(2048), nullable=True))
        batch_op.add_column(sa.Column("client_uri", sa.String(2048), nullable=True))
        batch_op.add_column(sa.Column("client_secret_hash", sa.String(128), nullable=True))
