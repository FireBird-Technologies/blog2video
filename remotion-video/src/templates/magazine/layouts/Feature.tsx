import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  KineticWords,
  PageHalf,
  MagPlate,
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
  const hasImage = Boolean(props.imageUrl);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;
  const uid = React.useId().replace(/[:]/g, "");

  const frame = useMagFrame();
  const g = p ? 0 : gutterPx(props.aspectRatio); // fold-safe centre channel (landscape only)
  const kickerO = useReveal(2, 10);
  const headO = useReveal(6, 14);
  const ruleP = useReveal(14, 14);
  const kpO = useReveal(30, 16);
  const plateO = useReveal(10, 18); // the framed photo plate fades in with the spread
  const bodyO = interpolate(frame, [24, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
  // The body flows in a single column whenever a photo plate shares the spread
  // (portrait always; landscape only when an image confines the copy to the left
  // leaf), otherwise two justified columns run across both leaves.
  const bodyCols = p || hasImage ? 1 : 2;
  // Copy-capacity estimate seeds the fitter; a landscape photo halves the band.
  const bodyCapacity = p ? 760 : hasImage ? 560 : 1180;
  const len = columns.length || 1;
  const estScale = len > bodyCapacity ? Math.sqrt(bodyCapacity / len) : 1;
  const floorPx = p ? 13 : 12;
  const targetBodyPx = Math.max(floorPx, Math.round(base * estScale));

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
  // column-fill:auto (not balance) — auto fills col 1 completely before col 2,
  // so the browser never runs a per-frame balance algorithm during WrittenText
  // write-on. The copy still flows across both leaves; the split point is
  // determined once by content height, not recalculated every frame.
  const css = `.${cls}{position:relative;column-count:${bodyCols};column-gap:${p ? "6%" : `${g}px`};column-fill:auto;height:100%;box-sizing:border-box;}
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

  // The justified body column(s) with the pinned red drop cap. Factored out so the
  // image / no-image spreads can place it (full-width across both leaves, or
  // confined to the left leaf when a photo plate takes the right one).
  const bodyBlock = (
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
      <p style={{ opacity: bodyO }}>
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
        {columns.slice(1)}
      </p>
    </div>
  );

  return (
    <MagazinePage colors={colors} section={sectionLabel} issue={props.issueLabel ?? "Feature"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} establishingShot={props.establishingShot} cameraMove={props.cameraMove} lightChrome printTextureSrc="qa-timeline-bg.svg" printTextureOpacity={0.38}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 16 }}>
          {sectionLabel}
        </Kicker>

        {p ? (
          // Portrait: headline + deck on the upper page. With a photo, a full-width
          // framed plate sits between the deck and the body; the body then flows
          // below in a single fold-safe column (the fitter reflows to the space).
          <>
            <PageHalf side="left" aspectRatio={props.aspectRatio} style={{ marginBottom: hasImage ? 18 : 4 }}>
              {headline}
              <div style={{ marginBottom: 26 }}>{deckEl}</div>
            </PageHalf>
            {hasImage && (
              <MagPlate
                src={props.imageUrl}
                colors={colors}
                objectPosition={props.imageObjectPosition}
                zoom={props.imageZoom}
                opacity={plateO}
                style={{ height: "32%", flexShrink: 0, marginBottom: 24 }}
              />
            )}
            {bodyBlock}
          </>
        ) : hasImage ? (
          // Landscape with a photo: an asymmetric spread — headline, deck and a
          // single-column body confined to the LEFT leaf, a full-height framed
          // plate filling the RIGHT leaf (replacing the ghosted folio block).
          <div style={{ display: "flex", gap: g, flex: 1, minHeight: 0 }}>
            <div style={{ width: `calc(50% - ${g / 2}px)`, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {headline}
              <div style={{ marginBottom: 26 }}>{deckEl}</div>
              {bodyBlock}
            </div>
            <MagPlate
              src={props.imageUrl}
              colors={colors}
              objectPosition={props.imageObjectPosition}
              zoom={props.imageZoom}
              opacity={plateO}
              style={{ flex: 1, minWidth: 0, minHeight: 0 }}
            />
          </div>
        ) : (
          // Landscape, no photo: the original two-leaf spread — headline + deck on
          // the left page so big type never crosses the binding; the facing half
          // carries a ghosted folio + section mark so it doesn't read as blank; the
          // body then flows below in two fold-safe columns across both leaves.
          <>
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
            {bodyBlock}
          </>
        )}

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
