import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type SocialKey =
  | "instagram"
  | "youtube"
  | "medium"
  | "substack"
  | "facebook"
  | "linkedin"
  | "tiktok";

export type SocialItem = {
  enabled?: boolean;
  /** Link or free-form text to show under the icon */
  label?: string;
  /** Backward-compatible alias */
  text?: string;
  /** Backward-compatible alias */
  url?: string;
};

export type SocialsMap = Partial<Record<SocialKey, SocialItem>>;
export type SocialsRow = {
  platform?: string;
  enabled?: boolean | string;
  label?: string;
  text?: string;
  url?: string;
};

// ─── Accurate SVG brand icons ────────────────────────────────────────────────

const InstagramIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs>
      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
    <rect x="6.5" y="6.5" width="11" height="11" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="16.2" cy="7.8" r="0.9" fill="white" />
  </svg>
);

const YoutubeIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#FF0000" />
    <path
      d="M19.8 8.2a2 2 0 0 0-1.4-1.4C17.1 6.5 12 6.5 12 6.5s-5.1 0-6.4.3a2 2 0 0 0-1.4 1.4C4 9.5 4 12 4 12s0 2.5.3 3.8a2 2 0 0 0 1.4 1.4c1.3.3 6.4.3 6.4.3s5.1 0 6.4-.3a2 2 0 0 0 1.4-1.4C20 14.5 20 12 20 12s0-2.5-.2-3.8Z"
      fill="white"
    />
    <polygon points="10,9.5 10,14.5 15,12" fill="#FF0000" />
  </svg>
);

const MediumIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#000000" />
    <ellipse cx="8.5" cy="12" rx="4" ry="4.8" fill="white" />
    <ellipse cx="16.5" cy="12" rx="2.5" ry="4.5" fill="white" />
    <ellipse cx="21" cy="12" rx="1" ry="3.5" fill="white" />
  </svg>
);

const SubstackIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#FF6719" />
    <rect x="4.5" y="6" width="15" height="2.5" rx="0.5" fill="white" />
    <rect x="4.5" y="10.5" width="15" height="2.5" rx="0.5" fill="white" />
    <path d="M4.5 15.5 L12 20 L19.5 15.5 L19.5 15 L4.5 15 Z" fill="white" />
  </svg>
);

const FacebookIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1877F2" />
    <path
      d="M13.5 12.5H15.5L16 10H13.5V8.5C13.5 7.8 13.8 7.2 14.9 7.2H16.1V5C16.1 5 15.1 4.8 14.1 4.8C12 4.8 10.5 6.1 10.5 8.3V10H8.5V12.5H10.5V19H13.5V12.5Z"
      fill="white"
    />
  </svg>
);

const LinkedInIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#0A66C2" />
    <rect x="5" y="9" width="3" height="10" rx="0.5" fill="white" />
    <circle cx="6.5" cy="6.5" r="1.8" fill="white" />
    <path
      d="M11 9h2.8v1.4h.04c.4-.7 1.4-1.5 2.8-1.5 3 0 3.6 2 3.6 4.5V19H17.3v-4.9c0-1.2 0-2.7-1.6-2.7-1.6 0-1.9 1.3-1.9 2.6V19H11V9Z"
      fill="white"
    />
  </svg>
);

const TikTokIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#010101" />
    {/* cyan shadow */}
    <path
      d="M14.5 4.8c.3 1.5 1.1 2.6 2.4 3.1v2.2c-.9-.1-1.7-.4-2.4-.9v4.5c0 2.3-1.6 4.2-3.8 4.2a3.7 3.7 0 0 1-3.7-3.7c0-2 1.7-3.7 3.7-3.7.2 0 .4 0 .6.1v2.3a1.6 1.6 0 1 0 1.1 1.5V4.8h2.1Z"
      fill="#69C9D0"
      transform="translate(-0.5, 0)"
    />
    {/* red shadow */}
    <path
      d="M14.5 4.8c.3 1.5 1.1 2.6 2.4 3.1v2.2c-.9-.1-1.7-.4-2.4-.9v4.5c0 2.3-1.6 4.2-3.8 4.2a3.7 3.7 0 0 1-3.7-3.7c0-2 1.7-3.7 3.7-3.7.2 0 .4 0 .6.1v2.3a1.6 1.6 0 1 0 1.1 1.5V4.8h2.1Z"
      fill="#EE1D52"
      transform="translate(0.5, 0)"
    />
    {/* white main */}
    <path
      d="M14.5 4.8c.3 1.5 1.1 2.6 2.4 3.1v2.2c-.9-.1-1.7-.4-2.4-.9v4.5c0 2.3-1.6 4.2-3.8 4.2a3.7 3.7 0 0 1-3.7-3.7c0-2 1.7-3.7 3.7-3.7.2 0 .4 0 .6.1v2.3a1.6 1.6 0 1 0 1.1 1.5V4.8h2.1Z"
      fill="white"
    />
  </svg>
);

const SOCIAL_ICONS: Record<SocialKey, React.FC<{ size: number }>> = {
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  medium: MediumIcon,
  substack: SubstackIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface SocialIconsProps {
  socials?: SocialsMap | SocialsRow[];
  accentColor: string;
  textColor: string;
  /** Layout spacing */
  maxPerRow?: number;
  /** When set, label text under icons uses this font (matches scene fontFamily). */
  fontFamily?: string;
}

export const SocialIcons: React.FC<SocialIconsProps> = ({
  socials,
  accentColor,
  textColor,
  maxPerRow = 4,
  fontFamily,
}) => {
  const frame = useCurrentFrame();

  const fade = interpolate(frame, [8, 32], [0, 1], {
    extrapolateRight: "clamp",
  });

  const normalizeSocials = (input?: SocialsMap | SocialsRow[]): SocialsMap => {
    if (!input) return {};
    if (!Array.isArray(input)) return input;

    const out: SocialsMap = {};
    for (const row of input) {
      const key = String(row?.platform ?? "").trim().toLowerCase() as SocialKey;
      if (!key || !(key in SOCIAL_ICONS)) continue;

      const enabledRaw = row?.enabled;
      const enabled =
        typeof enabledRaw === "string"
          ? enabledRaw.trim().toLowerCase() !== "false"
          : Boolean(enabledRaw ?? true);

      out[key] = {
        enabled,
        label: row?.label,
        text: row?.text,
        url: row?.url,
      };
    }
    return out;
  };

  const normalizedSocials = normalizeSocials(socials);
  const enabled: Array<{ key: SocialKey; item: SocialItem }> = [];
  if (normalizedSocials) {
    (Object.keys(SOCIAL_ICONS) as SocialKey[]).forEach((k) => {
      const it = normalizedSocials[k];
      const isEnabled = Boolean(it && (it.enabled ?? true));
      if (!it) return;
      if (!isEnabled) return;
      enabled.push({ key: k, item: it });
    });
  }

  return (
    <div
      style={{
        opacity: fade,
        transition: "opacity 100ms linear",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 14,
        maxWidth: "95%",
      }}
    >
      {enabled.map(({ key, item }) => {
        const label = String(item?.label ?? item?.text ?? item?.url ?? "").trim();
        const IconComponent = SOCIAL_ICONS[key];

        return (
          <div
            key={key}
            style={{
              flex: `0 0 calc(${100 / Math.max(1, maxPerRow)}% - 12px)`,
              minWidth: 140,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                border: `1px solid ${accentColor}40`,
                background: `${accentColor}14`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <IconComponent size={40} />
            </div>
            {label ? (
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: textColor,
                  lineHeight: 1.2,
                  opacity: 0.92,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  ...(fontFamily ? { fontFamily } : {}),
                }}
              >
                {label}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};