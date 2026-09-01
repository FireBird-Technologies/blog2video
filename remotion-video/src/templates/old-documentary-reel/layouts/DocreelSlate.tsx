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
  const { width, height: frameHeight } = useVideoConfig();
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
  const titleTargetPx = titleFontSize ?? (p ? 108 : 74);
  const narrationTargetPx = descriptionFontSize ?? (p ? 60 : 34);

  // ChippedHeading wraps its text in an SVG-filtered div, so the title is still
  // measured through an equivalent hidden mirror rather than by reaching into
  // the component. The narration renders in full from frame 0 (no typewriter),
  // so its real element can be measured directly.
  //
  // Budgets are derived from the column's REAL geometry — frame height minus the
  // scene padding minus the clapperboard, which is a known size (boardWidth
  // drives both its stick and its body) — and then split between title and
  // narration. Two earlier approaches failed here:
  //   * a flat fraction of the frame ("title gets 20%") ignores the board, which
  //     eats a much larger share of a landscape frame than a portrait one, so a
  //     long title still pushed the narration off the bottom;
  //   * useAvailableHeight (the newspaper pattern) reads offsetTop, which is only
  //     trustworthy in newspaper's TOP-ALIGNED containers. This column is
  //     `justify-content:center`, so once the content overflows the browser
  //     shifts it up and the measured "space below" is already contaminated by
  //     the overflow it was supposed to detect.
  // Computing the remainder arithmetically avoids both traps.
  const columnPadY = p ? 120 : 80;
  // Clapperboard height: stick (16% of width) + body (5 rows of 3.8%-of-width
  // text at line-height 1, 4 gaps of 2%, 2x 4.5% padding, 2px borders).
  const boardHeightPx = boardWidth * 0.16 + (boardWidth * 0.038 * 1.2 * 5 + boardWidth * 0.012 * 5 + boardWidth * 0.02 * 4 + boardWidth * 0.09) + 4;
  const titleMarginPx = p ? 48 : 56;
  const narrationMarginPx = p ? 18 : 22;
  // What is left for title + narration once the board and all the fixed gaps
  // are paid for.
  const copyBudgetPx = Math.max(
    120,
    frameHeight - columnPadY * 2 - boardHeightPx - titleMarginPx - narrationMarginPx,
  );
  // Title takes the smaller share: the narration is the longer copy and needs
  // the room, and an oversized title is what pushed everything off frame.
  const titleBudgetPx = Math.round(copyBudgetPx * (p ? 0.42 : 0.40));
  const narrationBudgetPx = Math.round(copyBudgetPx * (p ? 0.58 : 0.60));

  const titleMirrorRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleMirrorRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : p ? 44 : 32,
    [title, titleTargetPx, titleFontSizeIsUserSet, titleBudgetPx, p, aspectRatio],
    titleBudgetPx,
  );
  // Keyed on titlePx so it re-measures after the title settles. One-directional
  // only — never feed this fit's overflow back into the title budget (see the
  // give-back warning in newspaper/layouts/NewsHeadline.tsx).
  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : p ? 26 : 16,
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, narrationBudgetPx, titlePx, p],
    narrationBudgetPx,
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
          padding: p ? `${columnPadY}px 40px` : `${columnPadY}px 120px`,
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
              marginTop: titleMarginPx,
              // ChippedHeading is an inline-block that shrink-wraps its text, so
              // without an explicit cap a long title lays out on one very wide
              // line and runs straight past the scene padding — horizontal
              // overflow the height fitter cannot see (it measures at whatever
              // width the element reports). Bounding the wrapper makes the copy
              // WRAP inside the safe column, which converts the overrun into
              // extra height that the fitter then shrinks to the budget.
              width: "100%",
              maxWidth: p ? "94%" : 1180,
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
            {/* ChippedHeading's own wrapper is an inline-block that shrink-wraps.
                `display:block` on that wrapper makes it take the bounded width
                of this column, and `width:100%` carries the constraint down to
                the text div, so the title wraps instead of running past the
                scene padding. No line-height override here: a single-line title
                must keep the exact metrics it has today. */}
            <ChippedHeading
              fontSize={titlePx}
              color={theme.accent}
              style={{ width: "100%", display: "block" }}
            >
              {title}
            </ChippedHeading>
          </div>
        ) : null}

        {narration ? (
          <div
            ref={narrationRef}
            style={{
              marginTop: narrationMarginPx,
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
