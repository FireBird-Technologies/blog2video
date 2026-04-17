import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps, BloombergSocial } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { BackgroundGraph } from "./BackgroundGraph";

const SUPPORTED_SOCIALS = new Set([
  "instagram",
  "youtube",
  "medium",
  "substack",
  "facebook",
  "linkedin",
  "tiktok",
]);

function parseEnabled(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeSocials(raw: BloombergLayoutProps["socials"]): BloombergSocial[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as BloombergSocial[])
      .map((item) => ({
        ...item,
        platform: String(item.platform || "").trim().toLowerCase(),
        enabled: parseEnabled(item.enabled, true),
        label: item.label?.trim(),
      }))
      .filter((item) => SUPPORTED_SOCIALS.has(item.platform));
  }
  // Legacy object map can be:
  // { platform: "label/url" } OR { platform: "false" } OR { platform: { enabled, label/url/text } }
  const normalized: BloombergSocial[] = [];
  for (const [platform, value] of Object.entries(raw)) {
    const normalizedPlatform = String(platform).trim().toLowerCase();
    if (!SUPPORTED_SOCIALS.has(normalizedPlatform)) continue;

    if (value !== null && typeof value === "object") {
      const row = value as { enabled?: unknown; label?: unknown; text?: unknown; url?: unknown };
      const label = String(row.label ?? row.text ?? row.url ?? "").trim();
      const enabled = parseEnabled(row.enabled, Boolean(label));
      if (!enabled) continue;
      normalized.push({ platform: normalizedPlatform, enabled, label });
      continue;
    }

    const rawText = String(value ?? "").trim();
    const enabled = parseEnabled(value, Boolean(rawText));
    if (!enabled) continue;

    const label =
      typeof value === "string" && ["true", "false", "1", "0", "yes", "no", "on", "off"].includes(rawText.toLowerCase())
        ? ""
        : rawText;
    normalized.push({ platform: normalizedPlatform, enabled, label });
  }

  return normalized;
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
    (s) => parseEnabled(s.enabled, true) && Boolean(s.platform),
  );

  // Blinking cursor
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
       <BackgroundGraph accentColor={blue} textColor={amber} variant="socials" />
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
