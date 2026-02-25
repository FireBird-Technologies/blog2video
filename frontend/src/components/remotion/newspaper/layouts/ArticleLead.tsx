import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * ArticleLead — opening paragraph reveal.
 *
 * Animation (30 fps):
 *  0-14   top rule draws + section label fades
 *  10-26  drop cap appears
 *  18-70  article body typewriters in (narration prop)
 *  52-72  pull-stat card slides in from right
 *  64-80  pull-stat number counts up
 *
 * Props:
 *  title           = article section / label (e.g. "The Story")
 *  narration       = article lead paragraph text
 *  stats[0].value  = pull-stat number (e.g. "47%")
 *  stats[0].label  = pull-stat caption (e.g. "of Americans affected")
 *  accentColor     = highlight color (default yellow)
 */
export const ArticleLead: React.FC<BlogLayoutProps> = ({
  title = "The Story",
  narration = "Lawmakers failed to pass a short-term spending bill before the midnight deadline, triggering a partial shutdown affecting hundreds of thousands of federal workers.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const pullVal = stats?.[0]?.value ?? "";
  const pullCap = stats?.[0]?.label ?? "";

  // Animations
  const ruleW     = interpolate(frame, [0, 16],  [0, 100], { extrapolateRight: "clamp" });
  const labelOp   = interpolate(frame, [6, 20],  [0, 1],   { extrapolateRight: "clamp" });
  const dropCapOp = interpolate(frame, [10, 26], [0, 1],   { extrapolateRight: "clamp" });
  const dropCapY  = interpolate(frame, [10, 26], [16, 0],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Typewriter: body text reveals character by character
  const bodyProgress = interpolate(frame, [20, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visChars     = Math.floor(narration.length * bodyProgress);
  const visText      = narration.slice(0, visChars);
  const showCursor   = visChars < narration.length;

  // Pull stat
  const pullSlide = interpolate(frame, [54, 72], [80, 0],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pullOp    = interpolate(frame, [54, 70], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pullNumP  = interpolate(frame, [66, 82], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Try to animate numeric pull value if it's a number/percent
  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum      = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix    = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum  = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal   = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  // Drop cap: first character of narration
  const dropChar = narration[0] ?? "";
  const bodyText = narration.slice(1);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "7% 6%" : "6% 9%",
        }}
      >
        {/* Top rule + section label */}
        <div style={{ marginBottom: p ? 18 : 24 }}>
          <div style={{ height: 3, background: textColor, width: `${ruleW}%`, marginBottom: 10 }} />
          <div
            style={{
              fontFamily: B_FONT,
              fontSize: titleFontSize ?? (p ? 14 : 16),
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: textColor,
              opacity: labelOp,
            }}
          >
            {title}
          </div>
        </div>

        {/* Article body layout */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 20 : 40,
            alignItems: "flex-start",
          }}
        >
          {/* Body text with drop cap */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: B_FONT,
                fontSize: descriptionFontSize ?? (p ? 20 : 24),
                color: textColor,
                lineHeight: 1.65,
              }}
            >
              {/* Drop cap */}
              <span
                style={{
                  float: "left",
                  fontFamily: H_FONT,
                  fontSize: p ? 72 : 92,
                  fontWeight: 700,
                  lineHeight: 0.78,
                  marginRight: 8,
                  marginTop: 6,
                  color: textColor,
                  opacity: dropCapOp,
                  transform: `translateY(${dropCapY}px)`,
                  display: "inline-block",
                }}
              >
                {dropChar}
              </span>

              {/* Body text typewriter */}
              <span>
                {visText.length > 1 ? visText.slice(1) : ""}
                {showCursor && visChars > 0 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: "1em",
                      background: textColor,
                      opacity: 0.5,
                      marginLeft: 2,
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </span>
            </div>
          </div>

          {/* Pull stat — right side */}
          {pullVal && (
            <div
              style={{
                width: p ? "100%" : 200,
                flexShrink: 0,
                opacity: pullOp,
                transform: `translateX(${pullSlide}px)`,
                borderLeft: `4px solid ${accentColor}`,
                paddingLeft: 18,
                paddingTop: 4,
                paddingBottom: 4,
                alignSelf: p ? "flex-start" : "center",
              }}
            >
              <div
                style={{
                  fontFamily: H_FONT,
                  fontSize: p ? 52 : 64,
                  fontWeight: 700,
                  color: textColor,
                  lineHeight: 1,
                  marginBottom: 8,
                }}
              >
                {displayVal}
              </div>
              {pullCap && (
                <div
                  style={{
                    fontFamily: B_FONT,
                    fontSize: p ? 14 : 16,
                    color: textColor,
                    opacity: 0.68,
                    lineHeight: 1.4,
                  }}
                >
                  {pullCap}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
