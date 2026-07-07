import React from "react";
import { interpolate, Easing } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  MAG_TEXTURES,
  Kicker,
  KineticWords,
  Rule,
  MAG_DISPLAY,
  MAG_SERIF,
  resolveMagColors,
  isPortrait,
  useMagFrame,
  hexToRgba,
  FitBlock,
  type MagColors,
} from "../magazineStyle";

const clampO = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const easeOut = { ...clampO, easing: Easing.out(Easing.cubic) };

/**
 * One milestone's text stack (year → label → detail). The year stays at its base
 * size; the label + detail are auto-shrunk together (via FitBlock) so the whole
 * block fits `maxHeight` — long copy is displayed in full at a smaller size
 * instead of being clamped to two lines with an ellipsis. Shared by the portrait
 * (vertical) and landscape (zig-zag) timelines.
 */
const MilestoneText: React.FC<{
  date: string;
  label: string;
  desc: string;
  yearPx: number;
  labelPx: number;
  descPx: number;
  labelMarginTop: number;
  descMarginTop: number;
  descLineHeight: number;
  maxHeight: number;
  colors: MagColors;
  yearNoWrap?: boolean;
  centered?: boolean;
  labelMaxWidth?: string;
  descMaxWidth?: string;
  style?: React.CSSProperties;
}> = ({
  date, label, desc, yearPx, labelPx, descPx,
  labelMarginTop, descMarginTop, descLineHeight, maxHeight, colors,
  yearNoWrap, centered, labelMaxWidth, descMaxWidth, style,
}) => {
  const { text, accent } = colors;
  const labelRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  const centerMargin = centered ? "auto" : undefined;
  return (
    <FitBlock
      maxHeight={maxHeight}
      minScale={0.55}
      deps={[label, desc, labelPx, descPx, maxHeight, yearPx]}
      targets={[
        { ref: labelRef, basePx: labelPx },
        { ref: descRef, basePx: descPx },
      ]}
      style={style}
    >
      <div style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: yearPx, lineHeight: 1, color: accent, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", ...(yearNoWrap ? { whiteSpace: "nowrap" } : null) }}>
        {date}
      </div>
      <div ref={labelRef} style={{ fontFamily: MAG_SERIF, fontWeight: 600, fontSize: labelPx, lineHeight: 1.3, color: text, marginTop: labelMarginTop, ...(centerMargin ? { marginLeft: centerMargin, marginRight: centerMargin } : null), ...(labelMaxWidth ? { maxWidth: labelMaxWidth } : null) }}>
        {label}
      </div>
      {desc && (
        <div ref={descRef} style={{ fontFamily: MAG_SERIF, fontSize: descPx, lineHeight: descLineHeight, color: hexToRgba(text, 0.7), marginTop: descMarginTop, ...(centerMargin ? { marginLeft: centerMargin, marginRight: centerMargin } : null), ...(descMaxWidth ? { maxWidth: descMaxWidth } : null) }}>
          {desc}
        </div>
      )}
    </FitBlock>
  );
};

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

  // Measured pixel height of the timeline band — used to bound each milestone's
  // year/label/detail stack so long copy shrinks to fit its slot (via FitBlock)
  // instead of being clamped with an ellipsis.
  const bandRef = React.useRef<HTMLDivElement>(null);
  const [bandH, setBandH] = React.useState(0);
  React.useLayoutEffect(() => {
    if (bandRef.current) setBandH(bandRef.current.clientHeight);
  });

  const raw = (props.milestones as any[]) ?? [];
  const milestones: { date: string; label: string; desc: string }[] = (raw.length > 0
    ? raw
    : [
        { date: "2019", label: "Company founded", desc: "Two founders, one rented desk, a first prototype." },
        { date: "2021", label: "Series A funding", desc: "Backed to grow the team and ship faster." },
        { date: "2023", label: "One million users", desc: "Word of mouth carried it across new markets." },
        { date: "2025", label: "Global expansion", desc: "Offices on three continents and counting." },
      ]
  )
    .slice(0, 6)
    .map((m) => ({
      date: String(m.date ?? m.value ?? ""),
      label: String(m.label ?? m.title ?? ""),
      desc: String(m.desc ?? m.description ?? ""),
    }));
  const n = milestones.length;

  // A soft editorial vignette fading up from the bottom edge of the page — a
  // subtle printed shadow, NOT laid over the copy: rendered as the first child of
  // the content column so every timeline element (headers, rail, milestones) paints
  // on top of it, and pointer-inert with a low stacking order. Uses the page's own
  // text colour at low alpha so it reads on light paper without dirtying the type.
  const bottomFade = (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "25%",
        background: `linear-gradient(to top, ${hexToRgba(text, 0.22)} 0%, ${hexToRgba(text, 0.08)} 45%, ${hexToRgba(text, 0)} 100%)`,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );

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
  const titlePx = titleFontSize ?? (p ? 68 : 66);
  const yearPx = descriptionFontSize ?? (p ? 54 : 70);
  const labelPx = p ? 28 : 32;
  const descPx = p ? 21 : 23;
  const stemLen = p ? 56 : 90; // baseline → year/label block
  // Landscape: a milestone block sits above or below the baseline, offset by the
  // stem; its usable height is from that offset to the band's top/bottom edge,
  // less a margin. Bounds FitBlock so long copy shrinks instead of clamping.
  const hSlotH = Math.max(90, bandH / 2 - (stemLen + 16) - 10);
  const slotW = Math.min(p ? 27 : 22, 94 / Math.max(n, 2)); // milestone column width, % of band
  // inset the band so the first/last milestones never run off the page edge
  const edge = slotW / 2 + 2; // % inset on each side
  const span = 100 - 2 * edge; // drawable width between the insets

  // ── Portrait: a vertical chronology that fills the tall page ──────────────────
  // The horizontal zig-zag band (below) leaves a 9:16 page mostly blank, so in
  // portrait the timeline instead runs straight DOWN the leaf: one accent rail
  // draws top→bottom with the playhead riding its leading edge, and each milestone
  // — a dot on the rail, a large display year, a serif label and its detail line —
  // settles in turn, evenly distributed so the column reads full top-to-bottom
  // rather than as a thin band floating in the middle.
  if (p) {
    const railX = 26; // px from the content edge to the rail
    const railColW = railX + 30; // rail column width: dot at railX + a gap to the text
    const top0 = 7; // first dot centre (% of band height)
    const top1 = 88; // last dot centre
    const reach = top1 - top0;
    const drawnReach = frac * reach;
    const yearPxV = descriptionFontSize ?? 70;
    const labelPxV = 31;
    const descPxV = 23;
    // Available height for one milestone's stack: the gap between adjacent dots
    // over the band, less a small breathing margin so blocks never touch. Blocks
    // are vertically centred on their dot, so each owns ~one inter-row gap.
    const rowGapH = n > 1 ? (bandH * (reach / 100)) / (n - 1) : bandH * (reach / 100);
    const vSlotH = Math.max(90, rowGapH - 18);
    return (
      <MagazinePage
        lightChrome
        colors={colors}
        section={(props.sectionLabel as string)?.trim() || "Timeline"}
        issue={props.issueLabel ?? "History"}
        page={props.pageNumber}
        aspectRatio={props.aspectRatio}
        fontFamily={fontFamily}
        establishingShot={props.establishingShot}
        cameraMove={props.cameraMove ?? "book_open"}
        hidePrintTexture
        backgroundImageSrc={props.imageUrl}
        backgroundImageObjectPosition={props.imageObjectPosition}
        backgroundImageZoom={props.imageZoom}
        backgroundImageOpacity={0.3}
        hideGutter
        cornerCurl
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
          {bottomFade}
          {/* Header — kicker + kinetic headline + a short accent rule. */}
          <Kicker color={accent} style={{ opacity: headO, marginBottom: 12 }}>
            Timeline
          </Kicker>
          <h1 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: titlePx, lineHeight: 1.12, letterSpacing: "-0.015em", color: text, margin: 0, overflowWrap: "break-word" }}>
            <KineticWords text={title ?? ""} start={18} stagger={2} dur={14} />
          </h1>
          <Rule color={accent} progress={headO} thickness={3} width={120} style={{ marginTop: 18 }} />

          {/* The vertical timeline band — a rail down the left with stacked milestones. */}
          <div ref={bandRef} style={{ flex: 1, position: "relative", marginTop: 30 }}>
            {/* faint full rail between the first and last dot */}
            <div style={{ position: "absolute", left: railX, top: `${top0}%`, height: `${reach}%`, width: 2, transform: "translateX(-50%)", background: hexToRgba(text, 0.1) }} />
            {/* accent rail that draws top→bottom to each dot in turn */}
            <div style={{ position: "absolute", left: railX, top: `${top0}%`, height: `${drawnReach.toFixed(2)}%`, width: 3, transform: "translateX(-50%)", background: accent }} />
            {/* travelling playhead riding the leading edge of the drawn rail */}
            <div
              style={{
                position: "absolute",
                left: railX,
                top: `${(top0 + drawnReach).toFixed(2)}%`,
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
              const cy = n > 1 ? top0 + (i / (n - 1)) * reach : (top0 + top1) / 2;
              const fi = drawStart + i * cycle;
              const o = interpolate(frame, [fi, fi + appearDur], [0, 1], clampO);
              const dotScale = interpolate(frame, [fi, fi + appearDur * 0.8], [0.2, 1], easeOut);
              const xx = interpolate(frame, [fi, fi + appearDur], [16, 0], easeOut);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${cy.toFixed(2)}%`,
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {/* rail column carrying the milestone dot, aligned on the rail */}
                  <div style={{ position: "relative", width: railColW, flexShrink: 0, alignSelf: "stretch" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: railX,
                        top: "50%",
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: accent,
                        border: `3px solid ${bg}`,
                        boxShadow: `0 0 0 1px ${accent}`,
                        transform: `translate(-50%, -50%) scale(${dotScale.toFixed(3)})`,
                      }}
                    />
                  </div>
                  {/* year over label over detail — shrinks to fit its slot */}
                  <MilestoneText
                    date={mi.date}
                    label={mi.label}
                    desc={mi.desc}
                    yearPx={yearPxV}
                    labelPx={labelPxV}
                    descPx={descPxV}
                    labelMarginTop={8}
                    descMarginTop={6}
                    descLineHeight={1.4}
                    maxHeight={vSlotH}
                    colors={colors}
                    style={{ flex: 1, minWidth: 0, opacity: o, transform: `translateX(${xx.toFixed(1)}px)` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </MagazinePage>
    );
  }

  return (
    <MagazinePage
      lightChrome
      colors={colors}
      section={(props.sectionLabel as string)?.trim() || "Timeline"}
      issue={props.issueLabel ?? "History"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={fontFamily}
      establishingShot={props.establishingShot}
      cameraMove={props.cameraMove ?? "book_open"}
      hidePrintTexture
      backgroundImageSrc={props.imageUrl}
      backgroundImageObjectPosition={props.imageObjectPosition}
      backgroundImageZoom={props.imageZoom}
      backgroundImageOpacity={0.3}
      hideGutter
      cornerCurl
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
        {bottomFade}
        {/* Header — kicker + kinetic headline + optional one-line deck. */}
        <Kicker color={accent} style={{ opacity: headO, marginBottom: 12 }}>
          Timeline
        </Kicker>
        <h1 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: titlePx, lineHeight: 1.12, letterSpacing: "-0.015em", color: text, margin: 0, overflowWrap: "break-word" }}>
          <KineticWords text={title ?? ""} start={18} stagger={2} dur={14} />
        </h1>

        {/* The timeline band — a horizontal baseline with milestones above/below. */}
        <div ref={bandRef} style={{ flex: 1, position: "relative", marginTop: p ? 26 : 34 }}>
          {/* faint full-width rail */}
          <div style={{ position: "absolute", left: `${edge}%`, right: `${edge}%`, top: "50%", height: 2, transform: "translateY(-50%)", background: hexToRgba(text, 0.1) }} />
          {/* accent baseline that draws left→right to each dot in turn */}
          <div style={{ position: "absolute", left: `${edge}%`, top: "50%", height: 3, transform: "translateY(-50%)", width: `${(frac * span).toFixed(2)}%`, background: accent }} />
          {/* travelling playhead riding the leading edge of the drawn line */}
          <div
            style={{
              position: "absolute",
              left: `${(edge + frac * span).toFixed(2)}%`,
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
            const x = n > 1 ? edge + (i / (n - 1)) * span : 50;
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
                {/* year over label, centred on the dot, above or below the line —
                    shrinks to fit the half-band above/below so long copy shows in
                    full instead of being clamped. */}
                <MilestoneText
                  date={mi.date}
                  label={mi.label}
                  desc={mi.desc}
                  yearPx={yearPx}
                  labelPx={labelPx}
                  descPx={descPx}
                  labelMarginTop={9}
                  descMarginTop={6}
                  descLineHeight={1.35}
                  yearNoWrap
                  centered
                  labelMaxWidth="94%"
                  descMaxWidth="96%"
                  maxHeight={hSlotH}
                  colors={colors}
                  style={{
                    position: "absolute",
                    left: "50%",
                    width: "100%",
                    textAlign: "center",
                    opacity: o,
                    transform: `translateX(-50%) translateY(${yy.toFixed(1)}px)`,
                    ...(above ? { bottom: `calc(50% + ${stemLen + 16}px)` } : { top: `calc(50% + ${stemLen + 16}px)` }),
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </MagazinePage>
  );
};
