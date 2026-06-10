import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { EconomistMasthead } from "../components/EconomistMasthead";
import { EditorialDivider, EngravingTexture } from "../components/EconomistOrnaments";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { clamp01, baselineSettle, letterpressStamp, redactionReveal, ruleDraw } from "./motion";

/**
 * ImageFeature — a full-bleed photo feature. The Ken-Burns photo develops from
 * newsprint monochrome to full colour + a lower dark gradient, a mini masthead
 * + section kicker top-left, a short red accent rule drawing on and a big white
 * serif headline settling lower-left, and caption/credit stamped bottom-right.
 * Wrapped by minimal chrome (owns the whole canvas).
 */
export const ImageFeature: React.FC<EconomistLayoutProps> = ({
  title,
  caption,
  credit,
  sectionLabel = "FEATURE",
  wordmark,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = Boolean(imageUrl);
  // Brand masthead from the brief; hidden when none (never print "The Economist").
  const brandWordmark = (wordmark ?? "").trim();

  const margin = isPortrait ? 56 : 70;
  const headlineSize = (titleFontSize ?? (isPortrait ? 64 : 80)) as number;

  const photoOp = interpolate(frame, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, 260], [1.05, 1.14], { extrapolateRight: "clamp" }) * imageZoom;
  // The photo develops from newsprint monochrome into full colour.
  const developT = clamp01(frame / 55);
  const photoFilter = `grayscale(${(1 - developT).toFixed(3)})`;
  const headOp = interpolate(frame, [16, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headline = baselineSettle(frame, 16);
  const capStamp = letterpressStamp(frame, 36, 14, 1.08);
  const capOp = interpolate(frame, [34, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ink = hasImage ? "#FFFFFF" : textColor;
  const textShadow = hasImage ? "0 2px 18px rgba(0,0,0,0.5)" : "none";

  // No image → don't fake a photo feature (empty paper with a corner-pinned
  // headline reads as broken). Render a centred editorial card instead: kicker,
  // rule, big serif headline, and the caption as a standfirst. The pipeline
  // should avoid picking image_feature without an image, but this keeps the
  // scene clean if it slips through.
  if (!hasImage) {
    const noImgHeadline = (titleFontSize ?? (isPortrait ? 72 : 92)) as number;
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 28% 26%, ${ECONOMIST_COLORS.panel} 0%, ${ECONOMIST_COLORS.paper} 62%)`,
          padding: `0 ${isPortrait ? margin + 8 : 150}px`,
          justifyContent: "center",
        }}
      >
        {/* Faint engraved field fills the empty paper when there's no photo. */}
        <EngravingTexture opacity={0.04} gap={10} />

        <div style={{ maxWidth: isPortrait ? "100%" : "78%" }}>
          {(() => {
            const reveal = redactionReveal(frame, 0, 14);
            return (
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: isPortrait ? 20 : 19, letterSpacing: 2.4, textTransform: "uppercase", color: ECONOMIST_COLORS.muted, clipPath: reveal.clipPath }}>
                  {sectionLabel}
                </div>
                <span style={{ position: "absolute", top: 0, bottom: 0, left: `${reveal.barLeftPct.toFixed(2)}%`, width: `${reveal.barWidthPct}%`, background: accentColor, opacity: reveal.barOpacity }} />
              </div>
            );
          })()}
          <div style={{ width: 64, height: 6, background: accentColor, margin: `${isPortrait ? 20 : 22}px 0`, ...ruleDraw(frame, 12, 16) }} />
          <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontWeight: 900, fontSize: noImgHeadline, lineHeight: 1.02, letterSpacing: -noImgHeadline * 0.014, color: textColor, ...headline }}>
            {title}
          </div>
          {caption && (
            <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontStyle: "italic", fontSize: isPortrait ? 30 : 30, lineHeight: 1.4, color: ECONOMIST_COLORS.muted, marginTop: isPortrait ? 24 : 26, maxWidth: isPortrait ? "100%" : "82%", opacity: capOp }}>
              {caption}
            </div>
          )}
          {/* Closing engraved end-mark (SVG) + credit — anchors the card so it
              doesn't float in empty paper when there is no photo. */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: isPortrait ? 30 : 34, opacity: capOp }}>
            <EditorialDivider width={isPortrait ? 220 : 300} progress={capOp} accentColor={accentColor} height={16} />
            {credit && (
              <span style={{ fontFamily: ECONOMIST_SANS_FONT, fontSize: isPortrait ? 18 : 17, letterSpacing: 0.5, color: ECONOMIST_COLORS.muted, whiteSpace: "nowrap" }}>
                {credit}
              </span>
            )}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#111", overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: photoOp }}>
        <Img
          src={imageUrl as string}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imageObjectPosition, transform: `scale(${kbScale})`, filter: photoFilter }}
        />
        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0) 62%)" }} />
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 22%)" }} />
      </AbsoluteFill>

      {/* Masthead + kicker, top-left. */}
      <div style={{ position: "absolute", top: margin, left: margin, opacity: headOp, display: "flex", alignItems: "center", gap: 16 }}>
        {brandWordmark && <EconomistMasthead wordmark={brandWordmark} width={isPortrait ? 170 : 190} accentColor={accentColor} />}
        <span style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: hasImage ? "rgba(255,255,255,0.85)" : ECONOMIST_COLORS.muted, textShadow }}>
          {sectionLabel}
        </span>
      </div>

      {/* Headline lower-left — settles onto its baseline as the ink dries. */}
      <div style={{ position: "absolute", left: margin, bottom: isPortrait ? height * 0.16 : margin + 56, width: isPortrait ? width - margin * 2 : width * 0.62 }}>
        <div style={{ width: 60, height: 6, background: accentColor, marginBottom: 20, ...ruleDraw(frame, 12, 16) }} />
        <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontWeight: 900, fontSize: headlineSize, lineHeight: 1.03, letterSpacing: -headlineSize * 0.012, color: ink, textShadow, ...headline }}>
          {title}
        </div>
      </div>

      {/* Caption / credit pressed in bottom-right. */}
      {(caption || credit) && (
        <div style={{ position: "absolute", right: margin, bottom: margin, maxWidth: isPortrait ? "70%" : "40%", textAlign: "right", opacity: capStamp.opacity, transform: capStamp.transform, transformOrigin: "right bottom", filter: capStamp.filter }}>
          {caption && (
            <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontStyle: "italic", fontSize: isPortrait ? 26 : 25, lineHeight: 1.35, color: hasImage ? "rgba(255,255,255,0.92)" : ECONOMIST_COLORS.muted, textShadow }}>
              {caption}
            </div>
          )}
          {credit && (
            <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontSize: 17, letterSpacing: 0.5, color: hasImage ? "rgba(255,255,255,0.7)" : ECONOMIST_COLORS.muted, marginTop: 6, textShadow }}>
              {credit}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
