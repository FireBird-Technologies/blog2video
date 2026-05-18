"""Drop supported_video_style column from custom_templates and crafted_templates.

The per-template video_style concept is gone. Video style now belongs to the
Project (Auto/Explainer/Promotional/Storytelling), chosen at create-time on the
blog URL form, with an LLM resolver for "Auto".

Revision ID: drop_supported_video_style
Revises: add_referral_invites
Create Date: 2026-05-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_supported_video_style"
down_revision: Union[str, None] = "add_referral_invites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table in ("custom_templates", "crafted_templates"):
        cols = {c["name"] for c in inspector.get_columns(table)}
        if "supported_video_style" in cols:
            op.drop_column(table, "supported_video_style")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table in ("custom_templates", "crafted_templates"):
        cols = {c["name"] for c in inspector.get_columns(table)}
        if "supported_video_style" not in cols:
            op.add_column(
                table,
                sa.Column(
                    "supported_video_style",
                    sa.String(length=30),
                    nullable=False,
                    server_default="explainer",
                ),
            )
