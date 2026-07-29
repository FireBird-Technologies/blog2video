"""Stock footage: VIDEO asset type + clip metadata columns on assets

Adds the columns needed to store Pexels/Pixabay clips as project assets.
``duration_seconds`` is load-bearing: the Newscast renderer converts it to
frames for Remotion's ``<Loop durationInFrames={...}>``, so it is probed from
the normalised (CFR 30) file rather than taken from the provider's metadata.

On Postgres ``asset_type`` is a NATIVE enum type (``assettype``), created by the
baseline migration with only IMAGE/AUDIO. Adding a member to the Python enum is
not enough — the database type must be altered too, or inserts fail with
``invalid input value for enum assettype: "VIDEO"``. SQLAlchemy stores enum
*names*, hence the uppercase label. SQLite has no native enum, so that step is
skipped there.

Revision ID: stock_footage_video_assets
Revises: tool_usage_counters
Create Date: 2026-07-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "stock_footage_video_assets"
down_revision: str = "tool_usage_counters"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_COLUMNS = (
    ("duration_seconds", sa.Float()),
    ("width", sa.Integer()),
    ("height", sa.Integer()),
    ("source_provider", sa.String(32)),
    ("source_id", sa.String(64)),
    ("source_author", sa.String(255)),
    ("source_page_url", sa.String(2048)),
    ("audio_variant_filename", sa.String(255)),
)


def upgrade() -> None:
    bind = op.get_bind()

    # database.py's additive bootstrap may already have created these on
    # long-lived dev databases; skip any that exist so the migration is
    # idempotent against those.
    existing = {c["name"] for c in sa.inspect(bind).get_columns("assets")}
    for name, type_ in _COLUMNS:
        if name not in existing:
            op.add_column("assets", sa.Column(name, type_, nullable=True))

    # Teach the native Postgres enum about the new member. ALTER TYPE ... ADD
    # VALUE cannot run inside a transaction block on older Postgres, so issue it
    # in an autocommit block. IF NOT EXISTS keeps re-runs safe.
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'VIDEO'")


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("assets", name)
    # The 'VIDEO' enum member is intentionally left in place: Postgres has no
    # ALTER TYPE ... DROP VALUE, and removing it would mean recreating the type
    # and rewriting the column. It is harmless if unused.
