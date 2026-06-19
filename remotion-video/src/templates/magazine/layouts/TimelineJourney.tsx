import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
} from "../magazineStyle";

/**
 * Timeline journey — a vertical chronology: a drawn rule with milestone dots,
 * each paired with an accent date and a serif label. Reads top-to-bottom.
 */
export const TimelineJourney: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const raw = (props.milestones as any[]) ?? [];
  const milestones: { date: string; label: string }[] = (raw.length > 0
    ? raw
    : [
        { date: "2019", label: "Company founded" },
        { date: "2021", label: "Series A funding" },
        { date: "2023", label: "One million users" },
        { date: "2025", label: "Global expansion" },
      ]
  )
    .slice(0, 6)
    .map((m) => ({ date: String(m.date ?? m.value ?? ""), label: String(m.label ?? m.title ?? "") }));

  const frame = useCurrentFrame();
  const titleO = useReveal(2, 12);
  const n = milestones.length;
  const lastStart = 14 + (n - 1) * 8;
  const lineP = interpolate(frame, [12, lastStart + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titlePx = titleFontSize ?? (p ? 52 : 48);
  const datePx = descriptionFontSize ?? (p ? 30 : 26);

  return (
    <MagazinePage colors={colors} section="Timeline" issue={props.issueLabel ?? "History"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Kicker color={accent} style={{ opacity: titleO, marginBottom: 12 }}>
          Timeline
        </Kicker>
        <h1 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: titlePx, lineHeight: 1.05, letterSpacing: "-0.015em", color: text, margin: 0, opacity: titleO }}>
          {title}
        </h1>
        {narration && (
          <p style={{ fontFamily: MAG_SERIF, fontSize: p ? 22 : 19, lineHeight: 1.5, color: text, opacity: titleO * 0.7, margin: "12px 0 0", maxWidth: p ? "100%" : "66%" }}>
            {narration}
          </p>
        )}

        {/* Track */}
        <div style={{ flex: 1, position: "relative", marginTop: 30, paddingLeft: 40 }}>
          {/* Vertical rule */}
          <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: `${text}1f` }} />
          <div style={{ position: "absolute", left: 7, top: 6, width: 2, height: `calc((100% - 12px) * ${lineP})`, background: accent }} />

          <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
            {milestones.map((mi, i) => {
              const start = 14 + i * 8;
              const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const x = interpolate(frame, [start, start + 14], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ position: "relative", opacity: o, transform: `translateX(${x}px)`, display: "flex", alignItems: "baseline", gap: 24 }}>
                  {/* Dot */}
                  <div style={{ position: "absolute", left: -40, top: 6, width: 16, height: 16, borderRadius: "50%", background: accent, border: `3px solid ${bg}`, boxShadow: `0 0 0 1px ${accent}` }} />
                  <div style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: datePx, color: accent, minWidth: p ? 110 : 130, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                    {mi.date}
                  </div>
                  <div style={{ fontFamily: MAG_SERIF, fontSize: datePx * 0.82, lineHeight: 1.35, color: text }}>
                    {mi.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MagazinePage>
  );
};
