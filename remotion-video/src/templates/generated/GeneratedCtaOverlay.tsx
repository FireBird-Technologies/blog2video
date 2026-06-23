import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SocialIcons } from "../SocialIcons";
import { resolveCtas } from "../shared/resolveCtas";
import type { GeneratedSceneData } from "./types";

type CtaProps = NonNullable<GeneratedSceneData["ctaProps"]>;

export interface GeneratedCtaOverlayProps {
  ctaProps: CtaProps;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  aspectRatio: "landscape" | "portrait";
  headingFont?: string;
  bodyFont?: string;
  title?: string;
  logoUrl?: string;
}

export const GeneratedCtaOverlay: React.FC<GeneratedCtaOverlayProps> = ({
  ctaProps,
  brandColors,
  aspectRatio,
  headingFont,
  bodyFont,
  title,
  logoUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 18], [15, 0], { extrapolateRight: "clamp" });

  const ctaOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = interpolate(
    spring({ frame: Math.max(0, frame - 12), fps, config: { damping: 12, stiffness: 100 } }),
    [0, 1],
    [0.9, 1],
  );

  const socialsOp = interpolate(frame, [20, 38], [0, 1], { extrapolateRight: "clamp" });

  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = interpolate(
    spring({ frame, fps, config: { damping: 14, stiffness: 80 } }),
    [0, 1],
    [0.8, 1],
  );

  // CTA cards: only render cards that have a visible pill (toggle on + link).
  // Empty cards (user added but never filled in) are dropped to avoid blank columns.
  const cards = resolveCtas(ctaProps).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const hasAnyCard = cards.length > 0;
  const cardCount = Math.min(Math.max(cards.length, 1), 3);

  const hasSocials =
    ctaProps.socials &&
    Object.values(ctaProps.socials).some((s) => s?.enabled);

  const accent = brandColors.accent || "#7C3AED";
  const bg = brandColors.background || "#FFFFFF";
  const text = brandColors.text || "#1A1A2E";
  const titleFont = headingFont || bodyFont || "'Inter', sans-serif";
  const font = bodyFont || "'Inter', sans-serif";

  // Column widths: 1 → comfortable centered; 2 → ~45%; 3 → ~30%.
  const cardBasis = cardCount === 1 ? (p ? "80%" : "60%") : cardCount === 2 ? "45%" : "30%";

  // Brand-accent atmosphere — two soft radial glows give the outro a richer,
  // on-brand backdrop than a flat fill (v3 bookend polish). Static + low-alpha,
  // so it never flickers in headless render.
  const backdrop = `radial-gradient(circle at 18% 22%, ${accent}14 0%, transparent 42%), radial-gradient(circle at 82% 80%, ${accent}10 0%, transparent 46%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      {/* Brand atmosphere backdrop */}
      <div style={{ position: "absolute", inset: 0, background: backdrop, opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }) }} />
      {/* Accent bar at bottom */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: accent }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "6% 8%" : "7% 12%",
          textAlign: "center",
          gap: p ? 20 : 28,
        }}
      >
        {/* Logo */}
        {logoUrl && (
          <div style={{ opacity: logoOp, transform: `scale(${logoScale})` }}>
            <Img
              src={logoUrl}
              style={{
                maxHeight: p ? 80 : 64,
                maxWidth: p ? 200 : 240,
                objectFit: "contain",
              }}
            />
          </div>
        )}

        {/* Title */}
        {title && (
          <div
            style={{
              opacity: titleOp,
              transform: `translateY(${titleY}px)`,
              fontSize: p ? 72 : 64,
              fontWeight: 800,
              color: text,
              fontFamily: titleFont,
              lineHeight: 1.1,
              maxWidth: p ? "90%" : "80%",
            }}
          >
            {title}
          </div>
        )}

        {/* Divider */}
        <div
          style={{
            width: p ? 180 : 240,
            height: 5,
            borderRadius: 999,
            backgroundColor: `${accent}55`,
            opacity: titleOp,
          }}
        />

        {/* CTA cards — 1/2/3 columns based on count */}
        {hasAnyCard && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: p ? 18 : 28,
              width: "100%",
              opacity: ctaOp,
              transform: `scale(${ctaScale})`,
            }}
          >
            {cards.map((card, idx) => {
              const ctaLabel = card.ctaButtonText.trim() || "Get started";
              return (
                <div
                  key={idx}
                  style={{
                    flex: `0 1 ${cardBasis}`,
                    maxWidth: cardBasis,
                    minWidth: p ? 220 : 240,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: p ? 10 : 12,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 999,
                      padding: p ? "16px 28px" : "14px 26px",
                      backgroundColor: accent,
                      color: "#FFFFFF",
                      fontSize: p ? 26 : 24,
                      fontWeight: 700,
                      fontFamily: font,
                    }}
                  >
                    <span>{ctaLabel}</span>
                    <span style={{ fontSize: p ? 28 : 26 }}>→</span>
                  </div>
                  <div
                    style={{
                      fontSize: p ? 22 : 20,
                      fontWeight: 600,
                      color: `${text}AA`,
                      fontFamily: font,
                      maxWidth: "100%",
                      wordBreak: "break-word",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global socials row */}
        {hasSocials && (
          <div style={{ marginTop: p ? 8 : 14, width: "100%", opacity: socialsOp }}>
            <SocialIcons
              socials={ctaProps.socials}
              accentColor={accent}
              textColor={text}
              maxPerRow={p ? 3 : 4}
              fontFamily={font}
              aspectRatio={aspectRatio}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
