import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  DingbatRule,
  KineticWords,
  MAG_DISPLAY,
  MAG_SANS,
  hexToRgba,
  resolveMagColors,
  isPortrait,
  useReveal,
  PopLayer,
  useMagFrame,
} from "../magazineStyle";

const animateValue = (valueStr: string, progress: number): string => {
  const match = valueStr.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)([^0-9]*)$/);
  if (!match) return valueStr;
  const [, prefix, numStr, suffix] = match;
  const finalNum = parseFloat(numStr);
  const decimals = numStr.includes(".") ? numStr.split(".")[1]?.length ?? 1 : 0;
  const current = finalNum * progress;
  return `${prefix}${decimals ? current.toFixed(decimals) : Math.round(current)}${suffix}`;
};

/**
 * By the numbers — a row of oversized serif figures with red rules and
 * tracked labels, separated by hairlines. Counters tick up on entry.
 */
export const ByTheNumbers: React.FC<SceneLayoutProps> = (props) => {
  const { title, titleFontSize, descriptionFontSize } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const raw: Array<{ value: string; label: string }> = (props.stats as any) ?? [];
  const stats = (raw.length > 0
    ? raw
    : [
        { value: "2.4M", label: "Monthly readers" },
        { value: "98%", label: "Satisfaction rate" },
        { value: "150+", label: "Countries reached" },
        { value: "$12B", label: "Market value" },
      ]
  ).slice(0, 4);

  const frame = useMagFrame();
  const { fps } = useVideoConfig();
  const titleO = useReveal(2, 12);
  const ruleP = useReveal(8, 14);

  const titlePx = titleFontSize ?? (p ? 92 : 107);
  // descriptionFontSize drives the small body text. The big figures, the subtitle
  // and the stat labels all scale proportionally off it so one slider tunes the
  // whole block together.
  const descSize = descriptionFontSize ?? (p ? 52 : 53);
  const descScale = descSize / (p ? 52 : 40);
  const valuePx = descSize * 2.2;
  const labelPx = (p ? 15 : 14) * descScale;

  return (
    <MagazinePage colors={colors} section="By the Numbers" issue={props.issueLabel ?? "Data"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} hideGutter cameraMove={props.cameraMove}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Kicker color={accent} style={{ opacity: titleO, marginBottom: 14 }}>
          By the Numbers
        </Kicker>
        <h1
          style={{
            fontFamily: MAG_DISPLAY,
            fontWeight: 800,
            fontSize: titlePx,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            color: text,
            margin: 0,
          }}
        >
          <KineticWords text={title ?? ""} start={2} stagger={2} dur={14} />
        </h1>

        <Rule color={accent} progress={ruleP} thickness={3} width={p ? 120 : 100} style={{ margin: "26px 0" }} />

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: p ? "1fr 1fr" : `repeat(${stats.length}, 1fr)`,
            gap: 0,
          }}
        >
          {stats.map((s, i) => {
            const start = 16 + i * 8;
            const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const counter = interpolate(frame, [start + 4, start + 4 + Math.round(fps * 0.8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const eased = 1 - Math.pow(1 - counter, 3);
            const showLeftBorder = p ? i % 2 === 1 : i > 0;
            return (
              <div
                key={i}
                style={{
                  opacity: o,
                  padding: p ? "20px 24px" : "0 32px",
                  borderLeft: showLeftBorder ? `1px solid ${text}22` : "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {/* The figure lifts off the page so it floats over its label
                    as the camera punches in. */}
                <PopLayer depth={44} start={start} len={16} style={{ display: "block" }}>
                  <div
                    style={{
                      fontFamily: MAG_DISPLAY,
                      fontWeight: 900,
                      fontSize: valuePx,
                      lineHeight: 1,
                      color: accent,
                      letterSpacing: "-0.02em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {animateValue(String(s.value ?? ""), eased)}
                  </div>
                </PopLayer>
                <div style={{ width: 40, height: 2, background: text, opacity: 0.3, margin: "16px 0 12px" }} />
                <div
                  style={{
                    fontFamily: MAG_SANS,
                    fontWeight: 700,
                    fontSize: labelPx,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    lineHeight: 1.35,
                    color: text,
                    opacity: 0.7,
                  }}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section-break dingbat */}
        <DingbatRule color={hexToRgba(text, 0.4)} width={p ? 160 : 220} opacity={ruleP} style={{ margin: "0 auto" }} />
      </div>
    </MagazinePage>
  );
};
