import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";
import {
  MagazinePage,
  MAG_TEXTURES,
  Kicker,
  Rule,
  KineticWords,
  WrittenText,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useMagFrame,
  hexToRgba,
} from "../magazineStyle";

// Normalise a points prop (object_array of { value } or string[]) to a clean
// string list. When absent, fall back to splitting the legacy narration prose
// into sentence bullets so older saved scenes still render as separate notes.
// Strip any leading bullet glyph the source text may carry (●, •, ▪, ‣, ◦, *,
// -, –, —) so we never paint a bullet inside the note — the ledger draws its
// own editorial marker.
const stripBullet = (s: string): string =>
  s.replace(/^[\s]*[•·●▪‣◦*\-–—]+[\s]+/, "").trim();

const toPoints = (raw: unknown, fallbackText: string): string[] => {
  const pts = (Array.isArray(raw) ? raw : [])
    .map((x) => (typeof x === "string" ? x : (x as { value?: string })?.value ?? ""))
    .map((s) => stripBullet(s))
    .filter(Boolean);
  if (pts.length) return pts;
  return (fallbackText || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => stripBullet(s))
    .filter(Boolean);
};

/**
 * Text narration — a single-page "FIELD NOTES" index. Instead of a two-leaf
 * opening spread, this is ONE sheet: a department masthead, then the narration
 * broken into BULLETED notes laid out as a two-column ledger, with a footer mast.
 * Reads like flipping to a magazine's Departments / Field Notes page rather than
 * a chapter opener.
 *
 * All text is narration-driven: the notes are sentences split from the narration,
 * and the title / section / folio come from the existing scene props.
 */
export const TextNarration: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const sectionLabel = (props.sectionLabel as string) ?? "Field Notes";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const frame = useMagFrame();
  const rev = (start: number, len = 12) =>
    interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Field-notes ledger, capped so the page stays calm. Prefer the structured
  // `points` array (each item is one bullet); fall back to sentence-splitting
  // the narration for legacy scenes that only carry prose.
  // Portrait is one tall column, so fewer/shorter notes fit before the fixed-
  // height content area clips — cap tighter there so the last note never gets
  // cut off at the bottom. The optional photo sits as a full-bleed background
  // (not a plate), so it never steals height from the ledger.
  const maxN = p ? 4 : 6;
  const entries = toPoints(props.points, narration ?? "").slice(0, maxN);

  const titleTargetPx = titleFontSize ?? (p ? 100 : 100);
  // Portrait is one tall single column, so the notes can carry a larger body size
  // and still fit (the ledger caps at maxN notes and centres in the remaining height).
  const entryTargetPx = descriptionFontSize ?? (p ? 72 : 43);
  const bulletPx = p ? 28 : 17;

  const titleFontSizeIsUserSet = (props as { titleFontSizeIsUserSet?: boolean }).titleFontSizeIsUserSet;
  const descriptionFontSizeIsUserSet = (props as { descriptionFontSizeIsUserSet?: boolean }).descriptionFontSizeIsUserSet;

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and the ledger notes are unbounded user/narration-derived input;
     long copy was clipped by the ledger grid's overflow:hidden (fixed
     entryPx, no measurement at all). Measure the real page height and shrink
     both to fit. The ledger's entries share one font size, so the LONGEST
     entry is measured (a hidden hidden mirror) and the fitted size applied
     to every note — a note shorter than the longest already fits. An
     explicitly chosen size is honored exactly (minPx === targetPx no-ops). */
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    const next = pageRef.current?.clientHeight ?? 0;
    if (next > 0) setPageHeight((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
  }, [p]);

  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const titleBudget = pageHeight > 0 ? Math.round(pageHeight * (p ? 0.16 : 0.2)) : undefined;
  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : Math.max(28, Math.round(titleTargetPx * 0.4)),
    [title, titleTargetPx, titleFontSizeIsUserSet, titleBudget, p],
    titleBudget,
  );

  const longestEntry = entries.reduce((a, b) => (b.length > a.length ? b : a), "");
  const entryMeasureRef = React.useRef<HTMLParagraphElement>(null);
  const entryBudget = pageHeight > 0 ? Math.round(pageHeight * (p ? 0.14 : 0.32)) : undefined;
  const { px: entryPx } = useFitText(
    entryMeasureRef,
    entryTargetPx,
    descriptionFontSizeIsUserSet ? entryTargetPx : Math.max(18, Math.round(entryTargetPx * 0.45)),
    [longestEntry, entryTargetPx, descriptionFontSizeIsUserSet, titlePx, entryBudget, p],
    entryBudget,
  );

  const kickerO = rev(2);
  const ruleP = rev(12);
  const footerO = rev(18 + entries.length * 5 + 4);

  const footerLabel = (props.issueLabel as string) ?? sectionLabel;

  return (
    <MagazinePage
      lightChrome
      colors={colors}
      section={sectionLabel}
      issue={props.issueLabel ?? sectionLabel}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      singlePage
      printTextureSrc={MAG_TEXTURES.blur}
      printTextureZoom={1.6}
      backgroundImageSrc={props.imageUrl}
      backgroundVideoUrl={props.videoUrl}
      backgroundVideoMuted={props.videoMuted}
      backgroundVideoVolume={props.videoVolume}
      backgroundVideoDurationInFrames={props.videoDurationInFrames}
      backgroundVideoStartInFrames={props.videoStartInFrames}
      backgroundImageObjectPosition={props.imageObjectPosition}
      backgroundImageZoom={props.imageZoom}
      backgroundImageOpacity={0.22}
    >
      <div ref={pageRef} style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Department masthead */}
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 14 }}>
          {sectionLabel}
        </Kicker>
        <h1
          ref={titleRef}
          style={{
            fontFamily: MAG_DISPLAY,
            fontWeight: 800,
            fontSize: titlePx,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: text,
            margin: 0,
            // Keep the heading on the left leaf so it never crosses the center
            // hinge crease of the spread background (landscape only; portrait
            // has no fold). Cap short of the 50% fold and force long words to
            // wrap/break so a wide word can never spill over the hinge — the
            // heading always stays wholly on the left page.
            maxWidth: p ? "100%" : "44%",
            overflowWrap: "break-word",
            wordBreak: "break-word",
            hyphens: "auto",
          }}
        >
          <KineticWords text={title ?? ""} start={6} stagger={3} dur={16} />
        </h1>
        <Rule color={accent} progress={ruleP} thickness={3} width="100%" style={{ marginTop: 10 }} />

        {/* Numbered notes ledger — two columns (landscape) / one (portrait). The
            optional photo renders as a full-bleed page background (see
            backgroundImageSrc on MagazinePage above), so the ledger keeps its
            full height regardless of whether a photo is present. */}
        <div
          style={{
            position: "relative",
            flex: 1,
            marginTop: p ? 24 : 34,
            display: "grid",
            gridTemplateColumns: p ? "1fr" : "1fr 1fr",
            columnGap: 56,
            rowGap: p ? 20 : 36,
            alignContent: "center",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Hidden mirror of the longest note, sized to one grid column, used
              only to measure — every visible note shares the resulting
              entryPx, so a shorter note (which would measure smaller) never
              drives the size and the longest note is what actually fits.
              position:absolute takes it out of grid flow entirely so it can't
              affect track sizing or push real entries around; useFitText's
              own measurement pass re-widens it to the real column width via
              el.clientWidth before probing (see the hook's width-bug note),
              so it needs a real starting width here, not auto. */}
          <p
            ref={entryMeasureRef}
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              visibility: "hidden",
              pointerEvents: "none",
              width: p ? "100%" : "calc(50% - 28px)",
              fontFamily: MAG_SERIF,
              fontSize: entryPx,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {longestEntry}
          </p>
          {entries.map((note, i) => {
            const o = rev(18 + i * 5);
            return (
              <div key={i}>
                <div style={{ width: 30, height: 2, background: accent, marginBottom: 10, opacity: o, transformOrigin: "left center" }} />
                <div style={{ display: "flex", alignItems: "baseline", gap: p ? 16 : 10 }}>
                  <span
                    aria-hidden
                    style={{
                      fontSize: bulletPx,
                      lineHeight: 1,
                      color: accent,
                      opacity: o,
                      flexShrink: 0,
                      // square editorial bullet, optically aligned to the serif baseline
                      transform: `translateY(${Math.round(bulletPx * -0.18)}px)`,
                    }}
                  >
                    ▪
                  </span>
                  <p
                    style={{
                      fontFamily: MAG_SERIF,
                      fontSize: entryPx,
                      lineHeight: 1.5,
                      color: text,
                      opacity: 0.92,
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    <WrittenText text={note} start={20 + i * 5} />
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer mast */}
        <div style={{ opacity: footerO, marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontFamily: MAG_SANS,
                fontWeight: 600,
                fontSize: p ? 16 : 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: hexToRgba(text, 0.55),
              }}
            >
              {footerLabel}
            </span>
            <span
              style={{
                fontFamily: MAG_SANS,
                fontWeight: 600,
                fontSize: p ? 16 : 11,
                letterSpacing: "0.1em",
                color: hexToRgba(text, 0.55),
              }}
            >
              {props.pageNumber ?? "01"}
            </span>
          </div>
        </div>
      </div>
    </MagazinePage>
  );
};
