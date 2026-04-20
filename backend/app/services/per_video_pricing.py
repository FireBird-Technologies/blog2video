"""
Per-video pack pricing: linear per-unit discount with a floor.

The floor sits above the Pro subscription's effective per-video rate
($50 / 100 = $0.50/video), so bulk packs never cannibalise Pro.

Frontend mirrors this exactly at frontend/src/lib/perVideoPricing.ts —
if you change these constants, change both.
"""

BASE_PRICE_CENTS = 300            # $3.00 at qty=1
FLOOR_PRICE_CENTS = 60            # $0.60/video — above Pro's $0.50 effective rate
DISCOUNT_PER_UNIT_CENTS = 5       # each extra video drops per-unit by $0.05
MIN_QUANTITY = 1
MAX_QUANTITY = 200


def per_unit_cents(qty: int) -> int:
    qty = max(MIN_QUANTITY, min(qty, MAX_QUANTITY))
    raw = BASE_PRICE_CENTS - (qty - 1) * DISCOUNT_PER_UNIT_CENTS
    return max(raw, FLOOR_PRICE_CENTS)


def total_cents(qty: int) -> int:
    return per_unit_cents(qty) * max(MIN_QUANTITY, min(qty, MAX_QUANTITY))
