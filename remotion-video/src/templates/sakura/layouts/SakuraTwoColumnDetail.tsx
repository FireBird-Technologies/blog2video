import React from "react";
import { useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  SoftPetal,
  hexToRgba,
} from "../sakuraStyle";

/**
 * Japanese "versus" comparison scene: two facing panels (left vs right) split
 * by a central 対 (tsui — opposition/pairing) medallion in a kamon ring, with a
 * gold "VS" beneath it. Each side carries a vertical kanji marker, a headline,
 * an underline blossom, and body copy — keeping the plum-washi sakura aesthetic.
 */
export const SakuraTwoColumnDetail: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useSakuraFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const leftHeadline = (props as any).leftHeadline ?? title ?? "";
  const leftBody = (props as any).leftBody ?? narration ?? "";
  const rightHeadline = (props as any).rightHeadline ?? "";
  const rightBody = (props as any).rightBody ?? "";
  const leftKanji = (props as any).leftKanji ?? "陰"; // yin
  const rightKanji = (props as any).rightKanji ?? "陽"; // yang

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 44 : 48);
  const bodyPx = descriptionFontSize ?? (p ? 24 : 22);
  // Decorative marks (big faint kanji, the 対 glyph, the "VS" label) scale off
  // the body size so they track the display-text slider with everything else.
  const markKanjiPx = Math.max(40, Math.round(bodyPx * 3.6));
  const versusKanjiPx = Math.max(32, Math.round(bodyPx * 2.7));
  const versusLabelPx = Math.max(12, Math.round(bodyPx * 0.85));

  // Left slides from the left, right slides from the right — they close in
  const leftProgress = interpolate(frame, [4, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const rightProgress = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Center medallion pops in after the panels settle
  const medallionSpring = spring({
    frame: Math.max(0, frame - 22),
    fps,
    config: { damping: 12, stiffness: 120 },
    from: 0,
    to: 1,
  });
  const medallionSpin = frame * 0.05;
  const vsReveal = interpolate(frame, [30, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;
  const medR = p ? 92 : 82;

  const side = (
    kanji: string,
    headlineText: string,
    bodyText: string,
    progress: number,
    dir: number, // -1 left, +1 right
  ) => (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        opacity: progress,
        transform: p
          ? `translateY(${(1 - progress) * 40 * dir}px)`
          : `translateX(${(1 - progress) * 60 * dir}px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: dir < 0 ? "flex-start" : "flex-end",
        textAlign: dir < 0 ? "left" : "right",
        gap: 16,
        padding: p ? "0" : dir < 0 ? "0 40px 0 0" : "0 0 0 40px",
      }}
    >
      {/* Big faint kanji marker — vertical tategaki (top-to-bottom) */}
      <div
        style={{
          fontFamily: SAKURA_DISPLAY_FONT,
          fontWeight: 700,
          fontSize: markKanjiPx,
          color: hexToRgba(crimson, 0.9),
          lineHeight: 1,
          textShadow: `0 0 40px ${hexToRgba(crimson, 0.2)}`,
          writingMode: "vertical-rl",
          textOrientation: "upright",
          letterSpacing: "0.05em",
        }}
      >
        {kanji}
      </div>
      <h2
        style={{
          fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
          fontWeight: 700,
          fontSize: titlePx,
          color: ink,
          lineHeight: 1.15,
          margin: 0,
        }}
      >
        {headlineText}
      </h2>
      <svg width={130} height={20} viewBox="0 0 130 20" style={{ overflow: "visible" }}>
        {dir < 0 ? (
          <>
            <line x1={0} y1={10} x2={86 * progress} y2={10} stroke={crimson} strokeWidth={2.5} />
            <SoftPetal cx={104} cy={10} r={9} color={crimson} bloomProgress={progress} />
          </>
        ) : (
          <>
            <line x1={130} y1={10} x2={130 - 86 * progress} y2={10} stroke={crimson} strokeWidth={2.5} />
            <SoftPetal cx={26} cy={10} r={9} color={crimson} bloomProgress={progress} />
          </>
        )}
      </svg>
      <p
        style={{
          fontFamily: fontFamily ?? SAKURA_BODY_FONT,
          fontSize: bodyPx,
          color: hexToRgba(ink, 0.75),
          lineHeight: 1.7,
          margin: 0,
          maxWidth: p ? "100%" : 460,
        }}
      >
        {bodyText}
      </p>
    </div>
  );

  return (
    <SakuraScene
      backdrop="washi_radial"
      entranceLayout="sakura_two_column_detail"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 10 : 14}
      petalIntensity={0.55}
      petalSeed={31}
      petalMode="drift"
      petalsBehind
      ambient="komorebi"
      chrome={
        <>
        {/* Central VS medallion — kamon ring + 対 + petals + gold VS */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {/* Vertical brush divider behind the medallion */}
          <line
            x1={cx}
            y1={p ? cy - (width / 2 - 120) : 120}
            x2={cx}
            y2={p ? cy + (width / 2 - 120) : height - 120}
            stroke={hexToRgba(crimson, 0.25)}
            strokeWidth={1.5}
            strokeDasharray="2 8"
          />
          <g transform={`translate(${cx}, ${cy}) scale(${medallionSpring})`}>
            {/* solid washi disc so panels read as separated */}
            <circle r={medR} fill={SAKURA.washi} opacity={0.96} />
            <circle r={medR} fill="none" stroke={crimson} strokeWidth={2.5} />
            <circle r={medR * 0.82} fill="none" stroke={hexToRgba(crimson, 0.5)} strokeWidth={1} />
            {/* orbiting petals around the ring */}
            <g transform={`rotate(${medallionSpin})`}>
              {[0, 90, 180, 270].map((deg) => {
                const a = (deg * Math.PI) / 180;
                return (
                  <SoftPetal
                    key={deg}
                    cx={Math.cos(a) * medR}
                    cy={Math.sin(a) * medR}
                    r={9}
                    rotation={deg}
                    color={SAKURA.deepBlush}
                  />
                );
              })}
            </g>
            {/* 対 kanji */}
            <text
              x={0}
              y={p ? 14 : 12}
              textAnchor="middle"
              fontFamily={SAKURA_DISPLAY_FONT}
              fontSize={versusKanjiPx}
              fontWeight={700}
              fill={crimson}
            >
              対
            </text>
          </g>
          {/* gold VS label beneath */}
          <text
            x={cx}
            y={cy + medR + (p ? 44 : 40)}
            textAnchor="middle"
            fontFamily={fontFamily ?? SAKURA_BODY_FONT}
            fontSize={versusLabelPx}
            letterSpacing="0.4em"
            fill={SAKURA.gold}
            opacity={vsReveal}
          >
            VS
          </text>
        </svg>
        </>
      }
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "stretch",
          gap: p ? 120 : 220,
          padding: p ? "130px 80px" : "110px 120px",
          boxSizing: "border-box",
        }}
      >
        {side(leftKanji, leftHeadline, leftBody, leftProgress, -1)}
        {side(rightKanji, rightHeadline, rightBody, rightProgress, 1)}
      </div>
    </SakuraScene>
  );
};
