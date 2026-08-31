import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ChippedHeading,
  hexToRgba,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** Clapperboard: diagonal-striped clap sticks + a chalk-style info panel. */
const Clapperboard: React.FC<{
  scene?: string;
  take?: string;
  date?: string;
  director?: string;
  production?: string;
  productionLabel?: string;
  sceneLabel?: string;
  takeLabel?: string;
  directorLabel?: string;
  dateLabel?: string;
  clapProgress: number; // 0 closed(open) .. 1 clapped(shut)
  width: number;
}> = ({
  scene, take, date, director, production,
  productionLabel, sceneLabel, takeLabel, directorLabel, dateLabel,
  clapProgress, width,
}) => {
  const theme = useDocReelTheme();
  const stickHeight = width * 0.16;
  const clapAngle = interpolate(clapProgress, [0, 1], [-18, 0]);
  const stripeCount = 10;
  const stripe = (i: number) => (
    <div
      key={i}
      style={{
        position: "absolute",
        left: `${(i / stripeCount) * 140 - 20}%`,
        top: 0,
        width: `${100 / stripeCount}%`,
        height: "100%",
        background: i % 2 === 0 ? theme.accent : theme.bg,
        transform: "skewX(-22deg)",
      }}
    />
  );
  return (
    <div style={{ width, position: "relative" }}>
      {/* Top clap stick */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: stickHeight,
          overflow: "hidden",
          transformOrigin: "left bottom",
          transform: `rotate(${clapAngle}deg)`,
          border: `2px solid ${theme.text}`,
          borderBottom: "none",
        }}
      >
        {Array.from({ length: stripeCount }, (_, i) => stripe(i))}
      </div>
      {/* Body */}
      <div
        style={{
          width: "100%",
          background: hexToRgba(theme.bg, 0.9),
          border: `2px solid ${theme.text}`,
          padding: width * 0.045,
          fontFamily: DOCREEL_MONO_FONT,
          color: theme.accent,
          fontSize: width * 0.038,
          display: "flex",
          flexDirection: "column",
          gap: width * 0.02,
        }}
      >
        {[
          [productionLabel ?? "PRODUCTION", production || "UNTITLED"],
          [sceneLabel ?? "SCENE", scene || "—"],
          [takeLabel ?? "TAKE", take || "1"],
          [directorLabel ?? "DIRECTOR", director || "—"],
          [dateLabel ?? "DATE", date || "—"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.line}`, paddingBottom: width * 0.012 }}>
            <span style={{ opacity: 0.6, letterSpacing: "0.12em" }}>{label}</span>
            <span style={{ fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DocreelSlate: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    narration,
    accentColor,
    bgColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    slateScene,
    slateTake,
    slateDate,
    slateDirector,
    slateProduction,
    slateProductionLabel,
    slateSceneLabel,
    slateTakeLabel,
    slateDirectorLabel,
    slateDateLabel,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 90;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // The 3-2-1 leader is its own scene now (DocreelCountdown, force-injected as
  // scene 0), so the slate opens directly on the clap instead of waiting out an
  // 18-frame countdown first. Every beat below is rebased ~18 frames earlier.
  const clapProgress = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clapFlash = interpolate(frame, [6, 8, 16], [0, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleReveal = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const boardWidth = p ? width * 0.72 : width * 0.34;
  const titleTargetPx = titleFontSize ?? (p ? 80 : 74);
  const narrationTargetPx = descriptionFontSize ?? (p ? 31 : 34);

  // ChippedHeading wraps its text in an SVG-filtered div, so the title is still
  // measured through an equivalent hidden mirror rather than by reaching into
  // the component. The narration renders in full from frame 0 (no typewriter),
  // so its real element can be measured directly.
  const titleMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleMirrorRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : Math.round(titleTargetPx * 0.45),
    [title, titleTargetPx, titleFontSizeIsUserSet, p, aspectRatio],
    Math.round((p ? 80 : 74) * 2.2),
  );
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : Math.round(narrationTargetPx * 0.55),
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, titlePx, p],
    Math.round((p ? 31 : 34) * 4),
  );

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} sprockets>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "120px 40px" : "80px 120px",
        }}
      >
        <div style={{ opacity: clapProgress >= 1 ? 1 : 0.001, transform: `scale(${interpolate(clapProgress, [0, 1], [0.96, 1])})` }}>
          <Clapperboard
            scene={slateScene}
            take={slateTake}
            date={slateDate}
            director={slateDirector}
            production={slateProduction}
            productionLabel={slateProductionLabel}
            sceneLabel={slateSceneLabel}
            takeLabel={slateTakeLabel}
            directorLabel={slateDirectorLabel}
            dateLabel={slateDateLabel}
            clapProgress={clapProgress}
            width={boardWidth}
          />
        </div>
        {title ? (
          <div
            style={{
              position: "relative",
              marginTop: p ? 48 : 56,
              opacity: titleReveal,
              transform: `translateY(${(1 - titleReveal) * 16}px)`,
              textAlign: "center",
            }}
          >
            <div
              ref={titleMirrorRef}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                visibility: "hidden",
                pointerEvents: "none",
                fontFamily: DOCREEL_DISPLAY_FONT,
                fontWeight: 700,
                fontSize: titlePx,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <ChippedHeading fontSize={titlePx} color={theme.accent}>
              {title}
            </ChippedHeading>
          </div>
        ) : null}

        {narration ? (
          <div
            ref={narrationRef}
            style={{
              marginTop: p ? 18 : 22,
              width: "100%",
              maxWidth: p ? "92%" : 760,
              opacity: titleReveal,
              transform: `translateY(${(1 - titleReveal) * 12}px)`,
              textAlign: "center",
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: narrationPx,
              color: hexToRgba(theme.text, 0.85),
              lineHeight: 1.5,
            }}
          >
            {narration}
          </div>
        ) : null}

        {/* Clap flash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.accent,
            opacity: clapFlash,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </DocReelScene>
  );
};
