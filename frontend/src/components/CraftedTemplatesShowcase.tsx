import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listPublicCraftedTemplates, type CraftedTemplateSummary } from "../api/client";
import CraftedTemplatePreviewSmart from "./templatePreviews/CraftedTemplatePreviewSmart";

// ── Tuning ─────────────────────────────────────────────────────────────
/** Slides within this distance of center are kept in the DOM. */
const RENDER_WINDOW = 3;
/** Slides within this distance run the live animated preview; the rest fall
 *  back to a static image to keep the page smooth. */
const LIVE_WINDOW = 1;
const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 48;

// Coverflow geometry (iPod-style): the centered card lies flat and large; the
// side cards stand like 2D panels on a plane — rotated nearly edge-on so you
// see them in steep profile, tightly stacked behind one another.
const FIRST_X = 46; // % offset of the first neighbour from center (clears the big center card)
const STEP_X = 14; // % each further neighbour shifts (tight stacking, mostly edges)
const STEP_Z = 120; // px each neighbour recedes
const ROT = 68; // deg each side card tilts inward (steep, near-profile)
const SCALE_STEP = 0.06; // gentle shrink per step out

const BADGES = ["Hand-crafted by designers", "Pixel-perfected", "Studio-grade motion"];

// ── A single coverflow card ────────────────────────────────────────────
function CoverflowCard({
  item,
  offset,
  isLive,
  onActivate,
}: {
  item: CraftedTemplateSummary;
  offset: number; // index - activeIndex
  isLive: boolean;
  onActivate: () => void;
}) {
  const abs = Math.abs(offset);
  const isCenter = offset === 0;
  const dir = Math.sign(offset); // -1 left, +1 right

  // Center card is flat + forward; side cards stand on the plane, rotated
  // steeply inward (near profile) and tightly stacked — classic cover flow.
  // The first neighbour clears the big center card by FIRST_X, then each
  // further card adds only STEP_X so we mostly see their standing edges.
  const sideX = dir * (FIRST_X + (abs - 1) * STEP_X);
  const transform = isCenter
    ? "translate(-50%, -50%) translateZ(60px)"
    : [
        "translate(-50%, -50%)",
        `translateX(${sideX}%)`,
        `translateZ(${-abs * STEP_Z}px)`,
        `rotateY(${-dir * ROT}deg)`,
        `scale(${Math.max(0.7, 1 - (abs - 1) * SCALE_STEP)})`,
      ].join(" ");

  const accent =
    item.theme?.colors?.accent ?? item.preview_colors?.accent ?? "#7c3aed";

  return (
    <div
      aria-hidden={!isCenter}
      onClick={!isCenter ? onActivate : undefined}
      className="absolute left-1/2 top-[42%] will-change-transform"
      style={{
        // Sized to match the "See it in action" demo media card: a single
        // ~16:9 card capped at ~440px wide (its image region is ~440x250).
        width: isCenter ? "clamp(260px, 32vw, 440px)" : "clamp(220px, 27vw, 380px)",
        transform,
        transformStyle: "preserve-3d",
        opacity: abs > RENDER_WINDOW ? 0 : 1,
        zIndex: 100 - abs,
        transition: "transform 0.55s cubic-bezier(0.22,0.61,0.36,1), opacity 0.45s ease, width 0.55s cubic-bezier(0.22,0.61,0.36,1)",
        cursor: isCenter ? "default" : "pointer",
        pointerEvents: abs > RENDER_WINDOW ? "none" : "auto",
      }}
    >
      {/* The panel itself + its mirrored reflection, stacked vertically inside
          the shared 3D wrapper so the reflection rotates with the card. */}
      <div
        className="relative overflow-hidden rounded-2xl bg-white"
        style={{
          aspectRatio: "16 / 9",
          boxShadow: isCenter
            ? `0 40px 80px -24px rgba(20,12,40,0.55), 0 0 0 1px ${accent}33`
            : "0 24px 50px -20px rgba(20,12,40,0.55), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {isLive ? (
          <CraftedTemplatePreviewSmart item={item} compileCacheScope="public-showcase" />
        ) : item.preview_image_url ? (
          <img
            src={item.preview_image_url}
            alt={`${item.name} preview`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            {item.name}
          </div>
        )}

        {/* Frost the side cards so focus stays on the active slide. */}
        {!isCenter && (
          <div
            className="absolute inset-0"
            style={{
              background:
                dir < 0
                  ? "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.10) 100%)"
                  : "linear-gradient(270deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.10) 100%)",
            }}
          />
        )}
      </div>

      {/* Glossy floor reflection — the card mirrored below itself, fading out.
          This is the signature cover-flow "standing on a plane" shadow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 overflow-hidden rounded-2xl"
        style={{
          top: "100%",
          height: "38%",
          marginTop: 1,
          transform: "scaleY(-1)",
          transformOrigin: "top",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.40), transparent 80%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.40), transparent 80%)",
        }}
      >
        <div className="h-full w-full" style={{ aspectRatio: "16 / 9" }}>
          {item.preview_image_url ? (
            <img
              src={item.preview_image_url}
              alt=""
              className="h-full w-full object-cover object-top"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="h-full w-full bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main showcase ──────────────────────────────────────────────────────
export default function CraftedTemplatesShowcase() {
  const [templates, setTemplates] = useState<CraftedTemplateSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance direction ping-pongs at the ends (no jarring wrap jump).
  const dirRef = useRef(1);
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);

  // Fetch live from R2 (backend cache + hard-refresh bypass handle freshness).
  useEffect(() => {
    let cancelled = false;
    listPublicCraftedTemplates()
      .then((res) => {
        if (cancelled) return;
        setTemplates(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const count = templates.length;

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(count - 1, i)),
    [count]
  );

  const go = useCallback(
    (next: number) => setActive((cur) => clamp(typeof next === "number" ? next : cur)),
    [clamp]
  );

  const prev = useCallback(() => setActive((i) => clamp(i - 1)), [clamp]);
  const next = useCallback(() => setActive((i) => clamp(i + 1)), [clamp]);

  // Ping-pong auto-advance, paused on hover / drag.
  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(() => {
      setActive((i) => {
        let d = dirRef.current;
        if (i + d > count - 1) d = -1;
        else if (i + d < 0) d = 1;
        dirRef.current = d;
        return i + d;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  // Keyboard arrows when the stage region is focused.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    },
    [prev, next]
  );

  // Pointer drag / swipe.
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, moved: false };
    setPaused(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) > 6) d.moved = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const delta = e.clientX - d.startX;
    if (delta <= -SWIPE_THRESHOLD_PX) next();
    else if (delta >= SWIPE_THRESHOLD_PX) prev();
  };

  const activeItem = templates[active];
  const accent =
    activeItem?.theme?.colors?.accent ?? activeItem?.preview_colors?.accent ?? "#7c3aed";

  // Window of slides to actually keep in the DOM.
  const visible = useMemo(
    () =>
      templates
        .map((item, i) => ({ item, i, offset: i - active }))
        .filter(({ offset }) => Math.abs(offset) <= RENDER_WINDOW),
    [templates, active]
  );

  // Self-hide when the feature is off / nothing to show.
  if (loaded && count === 0) return null;

  return (
    <div className="reveal">
      {/* Header — matches the light, purple-accented language of the rest of the page. */}
      <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
        Designer-Crafted · Premium
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Templates obsessed over by real designers
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-xl mx-auto mb-6 leading-relaxed">
        Not auto-generated themes — every scene below was hand-built, color-tuned, and
        motion-polished by our design studio. Slide through the collection.
      </p>

      {/* Exaggerated craft badges */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        {BADGES.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-medium text-purple-700"
          >
            <svg className="h-3.5 w-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {b}
          </span>
        ))}
      </div>

      {/* Glass stage — light, on-brand, with the coverflow filling the full width. */}
      <div className="glass-card relative overflow-hidden rounded-2xl px-2 py-8 sm:px-6 sm:py-10 mx-auto">
        {/* Soft accent wash that tracks the active template. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-30 blur-3xl transition-colors duration-700"
          style={{ background: `radial-gradient(60% 70% at 50% 0%, ${accent}22, transparent 70%)` }}
        />

        {/* Coverflow stage */}
        <div
          role="group"
          aria-label="Crafted templates carousel"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragRef.current = null; }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative mx-auto select-none outline-none"
          style={{
            // ~250px tall card (440px @ 16:9) + room below for the reflection,
            // capped so the stage stays at demo-card scale.
            height: "clamp(220px, 26vw, 340px)",
            perspective: "1600px",
            touchAction: "pan-y",
          }}
        >
          {!loaded ? (
            <div className="flex h-full items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" />
            </div>
          ) : (
            <>
              {visible.map(({ item, i, offset }) => (
                <CoverflowCard
                  key={item.id}
                  item={item}
                  offset={offset}
                  isLive={Math.abs(offset) <= LIVE_WINDOW}
                  onActivate={() => go(i)}
                />
              ))}

              {/* Edge fades for depth */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-white to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-white to-transparent" />
            </>
          )}
        </div>

        {/* Active template caption — a compact, centered info pill hugging the
            bottom of the cover, exactly like the iPod cover-flow label. */}
        {activeItem && (
          <div className="relative -mt-2 flex justify-center">
            <div className="max-w-[440px] rounded-2xl bg-white/85 px-6 py-3 text-center shadow-[0_8px_24px_-12px_rgba(20,12,40,0.30)] ring-1 ring-black/5 backdrop-blur">
              <h3 className="text-base font-semibold leading-tight text-gray-900">{activeItem.name}</h3>
              {activeItem.description && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{activeItem.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Controls: arrows + dots */}
        {count > 1 && (
          <div className="relative mt-5 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={prev}
              disabled={active === 0}
              aria-label="Previous template"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-purple-600 disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5">
              {templates.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to ${t.name}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === active ? 22 : 6,
                    background: i === active ? accent : "rgba(0,0,0,0.15)",
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={next}
              disabled={active === count - 1}
              aria-label="Next template"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-purple-600 disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
