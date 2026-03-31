import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { SocialIcons } from "../../SocialIcons";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  resolveNewscastDescriptionSize,
  resolveNewscastTitleSize,
  scaleNewscastPx,
} from "../themeUtils";

const NAVY_PANEL = "rgba(10,42,110,0.32)";
const BORDER = "rgba(200,220,255,0.28)";

export const EndingSocials: React.FC<NewscastLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
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

  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });
  const bodyOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Visit site";

  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 5%" : "7% 8%",
          opacity,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: p ? 520 : 920,
            background: NAVY_PANEL,
            border: `1px solid ${BORDER}`,
            backdropFilter: "blur(10px)",
            padding: p ? 36 : 44,
            textAlign: "center",
            boxShadow: `0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(232,32,32,0.12)`,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: RED,
              opacity: 0.95,
            }}
          />
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(10, portraitScale),
              letterSpacing: 4,
              fontWeight: 700,
              color: STEEL,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: titleOp,
            }}
          >
            Follow along
          </div>
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: resolveNewscastTitleSize(titleFontSize, p ? 36 : 40, portraitScale),
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: subtext ? 16 : 28,
              opacity: titleOp,
            }}
          >
            {title}
          </div>
          {subtext ? (
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 16, portraitScale),
                color: STEEL,
                lineHeight: 1.45,
                maxWidth: 640,
                margin: "0 auto 24px",
                opacity: bodyOp,
              }}
            >
              {subtext}
            </div>
          ) : null}

          {showWebsiteCta ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 28, opacity: bodyOp }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 8,
                  padding: "12px 28px",
                  backgroundColor: RED,
                  color: "#fff",
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: scaleNewscastPx(15, portraitScale),
                  fontWeight: 700,
                  boxShadow: `0 8px 28px ${RED}55`,
                }}
              >
                {resolvedCta}
              </div>
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: scaleNewscastPx(13, portraitScale),
                  color: STEEL,
                  wordBreak: "break-all",
                  maxWidth: "100%",
                }}
              >
                {resolvedWebsiteLink}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 8, opacity: bodyOp }}>
            <SocialIcons
              socials={socials}
              accentColor={RED}
              textColor={STEEL}
              maxPerRow={p ? 3 : 4}
              fontFamily={newscastFont(fontFamily, "body")}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
