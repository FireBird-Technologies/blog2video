import React from "react";
import { useCurrentFrame, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ProjectorReel,
  ReelChangeCue,
  hexToRgba,
  docReelRand,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** Sprocket-hole rail running along all four edges of a contact-sheet cell —
 *  a solid dark rail with small, densely-packed rectangular perforations,
 *  the same bold tape effect used on the Interview layout's single film
 *  frame border, scaled down and wrapped fully around each cell's border
 *  rather than just its left/right edges. */
const CellSprockets: React.FC = () => {
  const theme = useDocReelTheme();
  const frame = useCurrentFrame();
  const railW = 16;
  const holeShort = 7;
  const holeLong = 10;
  const holeGap = 6;
  const spacing = holeLong + holeGap;
  const offset = ((frame * 0.4) % spacing + spacing) % spacing;

  // Generously oversized counts — the rail div clips with overflow:hidden,
  // so this just needs to comfortably exceed any real cell's height/width
  // rather than matching it exactly (a fixed low count previously ran out
  // partway down the rail, leaving a blank unperforated gap below it).
  const vCount = 60;
  const hCount = 80;

  const rail = (axis: "vertical" | "horizontal", edgeStyle: React.CSSProperties, count: number) => (
    <div
      style={{
        position: "absolute",
        ...edgeStyle,
        background: hexToRgba(theme.bg, 0.92),
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={
            axis === "vertical"
              ? {
                  position: "absolute",
                  top: i * spacing - offset - spacing,
                  left: (railW - holeShort) / 2,
                  width: holeShort,
                  height: holeLong,
                  borderRadius: 2,
                  background: hexToRgba(theme.text, 0.94),
                }
              : {
                  position: "absolute",
                  left: i * spacing - offset - spacing,
                  top: (railW - holeShort) / 2,
                  width: holeLong,
                  height: holeShort,
                  borderRadius: 2,
                  background: hexToRgba(theme.text, 0.94),
                }
          }
        />
      ))}
    </div>
  );

  return (
    <>
      {/* Horizontal rails span the full width first, forming complete
          corners; vertical rails then fill only the strip between them, so
          every corner is one continuous, unbroken perforated border rather
          than two rails overlapping inconsistently. */}
      {rail("horizontal", { left: 0, right: 0, top: 0, height: railW }, hCount)}
      {rail("horizontal", { left: 0, right: 0, bottom: 0, height: railW }, hCount)}
      {rail("vertical", { top: railW, bottom: railW, left: 0, width: railW }, vCount)}
      {rail("vertical", { top: railW, bottom: railW, right: 0, width: railW }, vCount)}
    </>
  );
};

/** A grid of archive frames styled like a contact sheet of negatives on a
 *  light table — sprocketed cells and crop-mark corners. When only one
 *  photo is bound (the common case — scenes can only carry a single image),
 *  the sheet doesn't sit half-empty: the same photo repeats across the
 *  cells with a different crop/zoom in each, reading as multiple frames
 *  pulled off the same roll rather than one photo shown once. */
export const DocreelContactSheet: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    narration,
    imageUrl,
    bgColor,
    accentColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    era,
    contactSheetImages,
    contactSheetNotes,
  } = props;

  // The CASE NOTES panel's primary body text — write it as a genuinely long,
  // detailed multi-sentence note when there's more to say than the global
  // narration line. Falls back to narration so older scenes keep working.
  //
  // Rendered in full immediately, NOT typed in: this panel carries several
  // sentences, and typing them out reads as slow and busy rather than
  // dramatic. (The typewriter stays on the short single-line fields in other
  // layouts, per docReelStyle's own note on where it belongs.)
  const notesBody = contactSheetNotes || narration;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 120;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  const hasMultipleBound = Boolean(contactSheetImages && contactSheetImages.length > 0);

  // One shared grid holds both the photos AND the case-notes panel: a 3x2
  // sheet of 6 cells. The notes panel spans the last 4 cells as a single
  // merged 2x2 block (grid-column/row spanning), so it reads as part of the
  // same sheet rather than a separate side panel. Photos fill whatever cells
  // remain in front of it (up to 2 in landscape, up to 4 in portrait where
  // the notes panel spans fewer cells).
  const hasNotes = Boolean(title || notesBody);
  // Landscape uses a wider 4x2 sheet so the notes panel (right 2x2 block)
  // still leaves 4 photo cells — enough to read as an actual contact sheet
  // rather than just two photos. Portrait stays 3x2 with the notes panel
  // spanning the bottom row, leaving the full top row (3 cells) for photos.
  const cols = p ? 3 : 4;
  const rows = 2;
  const totalCells = cols * rows;
  const notesSpan = p ? 3 : 4;
  const photoCellCount = hasNotes ? totalCells - notesSpan : totalCells;

  // Multiple real images bound: use exactly those, one per cell, same as
  // before. Otherwise (the common single-image case): repeat the one photo
  // across every photo cell, each with a distinct deterministic crop/zoom —
  // the same roll, different frames — instead of leaving cells empty.
  const images: string[] = hasMultipleBound
    ? contactSheetImages!.slice(0, photoCellCount)
    : imageUrl
      ? Array.from({ length: photoCellCount }, () => imageUrl)
      : [];
  const cellCount = photoCellCount;

  const headerReveal = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fit the CASE NOTES copy to the cell it actually occupies. The panel is a
  // fixed-height grid cell with overflow:hidden, so without this a long note
  // is cut mid-sentence.
  //
  // The body renders in full from frame 0 (no typewriter), so the real
  // elements can be measured directly — no hidden mirror is needed. That
  // matters: a mirror has to be kept hidden by setting visibility on the
  // measured element ITSELF, since useFitText reads `el.style.visibility` to
  // decide whether to re-reveal it. Setting it on a parent wrapper instead
  // leaves the hook thinking the element is visible, and it paints the
  // full-text mirror on top of the real copy as ghosted double-text.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const titlePx = titleFontSize ?? (p ? 47 : 41);
  const bodyTargetPx = descriptionFontSize ?? (p ? 40 : 28);

  // Height budget for the note: the panel's inner height minus the headline.
  const [panelInnerPx, setPanelInnerPx] = React.useState<number | undefined>(undefined);
  React.useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const padY = (p ? 22 : 40) * 2;
    setPanelInnerPx(Math.max(0, el.clientHeight - padY));
  }, [p, aspectRatio]);

  const bodyBudget =
    panelInnerPx !== undefined
      ? Math.max(0, panelInnerPx - titlePx * 1.25 - 14)
      : undefined;
  const { px: bodyPx } = useFitText(
    bodyRef,
    bodyTargetPx,
    Math.round(bodyTargetPx * 0.55),
    [notesBody, bodyTargetPx, titlePx, p, panelInnerPx],
    bodyBudget,
  );

  const CropMarks: React.FC = () => (
    <>
      {[
        { top: -1, left: -1, borderTop: true, borderLeft: true },
        { top: -1, right: -1, borderTop: true, borderRight: true },
        { bottom: -1, left: -1, borderBottom: true, borderLeft: true },
        { bottom: -1, right: -1, borderBottom: true, borderRight: true },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            borderTop: c.borderTop ? `2px solid ${theme.accent}` : undefined,
            borderLeft: c.borderLeft ? `2px solid ${theme.accent}` : undefined,
            borderRight: c.borderRight ? `2px solid ${theme.accent}` : undefined,
            borderBottom: c.borderBottom ? `2px solid ${theme.accent}` : undefined,
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["aged_paper", "dust_scratches"]} sprockets vignette>
      {/* Light-table backlight glow behind the grid — the palette accent,
          never a true amber tint, per the strict grayscale rule. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 46%, ${hexToRgba(theme.accent, 0.1)}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* A still take-up reel in the corner of the light table — ties this
          layout into the same editor's-desk visual family as the rest of
          the template, without competing with the grid for attention. */}
      <div style={{ position: "absolute", bottom: p ? 14 : 18, right: p ? 10 : 22, opacity: 0.22, pointerEvents: "none" }}>
        <ProjectorReel size={p ? 64 : 88} opacity={0.8} beam={false} spinSpeed={0.5} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "70px 28px" : "60px 90px",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: p ? 8 : 12,
            minHeight: 0,
          }}
        >
          {Array.from({ length: Math.min(cellCount, photoCellCount) }, (_, i) => images[i]).map((src, i) => {
            const cellReveal = interpolate(frame, [10 + i * 4, 22 + i * 4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Per-cell crop/zoom variation so a single repeated photo reads
            // as distinct frames off the same roll rather than one image
            // stamped six times. Deterministic per scene+cell.
            const focusX = 30 + docReelRand(dur, 20 + i * 2) * 40;
            const focusY = 30 + docReelRand(dur, 21 + i * 2) * 40;
            const zoom = 1.05 + docReelRand(dur, 22 + i * 2) * 0.35;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  border: `1px solid ${theme.line}`,
                  overflow: "hidden",
                  opacity: cellReveal,
                  transform: `scale(${interpolate(cellReveal, [0, 1], [0.92, 1])})`,
                  background: theme.bg,
                  padding: "16px",
                }}
              >
                {typeof src === "string" ? (
                  <Img
                    src={src}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `${focusX}% ${focusY}%`,
                      transform: `scale(${zoom})`,
                      filter: "grayscale(1) contrast(1.15) brightness(.82)",
                    }}
                  />
                ) : (
                  // No frame supplied for this slot — an unexposed negative on
                  // the light table, not a flat void: backlight glow + a faint
                  // diagonal hatch, matching the exposed cells' texture level.
                  <div
                    style={{
                      width: "100%",
                      paddingTop: "66%",
                      background: `repeating-linear-gradient(45deg, ${hexToRgba(theme.text, 0.05)} 0px, ${hexToRgba(theme.text, 0.05)} 1px, transparent 1px, transparent 7px), radial-gradient(ellipse at 50% 50%, ${hexToRgba(theme.accent, 0.07)}, transparent 75%)`,
                    }}
                  />
                )}
                <CellSprockets />
                <div
                  style={{
                    position: "absolute",
                    left: 22,
                    bottom: 20,
                    fontFamily: DOCREEL_MONO_FONT,
                    fontSize: 10,
                    color: hexToRgba(theme.accent, 0.75),
                    background: hexToRgba(theme.bg, 0.6),
                    padding: "1px 4px",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <CropMarks />
              </div>
            );
          })}

          {/* CASE NOTES — occupies the last N cells of the SAME grid as one
              merged block (spanning, not a separate side column), so the
              text panel reads as part of the contact sheet itself, laid
              directly over/in place of those negatives. */}
          {hasNotes ? (
            <div
              ref={panelRef}
              style={{
                gridColumn: p ? `1 / ${cols + 1}` : `${cols - 1} / ${cols + 1}`,
                gridRow: p ? `${rows} / ${rows + 1}` : `1 / ${rows + 1}`,
                position: "relative",
                opacity: headerReveal,
                background: hexToRgba(theme.bg, 0.92),
                border: `1px solid ${theme.lineStrong}`,
                borderLeft: `4px solid ${theme.accent}`,
                padding: p ? "22px 26px" : "40px 48px",
                display: "flex",
                flexDirection: "column",
                justifyContent: notesBody && notesBody.length > 160 ? "flex-start" : "center",
                overflow: "hidden",
              }}
            >
              {title ? (
                <div
                  style={{
                    fontFamily: DOCREEL_DISPLAY_FONT,
                    fontWeight: 500,
                    fontSize: titlePx,
                    color: theme.accent,
                    lineHeight: 1.25,
                    // The panel is overflow:hidden, so a long headline would be
                    // sliced mid-word at the right edge. Wrap instead, and let
                    // the fitter shrink it if wrapping alone isn't enough.
                    width: "100%",
                    overflowWrap: "anywhere",
                    flex: "0 0 auto",
                  }}
                >
                  {title}
                </div>
              ) : null}
              {notesBody ? (
                <div
                  ref={bodyRef}
                  style={{
                    fontFamily: DOCREEL_MONO_FONT,
                    fontSize: bodyPx,
                    color: hexToRgba(theme.text, 0.88),
                    marginTop: 14,
                    lineHeight: 1.55,
                    // Measured against the panel's leftover height so a long
                    // case note shrinks to fit rather than being clipped
                    // mid-sentence by the panel's overflow:hidden.
                    width: "100%",
                    overflowWrap: "anywhere",
                    flex: "0 1 auto",
                    minHeight: 0,
                  }}
                >
                  {notesBody}
                </div>
              ) : null}

              {/* Hidden measurement mirrors. These hold the FULL text at the
                  same width/typography as the visible copy so useFitText can
                  settle on a size before the typewriter starts revealing it —
                  measuring the visible (growing) copy would resize mid-scene.
                  aria-hidden + pointer-events:none so they are invisible to
                  users and assistive tech alike. */}
            </div>
          ) : null}
        </div>
      </div>

      {/* Reel-Change Cue archive effect near the scene's tail — matches the
          projectionist changeover mark used on the other redesigned layouts. */}
      <ReelChangeCue triggerFrame={Math.max(0, dur - 22)} />
    </DocReelScene>
  );
};
