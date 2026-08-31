/**
 * Custom-template craft kit — structural primitives.
 *
 * These are the pieces that make a built-in template read as a *designed
 * template* rather than a series of slides, and which the kit previously had no
 * equivalent for. Compare economist: its identity is not only its layouts, it
 * is the persistent red-flag masthead, the panel numbering on every chart, the
 * drop caps, the hairline rules between sections. Those are STRUCTURE, and
 * without them every generated scene was an isolated card.
 *
 * The distinction from Decor.tsx: Decor is *atmosphere* (background texture you
 * could remove without anyone noticing a missing element). This is *structure* —
 * chrome and framing that repeats across scenes and makes them feel like one
 * publication.
 *
 * All deterministic (frame-derived only, no Math.random) and portrait-aware,
 * and all read the brand palette via useKit() so they need no colour props.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { drawProgress, progressAt } from "./motion";

// ─── Masthead ────────────────────────────────────────────────────────────────

export interface MastheadProps {
  /** Usually the brand wordmark or logo. */
  left?: React.ReactNode;
  /** Usually a section label, panel number or domain. */
  right?: React.ReactNode;
  rule?: "hairline" | "solid" | "none";
  position?: "top" | "bottom";
  /** Frame the draw-in begins. */
  revealFrame?: number;
  /** Horizontal inset as a % of frame width, to match the scene's safe area. */
  inset?: number;
}

/**
 * Persistent chrome strip. The blueprint sets this once and every scene renders
 * the same one — that repetition is what produces the "one template" feeling
 * rather than nine unrelated cards.
 */
export const Masthead: React.FC<MastheadProps> = ({
  left,
  right,
  rule = "hairline",
  position = "top",
  revealFrame = 0,
  inset = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, isPortrait, fonts, type } = useKit();

  const appear = progressAt(frame, revealFrame, Math.round(fps * 0.5));
  const ruleW = drawProgress(frame, revealFrame + 4, Math.round(fps * 0.6));
  if (appear <= 0) return null;

  // On the scale (type.micro), not a raw 20/22 literal — chrome has to follow
  // the body slider like everything else.
  const fontSize = type.micro;

  return (
    <div
      style={{
        position: "absolute",
        left: `${inset}%`,
        right: `${inset}%`,
        [position]: `${isPortrait ? 4.5 : 5}%`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        opacity: appear,
        transform: `translateY(${(1 - appear) * (position === "top" ? -8 : 8)}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
          color: palette.text,
          fontFamily: fonts.heading ?? "inherit",
          fontSize,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {left}
      </div>

      {rule !== "none" && (
        <div
          style={{
            flex: 1,
            height: rule === "solid" ? 2 : 1,
            background: rule === "solid" ? palette.accent : palette.border,
            transform: `scaleX(${ruleW})`,
            transformOrigin: "left center",
            minWidth: 0,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          color: palette.muted,
          fontFamily: fonts.body ?? "inherit",
          fontSize: Math.round(fontSize * 0.9),
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {right}
      </div>
    </div>
  );
};

// ─── Section divider ─────────────────────────────────────────────────────────

export interface SectionDividerProps {
  variant?: "rule" | "numeral" | "wordmark" | "wipe";
  label?: string;
  index?: number;
  /** 0..1 strength for the wipe/wash variants. */
  intensity?: number;
}

/**
 * A deliberate beat BETWEEN content sections. Built-ins use these to chapter a
 * video; without one, every scene carries equal weight and the video reads flat.
 */
export const SectionDivider: React.FC<SectionDividerProps> = ({
  variant = "rule",
  label,
  index,
  intensity = 0.6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, isPortrait, fonts, type } = useKit();

  const p = progressAt(frame, 0, Math.round(fps * 0.7));
  const draw = drawProgress(frame, 2, Math.round(fps * 0.8));
  const k = Math.max(0, Math.min(1, intensity));

  if (variant === "wipe") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: withAlpha(palette.accent, 0.9 * k),
          transform: `scaleX(${draw})`,
          transformOrigin: "left center",
          pointerEvents: "none",
        }}
      />
    );
  }

  const numeral =
    variant === "numeral" && typeof index === "number"
      ? String(index).padStart(2, "0")
      : null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isPortrait ? 18 : 24,
        opacity: p,
        pointerEvents: "none",
      }}
    >
      {numeral && (
        <div
          style={{
            // Large, but still type the viewer reads.
            color: palette.accentText,
            fontFamily: fonts.heading ?? "inherit",
            fontSize: Math.round(type.numeral * (isPortrait ? 1.6 : 1.7)),
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {numeral}
        </div>
      )}

      <div
        style={{
          width: `${draw * (isPortrait ? 46 : 32)}%`,
          height: variant === "wordmark" ? 1 : 3,
          background: variant === "wordmark" ? palette.border : palette.accent,
        }}
      />

      {label && (
        <div
          style={{
            color: variant === "wordmark" ? palette.text : palette.muted,
            fontFamily:
              variant === "wordmark"
                ? (fonts.heading ?? "inherit")
                : (fonts.body ?? "inherit"),
            fontSize:
              variant === "wordmark"
                ? Math.round(type.title * 0.8)
                : Math.round(type.label * 1.15),
            fontWeight: variant === "wordmark" ? 700 : 500,
            letterSpacing: variant === "wordmark" ? "-0.01em" : "0.16em",
            textTransform: variant === "wordmark" ? "none" : "uppercase",
            textAlign: "center",
            maxWidth: "80%",
            minWidth: 0,
            overflowWrap: "break-word",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// ─── Drop cap ────────────────────────────────────────────────────────────────

export interface DropCapProps {
  /** First character of the body text. Only the first char is used. */
  char: string;
  /** How many text lines the cap spans. */
  lines?: number;
  variant?: "solid" | "outline" | "knockout";
  fontSize?: number;
}

/**
 * Floated initial capital. Purely editorial, and a strong differentiator for
 * editorial-bucket brands — the kit had no way to express it before.
 */
export const DropCap: React.FC<DropCapProps> = ({
  char,
  lines = 3,
  variant = "solid",
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, isPortrait, fonts, type } = useKit();

  const p = progressAt(frame, 0, Math.round(fps * 0.5));
  const size = fontSize ?? Math.round(type.hero * 0.95 * (lines / 3));
  const letter = (char || "").trim().charAt(0);
  if (!letter) return null;

  const base: React.CSSProperties = {
    float: "left",
    marginRight: 14,
    marginTop: 2,
    lineHeight: 0.82,
    fontFamily: fonts.heading ?? "inherit",
    fontSize: size,
    fontWeight: 700,
    opacity: p,
    transform: `translateY(${(1 - p) * 6}px)`,
  };

  if (variant === "outline") {
    return (
      <span
        style={{
          ...base,
          color: "transparent",
          WebkitTextStroke: `2px ${palette.accent}`,
        }}
      >
        {letter}
      </span>
    );
  }

  if (variant === "knockout") {
    return (
      <span
        style={{
          ...base,
          color: palette.bg,
          background: palette.accent,
          padding: "0.06em 0.14em",
          marginRight: 16,
        }}
      >
        {letter}
      </span>
    );
  }

  return <span style={{ ...base, color: palette.accentText }}>{letter}</span>;
};

// ─── Panel number ────────────────────────────────────────────────────────────

const ROMAN: Array<[number, string]> = [
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  let out = "";
  let v = Math.max(1, Math.min(39, Math.round(n)));
  for (const [val, sym] of ROMAN) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

export interface PanelNumberProps {
  value: number | string;
  total?: number;
  style?: "roman" | "padded" | "plain";
  corner?: "tl" | "tr" | "bl" | "br";
  inset?: number;
}

/** The "01 / 06" panel numbering built-in editorial templates use. */
export const PanelNumber: React.FC<PanelNumberProps> = ({
  value,
  total,
  style = "padded",
  corner = "tr",
  inset = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, isPortrait, fonts, type } = useKit();

  const p = progressAt(frame, 3, Math.round(fps * 0.4));
  if (p <= 0) return null;

  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  const shown =
    style === "roman" && Number.isFinite(n)
      ? toRoman(n)
      : style === "padded" && Number.isFinite(n)
        ? String(n).padStart(2, "0")
        : String(value);

  const totalShown =
    total != null
      ? style === "roman"
        ? toRoman(total)
        : style === "padded"
          ? String(total).padStart(2, "0")
          : String(total)
      : null;

  const vertical = corner.startsWith("t") ? "top" : "bottom";
  const horizontal = corner.endsWith("l") ? "left" : "right";

  return (
    <div
      style={{
        position: "absolute",
        [vertical]: `${isPortrait ? 5 : 6}%`,
        [horizontal]: `${inset}%`,
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        opacity: p,
        color: palette.muted,
        fontFamily: fonts.body ?? "inherit",
        fontVariantNumeric: "tabular-nums",
        fontSize: type.micro,
        letterSpacing: "0.1em",
        pointerEvents: "none",
      }}
    >
      <span style={{ color: palette.accentText, fontWeight: 700 }}>{shown}</span>
      {totalShown && <span style={{ opacity: 0.7 }}>/ {totalShown}</span>}
    </div>
  );
};

// ─── Editorial rule ──────────────────────────────────────────────────────────

export interface EditorialRuleProps {
  orientation?: "horizontal" | "vertical";
  weight?: number;
  /** Optional inline label, like a fieldset legend. */
  label?: string;
  /** Animate the rule drawing in. */
  draw?: boolean;
  color?: string;
  length?: string;
}

/**
 * A structural rule, optionally carrying a label. Distinct from
 * <Decor system="rules" />, which is background atmosphere — this is a framing
 * element the layout is built around.
 */
export const EditorialRule: React.FC<EditorialRuleProps> = ({
  orientation = "horizontal",
  weight = 1,
  label,
  draw = true,
  color,
  length = "100%",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, fonts, type } = useKit();

  const p = draw ? drawProgress(frame, 0, Math.round(fps * 0.6)) : 1;
  const c = color ?? palette.border;
  const isH = orientation === "horizontal";

  const line = (
    <div
      style={{
        background: c,
        ...(isH
          ? { height: weight, width: length, transform: `scaleX(${p})`, transformOrigin: "left center" }
          : { width: weight, height: length, transform: `scaleY(${p})`, transformOrigin: "top center" }),
        flexShrink: 0,
      }}
    />
  );

  if (!label) return line;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isH ? "row" : "column",
        alignItems: "center",
        gap: 12,
        width: isH ? length : undefined,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: palette.muted,
          fontFamily: fonts.body ?? "inherit",
          fontSize: type.micro,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          flexShrink: 0,
          opacity: p,
        }}
      >
        {label}
      </span>
      {line}
    </div>
  );
};

// ─── Kicker ──────────────────────────────────────────────────────────────────

export interface KickerProps {
  children: React.ReactNode;
  /** Show the leading accent tick. */
  tick?: boolean;
  color?: string;
  /** Explicit size. Defaults to the kit type scale's `label`, which the editor's
   *  "Title font size" slider drives. */
  fontSize?: number;
}

/**
 * Small-caps tracked eyebrow with a leading accent tick. Previously only
 * reachable through SceneFrame's `eyebrow` prop, which forced scenes into
 * SceneFrame just to get one.
 */
export const Kicker: React.FC<KickerProps> = ({ children, tick = true, color, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, isPortrait, fonts, type } = useKit();

  const p = progressAt(frame, 0, Math.round(fps * 0.4));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: p,
        transform: `translateY(${(1 - p) * 4}px)`,
        minWidth: 0,
      }}
    >
      {tick && (
        <div
          style={{
            width: 22,
            height: 3,
            background: color ?? palette.accent,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          color: color ?? palette.muted,
          fontFamily: fonts.body ?? "inherit",
          // Reads the shared type scale rather than a hardcoded size, so the
          // editor's "Title font size" slider (which targets the scene's short
          // title / eyebrow) actually moves it. Falls back to the previous
          // literals when the scale is unset, so a Kicker used outside a
          // SceneFrame looks exactly as it did before.
          fontSize: fontSize ?? type.label ?? (isPortrait ? 20 : 22),
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          minWidth: 0,
          overflowWrap: "break-word",
        }}
      >
        {children}
      </span>
    </div>
  );
};

// ─── Safe area ───────────────────────────────────────────────────────────────

export interface SafeAreaInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SafeAreaProps {
  /** Per-orientation insets as % of frame. Falls back to a sane default. */
  landscape?: SafeAreaInset;
  portrait?: SafeAreaInset;
  children: React.ReactNode;
  center?: boolean;
}

const DEFAULT_LANDSCAPE: SafeAreaInset = { top: 6, right: 8, bottom: 6, left: 8 };
const DEFAULT_PORTRAIT: SafeAreaInset = { top: 8, right: 6, bottom: 8, left: 6 };

/**
 * Applies the TEMPLATE'S OWN safe-area policy rather than a single hardcoded
 * inset. The scene prompt used to mandate 6–8% on every side for every brand,
 * which forced every template into the same centred box; the blueprint now
 * chooses its own insets per orientation and passes them here.
 */
export const SafeArea: React.FC<SafeAreaProps> = ({
  landscape,
  portrait,
  children,
  // Composes from the MIDDLE by default. This used to default to `flex-start`,
  // so the blueprint-driven scaffold top-packed its content and a two-item
  // scene read as a list stuck to the ceiling with a bare band beneath it.
  // A scene that genuinely wants top alignment passes center={false}.
  center = true,
}) => {
  const { isPortrait } = useKit();
  const i = isPortrait
    ? (portrait ?? DEFAULT_PORTRAIT)
    : (landscape ?? DEFAULT_LANDSCAPE);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        paddingTop: `${i.top}%`,
        paddingRight: `${i.right}%`,
        paddingBottom: `${i.bottom}%`,
        paddingLeft: `${i.left}%`,
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
        alignItems: center ? "center" : "stretch",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
};
