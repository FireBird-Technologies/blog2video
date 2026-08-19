import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import {
  AccentBars,
  FilmGrain,
  FlashPop,
  LightDust,
  PulseRing,
  SpotlightBeam,
} from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";

/**
 * EndingSocialsV2 — "Curtain Call"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * Base pops the sign-off elements in as a stacked column. This one stages the close
 * as a CURTAIN CALL: a rule draws across the full width like a stage edge, the title
 * rises above it as the billing, and the CTA sits centred in a PulseRing — the last
 * light left on — with the socials as a marquee row beneath the rule.
 *
 * The beam converges to centre rather than sweeping, so the scene closes inward
 * instead of moving on. A single FlashPop fires as the CTA lands.
 *
 * The CTA/socials resolution (`resolveCtas`, the `showWebsiteButton` + link filter,
 * `SocialIcons`) is reused UNCHANGED from the base — it is the one part of this
 * scene with real behavioural surface and must not be re-derived.
 *
 * Seeds 59/61 are fresh.
 */
export const EndingSocialsV2: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#EF4444";
  const text = textColor || "#FFFFFF";
  const displayFont = fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;
  const bodyFont = fontFamily ?? SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;

  const subtext = (narration ?? "").trim();

  // Identical filter to the base: toggle on AND a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const hasAnyCard = cards.length > 0;
  const primary = cards[0];

  // ── Timing ────────────────────────────────────────────────────────────────
  const TITLE_AT = 6;
  const RULE_AT = 16;
  const CTA_AT = 30;
  const SOCIAL_AT = 44;

  const titleSpring = spring({
    frame: frame - TITLE_AT,
    fps,
    config: { damping: 16, stiffness: 210, mass: 1.15 },
  });
  const titleOpacity = interpolate(frame, [TITLE_AT, TITLE_AT + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The stage-edge rule draws out from centre.
  const ruleGrow = interpolate(frame, [RULE_AT, RULE_AT + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [TITLE_AT + 14, TITLE_AT + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaSpring = spring({
    frame: frame - CTA_AT,
    fps,
    config: { damping: 15, stiffness: 215, mass: 1.1 },
  });
  const ctaOpacity = interpolate(frame, [CTA_AT, CTA_AT + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialOpacity = interpolate(frame, [SOCIAL_AT, SOCIAL_AT + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titlePx = titleFontSize ?? (p ? 81 : 64);
  const subPx = descriptionFontSize ?? (p ? 33 : 29);
  const ctaPx = p ? 34 : 30;

  // The template's slam signature: overshoot dressed with a sine kicker.
  const titleScale = 0.82 + titleSpring * 0.18 + Math.sin(titleSpring * Math.PI) * 0.05;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", overflow: "hidden" }}>
      {/* ── Background: a CLOSING CURTAIN, not the base's open backdrop ──
             Vertical accent bands drape the frame like stage curtains and a warm
             footlight wash rises from the bottom edge. Both are tied to the close so
             the scene physically shuts rather than simply ending. */}
      <SpotlightBackground bgColor={bgColor} accentColor={accent} intensity={0.5} />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            ${accent}12 0px,
            ${accent}12 2px,
            transparent 2px,
            transparent ${p ? 26 : 34}px
          )`,
          opacity: interpolate(frame, [0, 24], [0, 0.9], { extrapolateRight: "clamp" }),
          maskImage: "linear-gradient(180deg, black 0%, transparent 62%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, transparent 62%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(0deg, ${accent}26 0%, transparent 30%)`,
          opacity: interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />

      {/* Beam converges to centre — the scene closing in rather than moving on. */}
      <SpotlightBeam mode="converge" startFrame={0} intensity={1.15} />
      <LightDust count={30} seed={59} tint="white" accentColor={accent} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "14% 8%" : "10% 9%",
          zIndex: 3,
        }}
      >
        {/* ── Billing ── */}
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 900,
            fontSize: titlePx,
            lineHeight: 1.04,
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
            color: text,
            textAlign: "center",
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            overflowWrap: "anywhere",
            maxWidth: "100%",
          }}
        >
          {title}
        </div>

        {subtext ? (
          <div
            style={{
              marginTop: p ? 16 : 14,
              fontFamily: bodyFont,
              fontWeight: 300,
              fontSize: subPx,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: text,
              opacity: subOpacity * 0.78,
              textAlign: "center",
              maxWidth: "88%",
              overflowWrap: "anywhere",
            }}
          >
            {subtext}
          </div>
        ) : null}

        {/* ── Stage edge ── */}
        <div
          style={{
            marginTop: p ? 30 : 26,
            width: `${(ruleGrow * 100).toFixed(1)}%`,
            height: 3,
            background: accent,
            flexShrink: 0,
          }}
        />

        {/* ── The CTA: the last light left on ── */}
        {hasAnyCard ? (
          <div
            style={{
              position: "relative",
              marginTop: p ? 34 : 30,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: ctaOpacity,
              transform: `scale(${0.9 + ctaSpring * 0.1})`,
            }}
          >
            <PulseRing accentColor={accent} periodFrames={70} />
            <div
              style={{
                fontFamily: displayFont,
                fontWeight: 900,
                fontSize: ctaPx,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: text,
                background: accent,
                padding: p ? "14px 30px" : "12px 28px",
                textAlign: "center",
                maxWidth: "100%",
                overflowWrap: "anywhere",
              }}
            >
              {primary?.ctaButtonText.trim() || "Get started"}
            </div>
            <div
              style={{
                marginTop: p ? 12 : 10,
                fontFamily: bodyFont,
                fontWeight: 300,
                fontSize: p ? 22 : 18,
                letterSpacing: "0.12em",
                color: text,
                opacity: 0.8,
                textAlign: "center",
                wordBreak: "break-word",
                maxWidth: "100%",
              }}
            >
              {primary?.websiteLink}
            </div>
          </div>
        ) : null}

        {/* ── Marquee row of socials ── */}
        <div
          style={{
            marginTop: p ? 32 : 28,
            opacity: socialOpacity,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={text}
            maxPerRow={p ? 3 : 6}
            fontFamily={bodyFont}
            aspectRatio={aspectRatio}
          />
        </div>
      </AbsoluteFill>

      <AccentBars accentColor={accent} position="bottom-left" count={3} startFrame={SOCIAL_AT} />
      <FlashPop count={2} every={30} seed={61} startFrame={CTA_AT + 2} />
      <FilmGrain intensity={0.9} />
    </AbsoluteFill>
  );
};
