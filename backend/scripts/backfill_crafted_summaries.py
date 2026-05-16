"""Backfill crafted template summary.json files on R2.

For every active crafted template, this loads the full package from R2
(forcing a fresh read so the in-process cache is bypassed), composes the
marquee summary payload, and writes it to ``{r2_prefix}/summary.json``.

Idempotent: running it twice is safe and just rewrites the same payload.

After deploying the code that drops the ``cached_meta_json`` column, run
this once so existing templates have ``summary.json`` available on R2
before the first dashboard load (otherwise the first list request pays a
one-time compose-and-upload cost per template).

Usage:
    python -m scripts.backfill_crafted_summaries
    python -m scripts.backfill_crafted_summaries --template crafted_finance_pro
"""

from __future__ import annotations

import os
import sys
from argparse import ArgumentParser

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.database import SessionLocal
from app.models.crafted_template import CraftedTemplate
from app.services.crafted_template_service import (
    _compose_summary_from_package,
    is_crafted_templates_enabled,
    load_crafted_template_package,
    write_summary_to_r2,
)


def _backfill_one(db, tpl: CraftedTemplate) -> bool:
    package = load_crafted_template_package(
        tpl.public_template_id,
        db=db,
        require_entitlement=False,
        force_refresh=True,
    )
    if not package:
        print(f"[skip] {tpl.public_template_id}: failed to load package from R2")
        return False
    summary = _compose_summary_from_package(package)
    if not write_summary_to_r2(tpl.r2_prefix, summary):
        print(f"[fail] {tpl.public_template_id}: upload to {tpl.r2_prefix}/summary.json failed")
        return False
    print(f"[ok]   {tpl.public_template_id}: wrote {tpl.r2_prefix}/summary.json")
    return True


def main() -> int:
    parser = ArgumentParser(description="Backfill crafted_templates summary.json on R2")
    parser.add_argument(
        "--template",
        help="Only backfill this public_template_id (default: all active)",
        default=None,
    )
    args = parser.parse_args()

    if not is_crafted_templates_enabled():
        print("CRAFTED_TEMPLATES_ENABLED is false; nothing to do.")
        return 0

    db = SessionLocal()
    try:
        q = db.query(CraftedTemplate).filter(CraftedTemplate.status == "active")
        if args.template:
            q = q.filter(CraftedTemplate.public_template_id == args.template)
        rows = q.all()
        if not rows:
            print("No active crafted templates found.")
            return 0
        ok = 0
        for tpl in rows:
            if _backfill_one(db, tpl):
                ok += 1
        print(f"Done. {ok}/{len(rows)} summaries backfilled.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
