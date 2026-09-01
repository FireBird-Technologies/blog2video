import React, { useId } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ArchiveImageBackdrop,
  hexToRgba,
  typewriterAt,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/**
 * Faded, curled old-map/scroll pages scattered behind the notebook —
 * rolled cylinder shapes at two corners plus soft diagonal fold-crease
 * shadows across the base, all rendered in the strict grayscale palette
 * (no sepia/tan — the curl and fold shapes carry the "old map" read
 * instead of a warm tint).
 */
const CurledMapPages: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const theme = useDocReelTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = portrait ? 1080 : 1920;
  const h = portrait ? 1920 : 1080;

  // A rolled scroll: a long rectangle whose near end is drawn as an ellipse
  // (the curled tube seen end-on), shaded with a radial gradient so it
  // reads as a cylinder rather than a flat card.
  const Scroll: React.FC<{ cx: number; cy: number; length: number; radius: number; rotate: number; opacity: number }> = ({
    cx, cy, length, radius, rotate, opacity,
  }) => (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`} opacity={opacity}>
      <rect x={0} y={-radius} width={length} height={radius * 2} fill={`url(#page-${uid})`} />
      <ellipse cx={0} cy={0} rx={radius * 0.55} ry={radius} fill={`url(#curl-${uid})`} />
      <ellipse cx={0} cy={0} rx={radius * 0.55} ry={radius} fill="none" stroke={hexToRgba(theme.text, 0.25)} strokeWidth={1.5} />
    </g>
  );

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`page-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={hexToRgba(theme.text, 0.22)} />
          <stop offset="60%" stopColor={hexToRgba(theme.text, 0.1)} />
          <stop offset="100%" stopColor={hexToRgba(theme.text, 0.02)} />
        </linearGradient>
        <radialGradient id={`curl-${uid}`} cx="35%" cy="50%" r="65%">
          <stop offset="0%" stopColor={hexToRgba(theme.text, 0.32)} />
          <stop offset="70%" stopColor={hexToRgba(theme.text, 0.14)} />
          <stop offset="100%" stopColor={hexToRgba(theme.shadowBase, 0.4)} />
        </radialGradient>
      </defs>
      <Scroll cx={w * 0.06} cy={h * 0.14} length={w * 0.34} radius={h * 0.05} rotate={18} opacity={0.55} />
      <Scroll cx={w * 0.98} cy={h * 0.9} length={w * 0.4} radius={h * 0.055} rotate={-160} opacity={0.5} />
      {/* Soft diagonal fold creases across the base — the shadow a page
          casts on itself where it's been folded, not a hard line. */}
      <line x1={w * 0.1} y1={h * 0.05} x2={w * 0.75} y2={h * 0.95} stroke={hexToRgba(theme.shadowBase, 0.18)} strokeWidth={h * 0.02} strokeLinecap="round" />
      <line x1={w * 0.9} y1={h * 0.0} x2={w * 0.2} y2={h * 0.7} stroke={hexToRgba(theme.shadowBase, 0.12)} strokeWidth={h * 0.015} strokeLinecap="round" />
    </svg>
  );
};

/** A hand-ticked checkbox glyph — a small square, filled in with a felt-tip
 *  check mark once its row has revealed, like an investigator working down
 *  a notebook page. */
const TickBox: React.FC<{ size: number; checked: boolean; color: string }> = ({ size, checked, color }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
    <rect x={1.5} y={1.5} width={17} height={17} rx={2} fill="none" stroke={hexToRgba(color, 0.6)} strokeWidth={1.5} />
    {checked ? (
      <path
        d="M4.5 10.5 L8 14 L15.5 5.5"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={0}
      />
    ) : null}
  </svg>
);

/**
 * Field notes checklist: a single photograph faded behind a typed notebook
 * page of plain fact bullets, each ticked off as it reveals. Purely a list
 * of independent facts — no timeline, no sequence, no cross-references —
 * for scenes that need to carry several short details at once.
 */
export const DocreelFieldNotes: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    bgColor,
    accentColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    fieldNotesHeading,
    fieldNotesItems,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 130;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  const heading = fieldNotesHeading || title || "";
  // Plain independent facts, never a sequence — narration is the fallback
  // when the LLM hasn't populated a real list, so the page never renders
  // as an empty notebook.
  const items = (fieldNotesItems && fieldNotesItems.length > 0 ? fieldNotesItems : narration ? [narration] : []).slice(0, 7);

  const headingReveal = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleTargetPx = titleFontSize ?? (p ? 60 : 48);
  const bodyTargetPx = descriptionFontSize ?? (p ? 57 : 36);

  // Frame-relative budgets (newspaper pattern). The list gets the largest
  // share in this template: it stacks up to 7 checklist rows.
  const headingBudgetPx = Math.round(frameHeight * (p ? 0.14 : 0.16));
  const listBudgetPx = Math.round(frameHeight * (p ? 0.44 : 0.48));
  const headingRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    headingRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : p ? 24 : 22,
    [heading, titleTargetPx, titleFontSizeIsUserSet, headingBudgetPx, p, aspectRatio],
    headingBudgetPx,
  );

  // Every checklist row types out independently, so the visible list grows for
  // most of the scene. A hidden mirror of the FULL list — same rows, gaps and
  // typography — carries the ref, so the row size is settled once against the
  // finished list. Keyed on titlePx so it re-fits after the heading settles.
  const listMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: bodyPx } = useFitText(
    listMirrorRef,
    bodyTargetPx,
    descriptionFontSizeIsUserSet ? bodyTargetPx : p ? 20 : 16,
    [items.join(" "), items.length, bodyTargetPx, descriptionFontSizeIsUserSet, listBudgetPx, titlePx, p],
    listBudgetPx,
  );
  const tickSize = Math.round(bodyPx * 0.95);

  const rowStart = (i: number) => 26 + i * 10;

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["aged_paper", "dust_scratches"]} sprockets={false} vignette>
      {/* Photo sits as a faint watermark behind the page, not a hard image
          block — this layout is about the list, not the picture. */}
      {(imageUrl || videoUrl) ? (
        <ArchiveImageBackdrop
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          imageObjectPosition={imageObjectPosition}
          imageZoom={imageZoom}
          videoMuted={videoMuted}
          videoVolume={videoVolume}
          videoDurationInFrames={videoDurationInFrames}
          videoStartInFrames={videoStartInFrames}
          dur={dur}
          dim={0.22}
          kenBurns={0.05}
        />
      ) : null}
      <div style={{ position: "absolute", inset: 0, background: hexToRgba(theme.bg, 0.72) }} />
      {/* Faded curled map/scroll pages, per the reference — old rolled
          pages peeking in from opposite corners with soft fold creases. */}
      <CurledMapPages portrait={p} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "56px 24px" : "48px 90px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: p ? 900 : 1500,
            border: `1px solid ${theme.lineStrong}`,
            background: hexToRgba(theme.bg, 0.4),
            padding: p ? "40px 34px" : "60px 76px",
          }}
        >
          {heading ? (
            <div
              ref={headingRef}
              style={{
                fontFamily: DOCREEL_DISPLAY_FONT,
                fontWeight: 500,
                fontSize: titlePx,
                width: "100%",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: theme.accent,
                marginBottom: 28,
                opacity: headingReveal,
                transform: `translateY(${(1 - headingReveal) * 10}px)`,
              }}
            >
              {heading}
            </div>
          ) : null}

          {/* Hidden mirror of the finished list — see the fitter above. */}
          <div
            ref={listMirrorRef}
            aria-hidden
            style={{
              position: "absolute",
              left: p ? 34 : 76,
              right: p ? 34 : 76,
              visibility: "hidden",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: p ? 18 : 22,
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: bodyPx,
              lineHeight: 1.5,
            }}
          >
            {items.map((item, i) => (
              <div key={i} style={{ paddingBottom: p ? 16 : 18 }}>
                {item}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: p ? 18 : 22 }}>
            {items.map((item, i) => {
              const rowReveal = interpolate(frame, [rowStart(i), rowStart(i) + 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const checked = frame >= rowStart(i) + 10;
              // `dur` so a long checklist still finishes typing before the cut.
              // Each row starts later than the last, and typewriterAt derives
              // its budget from that start frame, so the lowest rows — which
              // have the least time left — compress the most.
              const { visibleText: visibleItem, cursor: itemCursor } = typewriterAt(frame, item, rowStart(i) + 10, dur);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 18,
                    opacity: rowReveal,
                    transform: `translateX(${(1 - rowReveal) * -10}px)`,
                    paddingBottom: p ? 16 : 18,
                    borderBottom: i < items.length - 1 ? `1px solid ${hexToRgba(theme.text, 0.14)}` : "none",
                  }}
                >
                  <div style={{ marginTop: Math.round(bodyPx * 0.12) }}>
                    <TickBox size={tickSize} checked={checked} color={theme.accent} />
                  </div>
                  <div
                    style={{
                      fontFamily: DOCREEL_MONO_FONT,
                      fontSize: bodyPx,
                      color: hexToRgba(theme.text, 0.92),
                      lineHeight: 1.5,
                    }}
                  >
                    {visibleItem}
                    {itemCursor}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DocReelScene>
  );
};
