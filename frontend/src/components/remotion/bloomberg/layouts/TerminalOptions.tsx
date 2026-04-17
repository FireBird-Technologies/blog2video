import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundGraph } from "./BackgroundGraph";

export const TerminalOptions: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  items = [],
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  // Font sizing
  const tSize = titleFontSize ?? (p ? 90 : 97);
  const dSize = descriptionFontSize ?? (p ? 36 : 32);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const rawRows = items.length > 0 ? items : [
    "STRIKE | TYPE | BID | ASK | IV | DELTA | GAMMA",
    "185 | CALL | 5.20 | 5.40 | 28.4% | 0.52 | 0.041",
    "190 | CALL | 2.80 | 2.95 | 30.1% | 0.38 | 0.038",
    "195 | CALL | 1.10 | 1.20 | 32.8% | 0.24 | 0.030",
    "185 | PUT | 4.90 | 5.10 | 27.9% | -0.48 | 0.040",
    "180 | PUT | 2.40 | 2.55 | 29.5% | -0.32 | 0.033",
  ];

  const processRow = (row: string) => row.split("|").map(s => s.trim());
  const headerCells = processRow(rawRows[0]);
  const dataRows = rawRows.slice(1).map(processRow);

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar (Title removed from here) */}
      <BackgroundGraph accentColor={blue} textColor={amber} variant="options" />
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:OPTS</span>
      </div>

      {/* Centered Title */}
      <div style={{
        position: "absolute", 
        top: topH + (p ? 20 : 30), // Added more top clearance
        left: pad, right: pad,
        color: amber, 
        fontSize: tSize * 0.6, 
        opacity: titleOpacity, 
        letterSpacing: -0.5,
        textAlign: "center", // Centered as requested
        fontWeight: "bold",
        textTransform: "uppercase"
      }}>
        {title}
      </div>

      {/* Table Container - Height decreased from both ends */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 110 : 130), // Pushed down further
        left: pad, right: pad,
        bottom: botH + (p ? 120 : 140), // Pulled up significantly
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header Row */}
        <div style={{
          display: "flex",
          backgroundColor: BLOOMBERG_COLORS.headerBg,
          border: `1px solid ${amber}`,
          borderBottom: `2px solid ${amber}`,
          opacity: headerOpacity,
        }}>
          {headerCells.map((cell, idx) => (
            <div key={idx} style={{
              flex: 1,
              padding: "12px 10px",
              color: blue,
              fontSize: dSize * 0.7,
              textAlign: "center",
              borderRight: idx < headerCells.length - 1 ? `1px solid ${BLOOMBERG_COLORS.border}` : 'none'
            }}>
              {cell}
            </div>
          ))}
        </div>

        {/* Data Rows */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {dataRows.map((cells, i) => {
            const rowOpacity = interpolate(frame, [i * 6 + 12, i * 6 + 24], [0, 1], { extrapolateRight: "clamp" });
            const isPut = cells.some(c => c.toUpperCase() === "PUT");
            const rowBg = i % 2 === 0 ? "rgba(22, 31, 45, 0.48)" : "rgba(10, 16, 24, 0.42)";
            
            return (
              <div key={i} style={{
                flex: 1,
                display: "flex",
                backgroundColor: rowBg,
                border: `1px solid ${BLOOMBERG_COLORS.border}`,
                borderTop: "none",
                color: isPut ? BLOOMBERG_COLORS.neg : amber,
                opacity: rowOpacity,
              }}>
                {cells.map((cell, idx) => (
                  <div key={idx} style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: dSize * 0.75,
                    borderRight: idx < cells.length - 1 ? `1px solid ${BLOOMBERG_COLORS.border}` : 'none'
                  }}>
                    {cell}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Increased Narration Size & Positioned Below Metrics */}
      <div style={{
        position: "absolute", 
        bottom: botH + (p ? 30 : 40), 
        left: pad, right: pad,
        color: BLOOMBERG_COLORS.muted, 
        fontSize: dSize * 0.9, // Increased size significantly
        textAlign: "center",
        lineHeight: 1.3,
        opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {narration}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL · OPTIONS MONITOR
        </span>
      </div>
    </AbsoluteFill>
  );
};