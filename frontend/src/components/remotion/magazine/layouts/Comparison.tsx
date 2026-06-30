import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  KineticWords,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
  gutterPx,
  useMagFrame,
} from "../magazineStyle";

// Normalise a points prop (object_array of { value } or string[]) to a clean
// string list. When absent, fall back to splitting the legacy paragraph copy
// into sentence bullets so older saved scenes still render.
const toPoints = (raw: unknown, fallbackText: string): string[] => {
  const pts = (Array.isArray(raw) ? raw : [])
    .map((x) => (typeof x === "string" ? x : (x as { value?: string })?.value ?? ""))
    .map((s) => s.trim())
    .filter(Boolean);
  if (pts.length) return pts.slice(0, 6);
  return (fallbackText || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
};

/**
 * Comparison spread — two columns split by a centre rule with a circular "VS"
 * marker, each headed by a tracked label and a bulleted list of short points.
 * Left header in accent, right in ink.
 */
export const Comparison: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const leftHeader = props.leftHeader ?? "Before";
  const rightHeader = props.rightHeader ?? "After";
  const leftPoints = toPoints(props.leftPoints, props.leftContent ?? narration ?? "");
  const rightPoints = toPoints(props.rightPoints, props.rightContent ?? "");
  const vsLabel = (props.vsLabel ?? "VS").trim() || "VS";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const frame = useMagFrame();
  const leftO = useReveal(8, 16);
  const rightO = useReveal(14, 16);
  const vsO = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vsScale = interpolate(frame, [10, 24], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bodyPx = descriptionFontSize ?? (p ? 52 : 30);
  const titlePx = titleFontSize ?? (p ? 92 : 93);
  const headPx = p ? 22 : 20;

  const Column = (header: string, points: string[], o: number, headerColor: string, start: number) => (
    <div style={{ flex: 1, opacity: o, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: p ? "0" : "0 8px" }}>
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
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: p ? 16 : 14 }}>
        {points.map((pt, i) => {
          const bo = interpolate(frame, [start + i * 4, start + i * 4 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <li key={i} style={{ opacity: bo, display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span style={{ flexShrink: 0, width: bodyPx * 0.42, height: bodyPx * 0.42, marginTop: bodyPx * 0.5, background: accent }} />
              <span style={{ fontFamily: MAG_SERIF, fontSize: bodyPx, lineHeight: 1.45, color: text, opacity: 0.92 }}>
                {pt}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <MagazinePage colors={colors} section="Comparison" issue={props.issueLabel ?? "Analysis"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} cameraMove={props.cameraMove}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {title && (
          <h1
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: titlePx,
              lineHeight: 1.06,
              letterSpacing: "-0.015em",
              color: text,
              margin: "0 0 30px",
              textAlign: "left",
            }}
          >
            <KineticWords text={title} start={2} stagger={2} dur={14} />
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
          {Column(leftHeader, leftPoints, leftO, accent, 16)}

          {/* Centre divider — gap matches the binding so neither column's copy
              lands on the hinge */}
          {!p && <div style={{ width: 1, background: `${text}22`, margin: `0 ${gutterPx(props.aspectRatio) / 2}px` }} />}
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
            {vsLabel}
          </div>

          {Column(rightHeader, rightPoints, rightO, text, 24)}
        </div>
      </div>
    </MagazinePage>
  );
};
