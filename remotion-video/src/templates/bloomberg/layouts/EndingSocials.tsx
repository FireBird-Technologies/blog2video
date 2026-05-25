import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY, derivePalette } from "../constants";
import type { BloombergLayoutProps, BloombergSocial } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { BackgroundGraph } from "./BackgroundGraph";
import { resolveCtas } from "../../shared/resolveCtas";

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
  ctas,
  socials,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const { border, muted } = derivePalette(bg, amber);

  const topBarOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [8, 25], [0, 1], { extrapolateRight: "clamp" });
  const bodyOpacity = interpolate(frame, [20, 36], [0, 1], { extrapolateRight: "clamp" });
  const socialOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });

  const socialList = normalizeSocials(socials);
  const enabledSocials = socialList.filter(
    (s) => parseEnabled(s.enabled, true) && Boolean(s.platform),
  );

  // CTA cards (1-3). Bloomberg shows the terminal prompt whenever the toggle is on,
  // even with no link (original behaviour), so a card needs a label OR a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink.length > 0 || c.ctaButtonText.trim().length > 0),
  );
  const hasAnyCard = cards.length > 0;

  // Blinking cursor
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff, overflow: "hidden" }}>
      <BackgroundGraph accentColor={blue} textColor={amber} variant="socials" />

      {/* Horizontal rules framing centre */}
      <div style={{
        position: "absolute", top: 68, left: 48, right: 48, height: 1,
        backgroundColor: border, opacity: topBarOpacity,
      }} />
      <div style={{
        position: "absolute", bottom: 90, left: 48, right: 48, height: 1,
        backgroundColor: border, opacity: topBarOpacity,
      }} />

      {/* Centre block */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 28, width: "80%",
      }}>
        {/* CTA prompts — 1/2/3 columns */}
        {hasAnyCard && (
          <div style={{
            opacity: ctaOpacity,
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 32,
            width: "100%",
          }}>
            {cards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  flex: cards.length === 1 ? "0 1 auto" : "1 1 0",
                  minWidth: 220,
                  maxWidth: cards.length === 1 ? "100%" : cards.length === 2 ? "46%" : "32%",
                }}
              >
                <div style={{
                  color: amber,
                  fontSize: cards.length === 1 ? titleFontSize * 0.65 : titleFontSize * 0.4,
                  letterSpacing: 1,
                  textAlign: "center",
                }}>
                  {card.ctaButtonText.trim() || "Get Started"}
                  {idx === 0 && <span style={{ opacity: cursorVisible ? 1 : 0, color: blue }}>_</span>}
                </div>
                {card.websiteLink ? (
                  <div style={{
                    color: muted,
                    fontSize: cards.length === 1 ? descriptionFontSize * 0.7 : descriptionFontSize * 0.55,
                    letterSpacing: 2,
                    textAlign: "center",
                    wordBreak: "break-all",
                    maxWidth: "100%",
                  }}>
                    {card.websiteLink}
                  </div>
                ) : null}
              </div>
            ))}
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

    </AbsoluteFill>
  );
};
