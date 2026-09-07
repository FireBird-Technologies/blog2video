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
   * cursor (editorial / terminal feel); `mask_up` wipes each line up from
   * behind a hard edge, the way a title card is revealed in print — pick by the
   * brand signature's motionEnergy.
   */
  mode?: "word" | "char" | "line" | "fade" | "blur" | "typewriter" | "mask_up";
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

  if (mode === "mask_up") {
    // Each LINE rises out from behind a hard clip edge — no fade, no blur. The
    // reveal is the mask, which is what separates it from `line`: the type is
    // already at full opacity the instant any of it is visible.
    //
    // Previously `mask_up` was a blueprint-selectable value with no
    // implementation at all in either this component or IntroStage, so it fell
    // through to the plain word reveal and a template that asked for it got
    // something else.
    const lines = content.split(/\n+/);
    const lineStep = stepFrames ?? 8;
    return (
      <Tag style={style}>
        {lines.map((ln, i) => {
          const t = easeOutQuint(progressAt(frame, start + i * lineStep, 18));
          return (
            <span
              key={i}
              style={{
                display: "block",
                overflow: "hidden",
                // The clip travels with the text so descenders are not shaved
                // once the line has fully arrived.
                clipPath: `inset(${(1 - t) * 100}% 0% 0% 0%)`,
              }}
            >
              <span
                style={{
                  display: "block",
                  transform: `translateY(${(1 - t) * 100}%)`,
                  willChange: "transform",
                }}
              >
                {ln}
              </span>
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
  // Two roles, two colours. The underline and glow are FILLS and keep the
  // brand's true accent; the highlighted words are TYPE and must clear contrast
  // against the canvas — an unclamped accent made the most important phrase in
  // the sentence the least readable part of it.
  const accent = color ?? palette.accent;
  const accentType = color ?? palette.accentText;
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
      <span style={{ position: "relative", color: accentType, fontWeight: 700, display: "inline-block" }}>
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
