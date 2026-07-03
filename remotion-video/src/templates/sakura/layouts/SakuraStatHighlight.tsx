import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  SoftPetal,
  BrushUnderline,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraStatHighlight: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    bgColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const stat = (props as any).stat ?? title ?? "0";
  const statLabel = (props as any).statLabel ?? "";
  const context = (props as any).context ?? narration ?? "";

  const statPx = titleFontSize ?? (p ? 150 : 180);
  const contextPx = descriptionFontSize ?? (p ? 28 : 26);

  // The number sits on the left third (landscape) so the spotlight + ring
  // center on it; portrait keeps it centered.
  const statCx = p ? width / 2 : width * 0.32;
  const statCy = height / 2;

  // Stat spring + count-up
  const statSpring = spring({ frame, fps, config: { damping: 16, stiffness: 55 }, from: 0.5, to: 1 });
  const statOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const numericValue = parseFloat(stat.replace(/[^0-9.]/g, ""));
  const isNumeric = !isNaN(numericValue) && stat.replace(/[^0-9.]/g, "").length > 0;
  const suffix = isNumeric ? stat.replace(/[0-9.,]/g, "") : "";
  const countProgress = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const displayedStat = isNumeric
    ? Math.round(numericValue * countProgress).toLocaleString() + suffix
    : stat;

  // Kamon-style ring scaling in behind the number
  const ringScale = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const ringR = p ? 340 : 300;

  // Orbiting blossoms
  const orbitSpin = frame * 0.12;
  const orbitReveal = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelReveal = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const contextReveal = interpolate(frame, [26, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  return (
    <SakuraScene
      backdrop="spotlight"
      entranceLayout="sakura_stat_highlight"
      bgColor={bgColor}
      side="left"
      dur={dur}
      petals={p ? 8 : 12}
      petalIntensity={0.8}
      petalSeed={57}
      chrome={
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <circle cx={statCx} cy={statCy} r={ringR * ringScale} fill="none" stroke={SAKURA.gold} strokeWidth={2} opacity={0.14} />
          <circle cx={statCx} cy={statCy} r={ringR * 0.85 * ringScale} fill="none" stroke={SAKURA.blush} strokeWidth={0.8} opacity={0.1} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = ((i * 30 - 90 + orbitSpin) * Math.PI) / 180;
            return (
              <SoftPetal
                key={i}
                cx={statCx + Math.cos(a) * ringR * 0.92}
                cy={statCy + Math.sin(a) * ringR * 0.92}
                r={[9, 7, 8][i % 3]}
                rotation={i * 30 + orbitSpin}
                color={i % 2 === 0 ? SAKURA.blush : SAKURA.mist}
                opacity={0.25 * orbitReveal}
              />
            );
          })}
        </svg>
      }
    >
      {/* Asymmetric: big number left, label + context right */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: p ? "center" : "space-between",
          gap: p ? 30 : 80,
          padding: p ? "150px 90px" : "80px 150px",
          textAlign: p ? "center" : "left",
        }}
      >
        {/* Big stat with count-up */}
        <div
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: statPx,
            color: SAKURA.blush,
            lineHeight: 0.95,
            letterSpacing: "0.02em",
            textShadow: `0 0 80px ${hexToRgba(SAKURA.blush, 0.4)}`,
            opacity: statOpacity,
            transform: `scale(${statSpring})`,
            flexShrink: 0,
          }}
        >
          {displayedStat}
        </div>

        {/* Right column: underline + label + context */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: p ? "center" : "flex-start",
            maxWidth: p ? undefined : 620,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <BrushUnderline width={p ? 240 : 200} color={SAKURA.gold} startFrame={14} durationFrames={14} opacity={0.9} />
          </div>
          {statLabel ? (
            <div
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontSize: p ? 26 : 28,
                color: SAKURA.gold,
                letterSpacing: "0.4em",
                textTransform: "uppercase",
                opacity: labelReveal,
                transform: `translateY(${(1 - labelReveal) * 12}px)`,
                marginBottom: 22,
              }}
            >
              {statLabel}
            </div>
          ) : null}
          {context ? (
            <div
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontStyle: "italic",
                fontSize: contextPx,
                color: hexToRgba(SAKURA.washi, 0.85),
                lineHeight: 1.65,
                opacity: contextReveal,
                transform: `translateY(${(1 - contextReveal) * 12}px)`,
              }}
            >
              {context}
            </div>
          ) : null}
        </div>
      </div>
    </SakuraScene>
  );
};
