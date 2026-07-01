import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import {
  MagazinePage,
  Rule,
  DeskBackdrop,
  Barcode,
  Halftone,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  MAG_BACKDROP,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
  useMagDims,
} from "../magazineStyle";

/** Tracked uppercase column heading, e.g. "Follow", "Online". */
const ColHead: React.FC<{ color: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ color, children, style }) => (
  <div
    style={{
      fontFamily: MAG_SANS,
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Closing masthead / colophon — a centred Playfair wordmark sign-off, a short
 * rule, an italic deck, then column-headed blocks for the social handles and
 * any CTAs, closed by a fine-print colophon. Modeled on the .s-mast page.
 */
export const EndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize, socials, websiteLink, showWebsiteButton, ctaButtonText, ctas } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink.length > 0 || c.ctaButtonText.trim().length > 0),
  );

  const headO = useReveal(2, 14);
  const ruleP = useReveal(10, 14);
  const deckO = useReveal(14, 14);
  const socialO = useReveal(20, 14);
  const ctaO = useReveal(26, 14);
  const fineO = useReveal(30, 14);

  const titlePx = titleFontSize ?? (p ? 92 : 132);
  const deckPx = descriptionFontSize ?? (p ? 24 : 21);

  // ── Magazine close: a true bookend to the hero cover. Over the scene's last
  // frames the full-bleed colophon SHRINKS into the same 3:4 booklet the cover
  // uses, then FLIPS on its vertical axis to reveal the magazine's BACK COVER,
  // resting on the blurred desk. Locked to the raw sequence tail (NOT useMagFrame)
  // so it always lands regardless of MAG_TEMPO.
  const { width, height } = useMagDims();
  const rawFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const CLOSE = 48; // closing move length (frames)
  const HOLD = 12; // back-cover rest beat at the very end
  const c = interpolate(rawFrame, [durationInFrames - CLOSE, durationInFrames - HOLD], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const closing = c > 0;
  const deskBlur = Math.round(width * 0.012);

  // Booklet geometry — mirrors MagazineCover so open/close are the same object.
  const cardAspect = 0.75;
  let cardH = height * (p ? 0.98 : 0.92);
  let cardW = cardH * cardAspect;
  const maxCardW = width * (p ? 0.98 : 0.68);
  if (cardW > maxCardW) {
    cardW = maxCardW;
    cardH = cardW / cardAspect;
  }
  const outer = Math.round(cardW * 0.035);
  const border = Math.round(cardW * 0.022);

  // Phase A (c 0→0.45): full-bleed page shrinks/insets into the centred booklet.
  const shrink = interpolate(c, [0, 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Phase B (c 0.45→0.92): the booklet flips to the back cover, then settles.
  const flipDeg = interpolate(c, [0.45, 0.92], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const settleTY = interpolate(c, [0.45, 1], [0, height * 0.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shadowLift = Math.sin(Math.min(1, c) * Math.PI);

  // The colophon fills the frame until the close begins, then tucks into the booklet.
  const frontIsBooklet = closing;
  // Heading prefers the scene TITLE so the ending scene's edit modal (which edits
  // the generic `title` prop) drives the back-cover wordmark; brandName is a fallback.
  const brandMark = (title || (props.brandName as string) || "").trim();

  // Back cover matches the HERO cover, which inverts the paper (dark cover, light
  // type, red frame — see MagazineCover). Invert only here; the colophon front page
  // stays on light paper.
  const coverBg = text;
  const coverText = bg;

  // The back-cover face — a back-of-issue plate: red frame on the inverted dark
  // paper, a centred wordmark and a short rule, closed by a newsstand barcode.
  const backCover = (
    <div style={{ position: "absolute", inset: 0, background: coverBg, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)" }}>
      <div style={{ position: "absolute", inset: outer, border: `${border}px solid ${accent}`, overflow: "hidden", background: coverBg }}>
        <Halftone color={coverText} opacity={0.06} gap={9} />
        {/* Thin white inner keyline, matching the front cover. */}
        <div style={{ position: "absolute", inset: Math.round(border * 0.55), border: `${Math.max(2, Math.round(border * 0.34))}px solid #FFFFFF`, pointerEvents: "none" }} />
        {/* Centred wordmark + rule. */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `0 ${outer + border + 12}px`, textAlign: "center" }}>
          {brandMark ? (
            <div style={{ fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: cardW * 0.11, lineHeight: 1.02, letterSpacing: "-0.01em", color: coverText, textTransform: "uppercase" }}>
              {brandMark}
            </div>
          ) : null}
          <div style={{ width: cardW * 0.16, height: 3, background: accent, margin: `${cardW * 0.05}px 0` }} />
        </div>
        {/* Newsstand barcode, bottom-centre. */}
        <div style={{ position: "absolute", left: "50%", bottom: "7%", transform: "translateX(-50%)", background: "#FFFFFF", padding: "6px 8px 4px" }}>
          <Barcode color="#111111" width={Math.round(cardW * 0.26)} height={Math.round(cardW * 0.075)} label="0 74820 09221" />
        </div>
      </div>
    </div>
  );

  const colophonPage = (
    <MagazinePage lightChrome colors={colors} section="Colophon" issue={props.issueLabel ?? ""} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} singlePage cameraMove={props.cameraMove} printTextureSrc="magazine-blur-bg.svg">
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <h1
          style={{
            fontFamily: MAG_DISPLAY,
            fontWeight: 900,
            fontSize: titlePx,
            lineHeight: 0.9,
            letterSpacing: "-0.02em",
            color: text,
            margin: 0,
            opacity: headO,
            maxWidth: "94%",
          }}
        >
          {title || "Thank You"}
        </h1>

        <Rule color={accent} progress={ruleP} thickness={2} width={p ? 96 : 120} style={{ margin: `${p ? 36 : 46}px 0 ${p ? 28 : 34}px` }} />

        {narration && (
          <p style={{ fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: deckPx, lineHeight: 1.55, color: hexToRgba(text, 0.6), margin: "0 0 14px", maxWidth: p ? "84%" : "54%" }}>
            {narration}
          </p>
        )}

        <div style={{ opacity: socialO, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: p ? 24 : 34 }}>
          <ColHead color={accent}>Follow</ColHead>
          <SocialIcons socials={socials} accentColor={accent} textColor={text} maxPerRow={p ? 3 : 6} fontFamily={MAG_SANS} aspectRatio={props.aspectRatio} />
        </div>

        {cards.length > 0 && (
          <div style={{ opacity: ctaO, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: p ? 26 : 34 }}>
            <ColHead color={hexToRgba(text, 0.45)}>Online</ColHead>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: p ? 14 : 22 }}>
              {cards.map((card, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: MAG_SANS,
                      fontWeight: 700,
                      fontSize: p ? 15 : 14,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: bg,
                      background: accent,
                      padding: "11px 24px",
                    }}
                  >
                    {card.ctaButtonText.trim() || "Read More"}
                  </span>
                  {card.websiteLink && (
                    <span style={{ fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: 15, color: hexToRgba(text, 0.5), wordBreak: "break-all" }}>{card.websiteLink}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ opacity: fineO, marginTop: p ? 30 : 42, fontFamily: MAG_SANS, fontWeight: 500, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: hexToRgba(text, 0.38) }}>
          {props.issueLabel ?? "Thank you for reading"}
        </div>
      </div>
    </MagazinePage>
  );

  // Before the close begins, the colophon simply fills the frame. Once closing,
  // it tucks into a centred booklet that flips to the back cover on the desk.
  if (!frontIsBooklet) {
    return <AbsoluteFill>{colophonPage}</AbsoluteFill>;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: MAG_BACKDROP }}>
      {/* Blurred desk revealed behind the booklet as it closes. */}
      <AbsoluteFill style={{ filter: `blur(${deskBlur}px)`, transform: "scale(1.06)" }}>
        <DeskBackdrop aspectRatio={props.aspectRatio} accent={accent} parallaxX={0} parallaxY={0} />
      </AbsoluteFill>

      {/* Centred booklet on the desk. */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            // Grow from the full frame into the booklet as the page shrinks.
            width: interpolate(shrink, [0, 1], [width, cardW]),
            height: interpolate(shrink, [0, 1], [height, cardH]),
            transform: `perspective(1700px) translateY(${settleTY.toFixed(1)}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              transform: `rotateY(${flipDeg.toFixed(2)}deg)`,
              boxShadow: `0 ${(10 + shadowLift * 26).toFixed(0)}px ${(20 + shadowLift * 40).toFixed(0)}px rgba(0,0,0,${(0.12 + shadowLift * 0.22).toFixed(2)})`,
            }}
          >
            {/* FRONT face — the colophon page. */}
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", overflow: "hidden" }}>
              {colophonPage}
            </div>
            {/* BACK face — the magazine's back cover, pre-rotated 180°. */}
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              {backCover}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
