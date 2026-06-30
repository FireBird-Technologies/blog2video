import { useMemo } from "react";

// Social-proof + scarcity banner shown only when the Lifetime billing tab is
// active. Uses a deterministic per-day number (same trick as
// OutOfVideosOfferModal) so the figure is stable within a day but feels live.

const DAILY_POOL_OPTIONS = [24, 27, 29, 31] as const;

function hashDateToPool(date: Date): number {
  const ymd = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let h = 0;
  for (let i = 0; i < ymd.length; i += 1) {
    h = (h * 31 + ymd.charCodeAt(i)) | 0;
  }
  return DAILY_POOL_OPTIONS[Math.abs(h) % DAILY_POOL_OPTIONS.length];
}

export default function LifetimeUrgencyBanner() {
  const pool = useMemo(() => hashDateToPool(new Date()), []);
  // A few "spots" always left so it reads as nearly-full, not sold out.
  const claimed = pool - 3;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-4 py-2.5">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600" />
      </span>
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-purple-700">
          {claimed} of {pool} creators
        </span>{" "}
        grabbed the lifetime deal this week — lock in{" "}
        <span className="font-semibold text-emerald-600">lifetime access</span>{" "}
        before today&apos;s spots refresh.
      </p>
    </div>
  );
}
