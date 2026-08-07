"""Scene: record WHY a cutout is missing when the render itself succeeded.

Matting moved off this server and INTO the Modal render container, so /render now
returns the mp4 together with its transparent .mov/.webm twins. It gets exactly ONE
attempt there: matte failures are deterministic (a bad frame, a codec, an ffmpeg
crash), unlike render failures which are usually transient cold-start/5xx and are
retried. A failure therefore has to be RECORDED rather than retried.

These columns live on the SCENE and not on the job row because THE JOB SUCCEEDED —
the mp4 is there and the video plays; only the transparent twin is missing. That is
what lets the UI explain why a background change is unavailable, and offer the
manual per-scene re-matte, instead of the reason existing only in a server log.

``avatar_matte_failed_at`` is also the backoff for the AUTOMATIC sweeps (see
services/avatar_queue.scene_needs_matte_filters). Without it, a scene that fails
matting is re-enqueued every time any other render in the project completes — an
unbounded retry loop. Both columns are cleared on a successful (re-)matte and when
the avatar is deleted.

NOTE ON PLACEMENT: these belong logically in avatar_feature_squash, and were briefly
put there. That was wrong — the squash is already APPLIED on deployed databases, so
editing it is a no-op on every environment that has run it, and the app then 500s on
any scene query against columns the ORM declares but the table lacks. A revision that
is already stamped can only be extended by a NEW revision on top.

Revision ID: avatar_matte_error
Revises: avatar_feature_squash
Create Date: 2026-08-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
# NB: alembic_version.version_num is varchar(32) here — keep ids short.
revision: str = "avatar_matte_error"
down_revision: Union[str, None] = "avatar_feature_squash"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both nullable: NULL means "no matte failure recorded", which is the normal
    # state and the correct reading for every row predating this migration.
    op.add_column(
        "scenes",
        sa.Column("avatar_matte_error", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "scenes",
        sa.Column("avatar_matte_failed_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scenes", "avatar_matte_failed_at")
    op.drop_column("scenes", "avatar_matte_error")
