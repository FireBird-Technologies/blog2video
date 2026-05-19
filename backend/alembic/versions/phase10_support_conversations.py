"""Phase 10: Support bot conversations and messages

Revision ID: phase10_support_conversations
Revises: phase9_generation_failed
Create Date: 2026-05-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "phase10_support_conversations"
down_revision: str = "add_affiliate_user_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "support_conversations",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("session_state", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_support_conv_user_updated",
        "support_conversations",
        ["user_id", "updated_at"],
    )
    op.create_index(
        "ix_support_conv_session_updated",
        "support_conversations",
        ["session_id", "updated_at"],
    )

    op.create_table(
        "support_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "conversation_id",
            sa.BigInteger(),
            sa.ForeignKey("support_conversations.id"),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.String(9),  # VARCHAR(9) instead of native enum
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_path", sa.String(length=512), nullable=True),
        sa.Column("cited_docs", sa.JSON(), nullable=True),
        sa.Column("ui_guidance", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_support_msg_conv", "support_messages", ["conversation_id"])
    op.create_index("ix_support_msg_created", "support_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_support_msg_created", table_name="support_messages")
    op.drop_index("ix_support_msg_conv", table_name="support_messages")
    op.drop_table("support_messages")
    op.drop_index("ix_support_conv_session_updated", table_name="support_conversations")
    op.drop_index("ix_support_conv_user_updated", table_name="support_conversations")
    op.drop_table("support_conversations")
    op.execute("DROP TYPE IF EXISTS supportmessagerole")
