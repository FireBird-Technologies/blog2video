import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { NightfallClip } from "../components/NightfallClip";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassNarrativeV2 — "Editorial Stack"
 *
 * Variant of `glass_narrative`. Same props, different composition.
 *
 * Base wraps everything in one glass card with the image inset at 42%. This one
 * is built as two OVERLAPPING planes rather than a side-by-side split:
 *
 *   - the visual is a tall plate bled off the top and left edges, cropped on a
 *     diagonal so it never reads as a rectangle sitting in a box;
 *   - the copy rides a glass slab that OVERLAPS that plate's inner edge, casting
 *     a shadow onto it, so the two planes are layered in depth instead of
 *     abutting;
 *   - a numbered index marker and a rule run up the slab's outer margin.
 *
 * The drop cap is the template's signature so it stays, but it is set INTO the
 * slab's margin against the rule rather than floating inside a card.
 */
export const GlassNarrativeV2: React.FC<NightfallLayoutProps> = ({
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
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const font = fontFamily ?? "'Playfair Display', Georgia, serif";
  const hasImage = !!(imageUrl || videoUrl);

  // Plate bleeds in from the edge it hangs off.
  const plateIn = spring({
    frame: frame - 1,
    fps,
    config: { damping: 26, stiffness: 62, mass: 1.2 },
  });
  const plateOpacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  // Slow drift keeps a still image alive for the whole scene.
  const plateDrift = interpolate(frame, [0, 240], [1.1, 1.0], { extrapolateRight: "clamp" });

  // Slab lands after the plate so the overlap reads as a second plane arriving.
  const slabIn = spring({
    frame: frame - 12,
    fps,
    config: { damping: 24, stiffness: 68, mass: 1.1 },
  });
  const slabOpacity = interpolate(frame, [12, 38], [0, 1], { extrapolateRight: "clamp" });

  const ruleGrow = interpolate(frame, [22, 52], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [24, 48], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [24, 48], [22, 0], { extrapolateRight: "clamp" });
  const bodyOpacity = interpolate(frame, [38, 64], [0, 1], { extrapolateRight: "clamp" });
  const bodyY = interpolate(frame, [38, 64], [16, 0], { extrapolateRight: "clamp" });

  // Guarded: `narration` is typed required, but scenes built from partial
  // layoutProps can still arrive without it, and an unguarded .split() there
  // takes down the whole composition.
  const paragraphs = (narration ?? "").split("\n").filter((s) => s.trim());
  const dropSize = p ? 104 : 124;

  const visualStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
    objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
    transform: `scale(${imageZoom ?? 1})`,
    transformOrigin:
      (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
    display: "block",
  };

  // Diagonal cut on the plate's inner edge — the shape that stops this reading
  // as a plain two-column split. Portrait cuts across the bottom instead.
  const plateClip = p
    ? "polygon(0 0, 100% 0, 100% 88%, 0 100%)"
    : "polygon(0 0, 100% 0, 86% 100%, 0 100%)";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      {/* Bloom behind the overlap seam */}
      <div
        style={{
          position: "absolute",
          ...(p
            ? { top: "42%", left: 0, right: 0, height: 320, transform: "translateY(-50%)" }
            : { left: "46%", top: 0, bottom: 0, width: 380, transform: "translateX(-50%)" }),
          background: `radial-gradient(ellipse at center, ${accentColor}26 0%, transparent 70%)`,
          filter: "blur(70px)",
          opacity: plateOpacity,
        }}
      />

      {/* ── Plane 1: the bled, diagonally-cut plate ── */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            ...(p
              ? { top: 0, left: 0, right: 0, height: "52%" }
              : { top: 0, bottom: 0, left: 0, width: "56%" }),
            clipPath: plateClip,
            overflow: "hidden",
            opacity: plateOpacity,
            transform: p
              ? `translateY(${(1 - plateIn) * -70}px)`
              : `translateX(${(1 - plateIn) * -90}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${plateDrift})`,
              transformOrigin: "center center",
            }}
          >
            {videoUrl ? (
              <NightfallClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={visualStyle}
              />
            ) : (
              <Img src={imageUrl!} style={visualStyle} />
            )}
          </div>
          {/* Grade toward the slab so the planes join in shadow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: p
                ? `linear-gradient(180deg, ${accentColor}10 0%, transparent 35%, ${bgColor}D9 100%)`
                : `linear-gradient(90deg, ${accentColor}10 0%, transparent 40%, ${bgColor}D9 100%)`,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* ── Plane 2: the copy slab, overlapping the plate's inner edge ── */}
      <div
        style={{
          position: "absolute",
          ...(p
            ? { top: "44%", left: 30, right: 30, bottom: 46 }
            : hasImage
              ? { left: "44%", right: 64, top: 84, bottom: 84 }
              : { left: 130, right: 130, top: 96, bottom: 96 }),
          display: "flex",
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.055)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 18,
          // The cast shadow is what makes the slab read as sitting ON the plate.
          boxShadow: `0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px ${accentColor}1A`,
          padding: p ? "36px 30px" : "56px 58px",
          opacity: slabOpacity,
          transform: p
            ? `translateY(${(1 - slabIn) * 60}px)`
            : `translateX(${(1 - slabIn) * 70}px)`,
        }}
      >
        {/* Top accent line, matching the base card's signature detail */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "12%",
            width: "76%",
            height: 2,
            background: `linear-gradient(90deg, transparent, ${accentColor}70, transparent)`,
            opacity: slabOpacity,
          }}
        />

        <div style={{ position: "relative", width: "100%", paddingLeft: p ? 30 : 44 }}>
          {/* Margin rule + index marker running up the slab's outer edge */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 2,
              height: `${ruleGrow * 100}%`,
              background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}18 100%)`,
              boxShadow: `0 0 20px ${accentColor}70`,
            }}
          />

          <h2
            style={{
              fontSize: titleFontSize ?? (p ? 58 : 62),
              fontWeight: 700,
              color: textColor,
              fontFamily: font,
              lineHeight: 1.13,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: p ? 20 : 26,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {title}
          </h2>

          <div
            style={{
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
              fontSize: descriptionFontSize ?? (p ? 34 : 31),
              lineHeight: 1.7,
              color: `${textColor}CC`,
              fontFamily: font,
            }}
          >
            {paragraphs.map((para, i) => {
              const firstLetter = i === 0 ? para[0] : null;
              const rest = i === 0 ? para.slice(1) : para;
              return (
                <p key={i} style={{ margin: 0, marginBottom: i < paragraphs.length - 1 ? 20 : 0 }}>
                  {firstLetter && (
                    <span
                      style={{
                        float: "left",
                        // Set INTO the margin, against the rule.
                        marginLeft: p ? -26 : -38,
                        marginRight: p ? 14 : 18,
                        marginTop: 4,
                        fontSize: dropSize,
                        lineHeight: 0.8,
                        fontFamily: font,
                        color: accentColor,
                        fontWeight: 700,
                        textShadow: `0 0 36px ${accentColor}60, 0 0 72px ${accentColor}30`,
                      }}
                    >
                      {firstLetter}
                    </span>
                  )}
                  {rest}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
