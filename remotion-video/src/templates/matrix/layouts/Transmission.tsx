import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { buildHudStatus, DecodeSweep, GlitchSlice, ScanlinesOverlay, SignalWaveform, TerminalHUD } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

// Define default spring config for various effects
const springConfigSoftBounce = {
  damping: 8, // Softer bounce for position
  stiffness: 80, // Medium stiffness
  mass: 0.8, // Lighter for quicker reaction
  overshootClamping: false, // Allow overshoot for the bounce effect
};

const springConfigEaseOut = {
  damping: 20, // Higher damping for smoother ease-out, minimal oscillation
  stiffness: 100, // Reasonable stiffness
  mass: 1,
  overshootClamping: true, // Prevents any overshoot for a clean ease-out
};


/**
 * Transmission — Intercepted Signal Flash
 *
 * 3-5 short phrases displayed sequentially like intercepted transmissions.
 * Each phrase: centered, monospace, green. Hard cuts between phrases.
 * [SIGNAL] prefix in dimmer green.
 *
 * The scene is framed by two persistent bands: the TITLE across the top (under
 * a short rule) and the NARRATION across the bottom. Both hold for the whole
 * scene while the phrases flash in the middle, so the viewer keeps the context
 * of what is being intercepted. The phrase area is inset vertically to clear
 * them, which is why its fit budget is smaller than the full frame height.
 */
export const Transmission: React.FC<MatrixLayoutProps> = ({
  phrases,
  title,
  narration,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  textColor,
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

  const usedNarrationForPhrases = !(phrases && phrases.length > 0) && !!narration;
  const displayPhrases =
    phrases && phrases.length > 0
      ? phrases
      : narration
        ? narration.split(/[.!?]+/).filter((s) => s.trim())
        : [title];

  // Narration is shown verbatim in the bottom band — but NOT when the phrase
  // list was derived from it, which would print the same sentences twice.
  const footNarration = usedNarrationForPhrases ? "" : (narration || "").trim();

  const longestPhrase = displayPhrases.reduce((longest, phrase) => phrase.length > longest.length ? phrase : longest, "");
  const phraseMirrorRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const phraseTarget = titleFontSize ?? (p ? 75 : 68);

  // Band typography. Each band follows ITS OWN slider — the title tracks
  // titleFontSize, the narration tracks descriptionFontSize — so the two are
  // independently adjustable rather than both moving off one control.
  //
  // The title SHARES `titleFontSize` with the big centred phrase above, so it
  // takes a fraction of it rather than the raw value: at full size a caption
  // would compete with the transmission it labels. The factor is 0.8 — it was
  // 0.46, which rendered the title at roughly half the phrase and made the
  // slider look broken. Large enough to lead, still clearly subordinate.
  const titleBandTarget = Math.round((titleFontSize ?? (p ? 75 : 68)) * 0.8);
  // Narration has `descriptionFontSize` to itself, so it uses the value as-is.
  const narrationBandTarget = descriptionFontSize ?? (p ? 41 : 36);
  // Band height budgets. These are also what the phrase area is inset by below,
  // so a title that wraps to its full budget still cannot reach the phrase.
  //
  // Sized off the TARGET as well as the frame, so raising the slider raises the
  // ceiling with it — a fixed fraction of frame height silently capped the title
  // (at 1080p a one-liner could never exceed ~160px no matter how high the
  // slider went). Still bounded so a runaway value cannot swallow the phrase.
  const titleBandBudget = Math.min(height * 0.3, Math.max(height * 0.1, titleBandTarget * 1.5));
  const narrationBandBudget = Math.min(height * 0.24, Math.max(height * 0.11, narrationBandTarget * 2.6));
  const { px: fittedTitleSize } = useFitText(
    titleRef,
    titleBandTarget,
    12,
    [title, titleBandTarget, p, hasImage],
    titleBandBudget,
  );
  const { px: fittedNarrationSize } = useFitText(
    narrationRef,
    narrationBandTarget,
    10,
    [footNarration, narrationBandTarget, p, hasImage],
    narrationBandBudget,
  );

  // Where each band's reserved space ends, as a fraction of frame height. The
  // phrase area is inset to exactly these, so the worst case (a title wrapping
  // to the full budget) still clears it.
  // Derived from the ACTUAL budgets above, not a hardcoded fraction — those now
  // grow with the slider, and the inset has to grow with them or a large title
  // would overlap the phrase.
  const titleZoneEnd =
    (p ? 0.06 : 0.05) + titleBandBudget / height + (p ? 0.018 : 0.015); // top offset + budget + rule
  // Narration sits a little higher off the bottom edge than a flush-to-edge
  // caption would, so it reads as part of the composition rather than as an
  // overlay stuck to the frame.
  const narrationBottomOffset = p ? 0.12 : 0.11;
  const narrationZoneStart = footNarration
    ? 1 - (narrationBottomOffset + narrationBandBudget / height)
    : 1 - (p ? 0.09 : 0.08);

  // The phrase gets only the band left between the two zones, so its fit budget
  // is derived from that rather than from the full frame height.
  const phraseAreaFrac = Math.max(0.2, narrationZoneStart - titleZoneEnd);
  const { px: fittedPhraseSize } = useFitText(
    phraseMirrorRef,
    phraseTarget,
    16,
    [longestPhrase, phraseTarget, p, hasImage, footNarration],
    height * phraseAreaFrac * (hasImage ? (p ? 0.44 : 0.84) : 0.84),
  );

  // Both bands settle early — they frame the scene rather than being beats in
  // it, so they are in place before the first phrase flashes.
  const bandOpacity = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const holdFrames = 45; // Reduced from 60 to make transitions faster
  const currentIdx = Math.floor(frame / holdFrames) % displayPhrases.length;

  // Calculate the frame relative to the start of the current phrase's activation
  const currentPhraseActiveFrame = frame % holdFrames;

  // --- Image Animation ---
  const imageAnimationStart = 0; // Animation starts immediately when phrase becomes active
  const imageAnimationDuration = 30; // frames for fall and bounce

  const imageFallProgress = spring({
    frame: Math.max(0, currentPhraseActiveFrame - imageAnimationStart),
    fps: 30,
    config: springConfigSoftBounce,
    durationInFrames: imageAnimationDuration,
  });

  // Image falls from above the frame and bounces
  const imageTranslateY = interpolate(imageFallProgress, [0, 1], [-300, 0]); // Do not clamp to allow bounce overshoot
  // Image fades in as it falls
  const imageOpacity = interpolate(imageFallProgress, [0, 0.2], [0, 1], {
    extrapolateRight: "clamp", // Clamp opacity to stay between 0 and 1
  });
  // Image scales slightly as it falls, potentially with a small bounce
  const imageScale = interpolate(imageFallProgress, [0, 1], [0.9, 1]); // Do not clamp to allow bounce overshoot

  // --- Text Animation ---
  const textAnimationStart = 5; // Start text animations after image starts slightly
  const textAnimationDuration = 25; // frames for slide up

  const headerDelay = 0; // Header animates first (relative to textAnimationStart)
  const bodyDelay = 5; // Body text animates 5 frames after header

  // Header ([SIGNAL] prefix) animation
  const headerSlideInProgress = spring({
    frame: Math.max(0, currentPhraseActiveFrame - (textAnimationStart + headerDelay)),
    fps: 30,
    config: springConfigEaseOut,
    durationInFrames: textAnimationDuration,
  });
  const headerTranslateY = interpolate(headerSlideInProgress, [0, 1], [50, 0], {
    extrapolateRight: "clamp",
  });
  const headerOpacity = interpolate(headerSlideInProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Main phrase animation
  const bodySlideInProgress = spring({
    frame: Math.max(0, currentPhraseActiveFrame - (textAnimationStart + bodyDelay)),
    fps: 30,
    config: springConfigEaseOut,
    durationInFrames: textAnimationDuration,
  });
  const bodyTranslateY = interpolate(bodySlideInProgress, [0, 1], [50, 0], {
    extrapolateRight: "clamp",
  });
  const bodyOpacity = interpolate(bodySlideInProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} fontFamily={resolvedFontFamily} />

      {/* Decorative artifacts — transmission HUD, decode pass, glitch ticks, CRT texture. */}
      <TerminalHUD accentColor={accent} statusText={buildHudStatus("TRANSMISSION", title)} startFrame={2} seed={23} />
      {/* Live signal waveform reinforces the "incoming transmission" read. */}
      <SignalWaveform accentColor={accent} edge="bottom" seed={71} startFrame={6} />
      <DecodeSweep accentColor={accent} startFrame={4} seed={27} />
      <GlitchSlice accentColor={accent} every={66} seed={63} />
      <ScanlinesOverlay accentColor={accent} intensity={0.85} />
      <div ref={phraseMirrorRef} style={{ position: "absolute", visibility: "hidden", width: hasImage && !p ? "48%" : "84%", fontSize: phraseTarget, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, fontFamily: resolvedFontFamily, overflowWrap: "anywhere" }}>{longestPhrase}</div>

      {displayPhrases.map((phrase, i) => {
        const isActive = currentIdx === i;

        // The parent div's opacity now directly depends on `isActive`.
        // This achieves the "hard cuts between phrases" by instantly showing/hiding the overall container.
        // The children handle their own animated opacities and transforms within the active period.
        const parentOpacity = isActive ? 1 : 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // Inset vertically so the phrase never collides with the title
              // band above or the narration band below — derived from the same
              // budgets those bands are fitted to, so even a title that wraps to
              // its full budget clears this. The phrase stays centred in what's
              // left, keeping the base's centred-flash character.
              top: `${titleZoneEnd * 100}%`,
              bottom: `${(1 - narrationZoneStart) * 100}%`,
              display: "flex",
              flexDirection: hasImage && !p ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              padding: hasImage && !p ? "0 8% 0 0" : "0 8%",
              gap: hasImage ? 48 : 0,
              textAlign: "center",
              opacity: parentOpacity, // Controlled by isActive for hard cuts
              // Ensures that only the active phrase is visible and interactive
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            {hasImage && (
              <div
                style={{
                  flex: p ? "0 0 auto" : "0 0 38%",
                  width: p ? "76%" : undefined,
                  maxWidth: p ? 760 : undefined,
                  height: p ? "44%" : "100%",
                  padding: p ? "0" : "8% 0 8% 8%",
                  // Apply image animations
                  opacity: imageOpacity,
                  transform: `translateY(${imageTranslateY}px) scale(${imageScale})`,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    border: `1px solid ${accent}33`,
                  }}
                >
                  {videoUrl ? (
                    <ZoomCropVideo
                      src={videoUrl}
                      imageObjectPosition={imageObjectPosition}
                      imageZoom={imageZoom}
                      muted={videoMuted ?? true}
                      volume={videoVolume ?? 0.35}
                      durationInFrames={videoDurationInFrames}
                      startInFrames={videoStartInFrames}
                    />
                  ) : (
                    <ZoomCropImg
                      src={imageUrl!}
                      imageObjectPosition={imageObjectPosition}
                      imageZoom={imageZoom}
                    />
                  )}
                </div>
              </div>
            )}
            <div
              style={{
                flex: hasImage && !p ? 1 : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Signal prefix */}
              <div
                style={{
                  fontSize: p ? 14 : 18,
                  fontWeight: 400,
                  color: `${accent}44`,
                  fontFamily: resolvedFontFamily,
                  letterSpacing: "0.2em",
                  marginBottom: p ? 12 : 20,
                  textTransform: "uppercase",
                  // Apply header text animations
                  opacity: headerOpacity,
                  transform: `translateY(${headerTranslateY}px)`,
                }}
              >
                [SIGNAL INTERCEPTED]
              </div>

              {/* Main phrase */}
              <div
                style={{
                  fontSize: fittedPhraseSize,
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  fontFamily: resolvedFontFamily,
                  overflowWrap: "anywhere",
                  textShadow: `0 0 16px ${accent}44`,
                  // Apply body text animations
                  opacity: bodyOpacity,
                  transform: `translateY(${bodyTranslateY}px)`,
                }}
              >
                {phrase.trim()}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Title band, TOP ──
          Sits above the phrase flash and holds for the whole scene, so the
          viewer always knows what the intercept is about. Rendered after the
          phrases so it stays on top of any phrase that runs long. */}
      <div
        style={{
          position: "absolute",
          top: p ? "6%" : "5%",
          left: p ? "8%" : "6%",
          right: p ? "8%" : "6%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: bandOpacity,
        }}
      >
        <div
          ref={titleRef}
          style={{
            fontSize: fittedTitleSize,
            fontWeight: 700,
            color: accent,
            fontFamily: resolvedFontFamily,
            letterSpacing: "0.02em",
            lineHeight: 1.2,
            textAlign: "center",
            textTransform: "uppercase",
            overflowWrap: "anywhere",
            maxHeight: titleBandBudget,
            overflow: "hidden",
            textShadow: `0 0 14px ${accent}44`,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: p ? 10 : 12,
            width: p ? 120 : 160,
            height: 2,
            backgroundColor: `${accent}55`,
            boxShadow: `0 0 8px ${accent}44`,
          }}
        />
      </div>

      {/* ── Narration band, BOTTOM ── */}
      {footNarration && (
        <div
          ref={narrationRef}
          style={{
            position: "absolute",
            // Same constant the zone math above reserves space with, so the
            // rendered band and the phrase inset can never drift apart.
            bottom: `${narrationBottomOffset * 100}%`,
            left: p ? "8%" : "10%",
            right: p ? "8%" : "10%",
            fontSize: fittedNarrationSize,
            fontWeight: 400,
            color: `${accent}88`,
            fontFamily: resolvedFontFamily,
            letterSpacing: "0.04em",
            lineHeight: 1.4,
            textAlign: "center",
            overflowWrap: "anywhere",
            maxHeight: narrationBandBudget,
            overflow: "hidden",
            opacity: bandOpacity,
          }}
        >
          {footNarration}
        </div>
      )}
    </AbsoluteFill>
  );
};
