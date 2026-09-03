import React from "react";
import { useVideoConfig } from "remotion";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  MAG_TEXTURES,
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
import { useFitText as useFitTextBudget, useAvailableHeight } from "../components/useFitText";

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
  const { height } = useVideoConfig();
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

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and the before/after bullets are unbounded user input; long copy ran
     across the gutter and off the bottom of the spread. Fit both to the page. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitBodyRef = React.useRef<HTMLUListElement>(null);
  const colRef = React.useRef<HTMLDivElement>(null);
  const bodyTarget = descriptionFontSize ?? (p ? 52 : 46);
  const titleTarget = titleFontSize ?? (p ? 92 : 95);
  const { px: titlePx } = useFitTextBudget(fitTitleRef, titleTarget, Math.round(titleTarget * 0.32),
    [title, titleTarget, p, height], Math.round(height * 0.13));
  // The page sits under a camera transform, so a frame-height budget does not
  // map to page pixels — measure the real band the list sits in instead.
  const bodyAvail = useAvailableHeight(fitBodyRef, colRef, [narration, bodyTarget, titlePx, p]);
  const { px: bodyPx } = useFitTextBudget(fitBodyRef, bodyTarget, Math.round(bodyTarget * 0.6),
    [narration, bodyTarget, titlePx, p, bodyAvail], bodyAvail || undefined);
  const headPx = p ? 26 : 24;

  const Column = (header: string, points: string[], o: number, headerColor: string, start: number, listRef?: React.RefObject<HTMLUListElement>, boxRef?: React.RefObject<HTMLDivElement>) => (
    <div ref={boxRef} style={{ flex: 1, minHeight: 0, overflow: "hidden", opacity: o, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: p ? "0" : "0 8px" }}>
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
      <ul ref={listRef} style={{ listStyle: "none", margin: 0, padding: 0, minHeight: 0, height: "100%", flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column", gap: p ? 16 : 14 }}>
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
    <MagazinePage lightChrome colors={colors} section={(props.sectionLabel as string)?.trim() || "Comparison"} issue={props.issueLabel ?? "Analysis"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} cameraMove={props.cameraMove} hidePrintTexture={p} printTextureSrc={p ? MAG_TEXTURES.comparisonPortrait : MAG_TEXTURES.comparison} printTextureOpacity={0.3}>
      <div ref={fitTitleRef} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {title && (
          <h1
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: titlePx,
              lineHeight: 1.12,
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
            // Without minHeight:0 a flex child refuses to shrink below its
            // content, so the columns (and the fitter) never see a real bound
            // and long bullet copy ran off the bottom of the spread.
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 28 : 0,
            alignItems: "stretch",
            position: "relative",
          }}
        >
          {Column(leftHeader, leftPoints, leftO, accent, 16, fitBodyRef, colRef)}

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
