import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { buildHudStatus, CipherRing, DecodeSweep, ScanlinesOverlay, TelemetryGauge, TerminalHUD } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

const CIPHER_CHARS = "0123456789ABCDEF!@#$%ΔΣΩλ";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * CipherMetric — Number Decode
 *
 * Giant number decodes from cipher noise with counter roll-up.
 * Terminal-style card below with label. Green glow on number.
 */
export const CipherMetric: React.FC<MatrixLayoutProps> = ({
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
  const accent = accentColor || "#00FF41";
  const hasImage = !!imageUrl || !!videoUrl;
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;

  const primary = metrics?.[0];
  const metricMirrorRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const metricCopy = `${primary?.value || title}${primary?.suffix || ""}`;
  const cardCopy = `${primary?.label || title} ${metrics && metrics.length > 1 ? metrics.slice(1).map((m) => `${m.value}${m.suffix || ""} ${m.label}`).join(" · ") : narration || ""}`;
  const metricTarget = titleFontSize ?? (p ? 182 : 175);
  const cardTarget = descriptionFontSize ?? (p ? 48 : 39);
  const { px: fittedMetricSize } = useFitText(metricMirrorRef, metricTarget, 20, [metricCopy, metricTarget, p, hasImage], height * 0.3);
  const { px: fittedCardSize } = useFitText(cardRef, cardTarget, 12, [cardCopy, cardTarget, p, hasImage], height * 0.22);
  const numericValue = primary
    ? parseFloat(primary.value.replace(/,/g, ""))
    : 0;
  const isNumeric = !isNaN(numericValue) && numericValue > 0;

  const decodePhase = frame < 20; // cipher noise phase
  const countUpDuration = 36;
  const progress = interpolate(frame, [20, 20 + countUpDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - progress, 3);

  let displayNumber: string;
  if (decodePhase) {
    // Show cipher noise
    const valueStr = primary?.value || title;
    displayNumber = valueStr
      .split("")
      .map((_, i) => {
        const idx = Math.floor(
          seededRandom(i * 100 + frame * 7) * CIPHER_CHARS.length
        );
        return CIPHER_CHARS[idx];
      })
      .join("");
  } else if (isNumeric) {
    displayNumber = String(Math.round(eased * numericValue));
  } else {
    displayNumber = primary?.value || title;
  }

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
  const imageScaleVal = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const glowPulse = !decodePhase
    ? 0.6 + Math.sin(frame * 0.1) * 0.4
    : 0.3;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} fontFamily={resolvedFontFamily} />

      {/* Decorative artifacts — cipher dial, decode pass, verification HUD, CRT texture. */}
      {!hasImage && <CipherRing accentColor={accent} startFrame={4} seed={15} />}
      <DecodeSweep accentColor={accent} startFrame={2} seed={19} />
      <TerminalHUD accentColor={accent} statusText={buildHudStatus("VERIFIED", primary?.label || title)} startFrame={10} seed={59} />
      {/* Telemetry gauge sweeps up like a confidence reading on the metric. */}
      <TelemetryGauge accentColor={accent} label="CONF" corner="top-right" startFrame={14} seed={63} />
      <ScanlinesOverlay accentColor={accent} intensity={0.8} />
      <div ref={metricMirrorRef} style={{ position: "absolute", visibility: "hidden", width: hasImage && !p ? "50%" : "84%", fontSize: metricTarget, fontWeight: 700, lineHeight: 1, fontFamily: resolvedFontFamily, overflowWrap: "anywhere" }}>{metricCopy}</div>

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
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScaleVal})`,
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
        )}

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: fittedMetricSize,
              fontWeight: 700,
              color: accent,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              fontFamily: resolvedFontFamily,
              textShadow: `0 0 ${20 * glowPulse}px ${accent}88, 0 0 ${40 * glowPulse}px ${accent}44`,
              overflowWrap: "anywhere",
            }}
          >
            {displayNumber}
            {primary?.suffix && !decodePhase && (
              <span style={{ color: `${accent}88`, fontSize: "0.5em" }}>
                {primary.suffix}
              </span>
            )}
          </div>

          {/* Terminal card with label */}
          <div
            ref={cardRef}
            style={{
              marginTop: p ? 16 : 24,
              border: `1px solid ${accent}44`,
              padding: `${p ? 12 : 16}px ${p ? 24 : 36}px`,
              opacity: cardOpacity,
              transform: `translateY(${(1 - cardSpring) * 10}px)`,
              display: "inline-block",
            }}
          >
            <div
              style={{
                fontSize: fittedCardSize,
                fontWeight: 700,
                color: accent,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: resolvedFontFamily,
              }}
            >
              {primary?.label || title}
            </div>
            {(narration || (metrics && metrics.length > 1)) && (
              <div
                style={{
                  fontSize: fittedCardSize,
                  color: `${accent}66`,
                  marginTop: 4,
                  fontFamily: resolvedFontFamily,
                }}
              >
                {metrics && metrics.length > 1
                  ? metrics
                      .slice(1)
                      .map((m) => `${m.value}${m.suffix || ""} ${m.label}`)
                      .join(" · ")
                  : narration}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
