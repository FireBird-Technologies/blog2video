import { useState, useEffect, useCallback, useRef, type FC } from "react";
import InputShowcase from "./InputShowcase";
import PreviewErrorBoundary from "./PreviewErrorBoundary";

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
  /** Show the "any content source" input showcase below the carousel (landing only). */
  showInputShowcase?: boolean;
}

const VISIBLE_RANGE = 3;
// Side cards render a static poster <img> in thumbnailMode (zero Players) and
// only the center card renders a live preview, so the full visible fan can mount
// on every device with at most one Player alive at a time. This replaced an
// earlier per-side Player cap that existed only because side cards used to hold
// live (paused) Players and phones OOM/reloaded the tab when many existed.

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


function getStyle(offset: number, primed: boolean, portrait: boolean, orientation: CoverflowOrientation, isCenter: boolean): React.CSSProperties {
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
  // Before "primed", hide only the center card for the first two frames so the
  // coverflow can enter from a stable, centered layout.
  if (!primed && isCenter) {
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

/** Landscape: center card 600×337.5 (exact 16:9). Portrait: 220×391.11 (exact
 *  9:16). Heights are the width × the composition aspect so the preview — which
 *  sizes to its own 16:9/9:16 ratio from the card width — fills the card box
 *  exactly, with no top/bottom strip when a card is previewed at center. */
const CARD = {
  landscape: { w: 600, h: 337.5, designWidth: 660, designHeight: 390 },
  portrait: { w: 220, h: (220 * 16) / 9, designWidth: 560, designHeight: 430 },
} as const;

export default function CoverflowCarousel({ templates, initialIndex = 0, orientation = "landscape", showInputShowcase = false }: CoverflowCarouselProps) {
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
  // more of them is visible on narrow screens. Initialise from the current
  // viewport so the very first render already applies the mobile preview cap —
  // otherwise the first commit mounts the full 7 Players before the observer
  // narrows it to 3, and that momentary spike is enough to OOM/reload a phone
  // (worst on the orientation-switch remount).
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
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
   * Starts false so the centered live preview first renders at a neutral,
   * untransformed pose for two frames. That gives PlayerScaledCanvas a stable
   * card box to measure before coverflow transforms are applied.
   */
  const [primed, setPrimed] = useState(false);
  // Disable transform transitions while re-priming after arrow navigation so the
  // live player does not measure during a moving rotateY/scale animation.
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  useEffect(() => {
    setPrimed(false);
    setTransitionsEnabled(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPrimed(true);
        setTransitionsEnabled(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [activeIndex]);

  const goToIndex = useCallback((getNextIndex: (current: number) => number) => {
    // Put the next live card into the neutral measurement pose in the same
    // render that changes activeIndex. Waiting for the activeIndex effect is one
    // paint too late: the Player can mount while its card is still transitioning
    // from a side-card rotate/scale, which makes Remotion center/contain it and
    // leaves a visible top strip.
    setPrimed(false);
    setTransitionsEnabled(false);
    setActiveIndex((current) => getNextIndex(current));
  }, []);

  const prev = useCallback(() => {
    goToIndex((i) => (i - 1 + templates.length) % templates.length);
  }, [goToIndex, templates.length]);

  const next = useCallback(() => {
    goToIndex((i) => (i + 1) % templates.length);
  }, [goToIndex, templates.length]);

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
  const cardLeft = (DESIGN_WIDTH - card.w) / 2;
  const cardTop = (DESIGN_HEIGHT - card.h) / 2;

  return (
    <div className="select-none">
      {/* Preview layers must fill the card box by height (not aspect-ratio from
          width, which yields ~279px inside a 337.5px-tall landscape card). */}
      <style>{`
        .cf-card-preview {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          /* Flatten the card's preserve-3d tilt so Remotion doesn't letterbox
             when a side card animates into center. */
          transform: translateZ(0);
          transform-style: flat;
        }
        .cf-card-preview > *,
        .cf-card-preview .cf-scaled-canvas {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          max-height: none !important;
          aspect-ratio: unset !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          box-shadow: none !important;
        }
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
          // `clip` (not `hidden`) clips overflow WITHOUT forcing the other axis
          // to `auto` (which would add an unwanted scrollbar). Clip BOTH axes:
          // the scaled fan can spill *below* the stage box on short mobile
          // layouts and, since the center card is pointer-interactive, that
          // spill would sit over the arrow buttons and swallow their taps —
          // making "next" do nothing. Clipping Y keeps the controls tappable.
          overflowX: "clip",
          overflowY: "clip",
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
          // Lazy render: only mount visible cards. Side cards render poster
          // thumbnails through withPoster; the centered card renders the live
          // Remotion Player.
          const isVisible = Math.abs(wrapped) <= VISIBLE_RANGE;
          const style = getStyle(wrapped, primed, portrait, orientation, isCenter);
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
                top: cardTop,
                left: cardLeft,
                width: card.w,
                height: card.h,
                transition: transitionsEnabled
                  ? "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.45s ease"
                  : "none",
                transformStyle: "preserve-3d",
                transformOrigin: "center center",
                cursor: isCenter ? (tpl.onSelect ? "pointer" : "zoom-in") : "default",
                ...style,
              }}
            >
              <div
                className="rounded-xl border border-gray-200/60 bg-white"
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0 12px 34px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.22)",
                }}
              >
                {/* Absolutely fill the card's inner (border) box so the preview
                    covers it edge-to-edge. The preview cover-scales to this box
                    (see PlayerScaledCanvas / poster object-fit:cover), so there's
                    no top/bottom strip when a card is previewed at center — even
                    though the card's 1px border makes its content box a hair
                    smaller than card.w×card.h. Off-screen cards skip the preview
                    entirely (lazy render). */}
                <div
                  className="cf-preview cf-card-preview"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", borderRadius: 12 }}
                >
                  {isVisible && (
                    <PreviewErrorBoundary>
                      <CardPreview
                        key={isCenter ? `live-${orientation}-${activeIndex}` : `poster-${orientation}-${tpl.id}`}
                        thumbnailMode={!isCenter}
                      />
                    </PreviewErrorBoundary>
                  )}
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
              onClick={() => goToIndex(() => i)}
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

      {/* ── Content source showcase (landing page only) ── */}
      {showInputShowcase && <InputShowcase />}

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
            className={`relative mx-6 rounded-2xl overflow-hidden shadow-2xl ${orientation === "portrait" ? "" : "w-full max-w-5xl"}`}
            onClick={(e) => e.stopPropagation()}
            style={
              orientation === "portrait"
                ? { aspectRatio: "9/16", height: "min(86vh, 760px)" }
                : { aspectRatio: "16/9", width: "100%" }
            }
          >
            <div
              className="cf-preview relative"
              style={{
                width: "100%",
                height: "100%",
                background: "#000",
                opacity: modalReady ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            >
              <PreviewErrorBoundary>
                <ActivePreview />
              </PreviewErrorBoundary>
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
