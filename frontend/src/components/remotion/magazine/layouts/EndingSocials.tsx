import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import {
  Rule,
  DeskBackdrop,
  Barcode,
  Halftone,
  PageThickness,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  MAG_BACKDROP,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useMagDims,
  useFitText,
} from "../magazineStyle";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.out(Easing.cubic);

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
 * Closing sign-off — the EXACT REVERSE of the hero cover open. The hero raises the
 * booklet UP off the desk (rotateX 78°→0°, scaling in). This scene plays that
 * backward: the issue stands upright showing its BACK COVER — which carries the CTA
 * sign-off — then LAYS BACK DOWN flat onto the desk (rotateX 0°→78°, scaling out) as
 * the camera pulls away, coming to rest on the table. ONE card, ONE transform (like
 * the hero), so the move is as smooth as the open. Locked to the RAW sequence tail so
 * it always lands regardless of MAG_TEMPO.
 */
export const EndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize, socials, websiteLink, showWebsiteButton, ctaButtonText, ctas } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink.length > 0 || c.ctaButtonText.trim().length > 0),
  );

  const deckPx = descriptionFontSize ?? (p ? 52 : 24);

  const { width, height } = useMagDims();
  const rawFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const deskBlur = Math.round(width * 0.012);

  // Booklet geometry — identical to MagazineCover so open & close are the same object.
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
  const padX = outer + border + Math.round(cardW * 0.05);

  // ── Zoom-out + fade exit ──────────────────────────────────────────────────────
  // The magazine slowly recedes from screen centre and dissolves — no desk, no 3D tilt.
  // The move runs over the scene's tail; before it, the upright back cover holds so the CTA reads.
  const CLOSE = 130; // exit length in raw frames — long, slow float away (was 70) so the zoom-out is gentle
  const l = interpolate(rawFrame, [durationInFrames - CLOSE, durationInFrames - 1], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const closeScale = interpolate(l, [0, 1], [1.28, 0.9]); // starts BIGGER (zoomed in) then eases out only SLIGHTLY
  const closeOpacity = interpolate(l, [0, 1], [1, 0]);       // fades away
  const backdropOpacity = interpolate(l, [0.55, 1], [1, 0]); // backdrop fades slightly behind it
  const cardTransform = `scale(${closeScale.toFixed(4)})`;

  // ── Back-cover CONTENT reveal — prints in up front (while the issue stands
  // upright and readable), settled well BEFORE the laydown begins.
  const rev = (from: number, to: number) => interpolate(rawFrame, [from, to], [0, 1], CLAMP);
  const contentO = rev(2, 16);
  const headO = rev(4, 18);
  const ruleP = rev(10, 24);
  const socialO = rev(16, 30);
  const ctaO = rev(22, 36);
  const fineO = rev(28, 42);

  // Heading prefers the scene TITLE so the ending scene's edit modal (which edits the
  // generic `title` prop) drives the back-cover wordmark; brandName is a fallback.
  const brandMark = (title || (props.brandName as string) || "").trim();

  // The back cover inverts the paper to match the HERO cover (dark cover, light type,
  // red frame — see MagazineCover). This is the magazine's BACK COVER, carrying the CTA.
  const coverBg = text;
  const coverText = bg;
  // Wordmark sizing — a MODEST sign-off headline (not the hero masthead), fitted so
  // ALL its wrapped lines sit inside a capped title zone at the top of the cover and no
  // word ever touches the red frame. We estimate how many lines the headline wraps to
  // at a candidate size, then shrink until those lines fit the title zone's height.
  //   • width cap : the longest word must fit on one line (never overflow the frame).
  //   • height cap: total wrapped height (lines × size × lineHeight) ≤ titleZoneH.
  // A supplied titleFontSize is only ever an upper bound; the sign-off stays restrained.
  const innerW = cardW - 2 * padX;
  const LINE_H = 1.12; // display line-height (Playfair needs ≥~1.1 so wrapped lines never overlap)
  const titleZoneH = cardH * 0.26; // the title never spills past ~the top quarter
  const chars = brandMark.length || 1;
  const longestWord = brandMark.split(/\s+/).filter(Boolean).reduce((m, w) => Math.max(m, w.length), 1);
  const byWord = innerW / Math.max(1, longestWord * 0.6); // longest word fits one line
  // Solve for the size where the (wrapped) headline height fills the zone: at size s,
  // chars-per-line ≈ innerW/(s*0.6), lines ≈ chars/cpl = chars*s*0.6/innerW, so
  // height ≈ lines*s*LINE_H = chars*0.6*LINE_H*s²/innerW ≤ titleZoneH  ⇒ solve for s.
  const byHeight = Math.sqrt((titleZoneH * innerW) / (chars * 0.6 * LINE_H));
  // The math above is only a STARTING size — Playfair 900 caps wrap wider/taller than the
  // 0.6·size estimate, so we then MEASURE the real wrapped height and shrink the wordmark
  // until every line fits the fixed title band (never clipped by the overflow safety net).
  const titleRef = React.useRef<HTMLDivElement>(null);
  const targetPx = Math.max(18, Math.min(titleFontSize ?? cardW * 0.09, byWord, byHeight, cardW * 0.09));
  const wordPx = useFitText(titleRef, targetPx, 14, 1, [brandMark, cardW, cardH, padX, targetPx, p]);

  // ── The BACK COVER — a back-of-issue plate matching the hero's front cover (red
  // frame + white keyline on inverted dark paper), carrying the full CTA sign-off:
  // wordmark, deck, social handles, CTAs and colophon, closed by a newsstand barcode.
  const backCover = (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: coverBg, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)" }}>
      <div style={{ position: "absolute", inset: outer, border: `${border}px solid ${accent}`, overflow: "hidden", background: coverBg }}>
        <Halftone color={coverText} opacity={0.06} gap={9} />
        {/* Thin white inner keyline, matching the front cover. */}
        <div style={{ position: "absolute", inset: Math.round(border * 0.55), border: `${Math.max(2, Math.round(border * 0.34))}px solid #FFFFFF`, pointerEvents: "none", zIndex: 2 }} />

        {/* CTA sign-off, centred on the back cover. Bottom padding reserves the
            barcode band (barcode height + its padding + bottom offset) so the CTA
            buttons / colophon can never overlap the barcode. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${Math.round(cardH * 0.08)}px ${padX}px ${Math.round(cardH * 0.15)}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            textAlign: "center",
            gap: Math.round(cardH * 0.01),
            opacity: contentO,
          }}
        >
          {brandMark ? (
            <div ref={titleRef} style={{ fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: wordPx, lineHeight: LINE_H, letterSpacing: "0.005em", color: coverText, textTransform: "uppercase", opacity: headO, width: "100%", height: titleZoneH, overflow: "hidden", overflowWrap: "break-word", textAlign: "center" }}>
              {brandMark}
            </div>
          ) : null}

          <Rule color={accent} progress={ruleP} thickness={2} width={p ? 96 : 120} style={{ margin: `${cardW * 0.03}px 0` }} />

          {narration && (
            <p style={{ fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: deckPx, lineHeight: 1.45, color: hexToRgba(coverText, 0.72), margin: 0, maxWidth: p ? "90%" : "72%", opacity: headO }}>
              {narration}
            </p>
          )}

          <div style={{ opacity: socialO, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: cardH * 0.02 }}>
            <ColHead color={accent}>{(props.followLabel as string)?.trim() || "Follow"}</ColHead>
            <SocialIcons socials={socials} accentColor={accent} textColor={coverText} maxPerRow={p ? 3 : 6} fontFamily={MAG_SANS} aspectRatio={props.aspectRatio} />
          </div>

          {cards.length > 0 && (
            <div style={{ opacity: ctaO, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: cardH * 0.02 }}>
              <ColHead color={hexToRgba(coverText, 0.5)}>{(props.onlineLabel as string)?.trim() || "Online"}</ColHead>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: p ? 12 : 18 }}>
                {cards.map((card, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                    <span
                      style={{
                        fontFamily: MAG_SANS,
                        fontWeight: 700,
                        fontSize: p ? 15 : 14,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: coverBg,
                        background: accent,
                        padding: "11px 24px",
                      }}
                    >
                      {card.ctaButtonText.trim() || "Read More"}
                    </span>
                    {card.websiteLink && (
                      <span style={{ fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: 15, color: hexToRgba(coverText, 0.6), wordBreak: "break-all" }}>{card.websiteLink}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ opacity: fineO, marginTop: cardH * 0.022, fontFamily: MAG_SANS, fontWeight: 500, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: hexToRgba(coverText, 0.42) }}>
            {props.issueLabel ?? "Thank you for reading"}
          </div>
        </div>

        {/* Newsstand barcode, bottom-centre. */}
        <div style={{ position: "absolute", left: "50%", bottom: "5%", transform: "translateX(-50%)", background: "#FFFFFF", padding: "6px 8px 4px", opacity: fineO, zIndex: 3 }}>
          <Barcode color="#111111" width={Math.round(cardW * 0.24)} height={Math.round(cardW * 0.07)} label="0 74820 09221" />
        </div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: MAG_BACKDROP, fontFamily: props.fontFamily ?? MAG_SERIF, overflow: "hidden" }}>
      {/* Blurred table behind the magazine — fades as the magazine exits. */}
      <AbsoluteFill style={{ filter: `blur(${deskBlur}px)`, transform: "scale(1.06)", opacity: backdropOpacity }}>
        <DeskBackdrop aspectRatio={props.aspectRatio} accent={accent} parallaxX={0} parallaxY={0} />
      </AbsoluteFill>

      {/* The issue — ONE centred card that zooms out from screen centre and fades away. */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: cardW,
            height: cardH,
            transform: cardTransform,
            transformOrigin: "50% 50%",
            opacity: closeOpacity,
            boxShadow: "0 16px 48px rgba(0,0,0,0.28)",
          }}
        >
          {/* Page block under the cover gives it a subtle physical edge (as the hero). */}
          <PageThickness sheetInsetX="0px" sheetInsetY="0px" />
          {backCover}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
