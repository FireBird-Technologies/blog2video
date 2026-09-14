import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { COLORS, gridcraftV2Surface } from "../utils/styles";
import { GridcraftV2Frame } from "../components/GridcraftV2Frame";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import { useFitText } from "../components/useFitText";

export const EndingSocialsV2: React.FC<GridcraftLayoutProps> = ({
  title, narration, socials, websiteLink, showWebsiteButton, ctaButtonText, ctas,
  accentColor, bgColor, textColor, aspectRatio, fontFamily, titleFontSize,
  descriptionFontSize, titleFontSizeIsUserSet, descriptionFontSizeIsUserSet,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const portrait = aspectRatio === "portrait";
  const accent = accentColor || COLORS.ACCENT;
  const ink = textColor || COLORS.DARK;
  const font = fontFamily || GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const subtext = narration?.trim() || "";
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton })
    .filter((card) => card.showWebsiteButton && card.websiteLink.length > 0)
    .slice(0, 3);
  const hasCta = cards.length > 0;

  const titleRef = React.useRef<HTMLDivElement>(null);
  const subtextRef = React.useRef<HTMLDivElement>(null);
  const titleTarget = titleFontSize ?? (portrait ? 109 : 108);
  const subtextTarget = descriptionFontSize ?? (portrait ? 46 : 61);
  const { px: titlePx } = useFitText(titleRef, titleTarget, titleFontSizeIsUserSet ? titleTarget : portrait ? 28 : 32, [title, titleTarget, titleFontSizeIsUserSet, portrait], height * (portrait ? 0.19 : 0.28));
  const { px: subtextPx } = useFitText(subtextRef, subtextTarget, descriptionFontSizeIsUserSet ? subtextTarget : 14, [subtext, subtextTarget, descriptionFontSizeIsUserSet, portrait], height * (portrait ? 0.12 : 0.17));

  const motion = (index: number): React.CSSProperties => {
    const progress = spring({ frame: Math.max(0, frame - index * 6), fps, config: { damping: 18, stiffness: 170, mass: 0.7 } });
    return { opacity: interpolate(progress, [0, 1], [0, 1]), transform: `translateY(${interpolate(progress, [0, 1], [18, 0])}px) scale(${interpolate(progress, [0, 1], [0.92, 1])})` };
  };

  return (
    <GridcraftV2Frame bgColor={bgColor}>
      <div style={{ width: portrait ? "88%" : "90%", height: portrait ? "88%" : "82%", margin: "auto", display: "grid", gridTemplateColumns: portrait ? "1fr" : "7fr 5fr", gridTemplateRows: portrait ? "4.5fr 2.5fr 1.5fr" : "6fr 2fr", gap: 12, fontFamily: font }}>
        <div style={{ ...gridcraftV2Surface(false, accent, ink), ...motion(0), gridColumn: "1", gridRow: "1", padding: portrait ? 36 : 54, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ width: 42, height: 6, borderRadius: 3, backgroundColor: accent }} />
          <div>
            <div ref={titleRef} style={{ color: ink, fontSize: titlePx, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.045em", overflowWrap: "anywhere" }}>{title}</div>
            {subtext && <div ref={subtextRef} style={{ color: ink, opacity: 0.68, fontSize: subtextPx, fontWeight: 400, lineHeight: 1.4, marginTop: portrait ? 24 : 30, maxWidth: "92%" }}>{subtext}</div>}
          </div>
        </div>

        <div style={{ ...gridcraftV2Surface(true, accent, ink), ...motion(1), gridColumn: portrait ? "1" : "2", gridRow: portrait ? "2" : "1", padding: portrait ? "26px 32px" : "42px 38px", minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: portrait ? 16 : 22 }}>
          {hasCta ? cards.map((card, index) => {
            const label = card.ctaButtonText.trim() || card.websiteLink;
            return (
              <div key={`${card.websiteLink}-${index}`} style={{ paddingBottom: index < cards.length - 1 ? (portrait ? 16 : 22) : 0, borderBottom: index < cards.length - 1 ? "1px solid rgba(255,255,255,0.32)" : undefined, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, color: COLORS.WHITE, fontSize: Math.max(18, subtextTarget * (cards.length === 1 ? 1.18 : 0.92)), fontWeight: 700, lineHeight: 1.1 }}><span>{label}</span><span aria-hidden style={{ flexShrink: 0 }}>↗</span></div>
                <div style={{ color: COLORS.WHITE, opacity: 0.76, fontSize: Math.max(12, subtextTarget * 0.6), fontWeight: 500, marginTop: 9, overflowWrap: "anywhere" }}>{card.websiteLink}</div>
              </div>
            );
          }) : (
            <SocialIcons socials={socials} accentColor={COLORS.WHITE} textColor={COLORS.WHITE} maxPerRow={portrait ? 3 : 2} fontFamily={font} aspectRatio={aspectRatio} />
          )}
        </div>

        <div style={{ ...gridcraftV2Surface(false, accent, ink), ...motion(2), gridColumn: portrait ? "1" : "1 / 3", gridRow: portrait ? "3" : "2", padding: portrait ? "16px 24px" : "18px 34px", minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {hasCta && <SocialIcons socials={socials} accentColor={accent} textColor={ink} maxPerRow={portrait ? 3 : 6} fontFamily={font} aspectRatio={aspectRatio} />}
          {!hasCta && <div style={{ color: ink, opacity: 0.56, fontSize: Math.max(13, subtextTarget * 0.62), fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{websiteLink?.trim()}</div>}
        </div>
      </div>
    </GridcraftV2Frame>
  );
};
