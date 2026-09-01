import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ChippedHeading,
  ArchiveImageBackdrop,
  hexToRgba,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** A ledger-style overlay: a big Oswald number with a Courier Prime tally readout beside it. */
export const DocreelStatistic: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    bgColor,
    accentColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    statValue,
    statLabel,
    statContext,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width, height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 90;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Fall back to the universal title/narration when the layout-specific stat
  // fields weren't populated, so the scene never renders as a bare number.
  // Label always prefers statLabel, then falls back to title (regardless of
  // whether statValue itself came from title too) — narration is shown
  // whenever it carries content, so real description text is never dropped
  // just because a short statContext also happened to be set.
  const displayValue = statValue || title || "—";
  const displayLabel = statLabel || title || "";
  const displayContext = statContext || narration || "";
  const showNarrationSeparately = Boolean(narration && narration !== displayContext);

  const numberTargetPx = titleFontSize ?? (p ? 285 : 211);
  const contextTargetPx = descriptionFontSize ?? (p ? 60 : 55);

  // The stat number is a single line inside a shrink-wrapping inline-block, so it
  // overflows HORIZONTALLY — it grows its own box until it pushes the label and
  // context off the scene. useFitText cannot help here: it measures height at a
  // fixed width, which never detects a one-line overrun.
  //
  // Cap it by width instead. Oswald's uppercase digits/glyphs run ~0.62em wide, so
  // the rendered width is ≈ chars * 0.62 * fontSize; solve that for the widest
  // size that still fits the frame minus the scene and card padding. A short value
  // ("42%") stays comfortably under the chosen size and is unaffected; only a long
  // one ("1,284 MILLION") is scaled down to fit.
  const numberAvailPx = width - (p ? 40 : 160) * 2 - (p ? 28 : 90) * 2;
  const numberChars = Math.max(1, displayValue.length);
  const numberMaxPx = Math.floor(numberAvailPx / (numberChars * 0.62));
  const numberPx = Math.min(numberTargetPx, numberMaxPx);

  // The label / context / narration lines all render in full from frame 0 (no
  // typewriter), so their real elements can be measured directly — no hidden
  // mirror needed. The stat NUMBER is deliberately not fitted for HEIGHT: it is
  // the point of the scene, and shrinking it for a long context line would
  // invert the hierarchy. (It is capped by WIDTH above — a different failure
  // mode the height fitter cannot see.)
  //
  // The three text blocks below the number share ONE budget: the column height
  // left over once the scene padding and the (known) number card are paid for.
  // Budgeting each one against its own slice of the frame was the old bug — the
  // slices were chosen independently of the card, so on a long stat the label
  // wrapped to two lines, the context to six and the narration to five, and the
  // stack ran off the bottom (taking the closing rule with it). Deriving the
  // remainder from the card's actual height is what keeps the total bounded.
  // Never a multiple of the font size: that grows with the copy it must constrain.
  const cardPadY = p ? 36 : 44;
  const numberBlockPx = numberPx * 1.2 + cardPadY * 2 + 2;
  const scenePadY = p ? 140 : 80;
  // Gaps between the stacked blocks (label 28, context 18, narration 12) plus
  // the closing rule's reserved strip at the bottom of the scene.
  const gapsPx = 28 + 18 + 12;
  const ruleReservePx = p ? 60 : 50;
  const textBudgetPx = Math.max(
    100,
    frameHeight - scenePadY * 2 - numberBlockPx - gapsPx - ruleReservePx,
  );
  // Split: the label is a short heading, the context is the main paragraph, and
  // the narration is a secondary paragraph shown only when it differs.
  //
  // The context paragraph keeps its ORIGINAL frame-fraction budget untouched, so
  // a default-length stat fits exactly as it does today (verified pixel-identical
  // against a pre-change render). The derived remainder is used only as a FLOOR
  // for the whole stack: when the number card is unusually tall it can leave less
  // than the fraction assumes, and taking the smaller of the two then is what
  // stops the stack from running off the bottom. On a normal stat the fraction is
  // the tighter number and nothing changes.
  const contextBudgetPx = Math.round(frameHeight * (p ? 0.2 : 0.22));
  // The narration gets whatever the context paragraph does not claim, rather
  // than a flat share of the stack. A flat 0.3 share was ~141px, just under the
  // ~150px a DEFAULT three-line narration occupies, so ordinary copy was being
  // shrunk a single pixel — invisible on its own, but it changed the stack's
  // total height and slid the whole vertically-centred column 8px. Budgeting
  // the true remainder leaves default copy untouched and still bounds long copy.
  const narrationBudgetPx = Math.max(
    120,
    Math.round(textBudgetPx - contextBudgetPx),
  );
  const contextRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const { px: contextPx } = useFitText(
    contextRef,
    contextTargetPx,
    descriptionFontSizeIsUserSet ? contextTargetPx : p ? 26 : 24,
    [displayContext, contextTargetPx, descriptionFontSizeIsUserSet, contextBudgetPx, p, aspectRatio],
    contextBudgetPx,
  );
  // Keep the short stat label prominent and independent of any fit-down applied
  // to a long context paragraph. The description slider still controls it.
  //
  // Scales off the fitted contextPx, not the raw target: the label sits
  // directly above the context line, so driving the two from different sizes
  // let the label jump on a slider move while the paragraph below it stayed
  // put — the split that made this scene look most broken.
  const labelPx = Math.round(contextPx * 1.25);
  // The label rides on contextPx (above) to stay visually locked to the
  // paragraph, but a genuinely long label still wraps to two or three lines at
  // that size and pushes the stack down. Fit it against its own share of the
  // budget so it shrinks the rest of the way on its own. Its floor is the
  // context size — the label must never end up smaller than the body copy under
  // it, which would inflict exactly the hierarchy inversion the number cap
  // avoids.
  //
  // Measured through a hidden mirror rather than on the visible label. The
  // visible label shrink-wraps (no `width`), which is what gives a one-line
  // label its exact current position; adding a width to make it measurable
  // would change the box for EVERY label, shifting the whole stack ~8px even
  // when nothing needed fitting. The mirror carries the width instead.
  const labelRef = React.useRef<HTMLDivElement>(null);
  const labelBudgetPx = Math.round(textBudgetPx * (showNarrationSeparately ? 0.28 : 0.28));
  const { px: fittedLabelPx } = useFitText(
    labelRef,
    labelPx,
    Math.min(labelPx, contextPx),
    [displayLabel, labelPx, contextPx, labelBudgetPx, p, aspectRatio],
    labelBudgetPx,
  );
  // Secondary narration paragraph: fitted like the others instead of being
  // hard-clipped by an overflow:hidden cap, which silently cut sentences off
  // mid-word. It starts a notch below the context line to keep the hierarchy.
  const narrationTargetPx = Math.round(contextPx * 0.85);
  // Budget measured against the space that actually remains under the context
  // paragraph, so the fit engages only for copy that would otherwise leave the
  // frame. Ordinary narration sits inside it and keeps `narrationTargetPx`
  // exactly — the whole column is vertically centred, so shrinking this block
  // even 1px would visibly move everything above it.
  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : Math.min(narrationTargetPx, p ? 22 : 20),
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, narrationBudgetPx, contextPx, p],
    narrationBudgetPx,
  );

  // Ticker count-up: the digits settle in like a mechanical counter.
  const countProgress = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const labelReveal = interpolate(frame, [30, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contextReveal = interpolate(frame, [44, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanY = interpolate(frame % 60, [0, 60], [0, 100]);

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} sprockets>
      <ArchiveImageBackdrop
        imageUrl={imageUrl}
        videoUrl={videoUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
        videoMuted={videoMuted}
        videoVolume={videoVolume}
        videoDurationInFrames={videoDurationInFrames}
        videoStartInFrames={videoStartInFrames}
        dur={dur}
        dim={0.28}
      />
      {(imageUrl || videoUrl) ? (
        <div style={{ position: "absolute", inset: 0, background: hexToRgba(theme.bg, 0.55) }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? `${scenePadY}px 40px` : `${scenePadY}px 160px`,
        }}
      >
        <div
          style={{
            position: "relative",
            border: `1px solid ${theme.lineStrong}`,
            padding: p ? `${cardPadY}px 28px` : `${cardPadY}px 90px`,
            overflow: "hidden",
          }}
        >
          {/* Scanning readout line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanY}%`,
              height: 2,
              background: hexToRgba(theme.accent, 0.35),
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              opacity: interpolate(countProgress, [0, 0.15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `scale(${interpolate(countProgress, [0, 1], [0.85, 1])})`,
            }}
          >
            <ChippedHeading fontSize={statValue ? numberPx : numberPx * 0.42} color={theme.accent} letterSpacing="0.01em">
              {displayValue}
            </ChippedHeading>
          </div>
        </div>

        {displayLabel ? (
          <div
            style={{
              position: "relative",
              marginTop: 28,
              // Matches the context line below it, so a long label wraps within
              // the same column instead of running to the frame edges.
              maxWidth: p ? 640 : 920,
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 500,
              fontSize: fittedLabelPx,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: theme.text,
              opacity: labelReveal,
              transform: `translateY(${(1 - labelReveal) * 14}px)`,
              textAlign: "center",
            }}
          >
            {/* Hidden measuring mirror: carries the real column width so the fit
                wraps the label the way the frame will, without giving the
                visible (shrink-wrapped) label a width of its own. Stays hidden —
                useFitText reads el.style.visibility and preserves it. */}
            <div
              ref={labelRef}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: p ? 640 : 920,
                maxWidth: "100%",
                visibility: "hidden",
                pointerEvents: "none",
                fontFamily: DOCREEL_DISPLAY_FONT,
                fontWeight: 500,
                fontSize: fittedLabelPx,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {displayLabel}
            </div>
            {displayLabel}
          </div>
        ) : null}

        {displayContext ? (
          <div
            ref={contextRef}
            style={{
              marginTop: 18,
              width: "100%",
              maxWidth: p ? 640 : 920,
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: contextPx,
              color: hexToRgba(theme.text, 0.8),
              opacity: contextReveal,
              transform: `translateY(${(1 - contextReveal) * 10}px)`,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {displayContext}
          </div>
        ) : null}

        {showNarrationSeparately ? (
          <div
            style={{
              position: "relative",
              marginTop: 12,
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: narrationPx,
              color: hexToRgba(theme.text, 0.65),
              opacity: contextReveal,
              maxWidth: p ? 600 : 860,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {/* Hidden measuring mirror, for the same reason as the label's: this
                block shrink-wraps, and giving it a real `width` so useFitText
                could measure it would re-wrap the copy and move the whole
                centered stack even when no fitting was needed. */}
            <div
              ref={narrationRef}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                // Fixed measuring width — NOT clamped to the shrink-wrapped
                // parent, whose own width depends on the fitted size we are
                // trying to compute. Measuring against the constant maximum
                // makes the fit deterministic and matches the widest line the
                // paragraph is ever allowed to occupy.
                width: p ? 600 : 860,
                visibility: "hidden",
                pointerEvents: "none",
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: narrationPx,
                lineHeight: 1.5,
              }}
            >
              {narration}
            </div>
            {narration}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: ruleReservePx,
            left: p ? 40 : 60,
            right: p ? 40 : 60,
            borderTop: `1px solid ${theme.line}`,
          }}
        />
      </div>
    </DocReelScene>
  );
};
