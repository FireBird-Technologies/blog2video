import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  KineticWords,
  WrittenText,
  PageHalf,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
  gutterPx,
  useMagFrame,
  useFitText,
} from "../magazineStyle";

/**
 * Feature article — a purely typographic two-page spread. A red kicker, a
 * headline whose last word turns italic, a deck with a red side-rule, then a
 * justified two-column body that inks in word-by-word, led by a red drop cap
 * (via ::first-letter so it correctly leads the first column). A large ghosted
 * folio number and a vertical section mark sit on the facing page, and a row of
 * key-points runs along the bottom of both leaves.
 *
 * Image-free, in keeping with the print redesign — the body is supplied by the
 * generation pipeline (the `body` prop, distilled from the source script) and
 * falls back to the scene narration. The scene carries its own write-on motion,
 * so no cross-page transition runs on either side of it (see the feature skip in
 * transitions/index.ts).
 */
export const Feature: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const sectionLabel = (props.sectionLabel as string) ?? "Feature";
  const keyPoints = (Array.isArray(props.keyPoints) ? props.keyPoints : [])
    .map((k) => (typeof k === "string" ? k : (k as { value?: string })?.value ?? ""))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;
  const uid = React.useId().replace(/[:]/g, "");

  const frame = useMagFrame();
  const g = p ? 0 : gutterPx(props.aspectRatio); // fold-safe centre channel (landscape only)
  const kickerO = useReveal(2, 10);
  const headO = useReveal(6, 14);
  const ruleP = useReveal(14, 14);
  const kpO = useReveal(30, 16);

  const titlePx = titleFontSize ?? (p ? 92 : 56);

  // The article body: prefer an explicit, directly-editable `body` prop (filled
  // by the generation pipeline from the source script); fall back to the scene
  // narration so existing scenes keep working.
  const body = ((props.body as string)?.trim() || narration || "").trim();
  // The full body flows into columns; its first letter becomes the drop cap.
  const columns = body;

  // Body font size. The chosen size (explicit `descriptionFontSize`, else the
  // layout base) is the *target* — what we use when the copy fits. A char-count
  // estimate gives the fitter a close starting point so it converges fast and
  // doesn't flash; the real work is done by `useFitText`, which measures the
  // actual column band and shrinks the type until nothing overflows past the
  // bottom. This copes with any headline length, key-points band or aspect ratio.
  const base = descriptionFontSize ?? (p ? 52 : 28);
  const bodyCapacity = p ? 760 : 1180;
  const len = columns.length || 1;
  const estScale = len > bodyCapacity ? Math.sqrt(bodyCapacity / len) : 1;
  const floorPx = p ? 13 : 12;
  const targetBodyPx = Math.max(floorPx, Math.round(base * estScale));

  // The body flows in 1 column (portrait) or 2 (landscape) — matches the column
  // CSS below; the fitter needs it to compute the band's true copy capacity.
  const bodyCols = p ? 1 : 2;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const bodyPx = useFitText(bodyRef, targetBodyPx, floorPx, bodyCols, [columns, targetBodyPx, p]);

  const cls = `feat-${uid}`;
  // Drop-cap sizing — the cap is painted as an element pinned to the top-left of
  // the FIRST column (see the absolutely-positioned span below), NOT as a float or
  // `::first-letter` inside the balanced column flow. Any float at the head of the
  // paragraph gets relocated by `column-fill:balance` when the copy is short (the
  // browser splits the paragraph and the float follows the split into the facing
  // column — the "letter on the second page" bug). Pinning the cap to the
  // container's top-left and reserving its footprint with a transparent inline
  // spacer keeps it locked to column 1 regardless of how the copy balances.
  const capPx = bodyPx * 3.6;
  const capW = capPx * 0.62; // approx glyph advance — width reserved for the cap
  // A definite height (100% of the flex region) is what lets `column-fill:balance`
  // actually balance the two columns evenly across the spread — without it the
  // browser dumps everything into the first column and leaves the facing page
  // empty. `height:100%` + `box-sizing:border-box` keeps the columns full-bleed
  // top-to-bottom so both leaves carry equal copy.
  const css = `.${cls}{position:relative;column-count:${p ? 1 : 2};column-gap:${p ? "6%" : `${g}px`};column-fill:balance;height:100%;box-sizing:border-box;}
.${cls} p{margin:0;text-align:justify;}`;

  const headline = (
    <h1
      style={{
        fontFamily: MAG_DISPLAY,
        fontWeight: 800,
        fontSize: titlePx,
        lineHeight: 1.02,
        letterSpacing: "-0.015em",
        color: text,
        margin: 0,
      }}
    >
      <KineticWords text={title ?? ""} start={6} stagger={3} dur={16} italicizeLast focus />
    </h1>
  );

  const deckEl = (
    <Rule color={accent} progress={ruleP} thickness={3} width={p ? 130 : 100} style={{ margin: "24px 0 0" }} />
  );

  return (
    <MagazinePage colors={colors} section={sectionLabel} issue={props.issueLabel ?? "Feature"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} establishingShot={props.establishingShot} cameraMove={props.cameraMove}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 16 }}>
          {sectionLabel}
        </Kicker>

        {p ? (
          // Portrait: headline + deck sit on the upper page; the body then flows
          // below in a single fold-safe column.
          <PageHalf side="left" aspectRatio={props.aspectRatio} style={{ marginBottom: 4 }}>
            {headline}
            <div style={{ marginBottom: 26 }}>{deckEl}</div>
          </PageHalf>
        ) : (
          // Landscape: headline + deck sit on the left page so big type never
          // crosses the binding; the facing half carries a ghosted folio + section
          // mark so it doesn't read as blank. The body then flows below in two
          // fold-safe columns.
          <div style={{ display: "flex", alignItems: "flex-start", gap: g, marginBottom: 4 }}>
            <div style={{ width: `calc(50% - ${g / 2}px)`, flexShrink: 0 }}>
              {headline}
              <div style={{ marginBottom: 26 }}>{deckEl}</div>
            </div>
            <div style={{ flex: 1, position: "relative", alignSelf: "stretch", minHeight: 180 }}>
              <div
                style={{
                  position: "absolute",
                  top: -16,
                  right: 64,
                  fontFamily: MAG_DISPLAY,
                  fontWeight: 900,
                  fontSize: 200,
                  lineHeight: 0.8,
                  letterSpacing: "-0.04em",
                  color: hexToRgba(text, 0.07),
                  opacity: headO,
                  pointerEvents: "none",
                }}
              >
                {props.pageNumber ?? "01"}
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontFamily: MAG_SANS,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: hexToRgba(text, 0.5),
                  opacity: headO,
                }}
              >
                {sectionLabel}
              </div>
            </div>
          </div>
        )}

        <div
          ref={bodyRef}
          className={cls}
          style={{
            fontFamily: MAG_SERIF,
            fontSize: bodyPx,
            lineHeight: 1.62,
            color: hexToRgba(text, 0.9),
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Visible drop cap — pinned to the top-left of the first column so the
              column balancer can never relocate it to the facing page. */}
          {columns.charAt(0) && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 6,
                left: 0,
                fontFamily: MAG_DISPLAY,
                fontWeight: 800,
                fontSize: capPx,
                lineHeight: 0.72,
                color: accent,
                pointerEvents: "none",
                zIndex: 1,
                opacity: interpolate(frame, [24, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              {columns.charAt(0)}
            </span>
          )}
          <p>
            {/* Transparent inline spacer that reserves the cap's footprint so the
                first lines wrap around it. Being empty, even if balancing relocates
                it nothing is visible — the real cap is the pinned span above. */}
            {columns.charAt(0) && (
              <span
                aria-hidden
                style={{
                  float: "left",
                  width: capW,
                  height: capPx * 0.72,
                  marginRight: 14,
                }}
              />
            )}
            <WrittenText text={columns.slice(1)} start={24} />
          </p>
        </div>

        {keyPoints.length > 0 && (
          <div style={{ flexShrink: 0, marginTop: p ? 20 : 24 }}>
            <Rule color={hexToRgba(text, 0.18)} progress={kpO} thickness={1} width="100%" style={{ marginBottom: p ? 14 : 16 }} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: p ? "1fr" : "1fr 1fr",
                columnGap: g || "6%",
                rowGap: p ? 10 : 12,
              }}
            >
              {keyPoints.map((point, i) => {
                const start = 30 + i * 5;
                const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, opacity: o }}>
                    <span style={{ flexShrink: 0, width: 8, height: 8, marginTop: 2, background: accent }} />
                    <span
                      style={{
                        fontFamily: MAG_SANS,
                        fontWeight: 600,
                        fontSize: p ? 19 : 17,
                        lineHeight: 1.32,
                        letterSpacing: "0.01em",
                        color: hexToRgba(text, 0.82),
                      }}
                    >
                      {point}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MagazinePage>
  );
};
