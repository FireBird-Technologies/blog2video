/**
 * Custom-template craft kit — text reveals.
 *
 * OPTIONAL building blocks for animating on-screen text. Generalized from
 * chronicle's QuillText (word/char reveal + highlight underline) and the
 * line-by-line reveals in newscast/nightfall.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { progressAt, easeOutQuint, clamp01 } from "./motion";

export interface RevealTextProps {
  text: string;
  /**
   * Reveal granularity / personality. `fade` is a plain opacity rise; `word`/
   * `char`/`line` are the smooth (calm) personality; `blur` is the snappy
   * (energetic) personality; `typewriter` types characters in with a blinking
   * cursor (editorial / terminal feel) — pick by the brand signature's
   * motionEnergy.
   */
  mode?: "word" | "char" | "line" | "fade" | "blur" | "typewriter";
  start?: number;
  /** Frames per unit (word/char/line). Auto-scaled if omitted. */
  stepFrames?: number;
  style?: React.CSSProperties;
  as?: "div" | "span" | "h1" | "h2" | "p";
}

/** Staggered word/char/line reveal. `fade` is a plain opacity rise. */
export const RevealText: React.FC<RevealTextProps> = ({
  text,
  mode = "word",
  start = 0,
  stepFrames,
  style,
  as = "div",
}) => {
  const frame = useCurrentFrame();
  const Tag = as as React.ElementType;
  const content = text ?? "";

  if (mode === "fade") {
    const op = easeOutQuint(progressAt(frame, start, 18));
    return <Tag style={{ opacity: op, ...style }}>{content}</Tag>;
  }

  // Typewriter: reveal characters sequentially with a frame-driven blinking
  // cursor (deterministic — no Date/timers). Default ~1.4 frames per char.
  if (mode === "typewriter") {
    const step = stepFrames ?? 1.4;
    const shown = clamp01(progressAt(frame, start, Math.max(1, content.length * step)));
    const n = Math.floor(content.length * shown);
    const typing = n < content.length;
    // Blink every ~30 frames (15 on / 15 off). Solid while still typing.
    const cursorOn = typing || Math.floor(frame / 15) % 2 === 0;
    return (
      <Tag style={style}>
        {content.slice(0, n)}
        <span style={{ opacity: cursorOn ? 1 : 0 }}>▍</span>
      </Tag>
    );
  }

  // Snappy energetic personality: words punch in from blur + slight scale.
  if (mode === "blur") {
    const words = content.split(/(\s+)/);
    const step = stepFrames ?? 3;
    return (
      <Tag style={style}>
        {words.map((u, i) => {
          if (/^\s+$/.test(u)) return <React.Fragment key={i}>{u}</React.Fragment>;
          const t = easeOutQuint(progressAt(frame, start + i * step, 9));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: t,
                filter: `blur(${(1 - t) * 6}px)`,
                transform: `scale(${0.86 + t * 0.14})`,
                willChange: "opacity, filter, transform",
              }}
            >
              {u}
            </span>
          );
        })}
      </Tag>
    );
  }

  const units =
    mode === "char"
      ? content.split("")
      : mode === "line"
        ? content.split(/\n+/)
        : content.split(/(\s+)/); // keep whitespace tokens for words
  const step = stepFrames ?? (mode === "char" ? 1.2 : mode === "line" ? 10 : 4);

  return (
    <Tag style={style}>
      {units.map((u, i) => {
        if (/^\s+$/.test(u)) return <React.Fragment key={i}>{u}</React.Fragment>;
        const t = easeOutQuint(progressAt(frame, start + i * step, 12));
        return (
          <span
            key={i}
            style={{
              display: mode === "line" ? "block" : "inline-block",
              opacity: t,
              transform: `translateY(${(1 - t) * (mode === "char" ? 6 : 14)}px)`,
              willChange: "opacity, transform",
            }}
          >
            {u}
          </span>
        );
      })}
    </Tag>
  );
};

/**
 * Render `text`, drawing an accent underline that wipes in under `phrase`
 * (and tints it the accent color). Falls back to plain text if the phrase
 * isn't found.
 */
export const HighlightPhrase: React.FC<{
  text: string;
  phrase?: string;
  start?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ text, phrase, start = 12, color, style }) => {
  const frame = useCurrentFrame();
  const { palette } = useKit();
  const accent = color ?? palette.accent;
  const body = text ?? "";
  const hl = (phrase ?? "").trim();

  if (!hl || !body.toLowerCase().includes(hl.toLowerCase())) {
    return <span style={style}>{body}</span>;
  }
  const idx = body.toLowerCase().indexOf(hl.toLowerCase());
  const before = body.slice(0, idx);
  const mid = body.slice(idx, idx + hl.length);
  const after = body.slice(idx + hl.length);
  const wipe = clamp01(easeOutQuint(progressAt(frame, start, 16)));

  return (
    <span style={style}>
      {before}
      <span style={{ position: "relative", color: accent, fontWeight: 700, display: "inline-block" }}>
        {mid}
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -4,
            height: 4,
            background: accent,
            borderRadius: 2,
            transform: `scaleX(${wipe})`,
            transformOrigin: "left center",
            boxShadow: `0 0 12px ${withAlpha(accent, 0.5)}`,
          }}
        />
      </span>
      {after}
    </span>
  );
};
