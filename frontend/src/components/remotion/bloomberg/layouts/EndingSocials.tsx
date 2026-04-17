import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps, BloombergSocial } from "../types";
import { SocialIcons } from "../../SocialIcons";

function normalizeSocials(raw: BloombergLayoutProps["socials"]): BloombergSocial[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as BloombergSocial[];
  // Legacy object map { platform: handle }
  return Object.entries(raw).map(([platform, label]) => ({
    platform,
    enabled: "true",
    label: String(label),
  }));
}

export const EndingSocials: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize = 72,
  descriptionFontSize = 30,
  ctaButtonText = "Get Started",
  websiteLink,
  showWebsiteButton = true,
  socials,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  const topBarOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [8, 25], [0, 1], { extrapolateRight: "clamp" });
  const bodyOpacity = interpolate(frame, [20, 36], [0, 1], { extrapolateRight: "clamp" });
  const socialOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });

  const socialList = normalizeSocials(socials);
  const enabledSocials = socialList.filter(
    (s) => s.enabled === true || s.enabled === "true",
  );

  // Blinking cursor
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 48,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: "0 48px", gap: 24,
        opacity: topBarOpacity,
      }}>
        <span style={{ color: blue, fontSize: 13, letterSpacing: 3 }}>MBN:CLOS</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: 12 }}>SESSION CLOSE</span>
      </div>

      {/* Horizontal rules framing centre */}
      <div style={{
        position: "absolute", top: 68, left: 48, right: 48, height: 1,
        backgroundColor: BLOOMBERG_COLORS.border, opacity: topBarOpacity,
      }} />
      <div style={{
        position: "absolute", bottom: 90, left: 48, right: 48, height: 1,
        backgroundColor: BLOOMBERG_COLORS.border, opacity: topBarOpacity,
      }} />

      {/* Centre block */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 28, width: "80%",
      }}>
        {/* CTA prompt */}
        {showWebsiteButton && (
          <div style={{ opacity: ctaOpacity, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              color: amber, fontSize: titleFontSize * 0.65, letterSpacing: 1,
            }}>
              MBN&gt;&nbsp;{ctaButtonText}
              <span style={{ opacity: cursorVisible ? 1 : 0, color: blue }}>_</span>
            </div>

            {websiteLink && (
              <div style={{
                color: BLOOMBERG_COLORS.muted, fontSize: descriptionFontSize * 0.7,
                letterSpacing: 2,
              }}>
                {websiteLink}
              </div>
            )}
          </div>
        )}

        {/* Amber rule */}
        <div style={{
          width: "60%", height: 1, backgroundColor: amber, opacity: ctaOpacity * 0.4,
        }} />

        {/* Narration */}
        <div style={{
          color: amber, fontSize: descriptionFontSize * 0.8,
          textAlign: "center", lineHeight: 1.6, maxWidth: "70%",
          opacity: bodyOpacity,
        }}>
          {narration}
        </div>

        {/* Social icons */}
        {enabledSocials.length > 0 && (
          <div style={{ opacity: socialOpacity }}>
            <SocialIcons
              socials={enabledSocials}
              accentColor={amber}
              textColor={amber}
              iconSize={36}
              fontFamily={ff}
              aspectRatio={aspectRatio}
            />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 36,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: "0 48px",
        opacity: topBarOpacity,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: 11, letterSpacing: 2 }}>
          MBN TERMINAL  ·  END OF SESSION
        </span>
      </div>
    </AbsoluteFill>
  );
};
