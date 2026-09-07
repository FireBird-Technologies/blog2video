/** Render-time correction of off-theme colours in generated scene code.
 *
 * WHY THIS EXISTS AT RENDER TIME
 * ------------------------------
 * The validator now rejects hard-coded hues and unreadable text at generation
 * time, but that only helps scenes generated AFTER the check landed. Templates
 * a user already owns carry the old code, and regenerating them is neither free
 * nor something we can do behind their back. This walks the live DOM instead, so
 * an existing template is corrected the moment it renders — the same reason
 * EyebrowSizeProvider and KitVariantProvider live in the wrapper.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not repaint anything that is already on-palette, and it does not touch
 * an element merely because it is unusual. Two failures, narrowly defined:
 *
 *   1. A colour with a HUE that is not in the brand palette (indigo in a
 *      cream/black/red template). Greys are left alone — scrims, hairlines and
 *      shadows are legitimately neutral and carry no competing hue.
 *   2. Text that cannot be read against what it actually sits on, measured with
 *      the real composited background rather than a guess.
 *
 * Over-reach here would flatten every template into one colour, which is the
 * opposite of the goal, so each rule is applied per-element and only when the
 * element's own computed style is provably wrong.
 */
import { contrastRatio, readableOn, AA_CONTRAST } from "./theme";

/** rgb()/rgba() as painted by the browser → {r,g,b,a}. */
function parseRgb(c: string): { r: number; g: number; b: number; a: number } | null {
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** rgb()/rgba() as painted by the browser → #rrggbb, IGNORING alpha.
 *
 * Only safe where the colour is known to be opaque, or where alpha does not
 * change the decision. For a BACKGROUND, use `effectiveBackground` instead —
 * see the comment there.
 */
function rgbToHex(rgb: string): string | null {
  const p = parseRgb(rgb);
  return p ? toHex(p.r, p.g, p.b) : null;
}

/** `fg` composited over `bg` at alpha `a`. */
function composite(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
  a: number,
): { r: number; g: number; b: number } {
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

/** True when a colour is fully transparent, so it paints nothing. */
function isTransparent(c: string): boolean {
  const m = c.match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/);
  return c === "transparent" || (m ? Number(m[1]) === 0 : false);
}

function hueSpread(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Greys carry no hue, so they can never be "off-palette". */
const NEUTRAL_TOLERANCE = 12;
const isNeutral = (hex: string) => hueSpread(hex) <= NEUTRAL_TOLERANCE;

/** Perceptual-ish distance, good enough to pick the closest brand colour. */
function distance(a: string, b: string): number {
  const p = (h: string) => {
    const s = h.replace("#", "");
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  // Weighted to match human sensitivity (green > red > blue).
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
}

function nearest(hex: string, palette: string[]): string {
  let best = palette[0];
  let bestD = Infinity;
  for (const c of palette) {
    const d = distance(hex, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Walk up the ancestor chain for the first background that actually paints.
 * A transparent parent means the text sits on whatever is behind IT, so
 * measuring contrast against the element's own (transparent) background — or
 * against the canvas by assumption — gives the wrong answer for text inside a
 * panel. This is why the correction can safely leave panel text alone.
 */
function effectiveBackground(el: HTMLElement, fallback: string): string {
  // Layers from the element outward, each with its own alpha. A TRANSLUCENT
  // background does not hide what is behind it, so it must be composited rather
  // than read as opaque.
  //
  // Reading alpha as opaque is what produced the reported defect: a card painted
  // `rgba(255,255,255,0.04)` — a 4% white wash over a #0B0B0B canvas — was
  // reported as solid WHITE. The corrector then concluded that the card's white
  // text could not be read, and rewrote it to near-black, onto a card that is
  // in fact almost black. Two of that template's six scenes rendered invisible.
  const layers: { r: number; g: number; b: number; a: number }[] = [];
  let node: HTMLElement | null = el;
  while (node) {
    const parsed = parseRgb(getComputedStyle(node).backgroundColor);
    if (parsed && parsed.a > 0) {
      layers.push(parsed);
      // Opaque: nothing behind it can show through, so stop.
      if (parsed.a >= 1) break;
    }
    node = node.parentElement;
  }

  const base = parseRgb(fallback) ?? { r: 255, g: 255, b: 255, a: 1 };
  // Composite back-to-front: the furthest layer sits on the fallback ground,
  // and each nearer layer is laid over the result.
  let out = { r: base.r, g: base.g, b: base.b };
  for (let i = layers.length - 1; i >= 0; i--) {
    out = composite(layers[i], out, layers[i].a);
  }
  return toHex(out.r, out.g, out.b);
}

export interface EnforceThemeOptions {
  /** Every colour the brand allows, as #rrggbb. */
  palette: string[];
  /** The template canvas — the ground truth when nothing else paints. */
  background: string;
  /** Body text colour, used when a foreground must be replaced outright. */
  text: string;
}

/**
 * Correct off-theme colours inside `root`. Safe to call repeatedly (it is
 * idempotent: a corrected element is already on-palette and readable, so the
 * second pass finds nothing to do).
 *
 * Returns the number of corrections made, which the caller can log.
 */
export function enforceTheme(root: HTMLElement, opts: EnforceThemeOptions): number {
  const palette = opts.palette.filter(Boolean).map((c) => c.toLowerCase());
  if (palette.length === 0) return 0;
  let fixed = 0;

  const els = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of els) {
    const cs = getComputedStyle(el);

    // ── 1. Off-palette BACKGROUNDS (the indigo rule / indigo chip) ──────────
    const bgRaw = cs.backgroundColor;
    if (bgRaw && !isTransparent(bgRaw)) {
      const bgHex = rgbToHex(bgRaw);
      if (bgHex && !isNeutral(bgHex) && !palette.includes(bgHex)) {
        // A GRADIENT set through the `background` shorthand paints over
        // background-color regardless of !important, so the recolour would be
        // invisible. Clear it only in that case — an IMAGE background (a photo,
        // a data: URI) is content, not a theme colour, and must survive.
        const img = cs.backgroundImage;
        if (img && img.includes("gradient")) {
          el.style.setProperty("background-image", "none", "important");
        }
        el.style.setProperty("background-color", nearest(bgHex, palette), "important");
        fixed++;
      }
    }

    // ── SVG fill / stroke ───────────────────────────────────────────────────
    //
    // Scenes draw icons, rules, arrows and chart marks as SVG, and the kit's own
    // SignatureArtifact is built from <path stroke={c}> / <polygon fill={c}>.
    // None of that has a CSS background or border, so the two passes around this
    // one never saw it — an off-brand hue in an SVG survived every correction.
    for (const prop of ["fill", "stroke"] as const) {
      const raw = (cs as unknown as Record<string, string>)[prop];
      if (!raw || isTransparent(raw) || raw === "none") continue;
      const hex = rgbToHex(raw);
      if (hex && !isNeutral(hex) && !palette.includes(hex)) {
        el.style.setProperty(prop, nearest(hex, palette), "important");
        fixed++;
      }
    }

    // ── boxShadow ───────────────────────────────────────────────────────────
    //
    // A glow is a colour the viewer plainly sees ("0 0 18px <accent>"), and the
    // kit uses exactly that shape for accent glows. Rewritten by substituting
    // each off-palette colour inside the value, because a shadow is a compound
    // property that may carry several.
    const shadow = cs.boxShadow;
    if (shadow && shadow !== "none") {
      let next = shadow;
      for (const m of shadow.matchAll(/rgba?\([^)]*\)/g)) {
        const hex = rgbToHex(m[0]);
        if (hex && !isNeutral(hex) && !palette.includes(hex)) {
          next = next.split(m[0]).join(nearest(hex, palette));
        }
      }
      if (next !== shadow) {
        el.style.setProperty("box-shadow", next, "important");
        fixed++;
      }
    }

    // Borders read as strongly as fills at hairline widths, and the indigo
    // divider in the reported scene was a border, not a background.
    for (const side of ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"] as const) {
      // A border with no width paints nothing, and its computed COLOUR defaults
      // to the element's `color` — so recolouring it is both invisible and
      // endless (the value never settles, because it tracks `color`).
      const widthProp = side.replace("Color", "Width") as
        | "borderTopWidth" | "borderRightWidth" | "borderBottomWidth" | "borderLeftWidth";
      const styleProp = side.replace("Color", "Style") as
        | "borderTopStyle" | "borderRightStyle" | "borderBottomStyle" | "borderLeftStyle";
      if (parseFloat(cs[widthProp] || "0") === 0) continue;
      if (!cs[styleProp] || cs[styleProp] === "none" || cs[styleProp] === "hidden") continue;

      const raw = cs[side];
      if (!raw || isTransparent(raw)) continue;
      const hex = rgbToHex(raw);
      if (hex && !isNeutral(hex) && !palette.includes(hex)) {
        el.style.setProperty(
          side.replace(/([A-Z])/g, "-$1").toLowerCase(),
          nearest(hex, palette),
          "important",
        );
        fixed++;
      }
    }

    // ── 2. TEXT: off-palette hue, or unreadable on its real background ──────
    // Only elements with their own text are considered; recolouring a container
    // would cascade to children that were already correct.
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || "").trim().length > 0,
    );
    if (!hasOwnText) continue;

    const fgHex = rgbToHex(cs.color);
    if (!fgHex) continue;

    const onHex = effectiveBackground(el, opts.background);

    // What the kit itself would choose for this background. When the text
    // ALREADY equals that, it is correct by definition and must be left alone —
    // even though white/black are not literally palette members. Without this,
    // white-on-a-red-panel (the right answer) was re-evaluated on every frame
    // because "#ffffff" is not in the palette list.
    const ideal = readableOn(onHex);
    if (fgHex === ideal.toLowerCase()) continue;

    const offPalette = !isNeutral(fgHex) && !palette.includes(fgHex);
    const unreadable = contrastRatio(fgHex, onHex) < AA_CONTRAST;
    if (!offPalette && !unreadable) continue;

    // Prefer the brand's own text colour; fall back to whichever of black/white
    // the kit says reads on this background when even that is unreadable (a
    // panel dark enough that body text cannot sit on it).
    const candidate = contrastRatio(opts.text, onHex) >= AA_CONTRAST ? opts.text : ideal;
    if (candidate.toLowerCase() !== fgHex) {
      el.style.setProperty("color", candidate, "important");
      fixed++;
    }
  }
  return fixed;
}
