import { useMemo } from "react";

// Dark "LIMITED OFFER" scarcity bar shown on each lifetime deal. The number of
// claimed seats (out of 10) is deterministic per-seed per-day — same trick as
// LifetimeUrgencyBanner — so each card shows its own number that's stable
// within a day but feels live. `seed` should be unique per card.

const TOTAL_SEATS = 10;

// Claimed seats stay in a "nearly full" band so it always reads as scarce
// (a few seats left) without ever showing sold-out.
const MIN_CLAIMED = 6;
const MAX_CLAIMED = 9;

function hashClaimed(seed: string, date: Date): number {
  const key = `${seed}-${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  const span = MAX_CLAIMED - MIN_CLAIMED + 1;
  return MIN_CLAIMED + (Math.abs(h) % span);
}

export default function LimitedSeatsBar({
  seed,
  seatsLeft: seatsLeftOverride,
}: {
  seed: string;
  /** Pin the seats-left figure instead of using the random per-seed number. */
  seatsLeft?: number;
}) {
  const randomClaimed = useMemo(() => hashClaimed(seed, new Date()), [seed]);
  const seatsLeft =
    seatsLeftOverride != null ? seatsLeftOverride : TOTAL_SEATS - randomClaimed;
  const claimed = TOTAL_SEATS - seatsLeft;

  const claimedPct = (claimed / TOTAL_SEATS) * 100;

  return (
    <div className="mb-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold tracking-wide text-purple-700">
          LIMITED OFFER
        </span>
        <span className="text-[10px] text-gray-500 whitespace-nowrap">
          {claimed} of {TOTAL_SEATS} claimed
        </span>
      </div>
      <p className="mt-1 text-base font-bold text-gray-900 whitespace-nowrap">
        {seatsLeft} of {TOTAL_SEATS} seats left
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-purple-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
          style={{ width: `${claimedPct}%` }}
        />
      </div>
    </div>
  );
}
