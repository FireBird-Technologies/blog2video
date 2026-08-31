#!/usr/bin/env python3
"""Report how much custom templates actually differ from one another.

This is the query that found the bugs the diversification work fixed: every
stored blueprint had opening_move=logo_settle and closing_move=recap_card, and
era had collapsed onto 'technical' for most brands, dragging the typeface with
it. Both survived for months because nothing aggregated the per-template
values — the `[BLUEPRINT] fingerprint:` log line existed, but one line per
generation tells you nothing about convergence ACROSS generations.

Run it after a batch of templates to see whether the design stage is still
producing distinct designs:

    python3 scripts/blueprint_convergence.py
    python3 scripts/blueprint_convergence.py --limit 50

A fully-converged axis (one value covering every template) is the defect. The
report flags any axis where a single value covers more than HOT_SHARE of the
templates, and any two templates sharing a blueprint fingerprint — which is the
literal definition of "two brands got the same template".
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal  # noqa: E402
from app.dspy_modules.blueprint import (  # noqa: E402
    _house_style_score,
    blueprint_fingerprint,
)
from sqlalchemy import text  # noqa: E402

# A value covering more than this share of templates is a convergence warning.
HOT_SHARE = 0.6

AXES = {
    "era": lambda bp: (bp.get("identity") or {}).get("era"),
    "heading_font": lambda bp: (bp.get("identity") or {}).get("heading_font"),
    "decor_system": lambda bp: (bp.get("identity") or {}).get("decor_system"),
    "opening_move": lambda bp: ((bp.get("bookends") or {}).get("intro") or {}).get("opening_move"),
    "closing_move": lambda bp: ((bp.get("bookends") or {}).get("outro") or {}).get("closing_move"),
    "edge_policy": lambda bp: (bp.get("structure") or {}).get("edge_policy"),
    # ── The SCENE SET ────────────────────────────────────────────────────────
    # Every axis above is skin. This tool would report "no convergence warnings"
    # on a corpus where every template shipped an identical set of scenes, which
    # is precisely the collapse it was built to catch. These three make the scene
    # decisions visible.
    "layout_count": lambda bp: str(
        len([l for l in (bp.get("layouts") or []) if l.get("role") == "content"])
    ),
    "best_for_mix": lambda bp: ",".join(
        sorted(
            x
            for l in (bp.get("layouts") or [])
            if l.get("role") == "content"
            for x in (l.get("best_for") or [])
        )
    ),
    "role_mix": lambda bp: ",".join(
        sorted({str(l.get("role")) for l in (bp.get("layouts") or [])})
    ),
    # The layout IDENTITY set: type:variant per content layout. This is the axis
    # the user's "my templates look alike" report was really about — two
    # templates necessarily share content TYPES (8 values, 6+ layouts), so the
    # variant is what decides whether their layouts are the same object.
    "layout_identities": lambda bp: ",".join(
        sorted(
            f"{(l.get('best_for') or ['plain'])[0]}:{l.get('variant') or '-'}"
            for l in (bp.get("layouts") or [])
            if l.get("role") == "content"
        )
    ),
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=100, help="most recent N templates")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                "select id, name, design_blueprint from custom_templates "
                "where design_blueprint is not null order by id desc limit :n"
            ),
            {"n": args.limit},
        ).fetchall()
    finally:
        db.close()

    if not rows:
        print("No templates with a stored blueprint.")
        return 0

    blueprints = []
    for tid, name, raw in rows:
        try:
            blueprints.append((tid, name, json.loads(raw) if isinstance(raw, str) else raw))
        except (ValueError, TypeError):
            print(f"  ! template {tid} ({name}) has unparseable design_blueprint")

    total = len(blueprints)
    print(f"\n{total} template(s) with a blueprint\n")

    warnings = 0
    for axis, get in AXES.items():
        counts = collections.Counter(get(bp) for _, _, bp in blueprints)
        top_value, top_n = counts.most_common(1)[0]
        share = top_n / total
        flag = "  <-- CONVERGED" if share > HOT_SHARE and total > 1 else ""
        if flag:
            warnings += 1
        spread = ", ".join(f"{v}={n}" for v, n in counts.most_common())
        print(f"{axis:14} {len(counts):2} distinct | {spread}{flag}")

    print()
    fps = collections.Counter(blueprint_fingerprint(bp) for _, _, bp in blueprints)
    dupes = {fp: n for fp, n in fps.items() if n > 1}
    print(f"fingerprints   {len(fps):2} distinct of {total}")
    for fp, n in dupes.items():
        warnings += 1
        names = [name for _, name, bp in blueprints if blueprint_fingerprint(bp) == fp]
        print(f"  <-- {n} templates share one design: {', '.join(names)}")
        print(f"      {fp}")

    scores = sorted(_house_style_score(bp)[0] for _, _, bp in blueprints)
    print(f"\nhouse-style    scores {scores} (higher = more generic)")

    if warnings:
        print(f"\n{warnings} convergence warning(s) — templates are starting to look alike.")
        return 1
    print("\nNo convergence warnings.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
