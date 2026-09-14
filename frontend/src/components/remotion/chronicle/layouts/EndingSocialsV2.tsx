import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import { CHRONICLE_BODY_FONT, CHRONICLE_HEADING_FONT, CHRONICLE_SMALLCAPS_FONT } from "../../../../fonts/chronicle-defaults";
import { OrnamentalBorder, InkDivider } from "../components/OrnamentalBorder";
import { WaxSeal } from "../components/WaxSeal";
import { QuillText } from "../components/QuillInk";
import { resolveCtas } from "../../../../utils/resolveCtas";
import { SOCIAL_ICONS, resolveEnabledSocials } from "../../SocialIcons";
import { useFitText } from "../components/useFitText";
import { chronicleHeroHeadingStyle, chronicleHeroHeadingTypography } from "../components/ChronicleHeading";

/**
 * ending_socials__v2 — "The Final Folio".
 *
 * A quiet final leaf: deckled vellum, restrained marginal illumination, an
 * editorial colophon, and one wax seal. CTAs read as manuscript entries and
 * enabled social icons + identities form an orientation-aware sign-off.
 */
export const EndingSocialsV2: React.FC<ChronicleLayoutProps> = ({
  title = "The Shape of Things to Come",
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
  closingLeafLabel = "The closing leaf",
  passageLabel = "Passage {number}",
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width, fps } = useVideoConfig();
  const portrait = aspectRatio === "portrait" || height > width;
  // `p` is intentionally used by the template-studio source-default updater,
  // which recognizes responsive font fallbacks in the `p ? portrait : landscape` form.
  const p = portrait;

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton })
    .filter((card) => card.showWebsiteButton && card.websiteLink.length > 0)
    .slice(0, 3);
  const socialEntries = resolveEnabledSocials(socials).slice(0, portrait ? 4 : 5);
  const closingLeafText = closingLeafLabel.trim();

  const pageIn = spring({
    frame: frame - 5,
    fps,
    config: { damping: 24, stiffness: 72, mass: 1.15 },
  });
  const headingIn = interpolate(frame, [22, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationIn = interpolate(frame, [48, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const footerIn = interpolate(frame, [96, 116], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pageW = portrait ? width * 0.87 : width * 0.78;
  const pageH = portrait ? height * 0.87 : height * 0.84;
  const body = fontFamily ?? CHRONICLE_BODY_FONT;
  const monogram = (title.match(/[A-Za-z]/)?.[0] ?? "C").toUpperCase();

  const titleRef = React.useRef<HTMLDivElement>(null);
  // Portrait is a full closing leaf, so its default display type should carry
  // the page instead of reading like a landscape block scaled down in place.
  // useFitText still protects long/user-authored titles.
  const titleTarget = titleFontSize ?? (p ? 107 : 116);
  // Untouched defaults may shrink far enough to fit a long generated title.
  // A user-selected size remains exact, even when that deliberate choice
  // overflows the parchment.
  const titleFloor = titleFontSizeIsUserSet
    ? titleTarget
    : Math.min(titleTarget, Math.max(portrait ? 32 : 28, Math.round(titleTarget * 0.28)));
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFloor,
    [title, titleTarget, titleFontSizeIsUserSet, portrait, pageW],
    Math.round(pageH * 0.17),
  );

  const narrationRef = React.useRef<HTMLDivElement>(null);
  // One editor control owns the complete supporting-type system. This keeps
  // the hierarchy intact while allowing every non-title label to scale with
  // the narration instead of leaving fixed-size CTA/footer copy behind.
  const narrationTarget = descriptionFontSize ?? (p ? 71 : 51);
  const narrationBudget = Math.round(pageH * (portrait ? 0.2 : 0.18));
  const narrationFloor = descriptionFontSizeIsUserSet
    ? narrationTarget
    : Math.min(narrationTarget, Math.max(portrait ? 18 : 16, Math.round(narrationTarget * 0.4)));
  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationTarget,
    narrationFloor,
    [narration, narrationTarget, descriptionFontSizeIsUserSet, titlePx, portrait, pageW],
    narrationBudget,
  );
  // Supporting labels and CTA rows follow auto-fit for untouched defaults, but
  // preserve the user's exact supporting-type choice when explicitly set.
  const supportingTarget = descriptionFontSizeIsUserSet ? narrationTarget : narrationPx;
  const supportingSize = (ratio: number, minimum = 10) =>
    Math.max(minimum, Math.round(supportingTarget * ratio));
  const eyebrowPx = supportingSize(0.55);
  const socialLabelPx = supportingSize(0.55);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: fadeOut, fontFamily: body }}>
      <div
        style={{
          position: "absolute",
          width: portrait ? "110%" : "72%",
          height: portrait ? "55%" : "82%",
          background: "radial-gradient(ellipse, rgba(255,206,120,0.20) 0%, rgba(255,190,90,0.06) 45%, transparent 72%)",
          filter: "blur(24px)",
          transform: `translateY(${Math.sin(frame / 24) * 3}px)`,
        }}
      />

      <div
        style={{
          position: "relative",
          width: pageW,
          height: pageH,
          opacity: interpolate(pageIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(pageIn, [0, 1], [34, 0])}px) scale(${interpolate(pageIn, [0, 1], [0.975, 1])})`,
          filter: "drop-shadow(0 30px 34px rgba(40,24,10,0.28))",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(0.7% 1.2%,15% .4%,31% 1%,48% .2%,66% .8%,84% .3%,99.2% 1.1%,99.7% 20%,99.1% 43%,99.8% 67%,99.2% 98.8%,82% 99.5%,61% 98.9%,42% 99.7%,21% 99.1%,.8% 99.6%,.3% 77%,.9% 54%,.2% 29%)",
            background: "radial-gradient(ellipse at 26% 12%,rgba(255,244,205,.72),transparent 43%),radial-gradient(ellipse at 76% 80%,rgba(142,95,34,.12),transparent 46%),linear-gradient(96deg,#dfc995 0%,#f4e6c5 4%,#f2e3bf 51%,#ead6a7 96%,#c6a86f 100%)",
            boxShadow: `inset 0 0 0 1px ${accentColor}, inset 0 0 70px rgba(83,51,18,0.16)`,
          }}
        />

        <div style={{ position: "absolute", inset: portrait ? "4.8%" : "5.5%" }}>
          <OrnamentalBorder color={accentColor} size={portrait ? 94 : 112} startFrame={10} variant="vine" />

          <div
            style={{
              position: "absolute",
              inset: portrait ? "5.5% 5% 4%" : "5% 7% 4%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              // The former flex-end alignment left almost the entire upper
              // half blank in portrait. Center the complete colophon stack so
              // the closing leaf has balanced top and bottom breathing room.
              justifyContent: portrait ? "center" : "flex-start",
              minHeight: 0,
            }}
          >
            {closingLeafText && (
              <div
                style={{
                  fontFamily: CHRONICLE_SMALLCAPS_FONT,
                  color: accentColor,
                  fontSize: eyebrowPx,
                  fontWeight: 700,
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                  opacity: headingIn,
                }}
              >
                {closingLeafText}
              </div>
            )}

            <FinalFlourish color={accentColor} progress={headingIn} portrait={portrait} />

            <div style={{ width: "100%", position: "relative", flexShrink: 0 }}>
              <div
                ref={titleRef}
                aria-hidden
                style={{ position: "absolute", visibility: "hidden", width: "100%", ...chronicleHeroHeadingTypography(fontFamily), fontSize: titlePx }}
              >
                {title}
              </div>
              <div
                style={{
                  minHeight: titlePx * 1.04,
                  ...chronicleHeroHeadingStyle(accentColor, fontFamily),
                  fontSize: titlePx,
                  opacity: headingIn,
                }}
              >
                <QuillText text={title} startFrame={24} durationFrames={28} mode="fade" showCursor={false} />
              </div>
            </div>

            <div style={{ width: portrait ? "64%" : "48%", margin: portrait ? "18px 0" : "16px 0" }}>
              <InkDivider color={textColor} width="100%" startFrame={38} />
            </div>

            {narration && (
              <div
                ref={narrationRef}
                style={{
                  width: portrait ? "86%" : "76%",
                  maxHeight: descriptionFontSizeIsUserSet ? undefined : narrationBudget,
                  fontFamily: body,
                  fontSize: narrationPx,
                  fontStyle: "italic",
                  lineHeight: 1.42,
                  textAlign: "center",
                  color: textColor,
                  opacity: narrationIn * 0.9,
                  overflow: descriptionFontSizeIsUserSet ? "visible" : "hidden",
                  flexShrink: 0,
                }}
              >
                <QuillText text={narration} startFrame={48} durationFrames={44} mode="word" showCursor={false} />
              </div>
            )}

            {cards.length > 0 && (
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: portrait ? "1fr" : `repeat(${cards.length}, minmax(0, 1fr))`,
                  gap: portrait ? 8 : 22,
                  marginTop: portrait ? 24 : 28,
                  flexShrink: 0,
                }}
              >
                {cards.map((card, index) => {
                  const start = 67 + index * 7;
                  const reveal = interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                  return (
                    <CtaEntry
                      key={`${card.websiteLink}-${index}`}
                      index={index}
                      label={card.ctaButtonText.trim() || "Read the full chronicle"}
                      link={card.websiteLink}
                      accentColor={accentColor}
                      textColor={textColor}
                      portrait={portrait}
                      reveal={reveal}
                      descriptionSize={supportingTarget}
                      passageLabel={passageLabel}
                    />
                  );
                })}
              </div>
            )}

            {socialEntries.length > 0 ? (
              <div
                style={{
                  // Expand through all space left between the CTA and footer so
                  // the icon group sits at the visual centre of that open field.
                  marginTop: portrait ? 18 : undefined,
                  marginBottom: portrait ? 0 : 22,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  minHeight: portrait ? 160 : 120,
                }}
              >
                <SocialIdentityList
                  entries={socialEntries}
                  textColor={textColor}
                  fontSize={socialLabelPx}
                  portrait={portrait}
                />
              </div>
            ) : (
              !portrait && <div style={{ flex: 1, minHeight: 12 }} />
            )}

            <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, opacity: footerIn * 0.75, flexShrink: 0, marginBottom: portrait ? 20 : 0 }} />
          </div>

          <div style={{ position: "absolute", left: "50%", bottom: portrait ? -34 : -39, transform: "translateX(-50%) rotate(-3deg)", zIndex: 4 }}>
            <WaxSeal size={portrait ? 104 : 82} color="#7A2418" monogram={monogram} stampFrame={88} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CtaEntry: React.FC<{
  index: number;
  label: string;
  link: string;
  accentColor: string;
  textColor: string;
  portrait: boolean;
  reveal: number;
  descriptionSize: number;
  passageLabel: string;
}> = ({ index, label, link, accentColor, textColor, portrait, reveal, descriptionSize, passageLabel }) => {
  const passagePx = Math.max(10, Math.round(descriptionSize * 0.42));
  const labelPx = Math.max(12, Math.round(descriptionSize * 0.66));
  const linkPx = Math.max(10, Math.round(descriptionSize * 0.5));
  const rowHeight = Math.max(portrait ? 72 : 90, Math.round(descriptionSize * (portrait ? 2.6 : 3.1)));
  const passageText = passageLabel.replace(/\{number\}/gi, romanNumeral(index + 1)).trim();

  return (
  <div
    style={{
      position: "relative",
      minHeight: rowHeight,
      padding: portrait ? "15px 18px 13px" : "15px 16px 13px",
      borderTop: `1px solid ${accentColor}`,
      borderBottom: `1px solid ${accentColor}`,
      opacity: reveal,
      transform: `translateY(${(1 - reveal) * 12}px)`,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 7,
        left: "50%",
        transform: "translateX(-50%) rotate(45deg)",
        width: portrait ? 10 : 8,
        height: portrait ? 10 : 8,
        background: accentColor,
      }}
    />
    {passageText && (
      <div style={{ fontFamily: CHRONICLE_SMALLCAPS_FONT, color: accentColor, fontSize: passagePx, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 5 }}>
        {passageText}
      </div>
    )}
    <div style={{ color: textColor, fontFamily: CHRONICLE_HEADING_FONT, fontWeight: 700, fontSize: labelPx, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {label}
    </div>
    <div style={{ color: textColor, opacity: 0.68, fontSize: linkPx, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {displayLink(link)}
    </div>
  </div>
  );
};

const FinalFlourish: React.FC<{ color: string; progress: number; portrait: boolean }> = ({ color, progress, portrait }) => (
  <svg viewBox="0 0 500 54" style={{ width: portrait ? "58%" : "40%", height: portrait ? 46 : 42, margin: "7px 0 4px" }}>
    <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="520" strokeDashoffset={(1 - progress) * 520}>
      <path d="M247 27 C198 27 198 7 154 12 C117 16 134 43 93 42 C66 41 55 26 31 27" />
      <path d="M253 27 C302 27 302 7 346 12 C383 16 366 43 407 42 C434 41 445 26 469 27" />
      <path d="M151 13 C145 24 151 31 166 34 M349 13 C355 24 349 31 334 34" />
    </g>
    <g transform="translate(250 27) rotate(45)" opacity={progress}>
      <rect x="-8" y="-8" width="16" height="16" fill={color} />
      <rect x="-3" y="-3" width="6" height="6" fill="#F1E4C9" />
    </g>
  </svg>
);

/**
 * Portrait uses a centered vertical list. Landscape presents the platforms in
 * one horizontal row, with each identity centered beneath its icon.
 */
const SocialIdentityList: React.FC<{
  entries: ReturnType<typeof resolveEnabledSocials>;
  textColor: string;
  fontSize: number;
  portrait: boolean;
}> = ({ entries, textColor, fontSize, portrait }) => {
  const frame = useCurrentFrame();
  const iconSize = portrait ? 72 : 46;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        alignItems: portrait ? "stretch" : "flex-start",
        justifyContent: "center",
        gap: portrait ? 22 : 44,
        width: "fit-content",
        maxWidth: portrait ? "86%" : "96%",
      }}
    >
      {entries.map(({ key, item }, index) => {
        const Icon = SOCIAL_ICONS[key];
        const iconIn = interpolate(frame, [84 + index * 6, 102 + index * 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const rawIdentity = String(item.label || item.text || item.url || "").trim();
        const username = rawIdentity.toLowerCase().replace(/\s+/g, "") === key
          ? ""
          : rawIdentity;

        return (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: portrait ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              gap: portrait ? 18 : 14,
              minWidth: portrait ? 260 : 150,
              textAlign: "center",
              opacity: iconIn,
              transform: `translateY(${(1 - iconIn) * 16}px) scale(${0.72 + iconIn * 0.28})`,
            }}
          >
            <Icon size={iconSize} />
            {username && (
              <span
                style={{
                  color: textColor,
                  fontSize,
                  fontStyle: "italic",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: portrait ? 300 : 180,
                }}
              >
                {username}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const romanNumeral = (value: number) => ["I", "II", "III"][value - 1] ?? String(value);

const displayLink = (link: string) => link.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
