import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  MAG_TEXTURES,
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
 *
 * A short subject-tied heading (+ optional standfirst) supplied by the generation
 * prompt anchors the top of the page above the figures; when it's absent the page
 * falls back to the clean stats-only layout. The figures scale UP as the stat count
 * drops, so a two-figure scene fills the page as deliberately as a four-figure one
 * (rather than stranding two thin columns in white space).
 */
export const ByTheNumbers: React.FC<SceneLayoutProps> = (props) => {
  const { descriptionFontSize } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;
  const sectionLabel = (props.sectionLabel as string)?.trim() || "By the Numbers";

  // Render ONLY real numeric figures — never invent stats. Drop entries with an
  // empty value or a value that carries no digit (a stray word is not a figure).
  // The backend guard (_guard_magazine_by_the_numbers) reroutes a scene with <2
  // real numeric stats away from this layout, so in practice we always get ≥2.
  const raw: Array<{ value: string; label: string }> = (props.stats as any) ?? [];
  const stats = raw
    .filter((s) => s && String(s.value ?? "").trim() && /\d/.test(String(s.value)))
    .slice(0, 4);
  const n = stats.length;

  // Optional subject-tied heading + standfirst above the figures. The generation
  // prompt supplies a real title (e.g. "The Numbers Behind the Launch"); when it's
  // absent (older projects / stats-only scenes) the page renders as before.
  const heading = String(props.title ?? "").trim();
  const standfirst = String(props.subtitle ?? "").trim();
  const hasHeading = heading.length > 0;

  const frame = useMagFrame();
  const { fps } = useVideoConfig();
  const titleO = useReveal(2, 12);
  const headP = useReveal(6, 14);
  const standP = useReveal(10, 14);
  const ruleP = useReveal(8, 14);
  const framesP = useReveal(10, 16);
  // Per-stat reveal ramps — plain interpolate (NOT the useReveal hook) so we never
  // call a hook inside the stats .map loop.
  const rev = (st: number, len: number) =>
    interpolate(frame, [st, st + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Figures scale UP as the count drops so the row always fills the page. Labels
  // track the figure size. descriptionFontSize (when supplied) still overrides.
  // Landscape lays the stats in one row; portrait keeps a 2-up grid. Sizes and the
  // low-count multipliers run larger than before so a 2–3 stat scene reads bold.
  const countScale = p ? 1 : [1, 1, 1.5, 1.24, 1][n] ?? 1;
  const baseFig = (p ? 128 : 172) * countScale;
  const valuePx = descriptionFontSize ? descriptionFontSize * 2.2 : baseFig;
  const labelPx = Math.round(valuePx * (p ? 0.14 : 0.12));

  // Heading + standfirst sizing — anchor off titleFontSize when supplied, else a
  // sensible display default. Kept plain (no blur/shadow) to stay cheap to paint.
  const headingPx = props.titleFontSize ? Math.round(props.titleFontSize * 0.6) : p ? 40 : 56;
  const standPx = Math.max(15, Math.round(headingPx * 0.3));

  // Portrait keeps its 2-column grid; landscape flows the stats in a single row so
  // two figures read as a centred pair, not two marooned columns.
  const gridCols = p ? "1fr 1fr" : `repeat(${n}, minmax(0, 1fr))`;
  // The centre crease (hingeShade in by-the-numbers-bg.png, ~50%) must never sit
  // under a figure. In landscape with an EVEN stat count the column split lands on
  // centre, so open a channel there so the figures read as a clearly separated
  // left/right block, clear of the fold. Odd counts already straddle acceptably.
  const columnGap = !p && n % 2 === 0 ? 72 : 0;

  return (
    <MagazinePage colors={colors} section={sectionLabel} issue={props.issueLabel ?? "Data"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} hideGutter lightChrome cameraMove={props.cameraMove} hidePrintTexture>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Section header — a bold, unmistakable masthead so the scene reads as
            "By the Numbers" at a glance: a small red eyebrow, an oversized display
            title, and a heavy full-width rule that draws in beneath it. */}
        <div style={{ opacity: titleO }}>
          <Kicker color={accent} size={p ? 20 : 17} style={{ marginBottom: 10 }}>
            {`Data · ${sectionLabel}`}
          </Kicker>
          <div
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 900,
              fontSize: p ? 60 : 84,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              color: text,
              textTransform: "uppercase",
            }}
          >
            {sectionLabel}
          </div>
        </div>

        {/* Heavy header rule (draws in left→right) with a thin echo hairline just
            below it — the classic magazine section-header underscore. */}
        <div style={{ marginTop: p ? 14 : 18 }}>
          <Rule color={text} progress={ruleP} thickness={p ? 5 : 6} width="100%" />
          <Rule color={hexToRgba(text, 0.25)} progress={ruleP} thickness={1} width="100%" style={{ marginTop: 6 }} />
        </div>

        {/* Subject-tied heading + optional standfirst — owns the upper band so the
            page never opens onto blank paper above the figures. Rendered only when the
            prompt supplied a title; otherwise the stats-only layout is unchanged. */}
        {hasHeading && (
          <div style={{ marginTop: p ? 24 : 30 }}>
            <div
              style={{
                fontFamily: MAG_DISPLAY,
                fontWeight: 800,
                fontSize: headingPx,
                lineHeight: 1.12,
                color: text,
                letterSpacing: "-0.01em",
                maxWidth: p ? "100%" : "72%",
                opacity: headP,
                transform: `translateY(${((1 - headP) * 0.2).toFixed(3)}em)`,
              }}
            >
              {heading}
            </div>
            {standfirst && (
              <div
                style={{
                  fontFamily: MAG_SANS,
                  fontWeight: 600,
                  fontSize: standPx,
                  lineHeight: 1.4,
                  color: hexToRgba(text, 0.6),
                  maxWidth: p ? "100%" : "62%",
                  marginTop: 12,
                  opacity: standP,
                  transform: `translateY(${((1 - standP) * 0.2).toFixed(3)}em)`,
                }}
              >
                {standfirst}
              </div>
            )}
          </div>
        )}

        {/* Stats block — vertically centred between two hairlines so the figures own
            the middle of the page. With a heading present it takes its natural height
            (the heading owns the top) rather than stretching a short row across the
            whole page; without one it flexes to fill as before. */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 0 }}>
          <div style={{ width: "100%" }}>
            {/* Top hairline framing the figure row */}
            <div style={{ height: 1, background: hexToRgba(text, 0.16), transform: `scaleX(${framesP})`, transformOrigin: "left", marginBottom: p ? 28 : 8 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                columnGap,
                rowGap: 0,
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
                      padding: p ? "24px 24px" : "40px 40px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      minWidth: 0,
                    }}
                  >
                    {/* Column divider draws downward as the column sets. */}
                    {showLeftBorder && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: p ? 0 : "8%",
                          bottom: p ? 0 : "8%",
                          width: 1,
                          background: hexToRgba(text, 0.16),
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
                    <Rule color={accent} progress={underlineP} thickness={2} width={Math.round(valuePx * 0.4)} style={{ margin: "18px 0 14px" }} />
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

            {/* Bottom hairline framing the figure row */}
            <div style={{ height: 1, background: hexToRgba(text, 0.16), transform: `scaleX(${framesP})`, transformOrigin: "left", marginTop: p ? 28 : 8 }} />
          </div>
        </div>

        {/* Section-break dingbat */}
        <DingbatRule color={hexToRgba(text, 0.4)} width={p ? 160 : 220} opacity={ruleP} style={{ margin: "0 auto" }} />

        {/* Faded black wash pinned to the very bottom of the page — grounds the
            spread and lets the foot of the copy sink into shadow. Non-interactive
            overlay; extends past the page edges so no hard seam shows. */}
        <div
          style={{
            position: "absolute",
            left: "-8%",
            right: "-8%",
            bottom: "-8%",
            height: p ? "22%" : "26%",
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 42%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none",
            opacity: framesP,
          }}
        />
      </div>
    </MagazinePage>
  );
};
