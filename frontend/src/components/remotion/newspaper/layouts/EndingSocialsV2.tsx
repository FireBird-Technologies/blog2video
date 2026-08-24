import React from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { NewsBackground, NewsPaperWash } from "../NewsBackground";
import { useFitText } from "../components/useFitText";
import type { BlogLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";

const H_FONT_DEFAULT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT_DEFAULT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * ending_socials__v2 — "Back Page".
 *
 * Same props as EndingSocials (socials, websiteLink, showWebsiteButton,
 * ctaButtonText, ctas).
 *
 * Set as the actual back page of the paper, NOT a centred sign-off card:
 *  - a ruled nameplate band across the head, edition line and all
 *  - the sign-off ranged LEFT on a narrow measure, like a standing editorial
 *  - CTAs as a dashed "subscription coupon" — the clip-and-return device a
 *    back page carries
 *  - socials set as a boxed directory panel in the right rail
 *
 * The base layout is a centred card over Ken Burns shards with a scrolling
 * ticker; this is a squared, asymmetric page with none of those devices.
 */
export const EndingSocialsV2: React.FC<BlogLayoutProps & { narration?: string }> = ({
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
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const H_FONT = fontFamily ?? H_FONT_DEFAULT;
  const B_FONT = fontFamily ?? B_FONT_DEFAULT;

  const textCol = textColor ?? "#111111";
  const paperBg = bgColor ?? "#FAFAF8";
  const accent = accentColor ?? "#FFE34D";

  const subtext = (narration ?? "").trim();
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink.length > 0 || c.ctaButtonText.trim().length > 0),
  );
  const primary = cards[0];
  const extras = cards.slice(1);

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const contentOpacity = fadeIn * fadeOut;

  /* 3D camera — a flatter, more "laid on a desk" angle than the other scenes. */
  const camRotateX = interpolate(frame, [0, 78], [9, 1.5], { extrapolateRight: "clamp" });
  const camRotateY = interpolate(frame, [0, 78], [-7, -1], { extrapolateRight: "clamp" });
  const camScale = interpolate(frame, [0, 78], [1.12, 1.02], { extrapolateRight: "clamp" });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -22]);

  const bgScale = interpolate(frame, [0, durationInFrames], [1.06, 1.15], {
    extrapolateRight: "clamp",
  });
  const bgDriftX = interpolate(frame, [0, durationInFrames], [0, 18]);

  /* ── Auto-fit ──────────────────────────────────────────────
     The sign-off (title + subtext) is unbounded user input. In landscape the
     left column sits in a flex:1 row with a real budget; in portrait it's
     flex:"0 0 auto", shrink-wrapping to its own content with no height cap,
     so long copy can push past the page. Reserve a fixed share of the page
     for the two text blocks, split between them.

     Title and subtext each fit against their own fixed, independent budget.
     No give-back cross-talk between the two: a useLayoutEffect+setState
     chain reacting to another useFitText's overflow output creates a
     multi-render convergence that Remotion's per-frame headless capture can
     settle at different points on different frames (confirmed via a real
     render — frame-to-frame scene-change score hit 1.0, i.e. maximum, twice
     in the first ten frames, in the equivalent newspaper opening scene). */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const subtextRef = React.useRef<HTMLDivElement>(null);
  const titleTargetPx = titleFontSize ?? (p ? 63 : 50);
  const subTargetPx = descriptionFontSize ?? (p ? 33 : 25);
  const stackBudgetPx = Math.round(videoHeight * (p ? 0.34 : 0.52));
  const titleBudgetPx = Math.round(stackBudgetPx * (subtext ? 0.62 : 1));

  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : Math.round(titleTargetPx * 0.42),
    [title, titleTargetPx, titleFontSizeIsUserSet, titleBudgetPx],
    titleBudgetPx,
  );
  const subBudgetPx = Math.max(1, stackBudgetPx - titleBudgetPx);
  const { px: subPx } = useFitText(
    subtextRef,
    subTargetPx,
    descriptionFontSizeIsUserSet ? subTargetPx : p ? 16 : 14,
    [subtext, subTargetPx, descriptionFontSizeIsUserSet, subBudgetPx, titlePx],
    subBudgetPx,
  );

  const plateW = interpolate(frame, [2, 22], [0, 100], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(frame, [12, 30], [-24, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [24, 42], [0, 1], { extrapolateRight: "clamp" });
  const couponOp = interpolate(frame, [34, 54], [0, 1], { extrapolateRight: "clamp" });
  const couponY = interpolate(frame, [34, 54], [22, 0], { extrapolateRight: "clamp" });
  const dirOp = interpolate(frame, [44, 62], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        backgroundColor: paperBg,
        fontFamily: B_FONT,
        perspective: "1700px",
        perspectiveOrigin: "50% 42%",
      }}
    >
      {/* BACKDROP */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${bgScale}) translateX(${bgDriftX}px)`,
        }}
      >
        <NewsBackground bgColor={paperBg} />
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.2,
            filter: "grayscale(80%) contrast(1.1)",
            mixBlendMode: "multiply",
          }}
        />
          <NewsPaperWash />
      </div>

      {/* THE PAGE */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform:
            `scale(${camScale}) rotateX(${camRotateX}deg) rotateY(${camRotateY}deg) ` +
            `translateY(${driftY}px)`,
          opacity: contentOpacity,
          display: "flex",
          flexDirection: "column",
          padding: p ? "10% 7%" : "6.5% 7%",
        }}
      >
        {/* ── NAMEPLATE BAND ── */}
        <div style={{ width: `${plateW}%`, flexShrink: 0, transform: "translateZ(25px)" }}>
          <div style={{ height: p ? 10 : 8, background: textCol, width: "100%" }} />
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              padding: p ? "9px 0" : "7px 0",
              fontFamily: B_FONT,
              fontSize: p ? 20 : 16,
              fontWeight: 900,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: textCol,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <span>The Back Page</span>
            <span style={{ opacity: 0.5 }}>Final Edition</span>
          </div>
          <div style={{ height: 2, background: textCol, width: "100%", opacity: 0.5 }} />
        </div>

        {/* ── BODY: standing editorial left, directory right ── */}
        <div
          style={{
            /* Landscape keeps the two rails stretched to the page foot. Portrait
               stacks and must only be as tall as its text, so the socials band
               below rides down with it instead of being pinned to the bottom. */
            flex: p ? "0 0 auto" : 1,
            minHeight: 0,
            marginTop: p ? 26 : 24,
            display: "flex",
            flexDirection: p ? "column" : "row",
            /* Portrait stacks sign-off over CTA rail, so this gap is what drops
               the CTAs (and the socials band under them) clear of the text. */
            gap: p ? 64 : 46,
            alignItems: "stretch",
          }}
        >
          {/* LEFT — sign-off + coupon */}
          <div
            style={{
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              transform: "translateZ(45px)",
            }}
          >
            <div
              ref={titleRef}
              style={{
                fontFamily: H_FONT,
                fontSize: titlePx,
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.02em",
                color: textCol,
                opacity: titleOp,
                transform: `translateX(${titleX}px)`,
                flexShrink: 0,
              }}
            >
              {title}
            </div>

            {subtext && (
              <div
                ref={subtextRef}
                style={{
                  fontFamily: H_FONT,
                  fontSize: subPx,
                  fontStyle: "italic",
                  lineHeight: 1.42,
                  color: textCol,
                  opacity: subOp * 0.82,
                  marginTop: p ? 16 : 14,
                  flexShrink: 0,
                }}
              >
                {subtext}
              </div>
            )}

          </div>

          {/* RIGHT — the call-to-action rail: coupon on top, small ads under */}
          <div
            style={{
              width: p ? "100%" : "36%",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: p ? 14 : 16,
              transform: "translateZ(70px)",
              minHeight: 0,
            }}
          >
            {/* ── PRIMARY CTA — dashed coupon box in the call-to-action rail ── */}
            {primary && (
              <div
                style={{
                  opacity: couponOp,
                  transform: `translateY(${couponY}px)`,
                  border: `3px dashed ${textCol}`,
                  padding: p ? "18px 20px" : "16px 20px",
                  background: paperBg,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    background: accent,
                    color: textCol,
                    padding: p ? "9px 18px" : "8px 18px",
                    fontFamily: B_FONT,
                    fontSize: p ? 25 : 21,
                    fontWeight: 900,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    maxWidth: "100%",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {primary.ctaButtonText.trim() || "Read More"}
                </div>
                {primary.websiteLink && (
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: p ? 18 : 15,
                      fontWeight: 700,
                      color: textCol,
                      opacity: 0.62,
                      marginTop: 10,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {primary.websiteLink}
                  </div>
                )}
              </div>
            )}
            {/* Secondary CTAs as small ruled ads under the coupon */}
            {extras.map((card, i) => (
              <div
                key={i}
                style={{
                  border: `2px solid ${textCol}`,
                  borderLeft: `7px solid ${accent}`,
                  padding: p ? "10px 14px" : "10px 12px",
                  background: paperBg,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: B_FONT,
                    fontSize: p ? 19 : 16,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: textCol,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {card.ctaButtonText.trim() || "Read More"}
                </div>
                {card.websiteLink && (
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: p ? 15 : 12,
                      fontWeight: 600,
                      color: textCol,
                      opacity: 0.58,
                      marginTop: 3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER BAND — the directory of socials, ruled across the page foot ── */}
        <div
          style={{
            flexShrink: 0,
            /* Portrait: the band follows the text rather than sitting at the page
               foot, so it needs a real gap above it — otherwise it reads as part
               of the sign-off instead of a separate directory. */
            marginTop: p ? 44 : 16,
            opacity: dirOp,
            transform: "translateZ(25px)",
          }}
        >
          <div style={{ height: 3, background: textCol, width: "100%" }} />
          <div
            style={{
              display: "flex",
              /* Portrait stacks the label over centred icons; landscape keeps the
                 label ranged left with the directory filling the rest of the rule. */
              flexDirection: p ? "column" : "row",
              alignItems: "center",
              justifyContent: p ? "center" : "space-between",
              gap: p ? 10 : 26,
              paddingTop: p ? 12 : 10,
            }}
          >
            <span
              style={{
                fontFamily: B_FONT,
                fontSize: p ? 15 : 13,
                fontWeight: 900,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: textCol,
                opacity: 0.5,
                whiteSpace: "nowrap",
                flexShrink: 0,
                textAlign: p ? "center" : "left",
              }}
            >
              Find us
            </span>
            {/* SocialIcons sizes each item as a share of ITS container, so this
                needs to be the wide element or the icons wrap one per row. */}
            <div style={{ flex: p ? "0 0 auto" : 1, width: p ? "100%" : undefined, minWidth: 0 }}>
              <SocialIcons
                socials={socials}
                accentColor={accent}
                textColor={textCol}
                // Resolved B_FONT, not the raw prop: SocialIcons only applies
                // fontFamily when it's truthy, so passing `undefined` would let
                // the labels fall back to the component's own face instead of
                // the template's body font, as the base layout does.
                fontFamily={B_FONT}
                aspectRatio={aspectRatio}
                maxPerRow={p ? 4 : 6}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Print screen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(#000 1px, transparent 0)",
          backgroundSize: "4px 4px",
          opacity: 0.035,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
