import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";

/**
 * VersusFolio — two facing pages with a central spine + "vs." medallion.
 * Used for comparisons, before/after, myth-vs-fact.
 */
export const VersusFolio: React.FC<ChronicleLayoutProps> = ({
  title,
  narration,
  leftLabel = "Thus Spoken",
  rightLabel = "Thus Proven",
  leftDescription = "",
  rightDescription = "",
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

  // Left page slides in first, right page second
  const leftIn = interpolate(frame, [0, 25], [p ? -30 : -50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leftOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightIn = interpolate(frame, [15, 40], [p ? 30 : 50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightOp = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Medallion pops in
  const medScale = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  const Page = ({
    align,
    label,
    desc,
    tint,
    slideOffset,
    opacity,
    showImage,
  }: {
    align: "left" | "right";
    label: string;
    desc: string;
    tint: string;
    slideOffset: number;
    opacity: number;
    showImage: boolean;
  }) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: p ? "26px 26px" : "36px 36px",
        background: tint,
        borderRadius: 6,
        boxShadow: "inset 0 0 0 1px rgba(40,25,12,0.15), 0 6px 18px rgba(40,25,12,0.2)",
        transform: p
          ? `translateY(${slideOffset}px)`
          : `translateX(${slideOffset}px)`,
        opacity,
        position: "relative",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: CHRONICLE_SMALLCAPS_FONT,
          fontSize: p ? 22 : 20,
          color: accentColor,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          fontWeight: 700,
          textAlign: align === "left" ? "left" : "right",
          opacity: 0.8,
          marginBottom: 14,
        }}
      >
        {align === "left" ? "I." : "II."}
      </div>

      <div
        style={{
          fontFamily: CHRONICLE_HEADING_FONT,
          fontSize: titleFontSize ? titleFontSize * 0.55 : (p ? 44 : 50),
          fontWeight: 700,
          color: textColor,
          lineHeight: 1.1,
          textAlign: align === "left" ? "left" : "right",
          marginBottom: 20,
        }}
      >
        <QuillText
          text={label}
          startFrame={align === "left" ? 10 : 25}
          durationFrames={25}
          mode="char"
          showCursor={false}
        />
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1.5,
          background: textColor,
          opacity: 0.35,
          alignSelf: align === "left" ? "flex-start" : "flex-end",
          width: "50%",
          marginBottom: 20,
        }}
      />

      <div
        style={{
          fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
          fontSize: descriptionFontSize ?? (p ? 39 : 30),
          color: textColor,
          lineHeight: 1.5,
          opacity: 0.92,
          textAlign: align === "left" ? "left" : "right",
          flex: 1,
        }}
      >
        <QuillText
          text={desc}
          startFrame={align === "left" ? 30 : 45}
          durationFrames={Math.min(120, desc.length * 1.1)}
          mode="word"
          showCursor={false}
        />
      </div>

      {showImage && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: align === "left" ? "flex-start" : "flex-end",
          }}
        >
          <EmbossedImage
            src={imageUrl!}
            objectPosition={imageObjectPosition}
            zoom={imageZoom}
            rotate={align === "left" ? -2.5 : 2.5}
            revealStart={align === "left" ? 20 : 35}
            style={{
              width: p ? "100%" : "70%",
              aspectRatio: "4 / 3",
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        padding: p ? "10% 6%" : "7% 8%",
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Optional title */}
      {title && (
        <div
          style={{
            fontFamily: CHRONICLE_HEADING_FONT,
            fontSize: (titleFontSize ?? (p ? 84 : 65)) * (p ? 0.7 : 0.8),
            fontWeight: 700,
            color: textColor,
            textAlign: "center",
            marginBottom: 24,
            opacity: leftOp,
          }}
        >
          <QuillText text={title} startFrame={5} durationFrames={25} mode="char" showCursor={false} />
        </div>
      )}

      {/* Sub narration */}
      {narration && (
        <div
          style={{
            textAlign: "center",
            fontSize: descriptionFontSize ? descriptionFontSize * 0.85 : (p ? 24 : 20),
            color: textColor,
            opacity: 0.7,
            fontStyle: "italic",
            marginBottom: 20,
            maxWidth: p ? "100%" : "70%",
            alignSelf: "center",
          }}
        >
          {narration}
        </div>
      )}

      {/* Two folios */}
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          gap: p ? 24 : 90,
          flex: 1,
          position: "relative",
        }}
      >
        <Page
          align="left"
          label={leftLabel}
          desc={leftDescription || narration || ""}
          tint="rgba(248,239,214,0.55)"
          slideOffset={leftIn}
          opacity={leftOp}
          showImage={Boolean(imageUrl)}
        />
        <Page
          align="right"
          label={rightLabel}
          desc={rightDescription || ""}
          tint="rgba(248,239,214,0.55)"
          slideOffset={rightIn}
          opacity={rightOp}
          showImage={false}
        />

        {/* Central spine + VS medallion */}
        <div
          style={{
            position: "absolute",
            top: p ? "50%" : 0,
            bottom: p ? "50%" : 0,
            left: p ? 0 : "50%",
            right: p ? 0 : "auto",
            transform: p ? "translateY(-50%)" : "translateX(-50%)",
            width: p ? "100%" : 2,
            height: p ? 2 : "100%",
            background: `linear-gradient(${p ? "to right" : "to bottom"}, transparent 0%, ${textColor}55 15%, ${textColor}55 85%, transparent 100%)`,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${medScale})`,
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: p ? 90 : 110,
              height: p ? 90 : 110,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accentColor} 0%, #8A6510 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F8EFD6",
              fontFamily: CHRONICLE_HEADING_FONT,
              fontWeight: 900,
              fontSize: p ? 28 : 34,
              letterSpacing: "0.05em",
              boxShadow: "0 6px 18px rgba(40,25,12,0.5), inset 0 0 0 3px rgba(40,25,12,0.3), inset 0 0 0 4px rgba(250,230,170,0.6)",
              textShadow: "1px 1px 0 rgba(40,25,12,0.6)",
            }}
          >
            vs.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
