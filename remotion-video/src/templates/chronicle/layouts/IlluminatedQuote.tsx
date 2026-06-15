import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { OrnamentalBorder } from "../components/OrnamentalBorder";
import { EmberSparks, InkFlourish } from "../components/ChronicleArtifacts";
import { RibbonBanner, QuillText } from "../components/QuillInk";
import { EmbossedImage } from "../components/EmbossedImage";

/**
 * IlluminatedQuote — pull quote / memorable line with ornamental vine corners,
 * giant opening-quote glyph, and a ribbon banner attribution.
 */
export const IlluminatedQuote: React.FC<ChronicleLayoutProps> = ({
  title,
  narration,
  quote,
  attribution,
  highlightPhrase,
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  imageUrl,
  imageObjectPosition,
  imageZoom,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  const quoteText = (quote ?? narration ?? title ?? "").trim();
  const attributionText = (attribution ?? title ?? "").trim();

  // Highlight phrase rendering (red-ink underline on the phrase if present)
  const renderQuote = (): React.ReactNode => {
    const hl = (highlightPhrase ?? "").trim();
    if (!hl || !quoteText.toLowerCase().includes(hl.toLowerCase())) {
      return (
        <QuillText
          text={quoteText}
          startFrame={20}
          durationFrames={Math.min(140, quoteText.length * 1.5)}
          mode="word"
          showCursor={false}
        />
      );
    }
    const idx = quoteText.toLowerCase().indexOf(hl.toLowerCase());
    const before = quoteText.slice(0, idx);
    const mid = quoteText.slice(idx, idx + hl.length);
    const after = quoteText.slice(idx + hl.length);
    return (
      <>
        <QuillText text={before} startFrame={20} durationFrames={Math.min(80, before.length * 1.5)} mode="word" showCursor={false} />
        <span
          style={{
            color: "#8B2E1D",
            position: "relative",
            display: "inline-block",
          }}
        >
          <QuillText text={mid} startFrame={20 + before.length * 1.5} durationFrames={Math.min(40, mid.length * 1.5)} mode="word" showCursor={false} />
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -4,
              height: 3,
              background: "#8B2E1D",
              transform: `scaleX(${interpolate(
                frame,
                [50, 75],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )})`,
              transformOrigin: "left center",
            }}
          />
        </span>
        <QuillText
          text={after}
          startFrame={20 + (before.length + mid.length) * 1.5}
          durationFrames={Math.min(80, after.length * 1.5)}
          mode="word"
          showCursor={false}
        />
      </>
    );
  };

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        padding: p ? "10% 10%" : "8% 12%",
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        opacity: fadeOut,
        display: "flex",
        flexDirection: p ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: p ? 24 : 60,
        position: "relative",
      }}
    >
      {/* Candlelit embers rise behind the quote + a quill divider inks in below. */}
      <EmberSparks count={14} seed={5} intensity={0.9} />
      <InkFlourish variant="divider" position="bottom-center" color={accentColor} startFrame={36} />

      {/* Ornamental vine corners drawing in */}
      <OrnamentalBorder
        color={accentColor}
        size={p ? 140 : 170}
        startFrame={0}
        variant="vine"
      />

      {/* Optional image (small tilted card) */}
      {imageUrl && (
        <div style={{ flex: p ? "0 0 auto" : "0 0 30%", display: "flex", justifyContent: "center" }}>
          <EmbossedImage
            src={imageUrl}
            objectPosition={imageObjectPosition}
            zoom={imageZoom}
            rotate={-3}
            revealStart={10}
            style={{
              width: p ? "60%" : "100%",
              aspectRatio: "3 / 4",
            }}
          />
        </div>
      )}

      {/* Quote block */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          maxWidth: p ? "100%" : imageUrl ? "60%" : "75%",
        }}
      >
        {/* Giant opening quotation glyph */}
        <div
          style={{
            fontFamily: CHRONICLE_HEADING_FONT,
            fontSize: p ? 180 : 220,
            lineHeight: 0.7,
            color: accentColor,
            fontWeight: 900,
            opacity: interpolate(frame, [5, 20], [0, 0.9], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            marginBottom: -20,
            alignSelf: "flex-start",
            textShadow: "2px 2px 0 rgba(40,25,12,0.25)",
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <div
          style={{
            fontFamily: CHRONICLE_HEADING_FONT,
            fontStyle: "italic",
            fontSize: titleFontSize ?? (p ? 54 : 58),
            color: textColor,
            lineHeight: 1.25,
            fontWeight: 400,
            letterSpacing: "0.01em",
          }}
        >
          {renderQuote()}
        </div>

        {/* Ribbon banner with attribution (only if we have one) */}
        {attributionText && (
          <div style={{ marginTop: 48 }}>
            <RibbonBanner
              color="#8B2E1D"
              textColor="#F8EFD6"
              startFrame={Math.max(60, Math.floor(quoteText.length * 1.5) + 30)}
              width={p ? "80%" : 420}
              height={p ? 52 : 48}
              fontFamily={CHRONICLE_SMALLCAPS_FONT}
              fontSize={descriptionFontSize ? descriptionFontSize * 0.7 : (p ? 22 : 20)}
            >
              {attributionText}
            </RibbonBanner>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
