import { useEffect, useState } from "react";
import { AVATAR_PRESETS } from "../api/client";

/** Same clip used in the in-app Avatar batch wizard's "here's what this looks like" preview. */
const DEMO_YOUTUBE_ID = "BKm2_U3laCk";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Static presenter photo — no clip, no play affordance, nothing auto-playing. */
function AvatarTile({ preset, delayMs }: { preset: { id: string; label: string }; delayMs: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <div
      className="reveal group relative rounded-xl sm:rounded-2xl overflow-hidden glass-card transition-transform duration-300 hover:-translate-y-1"
      style={{ transitionDelay: reducedMotion ? undefined : `${delayMs}ms` }}
    >
      <div className="relative w-full aspect-[3/4] bg-gray-100">
        <img
          src={`/avatars/${preset.id}.jpg`}
          alt={preset.label}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="px-2 py-1.5 sm:px-4 sm:py-3 text-center">
        <p className="text-xs sm:text-sm font-semibold text-gray-900">{preset.label}</p>
      </div>
    </div>
  );
}

function UploadYourOwnTile({ delayMs }: { delayMs: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <div
      className="reveal group relative rounded-xl sm:rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-purple-400/60 transition-all duration-300 hover:-translate-y-1"
      style={{ transitionDelay: reducedMotion ? undefined : `${delayMs}ms` }}
    >
      <div className="relative w-full aspect-[3/4] flex flex-col items-center justify-center gap-1 sm:gap-3 bg-gray-50/60 group-hover:bg-purple-50/40 transition-colors px-1">
        <div className="w-5 h-5 sm:w-10 sm:h-10 rounded-full bg-white shadow-md ring-2 ring-purple-200 flex items-center justify-center transition-transform group-hover:scale-110">
          <svg className="w-2 h-2 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-[9px] sm:text-sm font-semibold text-gray-700 text-center leading-tight">
          <span className="sm:hidden">Your own</span>
          <span className="hidden sm:inline">Your own presenter</span>
        </p>
      </div>
      <div className="px-2 py-1.5 sm:px-4 sm:py-3 text-center hidden sm:block">
        <p className="text-[11px] text-gray-400 leading-relaxed">Upload a photo — we animate it for you</p>
      </div>
    </div>
  );
}

/** Animated arrow linking the presenter grid to the finished video — horizontal on desktop, vertical when stacked. */
function FlowConnector() {
  const reducedMotion = useReducedMotion();
  return (
    <div className="flex items-center justify-center shrink-0 py-0.5 lg:py-0 lg:px-1">
      {/* Vertical, stacked layouts */}
      <svg
        className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300 lg:hidden rotate-90"
        style={{ animation: reducedMotion ? undefined : "avatar-arrow-bob-x 1.6s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="13 6 19 12 13 18" />
      </svg>
      {/* Horizontal, side-by-side desktop layout */}
      <svg
        className="hidden lg:block w-7 h-7 text-purple-300"
        style={{ animation: reducedMotion ? undefined : "avatar-arrow-bob-x 1.6s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="13 6 19 12 13 18" />
      </svg>
      <span className="sr-only">becomes</span>
    </div>
  );
}

/** Real finished-video preview — thumbnail first, YouTube iframe only loads after a click. */
function DemoVideoPreview() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="reveal relative rounded-xl sm:rounded-2xl overflow-hidden glass-card">
      <div className="relative w-full aspect-video bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${DEMO_YOUTUBE_ID}?autoplay=1&si=W6-IEFqU-vTp4d6D`}
            title="AI presenter demo video"
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 w-full h-full"
            aria-label="Play demo video"
          >
            <img
              src={`https://img.youtube.com/vi/${DEMO_YOUTUBE_ID}/hqdefault.jpg`}
              alt="AI presenter demo video thumbnail"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-white/95 shadow-lg flex items-center justify-center transition-transform group-hover:scale-110">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 ml-0.5 sm:ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </button>
        )}
      </div>
      <p className="text-[10px] sm:text-xs text-gray-400 text-center py-1.5 sm:py-2.5 bg-white/60">
        See a finished AI presenter video
      </p>
    </div>
  );
}

export default function AvatarShowcase({ onExplore }: { onExplore?: () => void }) {
  return (
    <div className="reveal">
      {/* Header — matches the other landing showcases */}
      <div className="inline-flex items-center gap-2 mb-2 sm:mb-4 w-full justify-center">
        <p className="text-[10px] sm:text-xs font-medium text-purple-600 tracking-widest uppercase">
          AI Presenters
        </p>
      </div>
      <h2 className="text-lg sm:text-2xl lg:text-3xl font-semibold text-gray-900 text-center mb-2 sm:mb-4">
        Put a face on your video
      </h2>
      <p className="text-xs sm:text-sm text-gray-500 text-center max-w-lg mx-auto mb-3 sm:mb-4 leading-relaxed px-4">
        Pick a presenter and your script becomes a talking-head video — lips synced,
        natural head motion, zero filming. Use one of ours, or bring your own face.
      </p>

      {/* GPU flex badge */}
      <div className="flex justify-center mb-4 sm:mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-100 px-2.5 py-1 sm:px-3">
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
          </svg>
          <p className="text-[10px] sm:text-[11px] font-medium text-purple-600">
            Rendered on real GPUs in parallel
          </p>
        </div>
      </div>

      {/* Presenter grid → connector → finished video, showing the pick-a-face-to-finished-video flow */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4 lg:gap-3 max-w-4xl mx-auto px-4 sm:px-0">
        <div className="flex-[3] reveal-group grid grid-cols-3 gap-1.5 sm:gap-5 max-w-xs sm:max-w-none mx-auto sm:mx-0 w-full">
          {AVATAR_PRESETS.map((preset, i) => (
            <AvatarTile key={preset.id} preset={preset} delayMs={i * 300} />
          ))}
          <UploadYourOwnTile delayMs={AVATAR_PRESETS.length * 300} />
        </div>

        <FlowConnector />

        <div className="flex-[2] max-w-xs sm:max-w-sm lg:max-w-none mx-auto sm:mx-0 w-full">
          <DemoVideoPreview />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-5 sm:mt-8 flex justify-center">
        <button
          type="button"
          onClick={onExplore}
          className="group inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
        >
          Try AI presenters
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes avatar-arrow-bob-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
