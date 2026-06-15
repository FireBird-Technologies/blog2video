import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { createCheckoutSession } from "../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  secondsRemaining: number;
  isWindowLive?: boolean;
  onExpand?: () => void;
}

const DAILY_POOL_OPTIONS = [20, 25, 30] as const;

function hashDateToPool(date: Date): number {
  const ymd = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let h = 0;
  for (let i = 0; i < ymd.length; i += 1) {
    h = (h * 31 + ymd.charCodeAt(i)) | 0;
  }
  return DAILY_POOL_OPTIONS[Math.abs(h) % DAILY_POOL_OPTIONS.length];
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function OutOfVideosOfferModal({
  open,
  onClose,
  secondsRemaining,
  isWindowLive = false,
  onExpand,
}: Props) {
  const [loadingCycle, setLoadingCycle] = useState<"monthly" | "annual" | null>(null);

  const dailyPool = useMemo(() => hashDateToPool(new Date()), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const urgentMini = secondsRemaining < 60;
  const countdownMini = formatCountdown(secondsRemaining);

  // Minimized pill: shown when modal is closed but the 5-min window is still
  // live, so the user can re-open the offer without losing their countdown.
  if (!open) {
    if (isWindowLive && onExpand && secondsRemaining > 0) {
      return ReactDOM.createPortal(
        <button
          type="button"
          onClick={onExpand}
          className={`group fixed bottom-4 right-20 sm:bottom-4 sm:right-20 z-[120] flex items-center gap-3 sm:gap-3.5 pl-3 pr-4 sm:pl-3.5 sm:pr-5 py-2.5 sm:py-3 rounded-full shadow-[0_10px_30px_-5px_rgba(124,58,237,0.45)] ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_-5px_rgba(124,58,237,0.55)] active:scale-95 ${
            urgentMini
              ? "bg-gradient-to-r from-red-500 to-rose-600 ring-red-300/60 animate-pulse"
              : "bg-gradient-to-r from-purple-600 to-violet-600 ring-purple-300/60"
          }`}
          title="Reopen limited-time offer"
        >
          <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm text-base sm:text-lg leading-none">
            🔥
          </span>
          <div className="flex flex-col items-start leading-none">
            <span className="text-lg sm:text-xl font-bold tabular-nums tracking-tight text-white drop-shadow-sm">
              {countdownMini}
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] font-semibold mt-1 text-white/85">
              Offer left
            </span>
          </div>
          <span
            aria-hidden
            className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-white opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>,
        document.body
      );
    }
    return null;
  }

  const handleCheckout = async (cycle: "monthly" | "annual") => {
    setLoadingCycle(cycle);
    try {
      const res = await createCheckoutSession({
        plan: "pro",
        billing_cycle: cycle,
        apply_third_video_offer: true,
      });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setLoadingCycle(null);
      }
    } catch {
      setLoadingCycle(null);
    }
  };

  const urgent = secondsRemaining < 60;
  const countdown = formatCountdown(secondsRemaining);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
            title="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-start gap-2 pr-9">
            <span className="text-base leading-7">🔥</span>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 leading-snug">
              Only <span className="text-purple-600">2 spots remaining</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-purple-600 font-medium mt-1">
            The other {dailyPool - 2} spots have been bought
          </p>
          <p className="text-sm text-gray-500 mt-1">
            You&apos;re out of videos. Lock in your discount before this offer expires.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                urgent
                  ? "bg-red-50 border-red-200 animate-pulse"
                  : "bg-purple-50 border-purple-200"
              }`}
            >
              <svg
                className={`w-6 h-6 ${urgent ? "text-red-500" : "text-purple-500"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
              </svg>
              <div className="flex flex-col leading-none">
                <span
                  className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${
                    urgent ? "text-red-600" : "text-purple-700"
                  }`}
                >
                  {countdown}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider mt-1 ${
                    urgent ? "text-red-500" : "text-purple-500"
                  }`}
                >
                  Offer expires
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pro Monthly — 15% off */}
            <div className="glass-card p-5 flex flex-col">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Pro Monthly</h3>
                <p className="text-xs text-gray-400 mt-0.5">100 videos / month</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl font-bold text-gray-900">$51</span>
                <span className="text-xs text-gray-400 ml-1">/month</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-gray-400 line-through">$60/mo</span>
                  <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded">
                    Save 15%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">First month only — then $60/mo</p>
              </div>
              <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
                <li className="flex items-start gap-2"><CheckMark />100 videos / month</li>
                <li className="flex items-start gap-2"><CheckMark />AI script & voiceover</li>
                <li className="flex items-start gap-2"><CheckMark />Custom templates</li>
                <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
                <li className="flex items-start gap-2"><CheckMark />Priority support</li>
              </ul>
              <button
                onClick={() => handleCheckout("monthly")}
                disabled={loadingCycle !== null}
                className="w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingCycle === "monthly" ? "Redirecting…" : "Claim 15% off — Pro Monthly"}
              </button>
            </div>

            {/* Pro Annual — 25% off (Best deal) */}
            <div className="glass-card p-5 flex flex-col relative ring-2 ring-purple-300">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="px-3 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded-full">
                  Best deal
                </span>
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Pro Annual</h3>
                <p className="text-xs text-gray-400 mt-0.5">100 videos / month</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl font-bold text-gray-900">$36</span>
                <span className="text-xs text-gray-400 ml-1">/month</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-gray-400 line-through">$48/mo</span>
                  <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded">
                    Save 25%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">$432 billed annually — then $576/yr</p>
              </div>
              <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
                <li className="flex items-start gap-2"><CheckMark />100 videos / month</li>
                <li className="flex items-start gap-2"><CheckMark />AI script & voiceover</li>
                <li className="flex items-start gap-2"><CheckMark />Custom templates</li>
                <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
                <li className="flex items-start gap-2"><CheckMark />Priority support</li>
              </ul>
              <button
                onClick={() => handleCheckout("annual")}
                disabled={loadingCycle !== null}
                className="w-full py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingCycle === "annual" ? "Redirecting…" : "Claim 25% off — Pro Annual"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

function CheckMark() {
  return (
    <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
