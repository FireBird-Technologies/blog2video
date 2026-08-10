import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const DISCOUNT_CODE = "ILOVEB2V";
const DISCOUNT_PERCENT = "20%";
const DURATION_MS = 4 * 24 * 60 * 60 * 1000; // 4 days cycle
const START_TIME = new Date("2026-03-16T00:00:00Z").getTime(); // global start time

function useDiscountCountdown() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - START_TIME) % DURATION_MS;
  const remaining = DURATION_MS - elapsed;

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

interface Props {
  className?: string;
}

export default function DiscountCodeBadge({ className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const countdown = useDiscountCountdown();

  const handleCopy = () => {
    navigator.clipboard?.writeText(DISCOUNT_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 ${className}`}>
      {/* Discount & Code Button */}
      <div className="flex flex-1 items-center justify-center sm:justify-start gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex flex-1 items-center justify-center sm:justify-start gap-2 min-h-[34px] rounded-full bg-white px-3 text-[11px] sm:text-xs font-medium text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors"
        >
          {/* Percentage pill */}
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold whitespace-nowrap">
            {DISCOUNT_PERCENT} OFF
          </span>

          {/* Label + code are allowed to shrink/wrap slightly on very small screens */}
          <span className="text-purple-600 font-medium whitespace-nowrap">Use Code</span>

          {/* Code pill */}
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-900 font-semibold tracking-wide border border-purple-200 whitespace-nowrap">
            {DISCOUNT_CODE}
          </span>

          {/* Copy icon */}
          <span className="flex items-center justify-center w-4 h-4 text-purple-600">
            {copied ? (
              "✓"
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* Countdown */}
      <div className="flex justify-center sm:justify-start items-center gap-1 text-[10px] font-medium text-purple-700">
        {[
          { label: "Days", value: pad(countdown.days) },
          { label: "Hours", value: pad(countdown.hours) },
          { label: "Min", value: pad(countdown.minutes) },
          { label: "Sec", value: pad(countdown.seconds) },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center px-1.5 sm:px-2 rounded-md bg-white border border-purple-100 min-w-[40px] sm:min-w-[48px] h-[32px] sm:h-[34px]"
          >
            <span className="text-xs font-semibold text-purple-800">
              {item.value}
            </span>
            <span className="text-[9px] text-purple-400 leading-none">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Desktop-only CTA pill (after timer boxes) */}
      <div className="flex justify-center sm:justify-start">
        <Link
          to="/pricing"
          className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors whitespace-nowrap"
        >
          Go to plans
        </Link>
      </div>
    </div>
  );
}