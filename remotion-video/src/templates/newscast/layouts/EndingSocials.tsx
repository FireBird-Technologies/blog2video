import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import type { NewscastLayoutProps } from "./types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
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
  ctas,
  accentColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = aspectRatio === "portrait";

  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });
  const bodyOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and subtext are unbounded user input. The composition draws its
     own persistent chrome OVER every scene (NewsCastChrome: a channel logo
     top-centre, and a ticker + lower-third band at the bottom) — this layout
     doesn't render that chrome itself, so a card that's simply centred with
     no height cap can grow tall enough to sit BEHIND (and read as hidden
     under) that chrome, top and bottom, once it's centred within the full
     frame instead of the real space between the chrome bands. Reserve the
     same top/bottom chrome heights NewsCastChrome actually uses, and fit
     title and subtext each against their own fixed, independent budget.
     Never clip: the goal is "shrink until it fits", not "cut off what
     doesn't". No give-back cross-talk between the two fields: a
     useLayoutEffect+setState chain reacting to another useFitText's overflow
     output creates a multi-render convergence that Remotion's per-frame
     headless capture can settle at different points on different frames
     (confirmed via a real render — frame-to-frame scene-change score hit
     1.0, i.e. maximum, twice in the first ten frames, in this scene). */
  const topChromeReserve = Math.round(70 * portraitScale); // channel logo band
  const bottomChromeReserve = p ? 190 : 170; // ticker + lower-third, matches EndingSocialsV2
  const cardBandPx = Math.max(
    1,
    height - topChromeReserve - bottomChromeReserve,
  );

  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitSubRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 52 : 40);
  const fitSubTarget = descriptionFontSize ?? (p ? 20 : 16);
  const cardChromeBudgetPx = Math.round(cardBandPx * (p ? 0.55 : 0.6));
  const titleBudgetPx = Math.round(cardChromeBudgetPx * (subtext ? 0.55 : 1));

  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    // A moderate floor (e.g. 45% of target) still can't fit dozens of lines
    // of stress-test copy into a fixed-width, fixed-height card — line count
    // scales with content length regardless of font size. A near-minimum
    // legible floor is what actually lets extreme copy converge instead of
    // hitting the floor and overflowing for good.
    titleFontSizeIsUserSet ? fitTitleTarget : 10,
    [title, fitTitleTarget, titleFontSizeIsUserSet, titleBudgetPx],
    titleBudgetPx,
  );
  const subBudgetPx = Math.max(1, cardChromeBudgetPx - titleBudgetPx);
  const { px: fitSubPx } = useFitText(
    fitSubRef,
    fitSubTarget,
    descriptionFontSizeIsUserSet ? fitSubTarget : 9,
    [subtext, fitSubTarget, descriptionFontSizeIsUserSet, fitTitlePx, subBudgetPx],
    subBudgetPx,
  );

  // CTA cards (1-3). Only render cards with toggle on + a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const hasAnyCard = cards.length > 0;

  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      {/* Top/bottom pinned to the REAL chrome edges (not inset:0) so
          alignItems:"center" centres within the actual space between the
          persistent channel logo and the ticker/lower-third — never behind
          either. */}
      <div
        style={{
          position: "absolute",
          top: topChromeReserve,
          left: 0,
          right: 0,
          bottom: bottomChromeReserve,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "0 5%" : "0 8%",
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
            ref={fitTitleRef}
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: fitTitlePx,
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
              ref={fitSubRef}
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: fitSubPx,
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

          {hasAnyCard ? (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: p ? 14 : 20,
                marginBottom: 28,
                opacity: bodyOp,
              }}
            >
              {cards.map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    flex: cards.length === 1 ? "0 1 auto" : "1 1 0",
                    minWidth: 180,
                    maxWidth: cards.length === 1 ? "100%" : cards.length === 2 ? "48%" : "32%",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      borderRadius: 8,
                      padding: "12px 24px",
                      backgroundColor: RED,
                      color: "#fff",
                      fontFamily: newscastFont(fontFamily, "title"),
                      fontSize: scaleNewscastPx(15, portraitScale),
                      fontWeight: 700,
                      boxShadow: `0 8px 28px ${RED}55`,
                    }}
                  >
                    {card.ctaButtonText.trim() || "Visit site"}
                  </div>
                  <div
                    style={{
                      fontFamily: newscastFont(fontFamily, "body"),
                      fontSize: scaleNewscastPx(13, portraitScale),
                      color: STEEL,
                      wordBreak: "break-all",
                      maxWidth: "100%",
                      textAlign: "center",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                </div>
              ))}
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
