import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { EconomistMasthead } from "../components/EconomistMasthead";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { baselineSettle, bellSin, clamp01, letterpressStamp, ruleDraw } from "./motion";

/**
 * EndingSocials — the sign-off. A centred red masthead springs in with a light
 * sweep across the wordmark, thin red rules draw outward from centre, an italic
 * closing line assembles word by word, CTA pill(s) (whatever the project sets —
 * never hardcoded) stamp in with a one-shot red glow, then the socials row.
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
  const mastheadSweep = interpolate(frame, [10, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.ctaButtonText.trim() || (c.showWebsiteButton && c.websiteLink.trim()),
  );
  const closing = narration || title;
  // The closing line assembles word by word; the stagger shrinks for long
  // copy so it always lands well before the CTAs arrive.
  const closingWords = (closing || "").split(/\s+/).filter(Boolean);
  const wordStep = Math.min(2, 30 / Math.max(1, closingWords.length));
  // The masthead shows the brand/channel name supplied by the brief. When none
  // is given we hide the flag entirely rather than print a brand the user never
  // chose (e.g. "The Economist").
  const brandWordmark = (wordmark ?? "").trim();

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `0 ${isPortrait ? 70 : 120}px` }}>
      {brandWordmark && (
        <div style={{ transform: `scale(${mastheadScale})`, transformOrigin: "center", marginBottom: isPortrait ? 48 : 34 }}>
          <EconomistMasthead
            wordmark={brandWordmark}
            width={isPortrait ? 360 : 420}
            accentColor={accentColor}
            sweep={mastheadSweep > 0 && mastheadSweep < 1 ? mastheadSweep : undefined}
            fontFamily={fontFamily}
          />
        </div>
      )}

      <div style={{ width: isPortrait ? width * 0.5 : 360, height: 2, background: accentColor, ...ruleDraw(frame, 14, 18, "center") }} />

      {closing && (
        <div
          style={{
            fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
            fontStyle: "italic",
            fontSize: isPortrait ? 38 : 40,
            lineHeight: 1.35,
            textAlign: "center",
            color: textColor,
            maxWidth: isPortrait ? "100%" : "64%",
            margin: `${isPortrait ? 44 : 30}px 0`,
          }}
        >
          {closingWords.map((w, i) => {
            const settle = baselineSettle(frame, 22 + i * wordStep, 14, 14);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  opacity: settle.opacity,
                  transform: settle.transform,
                  filter: settle.filter,
                }}
              >
                {w}
                {i < closingWords.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      )}

      {/* CTA pills — each stamps in with a one-shot red press glow. */}
      {cards.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: isPortrait ? "column" : "row",
            gap: 18,
            marginBottom: isPortrait ? 48 : 34,
          }}
        >
          {cards.map((c, i) => {
            const stamp = letterpressStamp(frame, 34 + i * 6, 14, 1.12);
            const glow = bellSin(clamp01((frame - (34 + i * 6)) / 20));
            return (
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
                  opacity: stamp.opacity,
                  transform: stamp.transform,
                  filter: stamp.filter,
                  boxShadow: glow > 0.01 ? `0 10px 28px rgba(227,18,11,${(0.18 * glow).toFixed(3)})` : "none",
                }}
              >
                <span style={{ fontFamily: fontFamily ?? ECONOMIST_SANS_FONT, fontWeight: 800, fontSize: isPortrait ? 27 : 25, letterSpacing: 0.5 }}>
                  {c.ctaButtonText || c.websiteLink}
                </span>
                {c.showWebsiteButton && c.websiteLink && c.ctaButtonText && (
                  <span style={{ fontFamily: fontFamily ?? ECONOMIST_SANS_FONT, fontSize: 18, opacity: 0.85, marginTop: 2 }}>{c.websiteLink}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ width: isPortrait ? width * 0.5 : 360, height: 2, background: accentColor, marginBottom: isPortrait ? 40 : 28, ...ruleDraw(frame, 14, 18, "center") }} />

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
