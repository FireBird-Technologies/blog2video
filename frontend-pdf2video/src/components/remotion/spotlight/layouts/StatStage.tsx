import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import { PulseRing, BigGlyphBackdrop, FilmGrain, HalftoneField, KineticTicker, StarburstBadge } from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";

/**
 * StatStage — Number Spotlight
 *
 * Giant number with counter roll-up animation centered on black.
 * A small frosted glass card fades in below with label/context.
 * The ONLY glass element in the entire Spotlight template.
 */
export const StatStage: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  metrics,imageUrl,
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
  const fps = 30;
  const p = aspectRatio === "portrait";
  const hasImage = !!imageUrl || !!videoUrl;
  const displayFontFamily =
    fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;
  const bodyFontFamily = fontFamily ?? SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;

  const primary = metrics?.[0];
  const numericValue = primary ? parseFloat(primary.value.replace(/,/g, "")) : 0;
  const isNumeric = !isNaN(numericValue) && numericValue > 0;

  const countUpDuration = 36;
  const progress = interpolate(frame, [5, 5 + countUpDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - progress, 3);
  const displayNumber = isNumeric
    ? Math.round(eased * numericValue)
    : primary?.value || title;

  const contextText =
    metrics && metrics.length > 1
      ? metrics
          .slice(1)
          .map((m) => `${m.value}${m.suffix || ""} ${m.label}`)
          .join(" · ")
      : narration || "";

  /* ── Auto-fit ──────────────────────────────────────────────
     The giant number falls back to raw title text when no numeric metric is
     supplied, and the context line under it can be a joined multi-metric
     string or full narration — both unbounded. Fit the number against the
     stat column, then the label/context card against what's left below it. */
  const numberRef = React.useRef<HTMLDivElement>(null);
  const contextRef = React.useRef<HTMLDivElement>(null);
  const numberTargetPx = titleFontSize ?? (p ? 131 : 120);
  const labelTargetPx = descriptionFontSize ?? (p ? 31 : 29);
  const stackBudgetPx = Math.round(height * (hasImage && !p ? 0.55 : p ? 0.6 : 0.68));
  const numberBudgetPx = Math.round(stackBudgetPx * 0.68);
  const { px: numberPx } = useFitText(
    numberRef,
    numberTargetPx,
    p ? 48 : 44,
    [String(displayNumber), numberTargetPx, numberBudgetPx],
    numberBudgetPx,
  );
  const contextBudgetPx = Math.max(1, stackBudgetPx - numberBudgetPx);
  const { px: contextPx } = useFitText(
    contextRef,
    labelTargetPx,
    p ? 14 : 13,
    [contextText, primary?.label, labelTargetPx, contextBudgetPx, numberPx],
    contextBudgetPx,
  );

  const cardSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  const cardOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} accentColor={accentColor} />

      {/* Decorative artifacts — ghost glyph + faint pulse behind the giant stat. */}
      {!hasImage && (
        <>
          <PulseRing accentColor={accentColor} />
          <BigGlyphBackdrop glyph="#" accentColor={accentColor} tint="accent" startFrame={2} />
          <HalftoneField accentColor={accentColor} corner="top-left" />
        </>
      )}
      <FilmGrain />
      {/* Spinning starburst seal stamps the stat moment + marquee energy below. */}
      <StarburstBadge accentColor={accentColor} corner={p ? "top-right" : "bottom-right"} size={p ? 140 : 168} startFrame={26} />
      {/* Marquee echoes the actual stat being staged. */}
      <KineticTicker
        accentColor={accentColor}
        edge="bottom"
        label={(primary
          ? `${primary.value}${primary.suffix || ""} ${primary.label || ""}`.trim()
          : title || "BIG NUMBER"
        ).slice(0, 48)}
        speed={0.9}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 80,
          gap: hasImage ? (p ? 30 : 60) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 35%",
              width: p ? "70%" : "auto",
              height: p ? 200 : 350,
              borderRadius: 4,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
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
              <Img
                src={imageUrl!}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                }}
              />
            )}
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <div
            ref={numberRef}
            style={{
              fontSize: numberPx,
              fontWeight: 900,
              color: textColor || "#FFFFFF",
              letterSpacing: "-0.05em",
              lineHeight: 1,
              fontFamily: displayFontFamily,
            }}
          >
            {displayNumber}
            {primary?.suffix && (
              <span style={{ color: accentColor, fontSize: "0.5em" }}>
                {primary.suffix}
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: p ? 16 : 24,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              padding: `${p ? 12 : 16}px ${p ? 24 : 36}px`,
              opacity: cardOpacity,
              transform: `translateY(${(1 - cardSpring) * 10}px)`,
              display: "inline-block",
            }}
          >
            {/* fontSize set on the wrapper (by the hook) and inherited (`1em`) by
                both children below — so the wrapper's own naturalHeight probe
                actually reflects their combined rendered height at the size
                being tested, instead of being ignored by explicit child sizes. */}
            <div ref={contextRef} style={{ fontSize: contextPx, maxHeight: "100%", overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "1em",
                  fontWeight: 700,
                  color: textColor || "#FFFFFF",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: bodyFontFamily,
                }}
              >
                {primary?.label || title}
              </div>
              {contextText && (
                <div
                  style={{
                    fontSize: "1em",
                    color: "#666666",
                    marginTop: 4,
                    fontFamily: bodyFontFamily,
                  }}
                >
                  {contextText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

