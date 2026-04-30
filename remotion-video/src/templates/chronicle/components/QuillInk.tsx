import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * Utility components for Chronicle text reveals.
 */

interface QuillTextProps {
  text: string;
  /** Frame to start the reveal. */
  startFrame?: number;
  /** Total frames the reveal should span. */
  durationFrames?: number;
  /** Whether to show a blinking quill cursor while writing. */
  showCursor?: boolean;
  /** Word-by-word, char typewriter, or whole-block fade (diary-style ink). */
  mode?: "word" | "char" | "fade";
  style?: React.CSSProperties;
  /** Optional className (preserved for host styling). */
  className?: string;
}

export const QuillText: React.FC<QuillTextProps> = ({
  text,
  startFrame = 0,
  durationFrames = 40,
  showCursor = true,
  mode = "char",
  style,
  className,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  if (mode === "word") {
    const words = text.split(/(\s+)/);
    const totalWords = words.filter((w) => w.trim().length > 0).length;
    const perWord = durationFrames / Math.max(1, totalWords);
    let wordIdx = 0;
    return (
      <span style={style} className={className}>
        {words.map((w, i) => {
          if (!w.trim()) return <React.Fragment key={i}>{w}</React.Fragment>;
          const wordStart = wordIdx * perWord;
          wordIdx += 1;
          const op = interpolate(local, [wordStart, wordStart + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const dy = interpolate(op, [0, 1], [8, 0]);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: op,
                transform: `translateY(${dy}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </span>
    );
  }

  if (mode === "fade") {
    // Slow, even materialize — ease-in-out keeps the middle gentle (no snap).
    const smooth = Easing.inOut(Easing.cubic);
    const op = interpolate(local, [0, durationFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smooth,
    });
    const dy = interpolate(local, [0, durationFrames], [3, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smooth,
    });
    const blurPx = interpolate(local, [0, durationFrames * 0.72], [1.4, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smooth,
    });
    return (
      <span
        style={{
          display: "block",
          textAlign: "inherit",
          opacity: op,
          transform: `translateY(${dy}px)`,
          filter: blurPx > 0.04 ? `blur(${blurPx}px)` : undefined,
          ...style,
        }}
        className={className}
      >
        {text}
      </span>
    );
  }

  // Char mode (typewriter)
  const progress = interpolate(local, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const charsVisible = Math.floor(text.length * progress);
  const cursorOn = charsVisible > 0 && charsVisible < text.length && Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={style} className={className}>
      {text.slice(0, charsVisible)}
      {showCursor && cursorOn && (
        <span
          style={{
            display: "inline-block",
            width: "0.08em",
            height: "0.9em",
            background: "currentColor",
            marginLeft: 2,
            verticalAlign: "text-bottom",
            opacity: 0.7,
          }}
        />
      )}
    </span>
  );
};

/**
 * Ink splatter — a few drops around a point, fade in over ~8 frames.
 */
export const InkSplatter: React.FC<{
  color?: string;
  startFrame?: number;
  size?: number;
  style?: React.CSSProperties;
}> = ({ color = "#2A1810", startFrame = 0, size = 80, style }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const op = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ opacity: op, ...style }}
    >
      <circle cx="50" cy="50" r="20" fill={color} />
      <circle cx="22" cy="32" r="4" fill={color} />
      <circle cx="82" cy="28" r="5" fill={color} />
      <circle cx="18" cy="70" r="3" fill={color} />
      <circle cx="78" cy="80" r="5" fill={color} />
      <circle cx="30" cy="88" r="2.5" fill={color} />
      <circle cx="90" cy="56" r="2" fill={color} />
    </svg>
  );
};

/**
 * Ribbon banner — unfurls with scaleX from center.
 */
export const RibbonBanner: React.FC<{
  children: React.ReactNode;
  color?: string;
  textColor?: string;
  startFrame?: number;
  width?: number | string;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({
  children,
  color = "#8B2E1D",
  textColor = "#F8EFD6",
  startFrame = 0,
  width = 360,
  height = 48,
  fontFamily,
  fontSize = 22,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const scaleX = interpolate(local, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textOp = interpolate(local, [14, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        transform: `scaleX(${scaleX})`,
        ...style,
      }}
    >
      {/* Main ribbon body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to bottom, ${color} 0%, ${darken(color, 0.15)} 60%, ${darken(color, 0.25)} 100%)`,
          clipPath:
            "polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%, 4% 50%)",
          boxShadow: "0 4px 10px rgba(40,15,10,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: textColor,
          fontFamily,
          fontSize,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "0 24px",
        }}
      >
        <span style={{ opacity: textOp }}>{children}</span>
      </div>
    </div>
  );
};

function shiftColor(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const darken = (hex: string, amt: number) => shiftColor(hex, -amt);
