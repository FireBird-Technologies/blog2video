"""Remove any 'auto' rows from user_video_style_slots and repack positions.

"Auto" is no longer a slot-managed video style (it's now a fixed, always-on
Step 2 option outside the 9-slot selection system). Any pre-existing slot row
with builtin_key='auto' would otherwise silently waste a Step 2 slot, since
the backend no longer serializes 'auto' as a manageable style.

Revision ID: remove_auto_video_style_slot
Revises: add_user_builtin_video_styles
"""
from alembic import op
import sqlalchemy as sa


revision = "remove_auto_video_style_slot"
down_revision = "add_user_builtin_video_styles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    affected_user_ids = [
        row[0]
        for row in conn.execute(
            sa.text("SELECT DISTINCT user_id FROM user_video_style_slots WHERE builtin_key = 'auto'")
        ).fetchall()
    ]
    for user_id in affected_user_ids:
        rows = conn.execute(
            sa.text(
                "SELECT id, builtin_key, custom_style_id FROM user_video_style_slots "
                "WHERE user_id = :user_id AND (builtin_key IS NULL OR builtin_key != 'auto') "
                "ORDER BY position ASC"
            ),
            {"user_id": user_id},
        ).fetchall()
        conn.execute(
            sa.text("DELETE FROM user_video_style_slots WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        for position, row in enumerate(rows):
            conn.execute(
                sa.text(
                    "INSERT INTO user_video_style_slots "
                    "(user_id, position, builtin_key, custom_style_id, created_at) "
                    "VALUES (:user_id, :position, :builtin_key, :custom_style_id, NOW())"
                ),
                {
                    "user_id": user_id,
                    "position": position,
                    "builtin_key": row[1],
                    "custom_style_id": row[2],
                },
            )


def downgrade() -> None:
    # Irreversible: original per-user position of the removed 'auto' slot is not recoverable.
    pass
