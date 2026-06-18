import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const PerspectiveSplit: React.FC<BlogLayoutProps> = ({
  title = "Two Perspectives",
  narration,
  leftThought = "This policy creates opportunity and drives long-term economic growth for everyone.",
  rightThought = "The costs are too high and the benefits too uncertain to justify moving forward now.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  category,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const leftLabel = stats?.[0]?.label ?? "PERSPECTIVE A";
  const leftStat = stats?.[0]?.value ?? "";
  const rightLabel = stats?.[1]?.label ?? "PERSPECTIVE B";
  const rightStat = stats?.[1]?.value ?? "";

  const titleSize = titleFontSize ?? (p ? 58 : 38);
  const descSize = descriptionFontSize ?? (p ? 25 : 17);

  // Shard entrance wipe: two panels slide in from left/right
  const shardProgress = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: "clamp" });
  const leftShardX = interpolate(shardProgress, [0, 1], [-width, 0]);
  const rightShardX = interpolate(shardProgress, [0, 1], [width, 0]);

  // Exit: shards expand outward (inverse wipe)
  const EXIT_START = durationInFrames - 30;
  const exitProgress = interpolate(frame, [EXIT_START, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shardScale = interpolate(exitProgress, [0, 1], [1, 4]);
  const leftExitX = interpolate(exitProgress, [0, 1], [0, -width * 0.7]);
  const rightExitX = interpolate(exitProgress, [0, 1], [0, width * 0.7]);
  const contentOpacity = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Category badge & title
  const categoryOp = interpolate(frame, [28, 42], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 22], [0, 100], { extrapolateRight: "clamp" });

  // Panel entrances
  const leftPanelOp = interpolate(frame, [35, 48], [0, 1], { extrapolateRight: "clamp" });
  const leftPanelX = interpolate(frame, [35, 48], [-40, 0], { extrapolateRight: "clamp" });
  const rightPanelOp = interpolate(frame, [38, 52], [0, 1], { extrapolateRight: "clamp" });
  const rightPanelX = interpolate(frame, [38, 52], [40, 0], { extrapolateRight: "clamp" });

  // Badge highlight sweep (from FactCheck)
  const hlSweepLeft = interpolate(frame, [40, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hlSweepRight = interpolate(frame, [48, 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const badgeHL = (color: string, sweep: number) => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundSize: `${sweep * 100}% 100%`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "0 0",
  });

  // Word reveals for left and right thoughts
  const leftWords = (leftThought ?? "").split(" ");
  const rightWords = (rightThought ?? "").split(" ");
  const leftWordP = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightWordP = interpolate(frame, [58, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leftVisWords = Math.ceil(leftWords.length * leftWordP);
  const rightVisWords = Math.ceil(rightWords.length * rightWordP);

  // Stat badges spring in
  const leftStatSpring = spring({ frame: Math.max(0, frame - 65), fps, config: { stiffness: 120, damping: 14 } });
  const rightStatSpring = spring({ frame: Math.max(0, frame - 72), fps, config: { stiffness: 120, damping: 14 } });

  // Narration
  const narrationOp = interpolate(frame, [85, 100], [0, 1], { extrapolateRight: "clamp" });
  const narrationY = interpolate(frame, [85, 100], [12, 0], { extrapolateRight: "clamp" });

  const panelStyle = (side: "left" | "right"): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    // Landscape: card width grows with its content (up to a cap) so longer
    // thoughts expand the card horizontally rather than pushing it taller and
    // crowding the centered title. Portrait: full-width stacked cards.
    width: p ? "100%" : "fit-content",
    minWidth: p ? undefined : "40%",
    maxWidth: p ? "100%" : "78%",
    alignSelf: p ? "stretch" : side === "right" ? "flex-start" : "flex-end",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderLeft: side === "left" ? `6px solid ${accentColor}` : "none",
    borderRight: side === "right" ? `6px solid ${textColor}` : "none",
    padding: p ? "5% 6%" : "3% 4%",
    overflow: "hidden",
    opacity: side === "left" ? leftPanelOp : rightPanelOp,
    transform: `translateX(${side === "left" ? leftPanelX : rightPanelX}px)`,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000" }}>
      <NewsBackground bgColor={bgColor} />
      <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2, pointerEvents: "none" }} />

      {/* Entrance shard wipe — left */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: width / 2,
          height,
          objectFit: "cover",
          opacity: 0.32,
          filter: "grayscale(75%) contrast(1.08)",
          zIndex: 1,
          transform: `translateX(${leftShardX + leftExitX}px) scale(${shardScale})`,
          transformOrigin: "left center",
        }}
      />
      {/* Entrance shard wipe — right */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: width / 2,
          height,
          objectFit: "cover",
          opacity: 0.32,
          filter: "grayscale(75%) contrast(1.08)",
          zIndex: 1,
          transform: `translateX(${rightShardX + rightExitX}px) scale(${shardScale})`,
          transformOrigin: "right center",
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "8% 6%" : "4% 7%",
          gap: p ? 16 : 20,
          zIndex: 10,
          opacity: contentOpacity,
          transform: "translateZ(40px)",
        }}
      >
        {/* Diagonal stack: right card (top), title (center), left card (bottom).
            In portrait the cards swap roles: left card on top, right card at bottom. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: p ? 16 : 12,
            overflow: "hidden",
          }}
        >
          {/* TOP CARD — right panel in landscape, left panel in portrait */}
          {p ? (
            <div style={panelStyle("left")}>
              {/* Label with sweep */}
              <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: textColor, ...badgeHL(accentColor, hlSweepLeft), padding: "4px 8px", marginBottom: 14 }}>
                {leftLabel}
              </div>

              {/* Left thought word-reveal */}
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontSize: descSize, fontWeight: 500, color: textColor, lineHeight: 1.4, fontStyle: "italic", flex: 1 }}>
                "{leftWords.slice(0, leftVisWords).join(" ")}
                {leftVisWords < leftWords.length && leftVisWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.8em", background: textColor, opacity: 0.45, marginLeft: 3, verticalAlign: "middle" }} />
                )}"
              </div>

              {/* Left stat badge */}
              {leftStat && (
                <div style={{ marginTop: 16, opacity: leftStatSpring, transform: `scale(${leftStatSpring})`, transformOrigin: "bottom left" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 16, color: textColor, lineHeight: 1 }}>{leftStat}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={panelStyle("right")}>
              {/* Label with sweep */}
              <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: textColor, border: `1.5px solid ${textColor}`, ...badgeHL(`${textColor}18`, hlSweepRight), padding: "4px 8px", marginBottom: 14 }}>
                {rightLabel}
              </div>

              {/* Right thought word-reveal */}
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descSize, fontWeight: 500, color: textColor, lineHeight: 1.45, flex: 1 }}>
                {rightWords.slice(0, rightVisWords).join(" ")}
                {rightVisWords < rightWords.length && rightVisWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.8em", background: textColor, opacity: 0.45, marginLeft: 3, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Right stat badge */}
              {rightStat && (
                <div style={{ marginTop: 16, opacity: rightStatSpring, transform: `scale(${rightStatSpring})`, transformOrigin: "bottom right", alignSelf: "flex-end" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 16, color: textColor, lineHeight: 1, textAlign: "right" }}>{rightStat}</div>
                </div>
              )}
            </div>
          )}

          {/* CENTER — category badge + title + rule */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            {category && (
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: textColor, opacity: categoryOp * 0.65, marginBottom: 8 }}>
                {category}
              </div>
            )}
            <div style={{ opacity: titleOp }}>
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontSize: titleSize, fontWeight: 800, color: textColor, lineHeight: 1.05, letterSpacing: "-0.01em" }}>
                {title}
              </div>
              <div style={{ height: 3, background: textColor, opacity: 0.18, width: `${ruleW}%`, maxWidth: 220, margin: "10px auto 0" }} />
            </div>
          </div>

          {/* BOTTOM CARD — left panel in landscape, right panel in portrait */}
          {p ? (
            <div style={panelStyle("right")}>
              {/* Label with sweep */}
              <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: textColor, border: `1.5px solid ${textColor}`, ...badgeHL(`${textColor}18`, hlSweepRight), padding: "4px 8px", marginBottom: 14 }}>
                {rightLabel}
              </div>

              {/* Right thought word-reveal */}
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descSize, fontWeight: 500, color: textColor, lineHeight: 1.45, flex: 1 }}>
                {rightWords.slice(0, rightVisWords).join(" ")}
                {rightVisWords < rightWords.length && rightVisWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.8em", background: textColor, opacity: 0.45, marginLeft: 3, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Right stat badge */}
              {rightStat && (
                <div style={{ marginTop: 16, opacity: rightStatSpring, transform: `scale(${rightStatSpring})`, transformOrigin: "bottom right", alignSelf: "flex-end" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 16, color: textColor, lineHeight: 1, textAlign: "right" }}>{rightStat}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={panelStyle("left")}>
              {/* Label with sweep */}
              <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: textColor, ...badgeHL(accentColor, hlSweepLeft), padding: "4px 8px", marginBottom: 14 }}>
                {leftLabel}
              </div>

              {/* Left thought word-reveal */}
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontSize: descSize, fontWeight: 500, color: textColor, lineHeight: 1.4, fontStyle: "italic", flex: 1 }}>
                "{leftWords.slice(0, leftVisWords).join(" ")}
                {leftVisWords < leftWords.length && leftVisWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.8em", background: textColor, opacity: 0.45, marginLeft: 3, verticalAlign: "middle" }} />
                )}"
              </div>

              {/* Left stat badge */}
              {leftStat && (
                <div style={{ marginTop: 16, opacity: leftStatSpring, transform: `scale(${leftStatSpring})`, transformOrigin: "bottom left" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 16, color: textColor, lineHeight: 1 }}>{leftStat}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editor's narration note */}
        {narration && (
          <div
            style={{
              transform: `translateY(${narrationY}px)`,
              paddingTop: 14,
              borderTop: `3px solid ${accentColor}`,
              fontFamily: fontFamily ?? B_FONT,
              fontSize: descSize - 4,
              fontWeight: 500,
              color: textColor,
              opacity: narrationOp * 0.85,
              lineHeight: 1.45,
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
