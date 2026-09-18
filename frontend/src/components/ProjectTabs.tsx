import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type ProjectTabId = "script" | "scenes" | "images" | "audio" | "avatar" | "settings";

export interface ProjectTabItem {
  id: ProjectTabId;
  label: string;
  /** Optional leading icon rendered before the label (e.g. a pencil on "Edit Scenes"). */
  icon?: ReactNode;
  /** Short uppercase tag rendered after the label (e.g. "BETA"). Kept separate
   *  from `label` so it can be styled as a pill and so the label stays the plain
   *  tab name for anything that reads it. */
  badge?: string;
}

type TabSize = "sm" | "lg";

interface Props {
  tabs: ProjectTabItem[];
  active: ProjectTabId;
  onChange: (next: ProjectTabId) => void;
  /** Forwarded to the tabs container; used by joyride targeting in ProjectView. */
  containerDataTour?: string;
  /** Visual size — "sm" (default, in-app) or "lg" (used by help videos / marketing renders). */
  size?: TabSize;
}

/** Pill-style tab strip used at the top of the project page. Shared between live UI and help videos. */
export default function ProjectTabs({ tabs, active, onChange, containerDataTour, size = "sm" }: Props) {
  /* flex-wrap + max-w-full: the strip is `sm:w-fit`, so it sizes to its content
     — with six tabs that content can be wider than the column it sits in, and
     the last tab ("Settings") was simply clipped at the edge with no way to
     reach it. Wrapping lets the overflow fall onto a second row inside the same
     pill, so every tab stays visible and clickable without horizontal scrolling
     (a scrollbar hides the very thing the user is looking for). */
  /* justify-center centres the buttons inside the strip, so a wrapped second
     row sits under the middle of the first rather than hanging off the left.
     The strip itself is centred in its column only WHEN capped (see `style`
     below) — an uncapped strip keeps its existing left alignment. */
  const wrapCls = "flex-wrap max-w-full justify-center";
  const containerCls =
    size === "lg"
      ? `flex ${wrapCls} gap-1.5 p-1.5 bg-gray-100/60 rounded-2xl w-full sm:w-fit`
      : `flex ${wrapCls} gap-1 p-1 bg-gray-100/60 rounded-xl w-full sm:w-fit`;

  /* Balance the two rows when the strip wraps.
   *
   * Plain `flex-wrap` fills the first row and spills the remainder, so six tabs
   * in a slightly-too-narrow column break as [5, 1] — a full row plus one
   * orphan. Splitting the tabs evenly is a measurement problem CSS cannot solve
   * on its own: it depends on each button's rendered width. So measure once
   * after layout, and if the buttons landed on more than one row, cap the strip
   * to the width of the wider half — which forces the break at the midpoint.
   *
   * Width is only ever CAPPED, never forced, so a strip that fits on one line is
   * left completely alone and this is inert in the common case.
   */
  const stripRef = useRef<HTMLDivElement>(null);
  const [maxW, setMaxW] = useState<number | null>(null);
  const [fontNonce, setFontNonce] = useState(0);

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    const measure = () => {
      const node = stripRef.current;
      const parent = node?.parentElement;
      if (!node || !parent) return;
      const kids = Array.from(node.children) as HTMLElement[];
      if (kids.length < 2) return;

      const cs = getComputedStyle(node);
      const gap = parseFloat(cs.columnGap || "0") || 0;
      const pad =
        parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");

      /* Measure NATURAL button widths, with the cap and any stretching lifted.
       *
       * This is the subtle part. While a cap is applied the strip is no longer
       * shrink-wrapping, so its flex children stretch to fill the row — reading
       * offsetWidth then reports the STRETCHED width, the cap is recomputed too
       * large, and the split degrades (6 tabs settled at [4,2] instead of
       * [3,3]). Forcing the strip wide and the buttons to their content size for
       * the duration of the measurement makes the numbers independent of the
       * layout this effect itself produced. Nothing is painted in between: the
       * styles are restored before the browser can render.
       */
      const prevMaxWidth = node.style.maxWidth;
      const prevWidth = node.style.width;
      node.style.maxWidth = "none";
      node.style.width = "max-content";
      const natural = kids.map((k) => k.getBoundingClientRect().width);
      node.style.maxWidth = prevMaxWidth;
      node.style.width = prevWidth;

      const widthOf = (from: number, to: number) =>
        natural.slice(from, to).reduce((sum, w, i) => sum + w + (i ? gap : 0), 0);

      const full = widthOf(0, natural.length) + pad;
      const available = parent.clientWidth;

      // Fits on one line: no cap, leave the natural layout alone.
      if (full <= available) {
        setMaxW(null);
        return;
      }

      const half = Math.ceil(kids.length / 2);
      // The wider of the two halves decides the cap, so neither half is clipped.
      const balanced = Math.ceil(
        Math.max(widthOf(0, half), widthOf(half, kids.length)) + pad,
      );
      // Never cap wider than the space we actually have, or the second row
      // would be clipped again instead of wrapping.
      setMaxW(Math.min(balanced, available));
    };

    measure();
    const ro = new ResizeObserver(measure);
    // Watch the PARENT: the strip's own size is what we are changing, so
    // observing it would feed back into itself.
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [tabs.length, size, fontNonce]);

  // Re-balance once webfonts land: they change every button's width, and the
  // first measurement ran against the fallback face. Bumping the nonce re-runs
  // the effect above rather than just clearing the cap, which on its own would
  // leave the strip unbalanced.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) return;
    let cancelled = false;
    fonts.ready.then(() => {
      if (!cancelled) setFontNonce((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  /* shrink-0 from sm up: with a wrapping strip a shrinkable button squeezes
     itself thin to stay on one line instead of wrapping, which is exactly the
     crushed row we are fixing. Below sm the tabs still share the full width
     equally (flex-1), so the phone layout is unchanged. */
  const buttonBase =
    size === "lg"
      ? "flex-1 sm:flex-none sm:shrink-0 px-5 sm:px-7 py-3 text-base font-semibold rounded-xl transition-all text-center"
      : "flex-1 sm:flex-none sm:shrink-0 px-1.5 sm:px-4 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-all text-center whitespace-nowrap";

  return (
    <div
      ref={stripRef}
      className={containerCls}
      /* While capped, pin the width outright rather than only bounding it: the
         container is `w-full sm:w-fit`, so a max-width alone still leaves the
         strip stretched to the column below `sm` and the buttons (flex-1 there)
         stretch with it — which pushes a fourth tab onto the first row and gives
         the lopsided [4,2] break. marginInline:auto takes the removed width off
         BOTH sides instead of entirely off the right. */
      style={maxW ? { width: maxW, maxWidth: "100%", marginInline: "auto" } : undefined}
      data-tour={containerDataTour}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-tour={`${tab.id}-tab`}
          onClick={() => onChange(tab.id)}
          className={`${buttonBase} ${
            active === tab.id
              ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {tab.icon || tab.badge ? (
            <span className="inline-flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.badge && (
                <span
                  className={`${
                    size === "lg"
                      ? "px-1.5 py-0.5 text-[10px]"
                      : "px-1 py-px text-[8px] sm:text-[9px]"
                  } font-bold tracking-wide rounded bg-purple-100 text-purple-600 leading-none`}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          ) : (
            tab.label
          )}
        </button>
      ))}
    </div>
  );
}
