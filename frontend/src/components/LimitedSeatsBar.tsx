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

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-4 py-2.5">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600" />
      </span>
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-purple-700">
          {seatsLeft} of {TOTAL_SEATS} seats left
        </span>{" "}
        — <span className="font-semibold text-emerald-600">limited offer</span>,{" "}
        {claimed} already claimed.
      </p>
    </div>
  );
}
