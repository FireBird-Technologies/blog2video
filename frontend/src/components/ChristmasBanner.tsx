import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * Seasonal strip promoting the Snowy Christmas template. Sits at the very top of
 * the landing nav and the dashboard navbar; the whole strip links to the
 * template's preview page. Hides itself after the season ends, and once
 * dismissed stays hidden for the session (until a full reload).
 */

const TEMPLATE_PATH = "/templates/christmas";
/** Banner stops showing from this date (local time). */
const SEASON_ENDS = new Date(2027, 0, 7);

let globalChristmasDismissed = false;

interface Props {
  /** Max-width wrapper matching the surrounding navbar (e.g. "max-w-6xl"). */
  containerClassName?: string;
  className?: string;
}

export default function ChristmasBanner({ containerClassName = "", className = "" }: Props) {
  const [dismissed, setDismissed] = useState(globalChristmasDismissed);

  if (dismissed || new Date() >= SEASON_ENDS) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    globalChristmasDismissed = true;
    setDismissed(true);
  };

  return (
    <div className={`bg-white ${className}`}>
      <div className={`mx-auto flex w-full items-center justify-center gap-1 px-3 py-2 ${containerClassName}`}>
        <Link
          to={TEMPLATE_PATH}
          className="group flex min-w-0 items-center justify-center gap-2 text-center text-xs sm:text-sm"
        >
          <TreeIcon />
          <span className="whitespace-nowrap font-semibold text-purple-700">Holiday Season</span>
          <span className="whitespace-nowrap text-purple-900">
            <span className="hidden sm:inline">is here — checkout the new </span>
            <span className="sm:hidden">· </span>
            <span className="font-semibold"><span className="text-red-600">Christmas</span> <span className="font-normal text-purple-700">template</span></span>
          </span>
          <span className="ml-1 whitespace-nowrap rounded-full bg-purple-600 px-3 py-0.5 text-[11px] sm:text-xs font-semibold text-white transition-colors group-hover:bg-purple-700">
            Try it now →
          </span>
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-purple-400 hover:bg-purple-100 hover:text-purple-700 transition-colors"
          aria-label="Dismiss Christmas template banner"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Small green Christmas tree (the banner's only green). */
function TreeIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" className="shrink-0">
      <path d="M8 1 L12 6 H10 L14 11 H11.5 L15 15.5 H1 L4.5 11 H2 L6 6 H4 Z" fill="#16A34A" />
      <rect x="6.75" y="15.5" width="2.5" height="2.5" rx="0.5" fill="#15803D" />
    </svg>
  );
}
