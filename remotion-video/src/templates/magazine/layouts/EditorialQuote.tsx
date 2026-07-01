import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Halftone,
  QuoteGlyph,
  WrittenText,
  Typewriter,
  MAG_DISPLAY,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
  useMagFrame,
} from "../magazineStyle";

/**
 * Editorial pull quote — an asymmetric "bleed-quote" page. An oversized accent
 * quotation mark bleeds off the top-left corner, a vertical accent rail grows
 * down the left margin, and the statement is set large and left-aligned, anchored
 * toward the lower-left. The attribution runs as vertical marginalia up the right
 * edge (landscape) or beneath the quote (portrait). Deliberately off-centre so it
 * never reads like the centred text-narration page.
 */
export const EditorialQuote: React.FC<SceneLayoutProps> = (props) => {
  const { title, titleFontSize, descriptionFontSize } = props;
  // The pull quote is the layout's own copy: the composition resolves `title` to the
  // layout-prop quote for this layout (see buildLayoutProps / MagazineVideo). We render
  // ONLY that quote + the attribution — the scene's main Display-text is not shown here.
  const quote = (title ?? "").trim();
  // Attribution is an explicit credit line only — never fall back to the quote
  // copy, or the statement would be duplicated as its own attribution.
  const attribution = (props.attribution as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const frame = useMagFrame();
  const { fps } = useVideoConfig();

  // The bleeding glyph and halftone field fade in first; the rail then grows.
  const markO = useReveal(4, 16);
  const railP = useReveal(6, 18);
  const glyphScale = 0.86 + 0.14 * markO;

  const words = quote.split(" ");
  const wStart = 14; // start right after the glyph + rail have appeared
  const wStagger = Math.max(1, Math.round(fps * 0.045)); // tighter stagger = smoother flow
  const wDur = Math.round(fps * 0.22); // each word fades in quickly
  const lastEnd = wStart + (words.length - 1) * wStagger + wDur;
  const attrO = interpolate(frame, [lastEnd, lastEnd + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const quotePx = titleFontSize ?? (p ? 92 : 78);
  const attrPx = descriptionFontSize ?? (p ? 52 : 26);
  const glyphSize = p ? 320 : 520;

  const attrInner = attribution && (
    <div
      style={{
        fontFamily: MAG_SANS,
        fontWeight: 700,
        fontSize: attrPx,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: text,
        opacity: 0.78,
      }}
    >
      <Typewriter text={attribution.replace(/^[—–-]\s*/, "")} start={lastEnd + 14} cpf={1.2} caretColor={accent} />
    </div>
  );

  return (
    <MagazinePage
      colors={colors}
      section="Quote"
      issue={props.issueLabel ?? "Comment"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      lightChrome
      singlePage
      hidePrintTexture
    >
      <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
        {/* Faint halftone field for print texture */}
        <Halftone color={text} opacity={0.05 * markO} gap={8} />

        {/* Oversized quotation mark anchored in the top-left — kept fully inside
            the page so the wrapper's overflow:hidden never chops it off. */}
        <QuoteGlyph
          color={accent}
          size={glyphSize}
          opacity={0.16 * markO}
          style={{
            position: "absolute",
            top: p ? "2%" : "0%",
            left: p ? "4%" : "5%",
            transform: `scale(${glyphScale.toFixed(3)})`,
            transformOrigin: "top left",
          }}
        />

        {/* Vertical accent rail growing down the left margin */}
        <div
          style={{
            position: "absolute",
            top: p ? "18%" : "14%",
            left: p ? "8%" : "9%",
            width: 6,
            height: p ? "60%" : "64%",
            background: accent,
            transform: `scaleY(${railP.toFixed(3)})`,
            transformOrigin: "top",
          }}
        />

        {/* The statement — left-aligned, tucked just below the quotation glyph */}
        <div
          style={{
            position: "absolute",
            left: "16%",
            right: p ? "10%" : "22%",
            top: p ? "22%" : "18%",
            bottom: p ? "8%" : "10%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <blockquote
            style={{
              fontFamily: MAG_DISPLAY,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: quotePx,
              lineHeight: 1.26,
              letterSpacing: "-0.01em",
              color: text,
              margin: 0,
              maxWidth: "100%",
              textAlign: "left",
            }}
          >
            <WrittenText text={quote} start={wStart} wordsPerFrame={wStagger > 0 ? 1 / wStagger : 0.5} dur={wDur} />
          </blockquote>

          {/* Attribution beneath the quote with a short accent rule */}
          {attribution && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26, opacity: attrO }}>
              <div style={{ width: 46, height: 2, background: accent }} />
              {attrInner}
            </div>
          )}
        </div>

        {/* Faded-black vignette along the very bottom of the page. Pointer-inert
            and low in the stack (the quote block above is zIndex:1) so it darkens
            the bottom edge without ever landing on the statement or attribution. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "22%",
            background: "linear-gradient(to top, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.14) 45%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      </div>
    </MagazinePage>
  );
};
