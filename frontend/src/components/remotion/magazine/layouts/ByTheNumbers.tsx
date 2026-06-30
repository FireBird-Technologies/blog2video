import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  DingbatRule,
  MAG_DISPLAY,
  MAG_SANS,
  hexToRgba,
  resolveMagColors,
  isPortrait,
  useReveal,
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
  const { descriptionFontSize } = props;
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
  // Per-stat reveal ramps — plain interpolate (NOT the useReveal hook) so we never
  // call a hook inside the stats .map loop.
  const rev = (st: number, len: number) =>
    interpolate(frame, [st, st + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // descriptionFontSize drives the stat labels; figures scale proportionally off it.
  const descSize = descriptionFontSize ?? (p ? 52 : 53);
  const descScale = descSize / (p ? 52 : 40);
  const valuePx = descSize * 2.2;
  const labelPx = (p ? 15 : 14) * descScale;

  return (
    <MagazinePage colors={colors} section="By the Numbers" issue={props.issueLabel ?? "Data"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} hideGutter lightChrome cameraMove={props.cameraMove}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Kicker color={accent} style={{ opacity: titleO, marginBottom: 20 }}>
          By the Numbers
        </Kicker>

        <Rule color={accent} progress={ruleP} thickness={3} width={p ? 120 : 100} style={{ marginBottom: 24 }} />

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
            const counter = interpolate(frame, [start + 4, start + 4 + Math.round(fps * 0.8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const eased = 1 - Math.pow(1 - counter, 3);
            // The column "sets" in staged steps — all transform/opacity (no 3D / blur /
            // clip-path), so it reads with magazine cadence yet can never jitter.
            const dividerP = rev(start, 12);            // hairline draws downward
            const riseRaw = rev(start + 2, 14);
            const riseP = 1 - Math.pow(1 - riseRaw, 3); // figure rises + fades into place
            const underlineP = rev(start + 6, 14);      // accent rule wipes in beneath it
            const labelP = rev(start + 10, 12);         // label settles just after
            const showLeftBorder = p ? i % 2 === 1 : i > 0;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  padding: p ? "20px 24px" : "0 32px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {/* Column divider draws downward as the column sets. */}
                {showLeftBorder && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: hexToRgba(text, 0.13),
                      transform: `scaleY(${dividerP})`,
                      transformOrigin: "top",
                    }}
                  />
                )}
                {/* The big figure rises into place and counts up. */}
                <div
                  style={{
                    fontFamily: MAG_DISPLAY,
                    fontWeight: 900,
                    fontSize: valuePx,
                    lineHeight: 1,
                    color: accent,
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                    opacity: riseP,
                    transform: `translateY(${((1 - riseP) * 0.35).toFixed(3)}em)`,
                  }}
                >
                  {animateValue(String(s.value ?? ""), eased)}
                </div>
                {/* Accent underline wipes in left→right (Rule's scaleX). */}
                <Rule color={accent} progress={underlineP} thickness={2} width={48} style={{ margin: "16px 0 12px" }} />
                {/* Tracked label settles up just behind its figure. */}
                <div
                  style={{
                    fontFamily: MAG_SANS,
                    fontWeight: 700,
                    fontSize: labelPx,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    lineHeight: 1.35,
                    color: text,
                    opacity: labelP * 0.7,
                    transform: `translateY(${((1 - labelP) * 0.25).toFixed(3)}em)`,
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
