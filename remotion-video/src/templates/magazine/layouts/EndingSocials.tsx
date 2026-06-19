import React from "react";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";
import {
  MagazinePage,
  Rule,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
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

  return (
    <MagazinePage colors={colors} section="Colophon" issue={props.issueLabel ?? "Fin"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
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
};
