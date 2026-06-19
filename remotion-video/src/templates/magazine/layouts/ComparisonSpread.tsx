import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
} from "../magazineStyle";

/**
 * Comparison spread — two columns split by a centre rule with a circular "VS"
 * marker, each headed by a tracked label. Left header in accent, right in ink.
 */
export const ComparisonSpread: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, descriptionFontSize } = props;
  const leftHeader = (props.leftHeader as string) ?? "Before";
  const rightHeader = (props.rightHeader as string) ?? "After";
  const leftContent = (props.leftContent as string) ?? narration ?? "";
  const rightContent = (props.rightContent as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const frame = useCurrentFrame();
  const titleO = useReveal(2, 12);
  const leftO = useReveal(8, 16);
  const rightO = useReveal(14, 16);
  const vsO = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vsScale = interpolate(frame, [10, 24], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bodyPx = descriptionFontSize ?? (p ? 24 : 21);
  const headPx = p ? 22 : 20;

  const Column = (header: string, content: string, o: number, headerColor: string) => (
    <div style={{ flex: 1, opacity: o, display: "flex", flexDirection: "column", padding: p ? "0" : "0 8px" }}>
      <div
        style={{
          fontFamily: MAG_SANS,
          fontWeight: 800,
          fontSize: headPx,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: headerColor,
          marginBottom: 14,
        }}
      >
        {header}
      </div>
      <div style={{ height: 3, width: 56, background: headerColor, marginBottom: 22 }} />
      <p style={{ fontFamily: MAG_SERIF, fontSize: bodyPx, lineHeight: 1.58, color: text, margin: 0, opacity: 0.92 }}>
        {content}
      </p>
    </div>
  );

  return (
    <MagazinePage colors={colors} section="Comparison" issue={props.issueLabel ?? "Analysis"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {title && (
          <h1
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: p ? 48 : 52,
              lineHeight: 1.06,
              letterSpacing: "-0.015em",
              color: text,
              margin: "0 0 30px",
              opacity: titleO,
              textAlign: p ? "left" : "center",
            }}
          >
            {title}
          </h1>
        )}

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 28 : 0,
            alignItems: "stretch",
            position: "relative",
          }}
        >
          {Column(leftHeader, leftContent, leftO, accent)}

          {/* Centre divider */}
          {!p && <div style={{ width: 1, background: `${text}22`, margin: "0 56px" }} />}
          {p && <div style={{ height: 1, background: `${text}22` }} />}

          {/* VS marker */}
          <div
            style={{
              position: "absolute",
              left: p ? "50%" : "50%",
              top: "50%",
              transform: `translate(-50%, -50%) scale(${vsScale})`,
              opacity: vsO,
              width: p ? 60 : 72,
              height: p ? 60 : 72,
              borderRadius: "50%",
              background: accent,
              color: bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MAG_SANS,
              fontWeight: 800,
              fontSize: p ? 22 : 26,
              letterSpacing: "0.04em",
              boxShadow: `0 0 0 8px ${bg}`,
            }}
          >
            VS
          </div>

          {Column(rightHeader, rightContent, rightO, text)}
        </div>
      </div>
    </MagazinePage>
  );
};
