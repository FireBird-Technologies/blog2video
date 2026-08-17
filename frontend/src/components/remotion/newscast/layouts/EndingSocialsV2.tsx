import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
  toRgba,
} from "../themeUtils";

/**
 * EndingSocialsV2 — "Sign-off Wall"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * Base centres one navy glass card and stacks everything inside it. This one is
 * a credits wall: the title is ranged LEFT against a full-height accent rule,
 * and each CTA becomes its own ticker slat sliding in from the right.
 *
 * `SocialIcons` + `resolveCtas` are the shared implementations, so social and
 * CTA behaviour is byte-identical to the base — only the frame around them
 * changes.
 */

const GOLD = "#D4AA50";

export const EndingSocialsV2: React.FC<NewscastLayoutProps> = ({
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
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = aspectRatio === "portrait";

  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const subtext = (narration ?? "").trim();

  const ruleGrow = interpolate(frame, [0, 26], [0, 1], { extrapolateRight: "clamp" });
  const titleIn = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const slateIn = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const bodyIn = interpolate(frame, [26, 48], [0, 1], { extrapolateRight: "clamp" });
  const socialIn = interpolate(frame, [34, 58], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      {/* Scrim only — NEVER an opaque ground. The composition renders the shared
          pixel-map/globe background beneath every newscast layout, so painting a
          solid colour here would hide it (which is exactly what the base layouts
          avoid by staying transparent). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 20% 15%, rgba(30,95,212,0.16) 0%, transparent 58%), linear-gradient(155deg, rgba(7,16,35,0.55) 0%, rgba(5,11,28,0.42) 55%, rgba(3,6,15,0.6) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          // Bottom padding reserves the ~150px where the composition's
          // NewsCastChrome draws its lower-third and ticker, so the social tiles
          // are never overlapped by it.
          padding: p ? "56px 34px 190px" : "70px 78px 170px",
        }}
      >
        {/* ── Head: full-height accent rule + left-ranged title ── */}
        <div style={{ display: "flex", gap: p ? 18 : 26, alignItems: "stretch" }}>
          <div
            style={{
              flexShrink: 0,
              width: 5,
              alignSelf: "stretch",
              minHeight: p ? 96 : 110,
              background: `linear-gradient(180deg, ${RED} 0%, ${GOLD} 100%)`,
              boxShadow: `0 0 20px ${toRgba(RED, 0.5)}`,
              transformOrigin: "top center",
              transform: `scaleY(${ruleGrow})`,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "label"),
                fontSize: scaleNewscastPx(11, portraitScale),
                letterSpacing: 5,
                fontWeight: 700,
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 10,
                opacity: titleIn,
              }}
            >
              Follow along
            </div>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: titleFontSize ?? (p ? 60 : 52),
                fontWeight: 800,
                color: "#fff",
                textTransform: "uppercase",
                lineHeight: 1.05,
                letterSpacing: 0.5,
                opacity: titleIn,
                transform: `translateX(${(1 - titleIn) * -24}px)`,
                textShadow: `0 4px 32px ${toRgba(RED, 0.28)}`,
              }}
            >
              {title}
            </div>

            {/* Slate line under the title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: p ? 14 : 16,
                opacity: slateIn,
              }}
            >
              <div
                style={{
                  height: 1,
                  width: p ? 48 : 74,
                  background: `linear-gradient(90deg, ${GOLD}, transparent)`,
                }}
              />
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(10, portraitScale),
                  letterSpacing: 4,
                  color: "#7A9AB8",
                  textTransform: "uppercase",
                }}
              >
                End of broadcast
              </div>
            </div>

            {subtext ? (
              <div
                style={{
                  marginTop: p ? 16 : 18,
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: descriptionFontSize ?? (p ? 22 : 18),
                  color: STEEL,
                  lineHeight: 1.5,
                  maxWidth: p ? "100%" : 640,
                  opacity: bodyIn,
                }}
              >
                {subtext}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── CTA slats: one per CTA, sliding in from the right ── */}
        {cards.length > 0 && (
          <div
            style={{
              marginTop: p ? 30 : 36,
              marginLeft: p ? 23 : 31,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: p ? "100%" : 780,
            }}
          >
            {cards.map((card, idx) => {
              const slatIn = interpolate(frame, [34 + idx * 8, 54 + idx * 8], [0, 1], {
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: p ? 12 : 16,
                    background: "rgba(10,42,110,0.34)",
                    border: "1px solid rgba(200,220,255,0.20)",
                    borderLeft: `4px solid ${RED}`,
                    backdropFilter: "blur(8px)",
                    padding: p ? "12px 14px" : "13px 18px",
                    opacity: slatIn,
                    transform: `translateX(${(1 - slatIn) * 60}px)`,
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      fontFamily: newscastFont(fontFamily, "title"),
                      fontSize: scaleNewscastPx(14, portraitScale),
                      fontWeight: 800,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "#fff",
                      background: RED,
                      padding: "5px 12px",
                    }}
                  >
                    {card.ctaButtonText.trim() || "Visit site"}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: newscastFont(fontFamily, "body"),
                      fontSize: scaleNewscastPx(14, portraitScale),
                      color: STEEL,
                      letterSpacing: 0.4,
                      wordBreak: "break-all",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      color: GOLD,
                      fontFamily: newscastFont(fontFamily, "title"),
                      fontSize: scaleNewscastPx(16, portraitScale),
                      fontWeight: 700,
                    }}
                  >
                    ›
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Social tiles ── */}
        <div
          style={{
            marginTop: p ? 30 : 38,
            marginLeft: p ? 23 : 31,
            paddingTop: p ? 22 : 26,
            borderTop: "1px solid rgba(200,220,255,0.16)",
            opacity: socialIn,
            transform: `translateY(${(1 - socialIn) * 18}px)`,
            display: "flex",
            justifyContent: p ? "center" : "flex-start",
          }}
        >
          <SocialIcons
            socials={socials}
            accentColor={RED}
            textColor={STEEL}
            maxPerRow={p ? 3 : 4}
            fontFamily={newscastFont(fontFamily, "body")}
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
