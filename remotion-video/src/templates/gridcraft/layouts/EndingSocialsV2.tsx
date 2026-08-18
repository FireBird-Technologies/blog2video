import * as React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY, GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";

/**
 * EndingSocialsV2 — "Contact Card"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * Base is a 4-box bento (title / accent CTA / narration / accent socials) that
 * staggers in cell by cell. This one is a SINGLE wide glass contact card that
 * slides up as one object:
 *
 *   • brand and narration on the left of the card;
 *   • socials in a bordered row on the right (landscape) / below (portrait);
 *   • the CTA a solid orange chip pinned to the card's lower edge, straddling it.
 *
 * The base puts the socials on an accent ground with white icons; here the card is
 * glass, so the icons take the accent colour against light — check contrast if the
 * user picks a pale accent.
 *
 * NOTE for the render tree: `resolveCtas` lives at a different path in
 * remotion-video — `../../shared/resolveCtas`. That import line is the ONLY
 * difference between the two copies of this file.
 *
 * `Blobs` is rendered once by the composition wrapper — do NOT re-render it here.
 */
export const EndingSocialsV2: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
  accentColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const accent = accentColor || COLORS.ACCENT;
  const ink = textColor || COLORS.DARK;

  const subtext = (narration ?? "").trim();

  // Identical CTA resolution to the base — do not re-derive.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const showWebsiteCta = cards.length > 0;

  const rawFont = (fontFamily ?? "").trim();
  const titleFont = rawFont || GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  const bodyFont = rawFont || GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const spr = (delay: number) =>
    spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 100 } });

  // The whole card arrives as ONE object — the base's cell-by-cell stagger is
  // exactly what this variant is avoiding.
  const cardP = spr(0);
  const socialsP = spr(10);
  const ctaP = spr(16);


  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        fontFamily: bodyFont,
      }}
    >
      {/* Column: card, then the CTA chips beneath it. Height is content-driven —
          nothing here is a fixed height, so the card grows as the brand/narration
          get longer and the chips ride down with it. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: p ? "90%" : "82%",
          maxWidth: 1200,
          maxHeight: "100%",
          opacity: interpolate(cardP, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(cardP, [0, 1], [34, 0])}px)`,
        }}
      >
        {/* ── The card ── */}
        <div
          style={{
            ...glass(false),
            width: "100%",
            // Never let the flex column squash the card — its height must follow
            // its content, which is the whole point of this layout.
            flexShrink: 0,
            display: "flex",
            flexDirection: p ? "column" : "row",
            alignItems: p ? "stretch" : "center",
            gap: p ? 26 : 40,
            padding: p ? 36 : 48,
            border: `1px solid ${accent}30`,
          }}
        >
          {/* Brand + narration */}
          <div style={{ flex: p ? undefined : 1.15, minWidth: 0 }}>
            <div
              style={{
                fontSize: titleFontSize ?? (p ? 50 : 64),
                fontWeight: 900,
                fontFamily: titleFont,
                color: ink,
                lineHeight: 1.08,
                wordBreak: "break-word",
              }}
            >
              {title}
            </div>
            <div
              style={{
                height: 4,
                width: 48,
                backgroundColor: accent,
                marginTop: p ? 16 : 20,
              }}
            />
            {subtext ? (
              <div
                style={{
                  marginTop: p ? 16 : 20,
                  fontSize: descriptionFontSize ?? (p ? 26 : 30),
                  fontWeight: 500,
                  color: ink,
                  opacity: 0.82,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}
              >
                {subtext}
              </div>
            ) : null}
          </div>

          {/* Socials, in a bordered row */}
          <div
            style={{
              flex: p ? undefined : 0.85,
              minWidth: 0,
              borderLeft: p ? undefined : `1px solid ${COLORS.MUTED}33`,
              borderTop: p ? `1px solid ${COLORS.MUTED}33` : undefined,
              paddingLeft: p ? 0 : 36,
              paddingTop: p ? 24 : 0,
              display: "flex",
              justifyContent: "center",
              opacity: interpolate(socialsP, [0, 1], [0, 1]),
            }}
          >
            <SocialIcons
              socials={socials}
              accentColor={accent}
              textColor={ink}
              maxPerRow={p ? 3 : 3}
              fontFamily={bodyFont}
              aspectRatio={aspectRatio}
            />
          </div>
        </div>

        {/* ── CTA chips, in flow BELOW the card ──
            Deliberately not absolutely positioned: as a flow sibling the chips are
            pushed down by however tall the card grows, so a long brand or narration
            can never end up behind them. */}
        {showWebsiteCta ? (
          <div
            style={{
              marginTop: p ? 22 : 26,
              // Full width so each chip's maxWidth resolves against the CARD's
              // measure. Without it the row shrink-wraps to its content and the
              // percentage cap collapses, ellipsising the URL early.
              width: "100%",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 14,
              opacity: interpolate(ctaP, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(ctaP, [0, 1], [12, 0])}px)`,
            }}
          >
            {cards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: accent,
                  color: COLORS.WHITE,
                  borderRadius: 999,
                  padding: p ? "14px 26px" : "16px 32px",
                  boxShadow: "0 8px 26px rgba(249,115,22,0.34)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  // Below the card the chip is no longer squeezed into a straddling
                  // row, so give it room — at 46% the URL span collapsed to nothing
                  // in landscape and only the label survived.
                  maxWidth: p ? "92%" : cards.length > 1 ? "46%" : "72%",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: cards.length === 1 ? (p ? 22 : 24) : p ? 18 : 20,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                    // The label must not consume the whole chip and starve the URL.
                    flexShrink: 0,
                  }}
                >
                  {card.ctaButtonText.trim() || "Get started"}
                </span>
                <span
                  style={{
                    fontSize: cards.length === 1 ? (p ? 17 : 18) : p ? 14 : 15,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    // The chip sizes to its content, so without this the URL span
                    // is only as wide as it happens to get and ellipsises early.
                    flex: "0 1 auto",
                  }}
                >
                  {card.websiteLink}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
