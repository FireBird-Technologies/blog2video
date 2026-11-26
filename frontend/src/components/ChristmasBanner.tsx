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
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "linear-gradient(180deg, #EAF4FB 0%, #F5FAFE 60%, #FFFFFF 100%)" }}
    >
      <style>{SNOW_CSS}</style>
      {/* Falling snow behind the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {FLAKES.map((f, i) => (
          <span
            key={i}
            className="xmas-flake"
            style={{
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            }}
          />
        ))}
      </div>
      {/* Snow drift along the bottom edge. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[6px] w-full"
        viewBox="0 0 120 6"
        preserveAspectRatio="none"
      >
        <path
          d="M0 6 V3 Q5 0 10 3 T20 3 T30 3 T40 3 T50 3 T60 3 T70 3 T80 3 T90 3 T100 3 T110 3 T120 3 V6 Z"
          fill="#FFFFFF"
          stroke="#C9DDEC"
          strokeWidth="0.4"
        />
      </svg>
      <div className={`relative mx-auto flex w-full items-center justify-center gap-1 px-3 py-2 ${containerClassName}`}>
        <Link
          to={TEMPLATE_PATH}
          className="group flex min-w-0 items-center justify-center gap-2 text-center text-xs sm:text-sm"
        >
          <SnowflakeIcon className="hidden sm:block" />
          <span className="whitespace-nowrap font-semibold text-purple-700">Holiday Season</span>
          <span className="whitespace-nowrap text-purple-900">
            <span className="hidden sm:inline">is here — checkout the new </span>
            <span className="sm:hidden">· </span>
            <span className="font-semibold"><TreeIcon className="mr-1 inline-block -mt-1 align-middle" /><span className="text-red-600">Christmas</span> <span className="font-normal text-purple-700">template</span></span>
          </span>
          <SnowflakeIcon className="hidden sm:block" />
          <span className="ml-1 whitespace-nowrap rounded-full bg-purple-600 px-3 py-0.5 text-[11px] sm:text-xs font-semibold text-white shadow-[0_0_0_2px_#fff,0_1px_4px_rgba(96,165,250,0.45)] transition-colors group-hover:bg-purple-700">
            Try it now →
          </span>
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-purple-400 hover:bg-white hover:text-purple-700 transition-colors"
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

/** Deterministic flake layout (no Math.random, so it never shifts between renders). */
const FLAKES = Array.from({ length: 36 }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin((i + 1) * 127.1 + n * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    left: (i / 36) * 100 + r(1) * 2.5,
    size: 2 + Math.round(r(2) * 3),
    opacity: 0.55 + r(3) * 0.4,
    duration: 3.5 + r(4) * 3.5,
    delay: -r(5) * 7,
  };
});

const SNOW_CSS = `
.xmas-flake {
  position: absolute;
  top: -6px;
  border-radius: 9999px;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(147, 186, 216, 0.55);
  animation-name: xmas-snowfall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes xmas-snowfall {
  0%   { transform: translate(0, 0); }
  50%  { transform: translate(6px, 26px); }
  100% { transform: translate(-2px, 52px); }
}
@media (prefers-reduced-motion: reduce) {
  .xmas-flake { animation: none; top: auto; }
  .xmas-flake:nth-child(odd) { top: 30%; }
  .xmas-flake:nth-child(even) { top: 65%; }
}
`;

/** Six-armed icy-blue snowflake. */
function SnowflakeIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10" />
        <path d="M9 4l3 3 3-3M9 20l3-3 3 3M3.6 10.6l4.1-1.1-1.1-4.1M20.4 13.4l-4.1 1.1 1.1 4.1M3.6 13.4l4.1 1.1-1.1 4.1M20.4 10.6l-4.1-1.1 1.1-4.1" />
      </g>
    </svg>
  );
}

/** Small green Christmas tree heavily covered in snow (the banner's only green). */
function TreeIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="20" viewBox="0 0 16 18" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M8 1 L12 6 H10 L14 11 H11.5 L15 15.5 H1 L4.5 11 H2 L6 6 H4 Z" fill="#16A34A" />
      {/* Snow blanketing each tier, drooping over the edges. */}
      <g fill="#FFFFFF" stroke="#B9D3E6" strokeWidth="0.35" strokeLinejoin="round">
        <path d="M8 0.6 L10.4 3.6 Q9.6 4.6 8.9 3.7 Q8.2 4.7 7.4 3.8 Q6.4 4.6 5.6 3.6 Z" />
        <path d="M5.8 6 Q8 4.8 10.2 6 L11.9 8.1 Q11.2 9.1 10.4 8.2 Q9.6 9.3 8.6 8.3 Q7.6 9.3 6.8 8.3 Q5.6 9.2 4.4 8.1 Z" />
        <path d="M4.3 11 Q8 9.6 11.7 11 L13.6 13.4 Q12.8 14.4 11.8 13.5 Q10.8 14.6 9.6 13.6 Q8.4 14.6 7.2 13.6 Q6 14.6 4.9 13.6 Q3.6 14.5 2.4 13.4 Z" />
        <path d="M0.4 15.5 Q8 14.6 15.6 15.5 Q16 16.6 14.8 16.6 H1.2 Q0 16.6 0.4 15.5 Z" />
      </g>
      <rect x="6.75" y="16.6" width="2.5" height="1.4" rx="0.4" fill="#15803D" />
    </svg>
  );
}
