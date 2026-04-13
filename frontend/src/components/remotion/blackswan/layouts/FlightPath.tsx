import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";

// Righteous — same family as DropletIntro
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

function derivePhrases(narration: string, count = 4): string[] {
  const fromComma = narration.split(/[,;|]/).map((s) => s.trim()).filter((s) => s.length > 1);
  if (fromComma.length >= 2) return fromComma.slice(0, count);
  return narration.split(/[.!?]/).map((s) => s.trim()).filter(Boolean).slice(0, count);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ── Node component ──────────────────────────────────────────────────────────
const PathNode: React.FC<{
  index: number;
  label: string;
  desc: string;
  accentColor: string;
  textColor: string;
  nodeD: number;
  numFS: number;
  labelFS: number;
  descFS: number;
  fontFamily?: string;
  opacity: number;
  translateY: number;
}> = ({ index, label, desc, accentColor, textColor, nodeD, numFS, labelFS, descFS, fontFamily, opacity, translateY }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: Math.round(descFS * 0.5),
      opacity,
      transform: `translateY(${translateY}px)`,
      flex: "0 0 auto",
      minWidth: nodeD * 3,
      maxWidth: nodeD * 4.5,
    }}
  >
    {/* Circle */}
    <div
      style={{
        width: nodeD,
        height: nodeD,
        borderRadius: "50%",
        border: `2px solid ${accentColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        boxShadow: `0 0 ${nodeD * 0.4}px ${accentColor}44, inset 0 0 ${nodeD * 0.2}px ${accentColor}11`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: numFS, color: accentColor, fontFamily: fontFamily ?? mono, fontWeight: 400 }}>
        {index + 1}
      </span>
    </div>

    {/* Label */}
    <span
      style={{
        fontSize: labelFS,
        color: accentColor,
        fontFamily: fontFamily ?? display,
        fontWeight: 400,
        textAlign: "center",
        letterSpacing: "0.04em",
        lineHeight: 1.2,
        textShadow: `0 0 8px ${accentColor}66`,
      }}
    >
      {label}
    </span>

    {/* Description */}
    {desc && (
      <span
        style={{
          fontSize: descFS,
          color: textColor,
          fontFamily: fontFamily ?? mono,
          fontWeight: 400,
          textAlign: "center",
          lineHeight: 1.5,
          opacity: 0.75,
          letterSpacing: "0.02em",
        }}
      >
        {desc}
      </span>
    )}
  </div>
);

// ── Arrow component ──────────────────────────────────────────────────────────
const Arrow: React.FC<{
  dir?: "right" | "left" | "down";
  size: number;
  nodeD: number;
  accentColor: string;
  opacity?: number;
}> = ({ dir = "right", size, nodeD, accentColor, opacity = 0.5 }) => {
  const char = dir === "right" ? "→" : dir === "left" ? "←" : "↓";
  return (
    <div
      style={{
        fontSize: size,
        color: accentColor,
        opacity,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        // vertically center the arrow with the circle in its row
        paddingTop: dir === "down" ? 0 : `${Math.round((nodeD - size) / 2)}px`,
        alignSelf: dir === "down" ? "center" : "flex-start",
        lineHeight: 1,
      }}
    >
      {char}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────
export const FlightPath: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    phrases,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const pathPhrases = (phrases && phrases.length > 0 ? phrases : derivePhrases(narration, 8)).slice(0, 8);

  const titleOp = interpolate(frame, [0, 20],  [0, 1], { extrapolateRight: "clamp" });
  const titleY  = interpolate(frame, [0, 20],  [12, 0], { extrapolateRight: "clamp" });

  // ── Font/size tokens (all driven by the two sliders) ──
  const descFS  = descriptionFontSize ?? (p ? 32 : 27);
  const titleFS = titleFontSize ?? (p ? 74 : 80);
  const nodeD   = Math.round(descFS * 2.6);   // circle diameter
  const numFS   = Math.round(descFS * 0.95);  // number inside circle
  const labelFS = Math.round(descFS * 1.3);   // node label
  const arrowFS = Math.round(descFS * 1.6);   // arrow character

  const narrationFS = p ? Math.round(descFS * 0.9) : Math.round(descFS * 1.1); // Adjusted font size for narration
  const narrationOp = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });
  const narrationY = interpolate(frame, [80, 100], [15, 0], { extrapolateRight: "clamp" });

  // ── Parse each phrase into label + description ──
  const parsedPhrases = pathPhrases.map((step) => {
    const colonIdx = step.indexOf(":");
    return {
      label: colonIdx > 0 ? step.slice(0, colonIdx).trim() : step,
      desc:  colonIdx > 0 ? step.slice(colonIdx + 1).trim() : "",
    };
  });

  // ── Landscape: rows of ≤4 ──────────────────────────────────────────────────
  const landscapeRows = chunkArray(parsedPhrases, 4);

  // ── Portrait: zigzag rows of 2 ────────────────────────────────────────────
  const portraitRows = chunkArray(parsedPhrases, 2);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      {/* Gradient shade — blue at bottom, black at top (reverse of water shade) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${accentColor}22 0%, ${accentColor}11 45%, transparent 75%)`,
          opacity: 0.15,
          pointerEvents: "none",
        }}
      />

      {/* ── Title ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: p ? "18%" : "8%",
          paddingBottom: p ? 0 : "2%",
          paddingLeft: "6%",
          paddingRight: "6%",
          gap: p ? 14 : 16,
          zIndex: 2,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleFS,
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            lineHeight: 1.1,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {title}
        </h1>
        <div
          style={{
            height: 2,
            width: p ? 160 : 200,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
            flexShrink: 0,
          }}
        />
      </div>

      {/* ── Nodes ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: p ? "28%" : "24%",
          paddingBottom: p ? "30%" : "22%", // Adjusted paddingBottom for landscape to create margin
          paddingLeft: p ? "6%" : "5%",
          paddingRight: p ? "6%" : "5%",
          gap: p ? Math.round(descFS * 0.75) : Math.round(descFS * 1.15),
          zIndex: 1,
        }}
      >
        {/* ── LANDSCAPE ──────────────────────────────────────────────────── */}
        {!p && landscapeRows.map((rowItems, rowIdx) => {
          const globalOffset = rowIdx * 4;
          return (
            <React.Fragment key={`row-${rowIdx}`}>
              {/* Row of nodes + arrows */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  gap: Math.round(descFS * 0.6),
                  width: "100%",
                }}
              >
                {rowItems.map((item, i) => {
                  const globalIdx = globalOffset + i;
                  const nodeOp = interpolate(frame, [15 + globalIdx * 7, 35 + globalIdx * 7], [0, 1], { extrapolateRight: "clamp" });
                  const nodeY  = interpolate(frame, [15 + globalIdx * 7, 35 + globalIdx * 7], [14, 0], { extrapolateRight: "clamp" });
                  return (
                    <React.Fragment key={`node-${globalIdx}`}>
                      <PathNode
                        index={globalIdx}
                        label={item.label}
                        desc={item.desc}
                        accentColor={accentColor}
                        textColor={textColor}
                        nodeD={nodeD}
                        numFS={numFS}
                        labelFS={labelFS}
                        descFS={descFS}
                        fontFamily={fontFamily}
                        opacity={nodeOp}
                        translateY={nodeY}
                      />
                      {i < rowItems.length - 1 && (
                        <Arrow dir="right" size={arrowFS} nodeD={nodeD} accentColor={accentColor} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Down-arrow connector between rows */}
              {rowIdx < landscapeRows.length - 1 && (
                <Arrow dir="down" size={arrowFS} nodeD={nodeD} accentColor={accentColor} opacity={0.4} />
              )}
            </React.Fragment>
          );
        })}

        {/* ── PORTRAIT — 3-col grid: horizontal arrows in center column; ↓ aligned under step 2 / 4 / … (exit column before next row) */}
        {p && portraitRows.map((rowItems, rowIdx) => {
          const globalOffset = rowIdx * 2;
          const isOddRow = rowIdx % 2 === 1;
          const gapPx = Math.round(descFS * 0.8);
          const midW = gapPx + Math.round(arrowFS * 1.1);
          const gridStyle: React.CSSProperties = {
            display: "grid",
            gridTemplateColumns: `minmax(0,1fr) ${midW}px minmax(0,1fr)`,
            width: "100%",
            maxWidth: 720,
            alignItems: "start",
            justifyItems: "center",
          };
          const arrowPadTop = Math.max(0, Math.round((nodeD - arrowFS) / 2));

          const renderNode = (globalIdx: number, item: { label: string; desc: string }) => {
            const nodeOp = interpolate(frame, [15 + globalIdx * 7, 35 + globalIdx * 7], [0, 1], { extrapolateRight: "clamp" });
            const nodeYAnim = interpolate(frame, [15 + globalIdx * 7, 35 + globalIdx * 7], [14, 0], { extrapolateRight: "clamp" });
            return (
              <PathNode
                key={`pnode-${globalIdx}`}
                index={globalIdx}
                label={item.label}
                desc={item.desc}
                accentColor={accentColor}
                textColor={textColor}
                nodeD={nodeD}
                numFS={numFS}
                labelFS={labelFS}
                descFS={descFS}
                fontFamily={fontFamily}
                opacity={nodeOp}
                translateY={nodeYAnim}
              />
            );
          };

          const hasTwo = rowItems.length > 1;
          let leftIdx: number;
          let rightIdx: number;
          let leftItem: (typeof parsedPhrases)[0];
          let rightItem: (typeof parsedPhrases)[0] | undefined;

          if (!hasTwo) {
            leftIdx = globalOffset;
            rightIdx = globalOffset;
            leftItem = rowItems[0];
            rightItem = undefined;
          } else if (isOddRow) {
            leftIdx = globalOffset + 1;
            rightIdx = globalOffset;
            leftItem = rowItems[1];
            rightItem = rowItems[0];
          } else {
            leftIdx = globalOffset;
            rightIdx = globalOffset + 1;
            leftItem = rowItems[0];
            rightItem = rowItems[1];
          }

          // 2→3: ↓ under column of step 2 (right). 4→5: ↓ under step 4 (left on reversed row). Single step: ↓ centered.
          const downCol: 1 | 2 | 3 = !hasTwo ? 2 : isOddRow ? 1 : 3;

          return (
            <React.Fragment key={`prow-${rowIdx}`}>
              <div style={gridStyle}>
                {hasTwo ? (
                  <>
                    {renderNode(leftIdx, leftItem)}
                    <div style={{ display: "flex", justifyContent: "center", width: "100%", paddingTop: arrowPadTop }}>
                      <Arrow dir={isOddRow ? "left" : "right"} size={arrowFS} nodeD={nodeD} accentColor={accentColor} />
                    </div>
                    {renderNode(rightIdx, rightItem!)}
                  </>
                ) : (
                  <>
                    <div />
                    {renderNode(leftIdx, leftItem)}
                    <div />
                  </>
                )}
              </div>

              {rowIdx < portraitRows.length - 1 && (
                <div
                  style={{
                    ...gridStyle,
                    marginTop: Math.round(descFS * 0.35),
                    marginBottom: Math.round(descFS * 0.15),
                  }}
                >
                  {downCol === 1 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                        <Arrow dir="down" size={arrowFS} nodeD={nodeD} accentColor={accentColor} opacity={0.45} />
                      </div>
                      <div />
                      <div />
                    </>
                  )}
                  {downCol === 2 && (
                    <>
                      <div />
                      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                        <Arrow dir="down" size={arrowFS} nodeD={nodeD} accentColor={accentColor} opacity={0.45} />
                      </div>
                      <div />
                    </>
                  )}
                  {downCol === 3 && (
                    <>
                      <div />
                      <div />
                      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                        <Arrow dir="down" size={arrowFS} nodeD={nodeD} accentColor={accentColor} opacity={0.45} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Narration Text ────────────────────────────────────────────────── */}
      {narration && (
        <div
          style={{
            position: "absolute",
            bottom: p ? "20%" : "15%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center", // Center horizontally
            alignItems: "center",
            padding: "0 8%", // Horizontal padding
            zIndex: 2,
            opacity: narrationOp,
            transform: `translateY(${narrationY}px)`,
            pointerEvents: "none",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: fontFamily ?? mono,
              fontSize: narrationFS,
              fontWeight: 400,
              color: textColor,
              lineHeight: 1.5,
              letterSpacing: "0.02em",
              textAlign: "center", // Center aligned for both landscape and portrait
              maxWidth: p ? "90%" : "70%", // Limit width for readability
              opacity: 0.85,
              textShadow: `0 0 6px ${textColor}33`,
            }}
          >
            {narration}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
