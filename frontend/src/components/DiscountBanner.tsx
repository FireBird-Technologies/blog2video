import { useState } from "react";
import { Link } from "react-router-dom";
import DiscountCodeBadge from "./DiscountCodeBadge";

// Global in-memory flag so once dismissed it stays hidden
// across all pages for the current session (until full reload).
let globalDiscountDismissed = false;

interface Props {
  /** Optional max-width wrapper to match the navbar container (e.g. 'max-w-6xl', 'max-w-7xl'). */
  containerClassName?: string;
  /** Extra classes on the outer banner (for responsive visibility, margins, etc.). */
  className?: string;
  /** Control visibility from parent (e.g. only for free users). Defaults to true. */
  visible?: boolean;
}

export default function DiscountBanner({
  containerClassName = "",
  className = "",
  visible = true,
}: Props) {
  const [dismissed, setDismissed] = useState(globalDiscountDismissed);

  const handleDismiss = () => {
    globalDiscountDismissed = true;
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  return (
    <div className={`bg-white ${className}`}>
      <div
        className={`relative mx-auto w-full px-2.5 sm:px-4 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 ${containerClassName}`}
      >
        {/* Left: reason for discount */}
        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] sm:text-sm font-medium text-purple-900 sm:order-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-800" />
          <span>Spring Savings – Limited Time</span>
        </div>

        {/* Center: code + countdown and CTA (desktop only inside badge) */}
        <div className="flex-1 flex justify-center min-w-[230px] sm:order-2">
          <DiscountCodeBadge className="max-w-full sm:max-w-[480px]" />
        </div>

        {/* Close button — top-right on mobile, inline on desktop */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[16px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors sm:static sm:ml-2 sm:order-3"
          aria-label="Dismiss discount offer"
        >
          ×
        </button>
      </div>
    </div>
  );
}

