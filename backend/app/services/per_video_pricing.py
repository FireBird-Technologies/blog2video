"""
Per-video pack pricing: three-zone curve shaped to nudge users toward packs.

Zone A — Flat (qty 1-5):  per_unit = $3.00. No discount. Full margin from casuals.
Zone B — Sweet spot (qty 6-15): steep 15c/unit drop. Drives pack buys.
Zone C — Bulk (qty 16+): gentle 2c/unit drop, floored at $0.60
                         (above Pro's $0.50/video effective rate).

Intentional quirk: total at qty=10 and qty=15 both equal $22.50. That's the
"drag from 10 to 15 for 5 free videos" psychological anchor — keep it.

Frontend mirrors this exactly at frontend/src/lib/perVideoPricing.ts —
if you change these constants or the formula, change both.
"""

BASE_PRICE_CENTS = 300            # $3.00 flat in Zone A

# Zone boundaries
FLAT_ZONE_END = 5                 # qty 1..5 is flat
SWEET_ZONE_END = 15               # qty 6..15 is steep-discount sweet spot

# Per-unit discount rates (cents of drop per extra unit)
SWEET_ZONE_DROP_CENTS = 15        # Zone B: steep — 3x the old curve
BULK_ZONE_DROP_CENTS = 1          # Zone C: very gentle, floor hits around qty=105

# Per-unit price anchors
SWEET_ZONE_END_PRICE_CENTS = 150  # per-unit at qty=15 ($1.50)

# Floor and bounds
FLOOR_PRICE_CENTS = 60            # $0.60/video — above Pro's effective rate
MIN_QUANTITY = 1
MAX_QUANTITY = 200

# UI anchors (exported for frontend mirror)
BEST_VALUE_QTY = 10               # "Best value" label
BEST_DEAL_QTY = 15                # "Best deal — 5 free videos" label


def per_unit_cents(qty: int) -> int:
    q = max(MIN_QUANTITY, min(qty, MAX_QUANTITY))
    if q <= FLAT_ZONE_END:
        return BASE_PRICE_CENTS
    if q <= SWEET_ZONE_END:
        return BASE_PRICE_CENTS - (q - FLAT_ZONE_END) * SWEET_ZONE_DROP_CENTS
    raw = SWEET_ZONE_END_PRICE_CENTS - (q - SWEET_ZONE_END) * BULK_ZONE_DROP_CENTS
    return max(raw, FLOOR_PRICE_CENTS)


def total_cents(qty: int) -> int:
    return per_unit_cents(qty) * max(MIN_QUANTITY, min(qty, MAX_QUANTITY))
