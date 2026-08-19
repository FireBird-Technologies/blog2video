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
 * rises above it as the billing, and the CTAs sit centred against a PulseRing — the
 * last lights left on — with the socials as a marquee row beneath the rule.
 *
 * The beam converges to centre rather than sweeping, so the scene closes inward
 * instead of moving on. A single FlashPop fires as the CTAs land.
 *
 * The CTA/socials behaviour (`resolveCtas`, the `showWebsiteButton` + link filter,
 * the 1-3 card row and its width rules, `SocialIcons`) matches the base layout —
 * it is the one part of this scene with real behavioural surface and must not be
 * re-derived. Only the dressing (accent pill, spring, staging) differs.
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
  const cardCount = cards.length;

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

        {/* ── The CTAs: the last lights left on ──
               1-3 columns, mirroring the base layout's card row. The PulseRing
               stays a single frame-centred ambient beat behind the whole row. */}
        {hasAnyCard ? (
          <div
            style={{
              position: "relative",
              marginTop: p ? 34 : 30,
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: p ? 18 : 32,
              width: "100%",
            }}
          >
            {/* The ring only reads as a halo when it sits behind a single centred
                CTA; with a row of cards it would circle empty space. */}
            {cardCount === 1 ? <PulseRing accentColor={accent} periodFrames={70} /> : null}
            {cards.map((card, idx) => {
              // Each card lands after the one before it.
              const cardAt = CTA_AT + idx * 6;
              const cardSpring = spring({
                frame: frame - cardAt,
                fps,
                config: { damping: 15, stiffness: 215, mass: 1.1 },
              });
              const cardOpacity = interpolate(frame, [cardAt, cardAt + 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: cardCount === 1 ? "0 1 auto" : "1 1 0",
                    minWidth: 220,
                    maxWidth: cardCount === 1 ? "100%" : cardCount === 2 ? "46%" : "32%",
                    opacity: cardOpacity,
                    transform: `scale(${0.9 + cardSpring * 0.1})`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontWeight: 900,
                      fontSize: cardCount === 1 ? ctaPx : Math.max(20, ctaPx - 6),
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
                    {card.ctaButtonText.trim() || "Get started"}
                  </div>
                  <div
                    style={{
                      marginTop: p ? 12 : 10,
                      fontFamily: bodyFont,
                      fontWeight: 300,
                      fontSize: cardCount === 1 ? (p ? 22 : 18) : (p ? 18 : 15),
                      letterSpacing: "0.12em",
                      color: text,
                      opacity: 0.8,
                      textAlign: "center",
                      wordBreak: "break-word",
                      maxWidth: "100%",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                </div>
              );
            })}
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
