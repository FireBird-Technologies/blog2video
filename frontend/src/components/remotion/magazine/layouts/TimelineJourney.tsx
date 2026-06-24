import React from "react";
import { interpolate, Easing } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  KineticWords,
  MAG_DISPLAY,
  MAG_SERIF,
  resolveMagColors,
  isPortrait,
  useMagFrame,
  hexToRgba,
} from "../magazineStyle";

const clampO = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const easeOut = { ...clampO, easing: Easing.out(Easing.cubic) };

/**
 * Timeline journey — a horizontal "zig-zag" chronology printed across the spread.
 *
 * The two-page spread swings open (the shared `book_open` camera move), then the
 * chronology writes itself out LEFT→RIGHT: a single accent baseline draws across
 * the full page with a travelling "playhead" dot riding its leading edge, and
 * milestones pop onto the line in turn — alternating ABOVE and BELOW it on short
 * stems, each a large display year over a serif label. Filling the page width
 * (and both halves of its height) it reads as a proper editorial timeline rather
 * than a thin list down one margin. The centre spine is suppressed so the line is
 * never bisected by the binding.
 */
export const TimelineJourney: React.FC<SceneLayoutProps> = (props) => {
  const { title, titleFontSize, descriptionFontSize, fontFamily } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;
  const frame = useMagFrame();

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
  const n = milestones.length;

  // ── Header reveal (fades in as the spread opens) ────────────────────────────
  const headO = interpolate(frame, [14, 30], [0, 1], clampO);

  // ── Draw pacing ─────────────────────────────────────────────────────────────
  // The baseline draws to each dot in turn: a milestone pops in, the line
  // stretches to the next stop, the next milestone pops in. Timing auto-scales to
  // the scene length so the whole chronology finishes shortly before the cut.
  const drawStart = 36; // after the spread has opened and content has faded in
  const dur = props.sceneDurationInFrames ?? 150;
  const appearDur = 11; // a milestone popping in
  const endBudget = Math.max(drawStart + 50, dur - 26);
  const rawLine = n > 1 ? (endBudget - drawStart - appearDur) / (n - 1) - appearDur : 14;
  const lineDur = Math.max(9, Math.min(22, rawLine)); // the line stretching to the next dot
  const cycle = appearDur + lineDur;

  const lineInput: number[] = [];
  const lineOutput: number[] = [];
  for (let i = 0; i < n; i++) {
    const fi = drawStart + i * cycle;
    const pi = n > 1 ? i / (n - 1) : 0;
    lineInput.push(fi, fi + appearDur);
    lineOutput.push(pi, pi);
  }
  const frac = n > 1 ? interpolate(frame, lineInput, lineOutput, clampO) : 0;
  const playheadO = interpolate(frac, [0, 0.02, 0.97, 1], [0, 1, 1, 0], clampO);

  // ── Sizing ──────────────────────────────────────────────────────────────────
  const titlePx = titleFontSize ?? (p ? 46 : 40);
  const yearPx = descriptionFontSize ?? (p ? 30 : 36);
  const labelPx = p ? 14 : 15;
  const stemLen = p ? 44 : 60; // baseline → year/label block
  const slotW = Math.min(p ? 27 : 21, 94 / Math.max(n, 2)); // milestone column width, % of band

  return (
    <MagazinePage
      colors={colors}
      section="Timeline"
      issue={props.issueLabel ?? "History"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={fontFamily}
      establishingShot={props.establishingShot}
      cameraMove={props.cameraMove ?? "book_open"}
      printTextureSrc="qa-timeline-bg.svg"
      printTextureOpacity={0.32}
      hideGutter
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header — kicker + kinetic headline + optional one-line deck. */}
        <Kicker color={accent} style={{ opacity: headO, marginBottom: 12 }}>
          Timeline
        </Kicker>
        <h1 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: titlePx, lineHeight: 1.04, letterSpacing: "-0.015em", color: text, margin: 0 }}>
          <KineticWords text={title ?? ""} start={18} stagger={2} dur={14} />
        </h1>

        {/* The timeline band — a horizontal baseline with milestones above/below. */}
        <div style={{ flex: 1, position: "relative", marginTop: p ? 26 : 34 }}>
          {/* faint full-width rail */}
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, transform: "translateY(-50%)", background: hexToRgba(text, 0.1) }} />
          {/* accent baseline that draws left→right to each dot in turn */}
          <div style={{ position: "absolute", left: 0, top: "50%", height: 3, transform: "translateY(-50%)", width: `${(frac * 100).toFixed(2)}%`, background: accent }} />
          {/* travelling playhead riding the leading edge of the drawn line */}
          <div
            style={{
              position: "absolute",
              left: `${(frac * 100).toFixed(2)}%`,
              top: "50%",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 0 4px ${hexToRgba(accent, 0.18)}`,
              transform: "translate(-50%, -50%)",
              opacity: playheadO,
            }}
          />

          {milestones.map((mi, i) => {
            const x = n > 1 ? (i / (n - 1)) * 100 : 50;
            const above = i % 2 === 0;
            const fi = drawStart + i * cycle;
            const o = interpolate(frame, [fi, fi + appearDur], [0, 1], clampO);
            const dotScale = interpolate(frame, [fi, fi + appearDur * 0.8], [0.2, 1], easeOut);
            const stemScale = interpolate(frame, [fi, fi + appearDur], [0, 1], easeOut);
            const yy = interpolate(frame, [fi, fi + appearDur], [above ? -10 : 10, 0], easeOut);
            return (
              <div key={i} style={{ position: "absolute", left: `${x}%`, top: 0, bottom: 0, width: `${slotW}%`, transform: "translateX(-50%)" }}>
                {/* stem from the baseline out to the year/label block */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    width: 2,
                    height: stemLen,
                    background: accent,
                    opacity: o,
                    transformOrigin: above ? "center bottom" : "center top",
                    transform: `translateX(-50%) scaleY(${stemScale.toFixed(3)})`,
                    ...(above ? { bottom: "50%" } : { top: "50%" }),
                  }}
                />
                {/* dot on the baseline */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: accent,
                    border: `3px solid ${bg}`,
                    boxShadow: `0 0 0 1px ${accent}`,
                    transform: `translate(-50%, -50%) scale(${dotScale.toFixed(3)})`,
                  }}
                />
                {/* year over label, centred on the dot, above or below the line */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    width: "100%",
                    textAlign: "center",
                    opacity: o,
                    transform: `translateX(-50%) translateY(${yy.toFixed(1)}px)`,
                    ...(above ? { bottom: `calc(50% + ${stemLen + 12}px)` } : { top: `calc(50% + ${stemLen + 12}px)` }),
                  }}
                >
                  <div style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: yearPx, lineHeight: 1, color: accent, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {mi.date}
                  </div>
                  <div style={{ fontFamily: MAG_SERIF, fontSize: labelPx, lineHeight: 1.3, color: text, margin: "7px auto 0", maxWidth: "94%" }}>
                    {mi.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MagazinePage>
  );
};
