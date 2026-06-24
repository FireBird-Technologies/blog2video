import React from "react";
import { Img, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  CropMarks,
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
 * Feature article — kicker, a headline whose last word turns italic, a deck
 * with a red side-rule, then a justified two-column body led by a red drop cap
 * (via ::first-letter so it correctly leads the first column).
 *
 * When a photograph is supplied it sits in a keyline-framed box at the top-left,
 * with the headline + deck beside it (landscape) or above the body (portrait).
 * The body columns always flow full-width below, so the page reads cleanly with
 * or without an image.
 */
export const FeatureSpread: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize, imageUrl, imageObjectPosition, imageZoom } = props;
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

  const hasImage = Boolean(imageUrl) && props.imagePlacement !== "none";

  const frame = useMagFrame();
  const g = p ? 0 : gutterPx(props.aspectRatio); // fold-safe centre channel (landscape only)
  const kickerO = useReveal(2, 10);
  const headO = useReveal(6, 14);
  const ruleP = useReveal(14, 14);
  const imgO = useReveal(3, 14);
  const kpO = useReveal(30, 16);
  const imgClip = interpolate(frame, [3, 20], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, 150], [1.05, 1.13], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (imageZoom ?? 1);

  const titlePx = titleFontSize ?? (p ? 92 : 56);

  // The article body: prefer an explicit, directly-editable `body` prop; fall
  // back to the scene narration so existing scenes keep working.
  const body = ((props.body as string)?.trim() || narration || "").trim();
  // The standfirst/deck line has been removed; the full body flows into columns.
  const columns = body;

  // Body font size. The chosen size (explicit `descriptionFontSize`, else the
  // layout base) is the *target* — what we use when the copy fits. A char-count
  // estimate gives the fitter a close starting point so it converges fast and
  // doesn't flash; the real work is done by `useFitText`, which measures the
  // actual column band and shrinks the type until nothing overflows past the
  // bottom. This copes with any headline length, deck, key-points band or aspect
  // ratio — the cases the old character-count-only heuristic missed and clipped.
  const base = descriptionFontSize ?? (p ? 52 : 28);
  const bodyCapacity = hasImage ? (p ? 520 : 760) : (p ? 760 : 1180);
  const len = columns.length || 1;
  const estScale = len > bodyCapacity ? Math.sqrt(bodyCapacity / len) : 1;
  const floorPx = p ? 13 : 12;
  const targetBodyPx = Math.max(floorPx, Math.round(base * estScale));

  // The body flows in 1 column (portrait) or 2 (landscape) — matches the column
  // CSS below; the fitter needs it to compute the band's true copy capacity.
  const bodyCols = p ? 1 : 2;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const bodyPx = useFitText(bodyRef, targetBodyPx, floorPx, bodyCols, [columns, targetBodyPx, p, hasImage]);

  const cls = `feat-${uid}`;
  // A definite height (100% of the flex region) is what lets `column-fill:balance`
  // actually balance the two columns evenly across the spread — without it the
  // browser dumps everything into the first column and leaves the facing page
  // empty. `height:100%` + `box-sizing:border-box` keeps the columns full-bleed
  // top-to-bottom so both leaves carry equal copy.
  const css = `.${cls}{column-count:${p ? 1 : 2};column-gap:${p ? "6%" : `${g}px`};column-fill:balance;height:100%;box-sizing:border-box;}
.${cls} p{margin:0;text-align:justify;}
.${cls} p::first-letter{float:left;font-family:${MAG_DISPLAY};font-weight:800;font-size:${bodyPx * 3.6}px;line-height:0.72;padding:6px 14px 0 0;color:${accent};}`;

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

  // The framed photograph block (top-left).
  const imageBox = (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: "100%",
        aspectRatio: p ? "16 / 9" : "4 / 3",
        opacity: imgO,
        border: `1px solid ${hexToRgba(text, 0.18)}`,
        background: hexToRgba(text, 0.04),
        overflow: "hidden",
        boxShadow: "0 10px 26px rgba(0,0,0,0.14)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: `inset(0 ${100 - imgClip}% 0 0)` }}>
        <Img
          src={imageUrl as string}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: imageObjectPosition ?? "50% 50%",
            transform: `scale(${kbScale.toFixed(4)})`,
          }}
        />
      </div>
      {/* accent corner tick + figure label */}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: 56, background: accent, opacity: imgO }} />
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 8,
          fontFamily: MAG_SANS,
          fontWeight: 700,
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#fff",
          background: hexToRgba("#000000", 0.5),
          padding: "3px 7px",
          opacity: imgO,
        }}
      >
        {`Fig. ${props.pageNumber ?? "01"}`}
      </div>
    </div>
  );

  return (
    <MagazinePage colors={colors} section={sectionLabel} issue={props.issueLabel ?? "Feature"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} establishingShot={props.establishingShot} cameraMove={props.cameraMove}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 16 }}>
          {sectionLabel}
        </Kicker>

        {hasImage ? (
          <div style={{ display: "flex", flexDirection: p ? "column" : "row", gap: p ? 22 : g, marginBottom: p ? 24 : 28 }}>
            {/* image rests on the left page, headline + deck on the right page */}
            <div style={{ flexShrink: 0, width: p ? "100%" : "42%" }}>{imageBox}</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", position: "relative" }}>
              <CropMarks color={hexToRgba(text, 0.3)} inset={-6} length={14} opacity={0.6 * headO} />
              {headline}
              {deckEl}
            </div>
          </div>
        ) : p ? (
          // No image (portrait): headline + deck sit on the upper page; the body
          // then flows below in a single fold-safe column.
          <PageHalf side="left" aspectRatio={props.aspectRatio} style={{ marginBottom: 4 }}>
            {headline}
            <div style={{ marginBottom: 26 }}>{deckEl}</div>
          </PageHalf>
        ) : (
          // No image (landscape): headline + deck sit on the left page so big
          // type never crosses the binding; the facing half of the band carries a
          // folio + section mark so it doesn't read as blank. The body then flows
          // below in two fold-safe columns.
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
          }}
        >
          <p>
            <WrittenText text={columns} start={24} />
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
