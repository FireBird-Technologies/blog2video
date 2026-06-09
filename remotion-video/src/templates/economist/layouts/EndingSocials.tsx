import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { EconomistMasthead } from "../components/EconomistMasthead";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";

/**
 * EndingSocials — the sign-off. A centred red masthead springs in, a thin red
 * rule, an italic closing line, CTA pill(s) (whatever the project sets — never
 * hardcoded), another rule, then the socials row.
 */
export const EndingSocials: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  wordmark,
  ctaButtonText,
  websiteLink,
  showWebsiteButton,
  ctas,
  socials,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  fontFamily,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const mastheadScale = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.6 } });
  const ruleW = interpolate(frame, [14, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineOp = interpolate(frame, [22, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOp = interpolate(frame, [34, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [34, 52], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.ctaButtonText.trim() || (c.showWebsiteButton && c.websiteLink.trim()),
  );
  const closing = narration || title;
  // The masthead shows the brand/channel name supplied by the brief. When none
  // is given we hide the flag entirely rather than print a brand the user never
  // chose (e.g. "The Economist").
  const brandWordmark = (wordmark ?? "").trim();

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `0 ${isPortrait ? 70 : 120}px` }}>
      {brandWordmark && (
        <div style={{ transform: `scale(${mastheadScale})`, transformOrigin: "center", marginBottom: isPortrait ? 30 : 34 }}>
          <EconomistMasthead wordmark={brandWordmark} width={isPortrait ? 360 : 420} accentColor={accentColor} />
        </div>
      )}

      <div style={{ width: isPortrait ? width * 0.5 : 360, height: 2, background: accentColor, transform: `scaleX(${ruleW})` }} />

      {closing && (
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontStyle: "italic",
            fontSize: isPortrait ? 38 : 40,
            lineHeight: 1.35,
            textAlign: "center",
            color: textColor,
            maxWidth: isPortrait ? "100%" : "64%",
            margin: `${isPortrait ? 28 : 30}px 0`,
            opacity: lineOp,
          }}
        >
          {closing}
        </div>
      )}

      {/* CTA pills. */}
      {cards.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: isPortrait ? "column" : "row",
            gap: 18,
            opacity: ctaOp,
            transform: `translateY(${ctaY}px)`,
            marginBottom: isPortrait ? 30 : 34,
          }}
        >
          {cards.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: i === 0 ? accentColor : "transparent",
                border: `2px solid ${accentColor}`,
                color: i === 0 ? "#fff" : accentColor,
                padding: isPortrait ? "16px 36px" : "14px 38px",
                borderRadius: 999,
              }}
            >
              <span style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 800, fontSize: isPortrait ? 27 : 25, letterSpacing: 0.5 }}>
                {c.ctaButtonText || c.websiteLink}
              </span>
              {c.showWebsiteButton && c.websiteLink && c.ctaButtonText && (
                <span style={{ fontFamily: ECONOMIST_SANS_FONT, fontSize: 18, opacity: 0.85, marginTop: 2 }}>{c.websiteLink}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ width: isPortrait ? width * 0.5 : 360, height: 2, background: accentColor, transform: `scaleX(${ruleW})`, marginBottom: isPortrait ? 26 : 28 }} />

      <SocialIcons
        socials={socials as never}
        accentColor={accentColor}
        textColor={textColor}
        maxPerRow={isPortrait ? 3 : 4}
        fontFamily={fontFamily}
        aspectRatio={aspectRatio}
      />
    </AbsoluteFill>
  );
};
