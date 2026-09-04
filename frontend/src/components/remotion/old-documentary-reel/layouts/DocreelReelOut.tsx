import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ArchiveImageBackdrop,
  ProjectorReel,
  hexToRgba,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText, useAvailableHeight } from "../components/useFitText";

/** Reel-Out & Credits: the projector spins down, sprocket holes widen, "THE END" card, socials roll. */
export const DocreelReelOut: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    accentColor,
    bgColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    brandName,
    websiteUrl,
    websiteLink,
    showWebsiteButton,
    ctaButtonText,
    socials,
    socialHandles,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width, height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  const endCardReveal = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const brandReveal = interpolate(frame, [40, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsReveal = interpolate(frame, [56, 74], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flicker = interpolate(frame % 8, [0, 4, 8], [1, 0.94, 1]);
  const titleTargetPx = titleFontSize ?? (p ? 153 : 158);
  // The brand name and CTA link are the description-scale copy on this end
  // card, so they follow descriptionFontSize instead of being fixed. The
  // fallbacks preserve the previous hardcoded sizes exactly, so an untouched
  // scene renders unchanged.
  // Fallbacks raised from 22/28 and 15/17: against a 115–158px "THE END" the
  // old sizes read as fine print rather than a credit line, and with no
  // `descriptionFontSize` default in meta.json they were what every untouched
  // end card actually used.
  const brandPx = descriptionFontSize ? Math.round(descriptionFontSize * 1.1) : (p ? 38 : 46);
  const linkPx = descriptionFontSize ? Math.round(descriptionFontSize * 0.75) : (p ? 26 : 30);

  // The end card runs very large (158px landscape), so a multi-word title is
  // the likeliest thing in this template to overrun its band. The card only
  // animates opacity + a scale transform (never layout), so the measured height
  // is constant across the scene.
  const cardRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  // The title is a centred, height-unconstrained flex child, so its own
  // clientHeight is just its content height and can never report overflow —
  // it needs an explicit budget. Reserve room for the rule, brand block and
  // socials that sit below it in the same column.
  const titleBudgetPx = useAvailableHeight(titleRef, cardRef, [title, p, aspectRatio]);
  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : p ? 52 : 70,
    [title, titleTargetPx, titleFontSizeIsUserSet, titleBudgetPx, p],
    // Measured leftover column height (reserving the rule, brand block and
    // socials below), with a frame fraction until the measurement lands.
    titleBudgetPx
      ? Math.round(titleBudgetPx * (p ? 0.46 : 0.52))
      : Math.round(frameHeight * (p ? 0.26 : 0.30)),
  );

  const link = websiteUrl || websiteLink;
  const ctaLabel = ctaButtonText || (link ? link.replace(/^https?:\/\//, "") : "");

  // Spotlight bloom behind the end card: swells in, then settles — like an iris
  // spotlight opening on the closing title card in the reference.
  const spotlightScale = interpolate(frame, [0, 30], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} sprockets>
      <ArchiveImageBackdrop
        imageUrl={imageUrl}
        videoUrl={videoUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
        videoMuted={videoMuted}
        videoVolume={videoVolume}
        videoDurationInFrames={videoDurationInFrames}
        videoStartInFrames={videoStartInFrames}
        dur={dur}
        dim={0.24}
      />
      {(imageUrl || videoUrl) ? (
        <div style={{ position: "absolute", inset: 0, background: hexToRgba(theme.bg, 0.6) }} />
      ) : null}
      {/* Spotlight vignette behind the end card, matching the reference's iris glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${p ? "70% 34%" : "42% 46%"} at 50% 42%, ${hexToRgba(theme.text, 0.16)}, transparent 70%)`,
          transform: `scale(${spotlightScale})`,
          opacity: endCardReveal,
          pointerEvents: "none",
        }}
      />

      {/* Projector take-up reel, corner-anchored, spinning throughout — matches
          the reference projector photograph. Never freezes. */}
      <div
        style={{
          position: "absolute",
          bottom: p ? 24 : 36,
          right: p ? 18 : 30,
          opacity: endCardReveal * 0.55,
          pointerEvents: "none",
        }}
      >
        <ProjectorReel size={p ? 90 : 130} opacity={0.8} beam={false} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "120px 40px" : "80px 160px",
          opacity: flicker,
        }}
        ref={cardRef}
      >
        {/* End card: large upright Oswald with a soft drop-shadow for depth —
            matches the two-font system used template-wide (display + mono),
            no italic/script styling. */}
        <div
          style={{
            opacity: endCardReveal,
            transform: `scale(${interpolate(endCardReveal, [0, 1], [0.88, 1])})`,
            textAlign: "center",
          }}
        >
          <div
            ref={titleRef}
            style={{
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 600,
              fontSize: titlePx,
              width: "100%",
              color: theme.accent,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              textShadow: `0 3px 0 ${hexToRgba(theme.bg, 0.9)}, 0 10px 26px ${hexToRgba(theme.bg, 0.85)}`,
            }}
          >
            {title || "The End"}
          </div>
          <div
            style={{
              marginTop: 18,
              width: p ? 220 : 320,
              height: 1,
              margin: "18px auto 0",
              background: hexToRgba(theme.accent, 0.4),
            }}
          />
        </div>

        {brandName ? (
          <div
            style={{
              marginTop: 34,
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 500,
              fontSize: brandPx,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: theme.text,
              opacity: brandReveal,
              transform: `translateY(${(1 - brandReveal) * 12}px)`,
            }}
          >
            {brandName}
          </div>
        ) : null}

        {link && (showWebsiteButton ?? true) ? (
          <div
            style={{
              marginTop: 16,
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: linkPx,
              letterSpacing: "0.08em",
              color: hexToRgba(theme.accent, 0.9),
              opacity: brandReveal,
              border: `1px solid ${theme.line}`,
              padding: "8px 18px",
            }}
          >
            {ctaLabel}
          </div>
        ) : null}

        {(socials || (socialHandles && socialHandles.length > 0)) ? (
          <div
            style={{
              marginTop: 30,
              opacity: socialsReveal,
              transform: `translateY(${(1 - socialsReveal) * 12}px)`,
            }}
          >
            <SocialIcons
              socials={socials}
              accentColor={theme.accent}
              textColor={theme.text}
              fontFamily={DOCREEL_MONO_FONT}
              aspectRatio={aspectRatio}
            />
          </div>
        ) : null}
      </div>
    </DocReelScene>
  );
};
