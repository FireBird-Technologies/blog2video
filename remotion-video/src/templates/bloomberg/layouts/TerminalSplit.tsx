import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useFitText } from "../components/useFitText";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY, derivePalette } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundGraph } from "./BackgroundGraph";

export const TerminalSplit: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  leftLabel = "BEFORE",
  rightLabel = "AFTER",
  leftDescription = "Previous baseline state with elevated risk and negative momentum.",
  rightDescription = "Recovery phase with improving breadth and positive risk appetite.",
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(bg, amber);

  const tSize = titleFontSize ?? (p ? 102 : 107);
  const dSize = descriptionFontSize ?? (p ? 45 : 41);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const leftOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const rightOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

  // Vertical spacing adjustments for "shortened" boxes
  const titleHeight = 80;
  const panelTopOffset = topH + titleHeight + 50; // Increased padding from 20 to 50
  const titleRef = React.useRef<HTMLDivElement>(null);
  const leftLabelRef = React.useRef<HTMLDivElement>(null);
  const rightLabelRef = React.useRef<HTMLDivElement>(null);
  const leftDescriptionRef = React.useRef<HTMLDivElement>(null);
  const rightDescriptionRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const labelTarget = tSize * (p ? 0.45 : 0.5);
  const descriptionTarget = dSize * (p ? 0.75 : 0.8);
  const { px: fittedTitleSize } = useFitText(titleRef, tSize * 0.6, p ? 30 : 28, [title, tSize, p], 145);
  const { px: fittedLeftLabelSize } = useFitText(leftLabelRef, labelTarget, 26, [leftLabel, labelTarget, p], p ? 90 : 120);
  const { px: fittedRightLabelSize } = useFitText(rightLabelRef, labelTarget, 26, [rightLabel, labelTarget, p], p ? 90 : 120);
  const { px: fittedLeftDescriptionSize } = useFitText(leftDescriptionRef, descriptionTarget, p ? 21 : 20, [leftDescription, descriptionTarget, p], p ? 125 : 260);
  const { px: fittedRightDescriptionSize } = useFitText(rightDescriptionRef, descriptionTarget, p ? 21 : 20, [rightDescription, descriptionTarget, p], p ? 125 : 260);
  const { px: fittedNarrationSize } = useFitText(narrationRef, dSize, p ? 22 : 20, [narration, dSize, p], p ? 150 : 100);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff, overflow: "hidden" }}>
      <BackgroundGraph accentColor={blue} textColor={amber} variant="split" />
      {/* Top bar */}
      <div ref={titleRef} style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,

      }}>
      </div>

      {/* NEW: Centered Title Section */}
      <div style={{
        position: "absolute",
        top: topH + 20,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: fittedTitleSize,
        lineHeight: 1.1,
        fontWeight: "bold",
        opacity: headerOpacity,
        textTransform: "uppercase"
      }}>
        <span style={{ backgroundColor: amber, color: bg, display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
      </div>

      {p ? (
        /* Portrait: stacked panels */
        <>
          {/* Left panel (Shortened) */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: pad, right: pad, height: "25%",
            backgroundColor: panelBg,
            border: `1px solid ${border}`,
            borderTop: `2px solid ${BLOOMBERG_COLORS.neg}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "20px 28px", opacity: leftOpacity,
          }}>
            <div style={{ color: muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 8 }}>PANEL A</div>
            <div ref={leftLabelRef} style={{ color: BLOOMBERG_COLORS.neg, fontSize: fittedLeftLabelSize, lineHeight: 1.1, marginBottom: 10, maxHeight: 90, overflow: "hidden", overflowWrap: "anywhere" }}>{leftLabel}</div>
            <div ref={leftDescriptionRef} style={{ color: amber, fontSize: fittedLeftDescriptionSize, lineHeight: 1.4, maxHeight: 125, overflow: "hidden", overflowWrap: "anywhere" }}>{leftDescription}</div>
          </div>

          {/* Right panel (Shortened) */}
          <div style={{
            position: "absolute", top: "58%", left: pad, right: pad, height: "25%",
            backgroundColor: panelBg,
            border: `1px solid ${border}`,
            borderTop: `2px solid ${blue}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "20px 28px", opacity: rightOpacity,
          }}>
            <div style={{ color: muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 8 }}>PANEL B</div>
            <div ref={rightLabelRef} style={{ color: blue, fontSize: fittedRightLabelSize, lineHeight: 1.1, marginBottom: 10, maxHeight: 90, overflow: "hidden", overflowWrap: "anywhere" }}>{rightLabel}</div>
            <div ref={rightDescriptionRef} style={{ color: amber, fontSize: fittedRightDescriptionSize, lineHeight: 1.4, maxHeight: 125, overflow: "hidden", overflowWrap: "anywhere" }}>{rightDescription}</div>
          </div>
        </>
      ) : (
        /* Landscape: side-by-side panels */
        <>
          {/* Left panel (Shortened height via bottom constraint) */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: pad, right: "51%", bottom: botH + 120,
            backgroundColor: panelBg,
            border: `1px solid ${border}`,
            borderTop: `2px solid ${BLOOMBERG_COLORS.neg}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "24px 36px", opacity: leftOpacity,
          }}>
            <div style={{ color: muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 12 }}>PANEL A</div>
            <div ref={leftLabelRef} style={{ color: BLOOMBERG_COLORS.neg, fontSize: fittedLeftLabelSize, lineHeight: 1.1, marginBottom: 14, maxHeight: 120, overflow: "hidden", overflowWrap: "anywhere" }}>{leftLabel}</div>
            <div ref={leftDescriptionRef} style={{ color: amber, fontSize: fittedLeftDescriptionSize, lineHeight: 1.5, maxHeight: 260, overflow: "hidden", overflowWrap: "anywhere" }}>{leftDescription}</div>
          </div>

          {/* Divider */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: "50%", transform: "translateX(-50%)",
            width: 2, bottom: botH + 120, backgroundColor: amber, opacity: 0.3,
          }} />

          {/* Right panel (Shortened height) */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: "51%", right: pad, bottom: botH + 120,
            backgroundColor: panelBg,
            border: `1px solid ${border}`,
            borderTop: `2px solid ${blue}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "24px 36px", opacity: rightOpacity,
          }}>
            <div style={{ color: muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 12 }}>PANEL B</div>
            <div ref={rightLabelRef} style={{ color: blue, fontSize: fittedRightLabelSize, lineHeight: 1.1, marginBottom: 14, maxHeight: 120, overflow: "hidden", overflowWrap: "anywhere" }}>{rightLabel}</div>
            <div ref={rightDescriptionRef} style={{ color: amber, fontSize: fittedRightDescriptionSize, lineHeight: 1.5, maxHeight: 260, overflow: "hidden", overflowWrap: "anywhere" }}>{rightDescription}</div>
          </div>
        </>
      )}

      {/* Narration footer - moved up slightly to account for smaller boxes */}
      <div ref={narrationRef} style={{
        position: "absolute", bottom: botH + 20, left: pad, right: pad,
        textAlign: "center",
        color: muted, fontSize: fittedNarrationSize, lineHeight: 1.3,
        maxHeight: p ? 150 : 100, overflow: "hidden", overflowWrap: "anywhere",
        opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {narration}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
      }}>
        <span style={{ color: muted, fontSize: labelSize, letterSpacing: 2 }}>
          COMPARISON
        </span>
      </div>
    </AbsoluteFill>
  );
};
