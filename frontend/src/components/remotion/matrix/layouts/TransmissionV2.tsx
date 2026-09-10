import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { CodeFragments, ScanlinesOverlay, SignalWaveform } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

/**
 * TransmissionV2 — "Signal Log" (variant of transmission)
 *
 * Same props as the base, deliberately different composition. The base shows one
 * centred phrase at a time with hard cuts; here the phrases ACCUMULATE, so the
 * viewer sees the intercept building up:
 *
 *   * alignment — the signal log holds the CENTRE of the frame (beside the image
 *     in landscape, below it in portrait) with the title and narration parked in
 *     a footer block, instead of one centred phrase over an empty field;
 *   * reveal — each line wipes in left→right behind a leading cursor block,
 *     instead of sliding up and hard-cutting;
 *   * history — earlier lines stay on screen and step down through the accent
 *     ramp (full → 66 → 33), which the base cannot show at all;
 *   * image — a tall panel down the RIGHT side in landscape, or a padded band
 *     across the TOP in portrait, instead of a panel beside the phrase.
 *
 * Zone layout:
 *
 *   landscape + image   signals LEFT  · image RIGHT · title+narration BOTTOM
 *   landscape, no image signals CENTRED           · title+narration BOTTOM
 *   portrait            image TOP · signals CENTRE · title+narration BOTTOM
 *
 * The phrase cadence still derives from the same `holdFrames` stride as the
 * base, so scene duration behaves identically.
 */
export const TransmissionV2: React.FC<MatrixLayoutProps> = ({
  phrases,
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
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;
  const hasImage = !!imageUrl || !!videoUrl;

  // Identical derivation to the base, so no prop behaviour changes.
  const usedNarrationForPhrases = !(phrases && phrases.length > 0) && !!narration;
  const displayPhrases =
    phrases && phrases.length > 0
      ? phrases
      : narration
        ? narration.split(/[.!?]+/).filter((s) => s.trim())
        : [title];

  // The footer shows the narration verbatim — but NOT when the phrase list was
  // itself derived from it, which would print the same sentences twice.
  const footNarration = usedNarrationForPhrases ? "" : (narration || "").trim();

  const longestPhrase = displayPhrases.reduce(
    (longest, phrase) => (phrase.length > longest.length ? phrase : longest),
    "",
  );

  const count = Math.max(1, displayPhrases.length);
  const phraseMirrorRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);

  // Footer typography: the title leads, narration sits under it as support copy.
  // Each follows ITS OWN slider — the title tracks titleFontSize, the narration
  // tracks descriptionFontSize — so the two are independently adjustable.
  //
  // The title SHARES `titleFontSize` with the signal log, whose values are
  // display-scale, so it takes a fraction rather than the raw number. 0.5 here
  // (vs 0.8 in the base) because the log's own target is already much larger.
  // It was 0.36, which rendered the title far smaller than the signals and made
  // the slider look broken.
  const footTitleTarget = Math.round((titleFontSize ?? (p ? 111 : 98)) * 0.5);
  // Narration has `descriptionFontSize` to itself, so it uses the value as-is.
  const footNarrationTarget = descriptionFontSize ?? (p ? 39 : 32);
  // Budgets scale with the target so raising the slider raises the ceiling —
  // a fixed fraction of frame height silently capped the title however high the
  // slider went. Still bounded so a runaway value cannot swallow the log.
  const footTitleBudget = Math.min(height * 0.3, Math.max(height * 0.1, footTitleTarget * 1.5));
  const footNarrationBudget = Math.min(
    height * 0.24,
    Math.max(height * 0.11, footNarrationTarget * 2.6),
  );
  const { px: fittedFootTitleSize } = useFitText(
    titleRef,
    footTitleTarget,
    12,
    [title, footTitleTarget, p, hasImage],
    footTitleBudget,
  );
  const { px: fittedFootNarrationSize } = useFitText(
    narrationRef,
    footNarrationTarget,
    10,
    [footNarration, footNarrationTarget, p, hasImage],
    footNarrationBudget,
  );

  // Total height the footer reserves: its offset from the bottom edge, plus the
  // title band, plus the narration band (when shown) and the rule/gaps between.
  const footerBottomOffset = p ? 0.12 : 0.11;
  const footerZoneFrac =
    footerBottomOffset +
    footTitleBudget / height +
    (footNarration ? footNarrationBudget / height : 0) +
    (p ? 0.03 : 0.025);

  // The log gets whatever the image and footer leave. Derived rather than
  // hardcoded so it tracks both.
  const logTopFrac = p ? (hasImage ? 0.36 : 0.16) : 0.14;
  const logAreaFrac = Math.max(0.18, 1 - footerZoneFrac - logTopFrac);
  const logBudget = height * logAreaFrac * 0.92;

  const baseTarget = titleFontSize ?? (p ? 111 : 98);
  const scaledTarget = Math.round(
    baseTarget * (count >= 5 ? 0.42 : count >= 4 ? 0.5 : count >= 3 ? 0.6 : count >= 2 ? 0.78 : 1),
  );
  const { px: fittedPhraseSize } = useFitText(
    phraseMirrorRef,
    scaledTarget,
    14,
    [longestPhrase, scaledTarget, p, hasImage, count, footNarration],
    logBudget / count,
  );

  const holdFrames = 45; // same stride as the base
  const logStart = 6;

  // Inset wipes down into place.
  const insetWipe = interpolate(frame, [4, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const insetEased = 1 - Math.pow(1 - insetWipe, 3);

  const headerOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Footer settles early — it frames the scene rather than being a beat in it,
  // so it should already be in place as the first signals start printing.
  const footOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const footRise = spring({
    frame: frame - 8,
    fps: 30,
    config: { damping: 22, stiffness: 150 },
  });

  const imageMedia = videoUrl ? (
    <ZoomCropVideo
      src={videoUrl}
      imageObjectPosition={imageObjectPosition}
      imageZoom={imageZoom}
      muted={videoMuted ?? true}
      volume={videoVolume ?? 0.35}
      durationInFrames={videoDurationInFrames}
      startInFrames={videoStartInFrames}
    />
  ) : imageUrl ? (
    <ZoomCropImg src={imageUrl} imageObjectPosition={imageObjectPosition} imageZoom={imageZoom} />
  ) : null;

  // How many lines have started printing — drives the upward ride of the stack.
  const landed = Math.min(
    count,
    Math.max(0, Math.floor((frame - logStart) / holdFrames) + 1),
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      {/* Rain kept at full strength here — the log occupies less of the frame
          than the base's display phrase, so the field can carry more texture.
          (MatrixBackground's own `opacity` prop is inert.) */}
      <MatrixBackground bgColor={bgColor} fontFamily={resolvedFontFamily} />

      {/* Waveform moved to the TOP edge, floating readouts kept. No TerminalHUD /
          DecodeSweep / GlitchSlice — the log is the chrome in this variant. */}
      <SignalWaveform accentColor={accent} edge="top" seed={43} startFrame={4} />
      <CodeFragments accentColor={accent} count={6} seed={81} startFrame={12} />
      <ScanlinesOverlay accentColor={accent} intensity={0.85} />

      <div
        ref={phraseMirrorRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          // Must track the signal zone's width below, or the fit is measured
          // against a column the log never actually occupies.
          width: hasImage && !p ? "54%" : "88%",
          fontSize: scaledTarget,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          fontFamily: resolvedFontFamily,
          overflowWrap: "anywhere",
        }}
      >
        {longestPhrase}
      </div>

      {/* ── Image zone ──
          Landscape: a tall panel down the RIGHT side, beside the signals.
          Portrait:  a band across the TOP, inset from the top edge. */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            top: p ? "7%" : "12%",
            right: p ? "8%" : "6%",
            left: p ? "8%" : undefined,
            width: p ? undefined : "32%",
            height: p ? "26%" : "62%",
            overflow: "hidden",
            border: `1px solid ${accent}44`,
            boxShadow: `0 0 24px ${accent}22`,
            clipPath: `inset(${(1 - insetEased) * 100}% 0 0 0)`,
          }}
        >
          {imageMedia}
          <AbsoluteFill
            style={{
              background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${accent}08 2px, ${accent}08 4px)`,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Channel marker. Kept clear of the image panel in landscape. */}
      <div
        style={{
          position: "absolute",
          top: p ? "3%" : "5%",
          left: p ? "8%" : "6%",
          opacity: headerOpacity,
          fontSize: p ? 15 : 18,
          fontWeight: 400,
          color: `${accent}66`,
          fontFamily: resolvedFontFamily,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          maxWidth: hasImage && !p ? "58%" : "80%",
          overflowWrap: "anywhere",
        }}
      >
        [SIGNAL LOG]
      </div>

      {/* ── Signal zone — vertically CENTRED in the frame ──
          Landscape with an image it takes the left column; without one it
          spans the frame. Portrait it sits between the image band and the
          footer. Vertical centring is what the brief asks for, so the log is
          centred in its band rather than hanging off the bottom edge. */}
      <div
        style={{
          position: "absolute",
          // Landscape + image: left column beside the panel. Otherwise full width.
          left: p ? "8%" : "6%",
          right: hasImage && !p ? "40%" : p ? "8%" : "6%",
          top: `${logTopFrac * 100}%`,
          // Derived from the footer's actual reserved height, so the signal zone
          // yields automatically when the title/narration sliders grow the
          // footer. A hardcoded value would let a large title overlap the log.
          bottom: `${footerZoneFrac * 100}%`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          // The stack still rides as lines land, but only half as far: centred
          // content moves from the middle outward, so it needs less travel than
          // the old bottom-anchored stack.
          transform: `translateY(${Math.max(0, count - landed) * (fittedPhraseSize * 0.12)}px)`,
        }}
      >
        {displayPhrases.map((phrase, i) => {
          const start = logStart + i * holdFrames;
          const local = frame - start;
          if (local < 0) return null;

          // Left→right clip wipe, with a cursor riding the leading edge.
          const wipeFrames = 14;
          const wipe = interpolate(local, [0, wipeFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const eased = 1 - Math.pow(1 - wipe, 3);
          const isWiping = local < wipeFrames;

          // Age ramp: newest full, then 66, then 33 — the base has no history.
          const age = landed - 1 - i;
          const tone = age <= 0 ? accent : age === 1 ? `${accent}66` : `${accent}33`;
          const isNewest = age <= 0;

          // Deterministic timestamp token from the line index.
          const stamp = `T+${String(i * 2 + 1).padStart(2, "0")}`;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: p ? 10 : 16,
                marginTop: i === 0 ? 0 : p ? 10 : 14,
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  fontSize: Math.max(10, fittedPhraseSize * 0.32),
                  fontWeight: 400,
                  color: isNewest ? `${accent}88` : `${accent}44`,
                  fontFamily: resolvedFontFamily,
                  letterSpacing: "0.14em",
                }}
              >
                {stamp}
              </span>

              <span style={{ position: "relative", display: "inline-block", minWidth: 0 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: fittedPhraseSize,
                    fontWeight: 700,
                    color: tone,
                    fontFamily: resolvedFontFamily,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                    overflowWrap: "anywhere",
                    textShadow: isNewest ? `0 0 16px ${accent}44` : "none",
                    clipPath: `inset(0 ${(1 - eased) * 100}% 0 0)`,
                  }}
                >
                  {phrase.trim()}
                </span>
                {isWiping && (
                  <span
                    style={{
                      position: "absolute",
                      left: `${eased * 100}%`,
                      bottom: 0,
                      width: Math.max(6, fittedPhraseSize * 0.5),
                      height: fittedPhraseSize * 0.94,
                      backgroundColor: accent,
                      boxShadow: `0 0 14px ${accent}`,
                    }}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Footer zone — title over narration, anchored to the BOTTOM ──
          Full width in every orientation, including landscape-with-image: the
          image panel stops above it, so the footer runs the whole frame and the
          copy is not squeezed into the narrow left column. */}
      <div
        style={{
          position: "absolute",
          left: p ? "8%" : "6%",
          right: p ? "8%" : "6%",
          // Lifted off the bottom edge so the footer reads as part of the
          // composition rather than an overlay stuck to the frame.
          bottom: `${footerBottomOffset * 100}%`,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          opacity: footOpacity,
          transform: `translateY(${(1 - footRise) * 14}px)`,
        }}
      >
        {/* Rule separating the footer from the signal zone above it. */}
        <div
          style={{
            width: "100%",
            height: 1,
            backgroundColor: `${accent}33`,
            marginBottom: p ? 12 : 14,
          }}
        />

        <div
          ref={titleRef}
          style={{
            fontSize: fittedFootTitleSize,
            fontWeight: 700,
            color: accent,
            fontFamily: resolvedFontFamily,
            letterSpacing: "0.02em",
            lineHeight: 1.2,
            textTransform: "uppercase",
            overflowWrap: "anywhere",
            maxHeight: footTitleBudget,
            overflow: "hidden",
            textShadow: `0 0 14px ${accent}44`,
          }}
        >
          {title}
        </div>

        {footNarration && (
          <div
            ref={narrationRef}
            style={{
              marginTop: p ? 8 : 10,
              fontSize: fittedFootNarrationSize,
              fontWeight: 400,
              color: `${accent}88`,
              fontFamily: resolvedFontFamily,
              letterSpacing: "0.04em",
              lineHeight: 1.4,
              overflowWrap: "anywhere",
              maxHeight: footNarrationBudget,
              overflow: "hidden",
            }}
          >
            {footNarration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
