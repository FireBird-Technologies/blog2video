"""Clamp over-limit FREE users' video usage to the free base.

One-time data fix. The FREE base allowance was lowered (3 → 2), leaving FREE
users who had already consumed 3 videos with videos_used_this_period (3) above
their new video_limit (2). Because can_create_video is
`videos_used_this_period < video_limit`, they are permanently blocked, and even a
purchased per-video credit only lifts the limit back to what was already consumed,
yielding no usable video.

This clamps videos_used_this_period down to the free base (2) for affected FREE
users who have NO row in the subscriptions table (i.e. never purchased anything —
no per-video credits, no plan history). Users with any subscriptions entry are left
untouched, since their video_limit_bonus / usage is governed by the billing recalc
paths and the purchase webhook (User.ensure_purchased_credit_usable) already keeps
their purchased credits usable going forward. Only ever lowers videos_used;
re-running is a no-op.

Revision ID: clamp_stranded_free_video_usage
Revises: add_caption_offset_to_projects
Create Date: 2026-07-07
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "clamp_stranded_free_video_usage"
down_revision: Union[str, None] = "add_caption_offset_to_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Keep in sync with FREE_TIER_INCLUDED_VIDEOS in app/models/user.py
FREE_BASE = 2


def upgrade() -> None:
    # Postgres stores the SQLAlchemy Enum member NAME ('FREE'); a bare 'free' literal
    # is rejected as an invalid enum value. SQLite (dev) stores the lowercase string.
    # Cast plan to text and lowercase it so a single 'free' comparison works on both.
    #
    # Only touch users with NO subscriptions row — i.e. those who never bought a
    # per-video credit or held any plan. Users with any subscriptions entry are
    # governed by the billing recalc paths and are intentionally left alone.
    op.execute(
        f"""
        UPDATE users
        SET videos_used_this_period = {FREE_BASE}
        WHERE LOWER(CAST(plan AS VARCHAR)) = 'free'
          AND videos_used_this_period > {FREE_BASE}
          AND NOT EXISTS (
              SELECT 1 FROM subscriptions s WHERE s.user_id = users.id
          )
        """
    )


def downgrade() -> None:
    # Irreversible: the pre-clamp usage counts are not recoverable, and restoring
    # them would re-strand users. No-op.
    pass
