"""widen mcp_oauth_codes.state to TEXT

Revision ID: mcp_oauth_codes_state_text
Revises: add_project_source_site
Create Date: 2026-10-05

OpenAI's plugin portal sends a ~700-character OAuth `state` (a relay-prefixed,
base64 blob). The VARCHAR(255) column rejected it with StringDataRightTruncation,
so /mcp/authorize failed and the portal reported `server_error`. OAuth clients may
send arbitrarily long state, so store it unbounded.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "mcp_oauth_codes_state_text"
down_revision: Union[str, tuple] = "add_project_source_site"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("mcp_oauth_codes") as batch:
        batch.alter_column("state", existing_type=sa.String(255), type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("mcp_oauth_codes") as batch:
        batch.alter_column("state", existing_type=sa.Text(), type_=sa.String(255), existing_nullable=True)
