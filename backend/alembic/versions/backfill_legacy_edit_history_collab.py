"""Backfill collaboration fields on legacy edit-history rows.

Rows written before collaboration existed have NULL user_id / change_set_id and were
left ``revertable=true`` by the column-add default — but they carry no change-set to
diff against, so offering a revert on them would break. This data migration marks
those legacy rows non-revertable and fills the collaboration attribution fields:

  * revertable            -> false   (no field-diff revert possible)
  * reverted              -> false   (terminal, never in a revert chain)
  * target                -> 'published'
  * user_id               -> the PROJECT OWNER's id (projects.user_id)
  * change_set_id         -> a unique per-row id ('legacy-<id>') so each legacy row
                             stays its own standalone change-set (matches how the
                             history code already treats NULL change_set_id rows)

"Legacy" = ``change_set_id IS NULL`` (the defining pre-collaboration trait). Newer
rows already have these fields set and are left untouched. Idempotent: re-running
matches nothing because the marker column is filled on the first pass.

Revision ID: backfill_legacy_history
Revises: regen_script_initiated_by
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "backfill_legacy_history"
down_revision: Union[str, None] = "regen_script_initiated_by"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, table):
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for tbl in ("project_edit_history", "scene_edit_history"):
        if tbl not in inspector.get_table_names():
            continue
        cols = _cols(inspector, tbl)
        # Only proceed if the collaboration columns exist (they always should by this
        # point, but guard so the migration is safe on partially-migrated DBs).
        if "change_set_id" not in cols:
            continue

        # Attribute legacy rows to the project owner. Done first so the update below
        # can rely on user_id already being set (though they are independent).
        if "user_id" in cols:
            op.execute(
                sa.text(
                    f"""
                    UPDATE {tbl} AS h
                    SET user_id = p.user_id
                    FROM projects AS p
                    WHERE h.project_id = p.id
                      AND h.change_set_id IS NULL
                      AND h.user_id IS NULL
                    """
                )
            )

        # Mark legacy rows non-revertable, terminal, published, and give each its own
        # change_set_id. The change_set_id fill is LAST because it clears the marker
        # (change_set_id IS NULL) these updates key off — keeps the pass consistent.
        set_clauses = ["revertable = false"]
        if "reverted" in cols:
            set_clauses.append("reverted = false")
        if "target" in cols:
            set_clauses.append("target = 'published'")
        set_clauses.append("change_set_id = 'legacy-' || h.id")

        op.execute(
            sa.text(
                f"""
                UPDATE {tbl} AS h
                SET {", ".join(set_clauses)}
                WHERE h.change_set_id IS NULL
                """
            )
        )


def downgrade() -> None:
    # Reverse only the synthetic change_set_id + revertable flag we set, identifying our
    # rows by the 'legacy-' prefix we stamped. user_id/target/reverted are left as-is:
    # restoring them to NULL/prior values isn't recoverable and would reintroduce the
    # broken-revert state this migration fixes.
    for tbl in ("project_edit_history", "scene_edit_history"):
        op.execute(
            sa.text(
                f"""
                UPDATE {tbl}
                SET change_set_id = NULL,
                    revertable = true
                WHERE change_set_id LIKE 'legacy-%'
                """
            )
        )
