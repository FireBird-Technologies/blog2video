"""Enforce one style_name per user on preferences.

Style names are unique per user, not globally — two users may each save a
"Brand Voice". Selections travel as ``manual_guide_<preference_id>``, so the id
remains the stable key and a rename never orphans an existing project.

Revision ID: add_pref_uniq_style_name
Revises: add_preferences_table
Create Date: 2026-07-10
"""
from typing import Sequence, Union
from alembic import op

# Keep revision ids under 32 chars: alembic_version.version_num is varchar(32).
revision: str = "add_pref_uniq_style_name"
down_revision: Union[str, None] = "add_preferences_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CONSTRAINT = "uq_preferences_user_id_style_name"


def upgrade() -> None:
    op.create_unique_constraint(_CONSTRAINT, "preferences", ["user_id", "style_name"])


def downgrade() -> None:
    op.drop_constraint(_CONSTRAINT, "preferences", type_="unique")
