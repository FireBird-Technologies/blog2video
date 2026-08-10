"""SceneAvatarJob: record that a failed scene's credits were given back.

An avatar batch charges AVATAR_CREDIT_COST_PER_SCENE up front (see
authorize_avatar_batch). A scene that then fails every attempt has been paid for
and produced nothing, and until this column there was no refund path for avatars
anywhere in the codebase.

THIS ONE COLUMN DOES THREE JOBS. That is deliberate, and it is the only
non-obvious decision in the feature:

  1. IDEMPOTENCY GUARD. The refund sweep selects only rows where this is not
     true and sets it in the same transaction as the balance change. Without it
     a second sweep — two jobs settling together, a restart mid-sweep, a retry
     row for the same scene — would silently hand out free credits, with nothing
     in the data to show it happened.

  2. PERMANENT-BLOCK MARKER. A refunded scene is a closed matter: the user's
     money is back, so re-rendering it would be free GPU work. Every gate that
     could start a render (the bulk retry endpoint, the per-scene endpoint, and
     batch eligibility) checks this column.

  3. OPERATOR UNBLOCK LEVER. Because all of those gates key off one column,
     clearing it is the whole undo — no admin UI needed:

         UPDATE scene_avatar_jobs SET credits_refunded = NULL WHERE scene_id = :sid;

     Clearing it on a scene that was refunded but NOT re-charged lets the next
     sweep refund it again, so this is an escape hatch for someone who knows
     that, not something to build a button on.

NULLABLE with no server default: NULL reads as "not refunded", which is the
correct answer for every row that predates this column.

Revision ID: avatar_credits_refunded
Revises: avatar_matte_error
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
# NB: alembic_version.version_num is varchar(32) here — keep ids short.
revision: str = "avatar_credits_refunded"
down_revision: Union[str, None] = "avatar_matte_error"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scene_avatar_jobs",
        sa.Column("credits_refunded", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scene_avatar_jobs", "credits_refunded")
