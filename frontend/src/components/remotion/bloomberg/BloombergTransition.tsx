import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "./constants";

export type BloombergTransitionVariant =
  | "scanline_wipe"
  | "pixel_dissolve"
  | "price_flash"
  | "command_prompt"
  | "column_shutter"
  | "phosphor_slide";

export interface BloombergTransitionProps {
  variant: BloombergTransitionVariant;
  accentColor?: string;
  textColor?: string;
  bgColor?: string;
  aspectRatio?: string;
  fontFamily?: string;
}

export const BLOOMBERG_TRANSITION_DURATION = 60;

export function pickBloombergTransition(
  outgoingLayout: string,
): BloombergTransitionVariant {
  switch (outgoingLayout) {
    case "terminal_boot":
      return "command_prompt";
    case "terminal_chart":
    case "terminal_dataviz":
    case "terminal_dashboard":
      return "pixel_dissolve";
    case "terminal_ticker":
    case "terminal_quote":
    case "terminal_metric":
      return "price_flash";
    case "terminal_table":
    case "terminal_options":
    case "terminal_profile":
      return "column_shutter";
    case "terminal_narrative":
    case "terminal_list":
    case "terminal_split":
      return "scanline_wipe";
    default:
      return "phosphor_slide";
  }
}

// Horizontal scanline sweeps top→bottom while background fades to black.
const ScanlineWipe: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const bgOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const lineY = progress * 100;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      {/* Darkening backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#000",
          opacity: bgOpacity * 0.9,
        }}
      />
      {/* CRT scanline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${lineY}%`,
          height: 6,
          backgroundColor: accentColor,
          boxShadow: `0 0 30px 10px ${accentColor}, 0 0 80px 20px ${accentColor}55`,
        }}
      />
      {/* Trailing bloom */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: `${lineY}%`,
          background: `linear-gradient(to bottom, transparent, ${accentColor}22)`,
        }}
      />
      {/* CRT scanline texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)`,
          opacity: bgOpacity * 0.5,
        }}
      />
    </AbsoluteFill>
  );
};

// Block glyph grid flickers over a darkening frame.
const GLYPHS = ["░", "▒", "▓", "█", "▚", "▞"];
const GRID_COLS = 16;
const GRID_ROWS = 9;

const PixelDissolve: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const bgOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const glyphOpacity = interpolate(frame, [0, durationInFrames * 0.3, durationInFrames * 0.8, durationInFrames], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });
  const flip = Math.floor(frame / 2);

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const seed = Math.abs(Math.sin((r + 1) * (c + 1) * 1.37 + flip));
      const glyph = GLYPHS[Math.floor(seed * GLYPHS.length) % GLYPHS.length];
      const active = seed > 0.3;
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor,
            opacity: active ? 1 : 0.15,
            fontFamily: BLOOMBERG_DEFAULT_FONT_FAMILY,
            fontSize: 72,
            textShadow: active ? `0 0 8px ${accentColor}` : "none",
          }}
        >
          {glyph}
        </div>,
      );
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: bgOpacity * 0.92 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          opacity: glyphOpacity,
        }}
      >
        {cells}
      </div>
    </AbsoluteFill>
  );
};

// Full-frame amber flash then [EXEC] badge.
const PriceFlash: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const bgOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const flashOpacity = interpolate(frame, [0, 2, 5, durationInFrames], [0, 0.7, 0, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: bgOpacity * 0.9 }} />
      <div style={{ position: "absolute", inset: 0, backgroundColor: accentColor, opacity: flashOpacity }} />
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 48,
          padding: "10px 22px",
          backgroundColor: "#000",
          border: `2px solid ${accentColor}`,
          color: accentColor,
          fontFamily: BLOOMBERG_DEFAULT_FONT_FAMILY,
          fontSize: 32,
          letterSpacing: 3,
          opacity: bgOpacity,
          boxShadow: `0 0 20px ${accentColor}88`,
        }}
      >
        [EXEC] ⟨GO⟩
      </div>
    </AbsoluteFill>
  );
};

// Monospace terminal prompt types itself in.
const CommandPrompt: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const bgOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const text = "> LOADING...";
  const charsShown = Math.floor(
    interpolate(frame, [0, durationInFrames * 0.8], [0, text.length], {
      extrapolateRight: "clamp",
    }),
  );
  const cursor = Math.floor(frame / 4) % 2 === 0 && charsShown < text.length;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: bgOpacity * 0.95 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accentColor,
          fontFamily: fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY,
          fontSize: 52,
          letterSpacing: 2,
          textShadow: `0 0 16px ${accentColor}`,
          opacity: bgOpacity,
        }}
      >
        {text.slice(0, charsShown)}
        {cursor ? "▊" : ""}
      </div>
    </AbsoluteFill>
  );
};

// 12 amber columns close inward.
const ColumnShutter: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const totalCols = 12;

  const cols: React.ReactNode[] = [];
  for (let i = 0; i < totalCols; i++) {
    const fromLeft = i < totalCols / 2;
    cols.push(
      <div key={i} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: fromLeft ? 0 : "auto",
            bottom: fromLeft ? "auto" : 0,
            height: `${progress * 100}%`,
            backgroundColor: accentColor,
            opacity: 0.95,
          }}
        />
      </div>,
    );
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {cols}
      </div>
    </AbsoluteFill>
  );
};

// Phosphor-glow vertical band slides left→right, darkening the scene.
const PhosphorSlide: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const bgOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const bandX = progress * 110 - 5;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: bgOpacity * 0.9 }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${bandX}%`,
          width: 12,
          backgroundColor: accentColor,
          boxShadow: `0 0 40px 14px ${accentColor}, 0 0 100px 30px ${accentColor}44`,
        }}
      />
    </AbsoluteFill>
  );
};

export const BloombergTransition: React.FC<BloombergTransitionProps> = (props) => {
  switch (props.variant) {
    case "scanline_wipe":
      return <ScanlineWipe {...props} />;
    case "pixel_dissolve":
      return <PixelDissolve {...props} />;
    case "price_flash":
      return <PriceFlash {...props} />;
    case "command_prompt":
      return <CommandPrompt {...props} />;
    case "column_shutter":
      return <ColumnShutter {...props} />;
    case "phosphor_slide":
    default:
      return <PhosphorSlide {...props} />;
  }
};
