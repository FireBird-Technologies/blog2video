import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
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

  // Narration → numbered notes (sentence split), capped so the page stays calm.
  // Portrait is one tall column, so fewer/shorter notes fit before the fixed-
  // height content area clips — cap tighter there so the last note never gets
  // cut off at the bottom.
  const maxN = p ? 4 : 6;
  const entries = (narration ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxN);

  const titlePx = titleFontSize ?? (p ? 60 : 44);
  const entryPx = descriptionFontSize ?? (p ? 26 : 17);
  const bulletPx = p ? 16 : 12;

  const kickerO = rev(2);
  const ruleP = rev(12);
  const footerO = rev(18 + entries.length * 5 + 4);

  const footerLabel = (props.issueLabel as string) ?? sectionLabel;

  return (
    <MagazinePage
      colors={colors}
      section={sectionLabel}
      issue={props.issueLabel ?? sectionLabel}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      singlePage
      printTextureSrc="field-notes-bg.svg"
      printTextureOpacity={0.5}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
          }}
        >
          <KineticWords text={title ?? ""} start={6} stagger={3} dur={16} />
        </h1>
        <Rule color={accent} progress={ruleP} thickness={3} width="100%" style={{ marginTop: 18 }} />

        {/* Numbered notes ledger — two columns (landscape) / one (portrait) */}
        <div
          style={{
            flex: 1,
            marginTop: p ? 24 : 34,
            display: "grid",
            gridTemplateColumns: p ? "1fr" : "1fr 1fr",
            columnGap: 56,
            rowGap: p ? 20 : 36,
            alignContent: "start",
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
          <div style={{ height: 1, background: hexToRgba(text, 0.25), marginBottom: 10 }} />
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
