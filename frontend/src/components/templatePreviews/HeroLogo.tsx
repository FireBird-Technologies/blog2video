import React, { useLayoutEffect, useRef, useState } from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Brand logo for the TEMPLATE PREVIEW bookends (intro/outro) only.
 *
 * This is deliberately NOT the corner watermark `LogoOverlay` draws. In a real
 * project the logo is a watermark whose corner the user picks; here it is the
 * subject, so a person browsing the gallery sees the brand up front.
 *
 * It is composited by CustomPreview OVER the scene, never passed to the scene as
 * `props.logoUrl` — generated scene code hardcodes its own logo size (28-44px on
 * a 1920px canvas), which is the "logo is very small" defect. Owning the size
 * here is the whole point.
 *
 * ## Why this measures the scene
 *
 * Generated bookends do not leave a reliable empty band. Many centre their copy
 * vertically and fill the frame, so a fixed hero slot painted straight through
 * the headline. There is no static signal for "is the top of this scene free" —
 * it differs per template and per orientation — so the only honest answer is to
 * look at what the scene actually painted, at runtime, and place accordingly:
 *
 *   - hero band clear  → large centred logo in the upper region (the intent)
 *   - hero band busy   → smaller logo tucked into the emptiest top corner
 *
 * Either way it never sits on top of text.
 */

/** Fraction of canvas WIDTH the centred hero box occupies. Portrait is the
 *  larger fraction because a portrait canvas is only 1080 wide against 1920 —
 *  matching landscape's fraction reads as small on a 9:16 frame. */
export const HERO_LOGO_WIDTH_RATIO = { landscape: 0.22, portrait: 0.44 } as const;
/** Cap on the hero box HEIGHT as a fraction of canvas height. `objectFit:
 *  contain` fits inside BOTH dimensions, so whichever binds first wins. */
export const HERO_LOGO_HEIGHT_RATIO = { landscape: 0.15, portrait: 0.11 } as const;
/** Distance from the top of the frame to the top of the centred hero box. */
export const HERO_LOGO_TOP_RATIO = { landscape: 0.09, portrait: 0.11 } as const;

/** The corner fallback, used when the scene already paints in the hero band.
 *  Smaller than the hero, larger than the project watermark (~0.105). */
export const CORNER_LOGO_WIDTH_RATIO = { landscape: 0.14, portrait: 0.26 } as const;
export const CORNER_LOGO_HEIGHT_RATIO = { landscape: 0.09, portrait: 0.07 } as const;
/** Inset from the frame edge for the corner placement. */
export const CORNER_LOGO_MARGIN_RATIO = { landscape: 0.025, portrait: 0.035 } as const;

type Key = "landscape" | "portrait";
type Placement =
  | { mode: "hero" }
  | { mode: "corner"; side: "left" | "right" };

/**
 * Does the scene paint anything inside `band` (viewport rect)?
 *
 * Walks the scene layer's leaf-ish elements and tests for intersection. Only
 * elements that actually mark the canvas count: a full-bleed transparent
 * positioning wrapper overlaps everything and would otherwise report "busy" for
 * every scene, so wrappers with no text, no background and no image are skipped.
 */
function bandIsBusy(sceneLayer: Element, band: DOMRect, minOverlapPx = 6): boolean {
  const els = sceneLayer.querySelectorAll<HTMLElement>("*");
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;

    const overlapW = Math.min(r.right, band.right) - Math.max(r.left, band.left);
    const overlapH = Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top);
    if (overlapW <= minOverlapPx || overlapH <= minOverlapPx) continue;

    // Ignore anything the size of the whole scene — those are layout wrappers
    // and full-bleed backdrops, not content competing for the band.
    const layerRect = sceneLayer.getBoundingClientRect();
    if (r.width >= layerRect.width * 0.92 && r.height >= layerRect.height * 0.92) continue;

    const cs = window.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;

    const tag = el.tagName;
    if (tag === "IMG" || tag === "SVG" || tag === "svg" || tag === "CANVAS" || tag === "VIDEO") {
      return true;
    }
    // Direct text: a node whose own child text is non-empty (not merely inherited
    // from a descendant, which would double-count every ancestor).
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("")
      .trim();
    if (ownText.length > 0) return true;

    // A painted box: visible background or a border of real thickness.
    const bg = cs.backgroundColor;
    const hasBg = !!bg && bg !== "transparent" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg);
    if (hasBg || cs.backgroundImage !== "none") return true;
  }
  return false;
}

interface HeroLogoProps {
  src: string;
  /** Scenes branch their layout on this, so the hero follows the same signal. */
  aspectRatio?: Key;
}

export const HeroLogo: React.FC<HeroLogoProps> = ({ src, aspectRatio = "landscape" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;
  const key: Key = isPortrait ? "portrait" : "landscape";

  const ref = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement>({ mode: "hero" });

  // Measure after the scene has painted, on a real timer rather than off the
  // frame counter.
  //
  // Keying this to `frame` does not work: the Player re-renders the composition
  // every frame, so a layout effect that re-runs each time both thrashes and
  // races the scene's own entrance animation. Instead probe a few times over the
  // first second — scenes slide their copy in, so a band that is empty at mount
  // may be occupied once the text lands — and keep the busiest answer.
  useLayoutEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const probe = () => {
      if (cancelled) return;
      const host = ref.current;
      if (!host) return;
      const wrapper = host.closest("[data-scene-wrapper]");
      const sceneLayer = wrapper?.querySelector("[data-scenecomp-layer]");
      if (!sceneLayer) return;

      const wRect = wrapper!.getBoundingClientRect();
      if (wRect.width <= 0 || wRect.height <= 0) return;

      // Pad the band a little so the logo never sits flush against copy.
      const padX = wRect.width * 0.02;
      const padY = wRect.height * 0.02;
      const bandW = wRect.width * HERO_LOGO_WIDTH_RATIO[key];
      const heroBand = new DOMRect(
        wRect.left + (wRect.width - bandW) / 2 - padX,
        wRect.top + wRect.height * HERO_LOGO_TOP_RATIO[key] - padY,
        bandW + padX * 2,
        wRect.height * HERO_LOGO_HEIGHT_RATIO[key] + padY * 2,
      );

      if (!bandIsBusy(sceneLayer, heroBand)) return; // stays hero

      // Busy: pick the emptier top corner rather than assuming one.
      const cw = wRect.width * CORNER_LOGO_WIDTH_RATIO[key];
      const ch = wRect.height * CORNER_LOGO_HEIGHT_RATIO[key];
      const m = wRect.width * CORNER_LOGO_MARGIN_RATIO[key];
      const rightBusy = bandIsBusy(
        sceneLayer,
        new DOMRect(wRect.right - m - cw, wRect.top + m, cw, ch),
      );
      const leftBusy = bandIsBusy(
        sceneLayer,
        new DOMRect(wRect.left + m, wRect.top + m, cw, ch),
      );
      // Right is the default: a left-aligned headline is the common case.
      const side: "left" | "right" = !rightBusy ? "right" : !leftBusy ? "left" : "right";
      // Only ever escalate hero -> corner within a scene's life, so a late
      // entrance animation cannot bounce the logo back under the text.
      setPlacement((p) =>
        p.mode === "corner" && p.side === side ? p : { mode: "corner", side },
      );
    };

    // Mount, then after the entrance animation has had time to land.
    probe();
    for (const ms of [120, 400, 900]) timers.push(setTimeout(probe, ms));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [key, src]);

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const style: React.CSSProperties =
    placement.mode === "hero"
      ? {
          position: "absolute",
          top: Math.round(height * HERO_LOGO_TOP_RATIO[key]),
          left: "50%",
          transform: "translateX(-50%)",
          width: Math.round(width * HERO_LOGO_WIDTH_RATIO[key]),
          height: Math.round(height * HERO_LOGO_HEIGHT_RATIO[key]),
        }
      : {
          position: "absolute",
          top: Math.round(height * CORNER_LOGO_MARGIN_RATIO[key]),
          [placement.side]: Math.round(width * CORNER_LOGO_MARGIN_RATIO[key]),
          width: Math.round(width * CORNER_LOGO_WIDTH_RATIO[key]),
          height: Math.round(height * CORNER_LOGO_HEIGHT_RATIO[key]),
        };

  return (
    <div ref={ref} style={{ ...style, zIndex: 100, pointerEvents: "none", opacity }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          // `contain` is what lets one box hold both a wide wordmark and a
          // square mark without either being cropped or stretched.
          objectFit: "contain",
          objectPosition: placement.mode === "hero" ? "center" : `top ${placement.side}`,
        }}
      />
    </div>
  );
};

export default HeroLogo;
