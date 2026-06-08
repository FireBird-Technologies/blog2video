"""add mcp oauth tables

Revision ID: bbedc2db8c83
Revises: phase12_free_templates_download
Create Date: 2026-05-25 16:45:52.075168

Creates two tables for the hosted MCP server's OAuth 2.1 authorization-code
flow:
- mcp_oauth_clients: Dynamic Client Registration storage (one row per
  claude.ai install or other MCP client)
- mcp_oauth_codes: short-lived authorization codes pending exchange for
  JWT access + refresh tokens

Access and refresh tokens are JWTs (see app/auth.py) and are NOT stored
in the DB.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'bbedc2db8c83'
down_revision: Union[str, None] = 'phase12_free_templates_download'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mcp_oauth_clients',
        sa.Column('client_id', sa.String(length=64), nullable=False),
        sa.Column('client_secret_hash', sa.String(length=128), nullable=True),
        sa.Column('client_name', sa.String(length=255), nullable=False),
        sa.Column('redirect_uris', sa.JSON(), nullable=False),
        sa.Column('grant_types', sa.JSON(), nullable=False),
        sa.Column('response_types', sa.JSON(), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('token_endpoint_auth_method', sa.String(length=64), nullable=False),
        sa.Column('client_uri', sa.String(length=2048), nullable=True),
        sa.Column('logo_uri', sa.String(length=2048), nullable=True),
        sa.Column('contacts', sa.JSON(), nullable=True),
        sa.Column('tos_uri', sa.String(length=2048), nullable=True),
        sa.Column('policy_uri', sa.String(length=2048), nullable=True),
        sa.Column('jwks_uri', sa.String(length=2048), nullable=True),
        sa.Column('software_id', sa.String(length=255), nullable=True),
        sa.Column('software_version', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('client_id'),
    )
    op.create_table(
        'mcp_oauth_codes',
        sa.Column('code', sa.String(length=128), nullable=False),
        sa.Column('client_id', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('redirect_uri', sa.String(length=2048), nullable=False),
        sa.Column('code_challenge', sa.String(length=255), nullable=True),
        sa.Column('code_challenge_method', sa.String(length=16), nullable=True),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('state', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['mcp_oauth_clients.client_id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('code'),
    )
    op.create_index(op.f('ix_mcp_oauth_codes_client_id'), 'mcp_oauth_codes', ['client_id'], unique=False)
    op.create_index(op.f('ix_mcp_oauth_codes_user_id'), 'mcp_oauth_codes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mcp_oauth_codes_user_id'), table_name='mcp_oauth_codes')
    op.drop_index(op.f('ix_mcp_oauth_codes_client_id'), table_name='mcp_oauth_codes')
    op.drop_table('mcp_oauth_codes')
    op.drop_table('mcp_oauth_clients')
