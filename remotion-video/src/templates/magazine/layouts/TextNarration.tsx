import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  KineticWords,
  WrittenText,
  MagPlate,
  MagSwoosh,
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
  const hasImage = Boolean(props.imageUrl);
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
  // cut off at the bottom.
  // Fewer notes when a photo plate shares the page, so the ledger never clips
  // under the reduced height.
  const maxN = (p ? 4 : 6) - (hasImage ? 2 : 0);
  const entries = toPoints(props.points, narration ?? "").slice(0, maxN);

  const titlePx = titleFontSize ?? (p ? 100 : 100);
  const entryPx = descriptionFontSize ?? (p ? 40 : 43);
  const bulletPx = p ? 22 : 17;

  const kickerO = rev(2);
  const ruleP = rev(12);
  const plateO = rev(10, 16);
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
      printTextureSrc="magazine-blur-bg.svg"
      printTextureZoom={1.6}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Department masthead */}
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 14 }}>
          {sectionLabel}
        </Kicker>
        <h1
          style={{
            fontFamily: MAG_DISPLAY,
            fontWeight: 800,
            fontSize: titlePx,
            lineHeight: 1.02,
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

        {/* Optional field plate — a full-width framed photo under the masthead,
            before the notes. The ledger below is flex:1 and reflows into the
            remaining height (maxN is trimmed when a plate is present). */}
        {hasImage && (
          <MagPlate
            src={props.imageUrl}
            colors={colors}
            objectPosition={props.imageObjectPosition}
            zoom={props.imageZoom}
            opacity={plateO}
            style={{ height: p ? "26%" : "30%", flexShrink: 0, marginTop: p ? 20 : 26 }}
          />
        )}

        {/* Numbered notes ledger — two columns (landscape) / one (portrait) */}
        <div
          style={{
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

        {/* Editorial ink swoosh — a curved black sweep, thick on the left and
            tapering to a fine tail on the right. Pinned to the very bottom edge
            of the page, flush left→right, beneath everything else. */}
        <MagSwoosh
          color={text}
          progress={footerO}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%" }}
        />
      </div>
    </MagazinePage>
  );
};
