import { useState, useEffect, useCallback, useRef, type FC } from "react";
import InputShowcase from "./InputShowcase";

export type CoverflowOrientation = "landscape" | "portrait";

export interface CoverflowTemplate {
  id: string;
  name: string;
  subtitle: string;
  Preview: FC<{ thumbnailMode?: boolean }>;
  /** 9:16 preview, rendered when the carousel is in portrait orientation. */
  PreviewPortrait?: FC<{ thumbnailMode?: boolean }>;
  /**
   * Optional click action for the center card. When provided, clicking the
   * centered card fires this instead of opening the fullscreen preview — used
   * for special CTA cards (e.g. "Your Own Brand").
   */
  onSelect?: () => void;
}

interface CoverflowCarouselProps {
  templates: CoverflowTemplate[];
  initialIndex?: number;
  /** Card shape: 16:9 (default) or 9:16. */
  orientation?: CoverflowOrientation;
}

const VISIBLE_RANGE = 3;

// Center card is 600px wide (half = 300px). ±1 peeks from just outside that edge.
// Each subsequent card is spaced further out.
//
// NOTE on rotateY: Remotion's <Player> auto-detects and divides out an ancestor
// CSS scale() to size its composition (see @remotion/player useElementSize). That
// math assumes a pure scale — a rotateY foreshortens getClientRects() width and
// throws it off, which at steep angles mis-sizes the Player to a partial ("half")
// scene. We keep the tilt moderate (~32°) so the foreshortening error stays small
// enough (cos32° ≈ 0.85) that the scene still renders correctly, while giving the
// cards a clear coverflow tilt.
// First side card sits close to the center; each subsequent card steps out by a
// large enough gap that the nearer (higher z) card doesn't cover the next one.
const OFFSETS: Record<number, { tx: number; ry: number; scale: number; opacity: number; z: number }> = {
  0: { tx: 0,    ry: 0,   scale: 1.00, opacity: 1.00, z: 10 },
  1: { tx: 270,  ry: -40, scale: 0.70, opacity: 0.85, z: 9  },
  2: { tx: 470,  ry: -42, scale: 0.52, opacity: 0.60, z: 8  },
  3: { tx: 620,  ry: -44, scale: 0.38, opacity: 0.38, z: 7  },
};

// In portrait the center card is shrunk and the side cards pulled out beside it
// (not over it) so two cards per side stay visible without overlapping the
// center. Offsets are tuned against each card's scaled half-width so a side
// card's inner edge sits just past the center card's edge. `ry` overrides the
// base tilt; `scaleMul` multiplies the base scale; `tx` replaces translateX.
//
// Portrait: center card shrunk; first side card close to center, the rest
// stepped out far enough not to be covered by the nearer card.
const PORTRAIT_OFFSETS: Record<number, { tx: number; ry: number; scaleMul: number }> = {
  0: { tx: 0,   ry: 0,   scaleMul: 0.66 },
  1: { tx: 245, ry: -42, scaleMul: 0.62 },
  2: { tx: 410, ry: -46, scaleMul: 0.50 },
  3: { tx: 540, ry: -50, scaleMul: 0.40 },
};

// ── Portrait *card-shape* (9:16) geometry ──
// Separate from the narrow-screen `portrait` shrink above. The card is tall and
// narrow (≈220px wide, half ≈110), so side cards are pulled in much closer than
// in the 16:9 layout while keeping the coverflow tilt.
const PORTRAIT_CARD_OFFSETS: Record<number, { tx: number; ry: number; scale: number; opacity: number; z: number }> = {
  0: { tx: 0,   ry: 0,   scale: 1.00, opacity: 1.00, z: 10 },
  1: { tx: 150, ry: -38, scale: 0.74, opacity: 0.85, z: 9  },
  2: { tx: 250, ry: -42, scale: 0.55, opacity: 0.58, z: 8  },
  3: { tx: 330, ry: -44, scale: 0.40, opacity: 0.34, z: 7  },
};


function getStyle(offset: number, primed: boolean, portrait: boolean, orientation: CoverflowOrientation): React.CSSProperties {
  const abs = Math.abs(offset);
  if (abs > VISIBLE_RANGE) {
    return { opacity: 0, pointerEvents: "none", zIndex: 0 };
  }
  const isPortraitCard = orientation === "portrait";
  // Portrait-card layout uses its own offsets table; the narrow-screen `portrait`
  // shrink still applies a multiplier on top so it fits small viewports.
  const cfg = isPortraitCard ? PORTRAIT_CARD_OFFSETS[abs] : OFFSETS[abs];
  const por = PORTRAIT_OFFSETS[abs];
  const baseTx = (!isPortraitCard && portrait) ? por.tx : cfg.tx;
  const baseRy = (!isPortraitCard && portrait) ? por.ry : cfg.ry;
  const scale = isPortraitCard
    ? cfg.scale * (portrait ? 0.82 : 1)
    : (portrait ? cfg.scale * por.scaleMul : cfg.scale);
  const tx = offset < 0 ? -baseTx : baseTx;
  const ry = offset < 0 ? -baseRy : baseRy;
  // Before "primed", every card sits at neutral scale(1)/rotateY(0) with opacity
  // 0. This lets each ScaledCanvas preview measure the true 600px box at mount (it
  // locks its internal scale once and never re-measures). The neutral pass is
  // invisible (opacity 0) and the card is absolutely positioned, so there's no flash.
  if (!primed) {
    return {
      transform: `translateX(${tx}px)`,
      opacity: 0,
      zIndex: cfg.z,
      pointerEvents: "none",
    };
  }
  // Push side cards back in 3D (translateZ) so under preserve-3d they render
  // *behind* the center card's plane — the center fully occludes their inner
  // edge, so they read as emerging from behind it rather than out of it.
  // (z-index is ignored between siblings in a preserve-3d context, so the depth
  // has to come from translateZ.)
  const tz = -abs * 120;
  return {
    transform: `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`,
    opacity: cfg.opacity,
    zIndex: cfg.z,
    pointerEvents: abs === 0 ? "auto" : "none",
  };
}

/** Landscape: center card 600×338 (16:9). Portrait: 220×391 (9:16). */
const CARD = {
  landscape: { w: 600, h: 338, designWidth: 660, designHeight: 390 },
  portrait: { w: 220, h: 391, designWidth: 560, designHeight: 430 },
} as const;

export default function CoverflowCarousel({ templates, initialIndex = 0, orientation = "landscape" }: CoverflowCarouselProps) {
  const card = CARD[orientation];
  const DESIGN_WIDTH = card.designWidth;
  const DESIGN_HEIGHT = card.designHeight;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [fullscreen, setFullscreen] = useState(false);
  // The fullscreen preview is a fresh mount; its ScaledCanvas/Remotion sizing
  // reads getBoundingClientRect once and jumps from a 0-width guess to the
  // correct scale — a visible flicker. The preview mounts immediately (so it
  // measures during these two frames) but stays at opacity 0 until ready, then
  // fades in, so the measure-and-resize happens off-screen.
  const [modalReady, setModalReady] = useState(false);
  useEffect(() => {
    if (!fullscreen) {
      setModalReady(false);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setModalReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [fullscreen]);

  // Responsive: the stage is laid out at a fixed DESIGN_WIDTH in px (the cards
  // and previews depend on concrete pixel sizes). On narrower screens we scale
  // the whole stage down to the available width so nothing overflows.
  const outerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  // Portrait/mobile layout: shrink the center card and pull side cards inward so
  // more of them is visible on narrow screens.
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setFitScale(w >= DESIGN_WIDTH ? 1 : w / DESIGN_WIDTH);
      setPortrait(w < 640);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [DESIGN_WIDTH]);
  /**
   * Starts false so every card first renders at neutral scale(1)/rotateY(0)
   * with opacity 0 — letting each preview measure the true 600px box at mount
   * (ScaledCanvas locks its scale once and never re-measures). After two frames
   * the measurement has happened, so we flip to the real coverflow transforms,
   * which fade/animate in via the cards' CSS transition.
   */
  const [primed, setPrimed] = useState(false);
  // Prime pass: every card first renders at a neutral, untransformed pose for two
  // frames so each preview's ScaledCanvas measures its true width, then we apply
  // the coverflow transforms. The carousel is remounted (via a `key` on the
  // orientation) when the user switches orientation, so this runs fresh each time.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPrimed(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + templates.length) % templates.length);
  }, [templates.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % templates.length);
  }, [templates.length]);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Arrow key navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (fullscreen) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen, prev, next]);

  const active = templates[activeIndex];
  const ActivePreview = orientation === "portrait" ? (active.PreviewPortrait ?? active.Preview) : active.Preview;

  return (
    <div className="select-none">
      {/* Every preview roots an element that sizes to its own 16:9 aspect from
          its width. Force that root to span the card's full width so it fills
          the 16:9 card box exactly (matches the wrapper FullTemplateShowcase
          uses). We deliberately do NOT force height — letting each preview keep
          its intrinsic 16:9 ratio avoids the Remotion Player overflowing. */}
      <style>{`
        .cf-preview > * { width: 100% !important; border-radius: 12px !important; overflow: hidden !important; box-shadow: none !important; }
        .cf-preview > * > * { box-shadow: none !important; }
      `}</style>
      {/* ── Responsive fit wrapper ──
          Breaks out of any parent container to span the full viewport width so
          the side cards have room to fan out. Clips horizontal overflow (no
          scrollbar) and collapses its height to the scaled stage. */}
      <div
        ref={outerRef}
        className="relative"
        style={{
          height: DESIGN_HEIGHT * fitScale,
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          // `clip` (not `hidden`) clips horizontal overflow WITHOUT forcing the
          // other axis to `auto` — `overflow-x: hidden` would make overflow-y
          // compute to `auto` and add an unwanted vertical scrollbar.
          overflowX: "clip",
          overflowY: "visible",
        }}
      >
      {/* ── Carousel stage (laid out at fixed DESIGN_WIDTH, scaled to fit) ── */}
      <div
        className="relative overflow-visible"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          perspective: "1600px",
          transformStyle: "preserve-3d",
          position: "absolute",
          left: "50%",
          top: 0,
          transform: `translateX(-50%) scale(${fitScale})`,
          transformOrigin: "top center",
        }}
      >
        {templates.map((tpl, i) => {
          const offset = i - activeIndex;
          // wrap-around: pick shorter path
          const len = templates.length;
          const wrapped =
            offset > len / 2 ? offset - len : offset < -len / 2 ? offset + len : offset;

          const isCenter = wrapped === 0;
          // Lazy render: only mount the preview for cards within the visible
          // fan (|offset| <= VISIBLE_RANGE). Off-screen cards render an empty
          // placeholder so their Remotion Players / animations aren't created
          // until scrolled into view. Safe because each preview measures with
          // offsetWidth, so mounting while transformed still locks the right scale.
          const isVisible = Math.abs(wrapped) <= VISIBLE_RANGE;
          const style = getStyle(wrapped, primed, portrait, orientation);
          // A card with its own `onSelect` fires that action on click instead of
          // opening the fullscreen preview (used for CTA cards).
          const handleClick = isCenter
            ? tpl.onSelect ?? (() => setFullscreen(true))
            : undefined;
          // In portrait orientation render the 9:16 variant (fall back to the
          // landscape preview only if a card lacks a portrait one).
          const CardPreview = orientation === "portrait" ? (tpl.PreviewPortrait ?? tpl.Preview) : tpl.Preview;

          return (
            <div
              key={`${orientation}-${tpl.id}`}
              onClick={handleClick}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: card.w,
                marginLeft: -card.w / 2,
                marginTop: -card.h / 2,
                transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.45s ease",
                transformStyle: "preserve-3d",
                cursor: isCenter ? (tpl.onSelect ? "pointer" : "zoom-in") : "default",
                ...style,
              }}
            >
              {/* Card. Each preview mounts exactly once (stable key) during the
                  prime pass while the card is at scale(1), so it measures the full
                  600px box and fills correctly — and never remounts, so fast
                  scrolling can't make it reload or flicker. Side cards run in
                  thumbnailMode (static); only the center plays.
                  The box-shadow lives on this wrapper (not an inner clipped
                  element) so the card's own `overflow: hidden` — which clips the
                  preview to rounded corners — never suppresses it. */}
              <div
                className="rounded-xl border border-gray-200/60 bg-white"
                style={{
                  width: card.w,
                  height: card.h,
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 12px 34px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.22)",
                }}
              >
                {/* The preview sizes to its own aspect from its width. Center it
                    so any aspect mismatch reads as balanced letterboxing rather
                    than a top-anchored gap. Off-screen cards skip the preview
                    entirely (lazy render). */}
                <div className="cf-preview" style={{ width: card.w, overflow: "hidden", borderRadius: 12 }}>
                  {isVisible && <CardPreview thumbnailMode={!isCenter} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* ── Template name + subtitle ── */}
      <div className="mt-8 text-center min-h-[52px]">
        <p className="text-base font-semibold text-gray-900">{active.name}</p>
        <p className="text-sm text-gray-500 mt-0.5 max-w-sm mx-auto leading-relaxed">{active.subtitle}</p>
      </div>

      {/* ── Arrow navigation ── */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous template"
          className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:shadow-md transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Dot indicator */}
        <div className="flex items-center gap-1.5">
          {templates.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to template ${i + 1}`}
              className={`rounded-full transition-all ${
                i === activeIndex
                  ? "w-5 h-1.5 bg-purple-600"
                  : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Next template"
          className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:shadow-md transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Content source showcase ── */}
      <InputShowcase />

      {/* ── Fullscreen modal ── */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Close fullscreen"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className={`mx-6 rounded-2xl overflow-hidden shadow-2xl ${orientation === "portrait" ? "" : "w-full max-w-5xl"}`}
            onClick={(e) => e.stopPropagation()}
            style={
              orientation === "portrait"
                ? { aspectRatio: "9/16", height: "min(86vh, 760px)" }
                : { aspectRatio: "16/9" }
            }
          >
            <div
              className="cf-preview"
              style={{
                width: "100%",
                background: "#000",
                opacity: modalReady ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            >
              <ActivePreview />
            </div>
          </div>

          <div className="absolute bottom-8 text-center">
            <p className="text-white font-semibold text-lg">{active.name}</p>
            <p className="text-white/60 text-sm mt-0.5">{active.subtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
