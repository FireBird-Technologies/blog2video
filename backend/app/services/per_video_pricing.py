"""
Per-video pack pricing: three flat tiers.

Zone A — Casual (qty 1-9):   $2.00/video. Full margin from one-off buys.
Zone B — Pack (qty 10-30):   $1.50/video. The "buy a pack" tier.
Zone C — Bulk (qty 31+):     $1.20/video. Bulk tier — flat, no further discount.

All three tiers are flat. Crossing qty=9->10 or qty=30->31 drops the per-video
price to the next tier; within a tier nothing changes.

Intentional cliffs:
  qty=9 -> qty=10: total drops $18 -> $15 ("unlock pack pricing")
  qty=30 -> qty=31: total drops $45 -> $37.20 ("unlock bulk pricing")

Frontend mirrors this exactly at frontend/src/lib/perVideoPricing.ts —
if you change these constants, change both.
"""

CASUAL_PRICE_CENTS = 200          # $2.00 in Zone A (qty 1-9)
PACK_PRICE_CENTS = 150            # $1.50 in Zone B (qty 10-30)
BULK_PRICE_CENTS = 120            # $1.20 in Zone C (qty 31+)

# Zone boundaries
CASUAL_ZONE_END = 9
PACK_ZONE_END = 30

# Bounds
MIN_QUANTITY = 1
MAX_QUANTITY = 200

# UI anchors (exported for frontend mirror)
PACK_TIER_START_QTY = 10
BULK_TIER_START_QTY = 31

# Legacy aliases — preserved so any external imports keep resolving.
BEST_VALUE_QTY = PACK_TIER_START_QTY
BEST_DEAL_QTY = PACK_TIER_START_QTY


def per_unit_cents(qty: int) -> int:
    q = max(MIN_QUANTITY, min(qty, MAX_QUANTITY))
    if q <= CASUAL_ZONE_END:
        return CASUAL_PRICE_CENTS
    if q <= PACK_ZONE_END:
        return PACK_PRICE_CENTS
    return BULK_PRICE_CENTS


def total_cents(qty: int) -> int:
    return per_unit_cents(qty) * max(MIN_QUANTITY, min(qty, MAX_QUANTITY))
