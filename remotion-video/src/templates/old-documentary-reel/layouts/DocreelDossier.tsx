import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ArchiveImageBackdrop,
  hexToRgba,
  useTypewriterReveal,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** A typewritten dossier/report insert, complete with a rubber-stamp classification mark. */
export const DocreelDossier: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    bgColor,
    accentColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    dossierHeading,
    dossierBody,
    dossierStamp,
    dossierClassification,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 110;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Fall back to the universal title/narration when the layout-specific fields
  // weren't populated, so the report card never renders as an empty box.
  const displayHeading = dossierHeading || title || "";
  const bodyText = dossierBody || narration || "";
  const { visibleText: visibleBody, cursor } = useTypewriterReveal(bodyText, 24, dur);

  // Small mono-font classification badge scales proportionally with
  // descriptionFontSize instead of a fixed pixel size.
  const baseDescriptionPx = descriptionFontSize ?? (p ? 49 : 27);

  // Heading fits first against its own band; the body then fits whatever is
  // left, keyed on headingPx so it re-measures after the heading settles. One
  // directional only — never feed the body's overflow back into the heading
  // (see the give-back warning in newspaper/layouts/NewsHeadline.tsx).
  const headingTargetPx = titleFontSize ?? (p ? 58 : 66);
  // Frame-relative budgets (newspaper pattern) — a font-size multiple is
  // circular and cannot detect overflow.
  const headingBudgetPx = Math.round(frameHeight * (p ? 0.14 : 0.18));
  const bodyBudgetPx = Math.round(frameHeight * (p ? 0.34 : 0.38));
  const headingRef = React.useRef<HTMLDivElement>(null);
  const { px: headingPx } = useFitText(
    headingRef,
    headingTargetPx,
    titleFontSizeIsUserSet ? headingTargetPx : p ? 26 : 30,
    [displayHeading, headingTargetPx, titleFontSizeIsUserSet, headingBudgetPx, p, aspectRatio],
    headingBudgetPx,
  );

  // The body TYPES OUT, so the visible copy grows frame by frame — measuring it
  // would resize the text mid-scene. A hidden mirror holding the FULL text at
  // the same width/typography carries the ref instead, so the size is settled
  // once against the final string and stays fixed.
  const bodyMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: bodyPx } = useFitText(
    bodyMirrorRef,
    baseDescriptionPx,
    descriptionFontSizeIsUserSet ? baseDescriptionPx : p ? 18 : 14,
    [bodyText, baseDescriptionPx, descriptionFontSizeIsUserSet, bodyBudgetPx, headingPx, p],
    bodyBudgetPx,
  );
  // The CLASSIFICATION badge and the rubber STAMP are both mono chrome that
  // sits alongside the body copy, so they track the description size rather
  // than being fixed. 0.5x rendered the badge so small that a slider move was
  // nearly invisible on it; 0.7x keeps it subordinate to the body while still
  // responding legibly. The stamp reads a touch larger again — it is the
  // loudest mark on the card.
  const metaPx = Math.round(bodyPx * 0.7);
  const stampPx = Math.round(bodyPx * 0.85);

  const headingReveal = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stampScale = interpolate(frame, [56, 66], [1.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const stampOpacity = interpolate(frame, [56, 64], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["aged_paper", "dust_scratches"]} sprockets={false} vignette>
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
        dim={0.22}
      />
      {(imageUrl || videoUrl) ? (
        <div style={{ position: "absolute", inset: 0, background: hexToRgba(theme.bg, 0.62) }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "90px 32px" : "70px 200px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: p ? 700 : 1120,
            border: `1px solid ${theme.lineStrong}`,
            padding: p ? "36px 28px" : "52px 64px",
            background: hexToRgba(theme.bg, 0.35),
          }}
        >
          {dossierClassification ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 20,
                opacity: headingReveal,
              }}
            >
              <span
                style={{
                  fontFamily: DOCREEL_MONO_FONT,
                  fontSize: metaPx,
                  letterSpacing: "0.14em",
                  color: theme.accent,
                  border: `1px solid ${hexToRgba(theme.accent, 0.5)}`,
                  padding: "3px 10px",
                }}
              >
                {dossierClassification.toUpperCase()}
              </span>
            </div>
          ) : null}

          {displayHeading ? (
            <div
              ref={headingRef}
              style={{
                fontFamily: DOCREEL_DISPLAY_FONT,
                fontWeight: 500,
                fontSize: headingPx,
                width: "100%",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                color: theme.accent,
                marginBottom: 18,
                opacity: headingReveal,
              }}
            >
              {displayHeading}
            </div>
          ) : null}

          <div style={{ position: "relative" }}>
            {/* Hidden measurement mirror: the FULL body at the same width and
                typography as the visible copy. visibility:hidden is set on the
                MEASURED element itself — useFitText reads el.style.visibility
                to decide whether to re-reveal, so hiding a parent wrapper
                instead would make it paint this mirror over the real copy as
                ghosted double-text. */}
            <div
              ref={bodyMirrorRef}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                visibility: "hidden",
                pointerEvents: "none",
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: bodyPx,
                lineHeight: 1.85,
                whiteSpace: "pre-wrap",
              }}
            >
              {bodyText}
            </div>
            <div
              style={{
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: bodyPx,
                lineHeight: 1.85,
                color: hexToRgba(theme.text, 0.92),
                whiteSpace: "pre-wrap",
                // Floor only — keeps a short note from collapsing the card. It
                // must not exceed the fitted copy's own height at large sizes,
                // so it scales down out of the way rather than fighting it.
                minHeight: Math.min(p ? 160 : 200, bodyPx * 6),
              }}
            >
              {visibleBody}
              {cursor}
            </div>
          </div>

          {dossierStamp ? (
            <div
              style={{
                position: "absolute",
                right: p ? 28 : 46,
                bottom: p ? 28 : 40,
                transform: `rotate(-9deg) scale(${stampScale})`,
                opacity: stampOpacity,
                border: `3px solid ${theme.accent}`,
                borderRadius: 6,
                padding: "8px 18px",
                fontFamily: DOCREEL_DISPLAY_FONT,
                fontWeight: 700,
                fontSize: stampPx,
                letterSpacing: "0.08em",
                color: theme.accent,
                textTransform: "uppercase",
              }}
            >
              {dossierStamp}
            </div>
          ) : null}
        </div>
      </div>
    </DocReelScene>
  );
};
