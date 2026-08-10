import type { CoverflowOrientation } from "./CoverflowCarousel";

interface Props {
  orientation: CoverflowOrientation;
  onChange: (o: CoverflowOrientation) => void;
  className?: string;
}

/** Landscape ⇄ Portrait pill toggle, shared above the template carousel. */
export default function OrientationToggle({ orientation, onChange, className = "" }: Props) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="flex gap-1 p-1 bg-gray-100/70 rounded-xl">
        <button
          type="button"
          title="Landscape (Desktop / YouTube)"
          onClick={() => onChange("landscape")}
          className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all ${
            orientation === "landscape" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" strokeLinecap="round" />
          </svg>
          Landscape
        </button>
        <button
          type="button"
          title="Portrait (Mobile / TikTok / Reels)"
          onClick={() => onChange("portrait")}
          className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all ${
            orientation === "portrait" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <rect x="7" y="2" width="10" height="20" rx="2" />
            <circle cx="12" cy="18" r="1" />
          </svg>
          Portrait
        </button>
      </div>
    </div>
  );
}
