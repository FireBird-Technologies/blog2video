import React from "react";
import { Img, useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  CropMarks,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
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
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;
  const uid = React.useId().replace(/[:]/g, "");

  const hasImage = Boolean(imageUrl) && props.imagePlacement !== "none";

  const frame = useCurrentFrame();
  const kickerO = useReveal(2, 10);
  const headO = useReveal(6, 14);
  const headY = interpolate(frame, [6, 20], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const deckO = useReveal(12, 14);
  const ruleP = useReveal(14, 14);
  const bodyO = useReveal(18, 18);
  const imgO = useReveal(3, 14);
  const imgClip = interpolate(frame, [3, 20], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, 150], [1.05, 1.13], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (imageZoom ?? 1);

  const titlePx = titleFontSize ?? (p ? 58 : hasImage ? 56 : 66);
  const bodyPx = descriptionFontSize ?? (p ? 23 : 21);

  const words = (title ?? "").split(" ");
  const lastWord = words.length > 1 ? words.pop() : undefined;
  const head = words.join(" ");

  const body = narration ?? "";
  // Use the first sentence as a deck, the remainder as the column body.
  const splitAt = body.indexOf(". ");
  const hasDeck = splitAt > 20 && splitAt < 180;
  const deck = hasDeck ? body.slice(0, splitAt + 1) : "";
  const columns = hasDeck ? body.slice(splitAt + 2) : body;

  const cls = `feat-${uid}`;
  const css = `.${cls}{column-count:${p ? 1 : 2};column-gap:6%;column-fill:balance;}
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
        opacity: headO,
        transform: `translateY(${headY}px)`,
      }}
    >
      {head}
      {lastWord ? <span style={{ fontStyle: "italic", fontWeight: 700 }}> {lastWord}</span> : null}
    </h1>
  );

  const deckEl = deck ? (
    <div
      style={{
        opacity: deckO,
        borderLeft: `4px solid ${accent}`,
        padding: "2px 0 2px 18px",
        margin: "22px 0 0",
        fontFamily: MAG_SERIF,
        fontStyle: "italic",
        fontSize: p ? 24 : 22,
        lineHeight: 1.4,
        color: hexToRgba(text, 0.78),
        maxWidth: "92%",
      }}
    >
      {deck}
    </div>
  ) : (
    <Rule color={accent} progress={ruleP} thickness={3} width={p ? 130 : 100} style={{ margin: "24px 0 0" }} />
  );

  // The framed photograph block (top-left).
  const imageBox = (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: p ? "100%" : "40%",
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
    <MagazinePage colors={colors} section={sectionLabel} issue={props.issueLabel ?? "Feature"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 16 }}>
          {sectionLabel}
        </Kicker>

        {hasImage ? (
          <div style={{ display: "flex", flexDirection: p ? "column" : "row", gap: p ? 22 : 34, marginBottom: p ? 24 : 28 }}>
            {imageBox}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", position: "relative" }}>
              <CropMarks color={hexToRgba(text, 0.3)} inset={-6} length={14} opacity={0.6 * headO} />
              {headline}
              {deckEl}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            {headline}
            <div style={{ marginBottom: 26 }}>{deckEl}</div>
          </div>
        )}

        <div
          className={cls}
          style={{
            opacity: bodyO,
            fontFamily: MAG_SERIF,
            fontSize: bodyPx,
            lineHeight: 1.62,
            color: hexToRgba(text, 0.9),
            flex: 1,
            overflow: "hidden",
          }}
        >
          <p>{columns}</p>
        </div>
      </div>
    </MagazinePage>
  );
};
