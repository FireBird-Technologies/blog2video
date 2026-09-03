import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import { DocReelClip } from "../components/DocReelClip";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ProjectorReel,
  ReelChangeCue,
  hexToRgba,
  docReelRand,
  useDocReelFrame,
  useTypewriterReveal,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/**
 * A curling length of filmstrip unspooling from the reel in a loose spiral —
 * the "tape rolled out" motion requested, paired with ProjectorReel so the
 * no-photo state isn't just a static watermark. Drawn as a wide ribbon that
 * winds outward with sprocket holes along both edges, fading as it uncoils.
 */
const UnspoolingFilmstrip: React.FC<{ size: number; opacity: number }> = ({ size, opacity }) => {
  const theme = useDocReelTheme();
  const frame = useDocReelFrame();
  const turns = 2.4;
  const points: string[] = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const angle = t * turns * Math.PI * 2 + frame * 0.01;
    const radius = size * 0.18 + t * size * 0.62;
    const x = size + radius * Math.cos(angle);
    const y = size + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return (
    <svg width={size * 2} height={size * 2} style={{ position: "absolute", overflow: "visible" }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={hexToRgba(theme.text, opacity)}
        strokeWidth={size * 0.05}
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Hand-drawn grease-pencil tick — a quick wobbly checkmark, like an archivist
 *  marking a print as pulled and reviewed. Bold enough to read clearly at
 *  the print's corner rather than getting lost against the photo. */
const GreasePencilTick: React.FC<{ seed: number }> = ({ seed }) => {
  const theme = useDocReelTheme();
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const w = (n: number) => (docReelRand(seed, n) - 0.5) * 5;
  const path = `M ${5 + w(1)} 15 L ${13 + w(2)} 24 L ${30 + w(3)} 3`;
  return (
    <svg width={36} height={30} viewBox="0 0 36 30" style={{ overflow: "visible" }}>
      <path
        d={path}
        fill="none"
        stroke={theme.mark}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
};

/**
 * A single archive photograph presented as a print pulled from its negative
 * sleeve, paired with a real archival-record text column — not a small
 * floating caption, but a full field-report-style block with a heading and a
 * multi-line description, so the layout can carry a real paragraph rather
 * than one or two short lines. When no photograph is supplied, the print
 * area itself becomes an aged "no photograph on file" artifact instead of a
 * flat empty box.
 */
export const DocreelPhotoPan: React.FC<SceneLayoutProps> = (props) => {
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
    caption,
    subCaption,
    photoPanLabel,
  } = props;

  // Layout-specific caption/subCaption win when set; otherwise fall back to the
  // universal title/narration so the panel never renders empty when a scene
  // was populated with only the generic fields. subCaption is the primary
  // body text here — it should carry a real multi-sentence description.
  const captionText = caption || title || "";
  const bodyText = subCaption || narration || "";

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width: frameWidth, height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 130;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Slow diagonal Ken Burns pan across the photo's own share of the frame.
  const panProgress = interpolate(frame, [0, dur], [0, 1]);
  const panX = interpolate(panProgress, [0, 1], [-2, 2]);
  const panY = interpolate(panProgress, [0, 1], [-1.5, 1.5]);
  const zoom = interpolate(panProgress, [0, 1], [1.06, 1.16]);

  const frameReveal = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The print slides into place — an archivist pulling it from the sleeve —
  // rather than the photo simply fading in.
  const slideOut = interpolate(frame, [4, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const panelReveal = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { visibleText: visibleBodyText, cursor: bodyCursor } = useTypewriterReveal(bodyText, 34, dur);
  const tickReveal = interpolate(frame, [46, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Same framing contract as ArchiveImageBackdrop/DocReelClip: a zoom below 1
  // means nothing is cropped, so the print is contained and centred and the
  // focus point is moot. Decided on the USER's zoom, not the Ken Burns product,
  // so the framing can't flip partway through the pan.
  const userZoom = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = userZoom < 1;
  const photoPos = imageObjectPosition ?? "50% 50%";

  const photoStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: isZoomedOut ? "contain" : "cover",
    objectPosition: isZoomedOut ? "center" : photoPos,
    transform: `scale(${userZoom * zoom}) translate(${panX}%, ${panY}%)`,
    transformOrigin: isZoomedOut ? "center center" : photoPos,
    filter: "grayscale(1) contrast(1.15) brightness(.82)",
  };

  const printSlide = interpolate(slideOut, [0, 1], [p ? -40 : -50, 0]);
  const titleTargetPx = titleFontSize ?? (p ? 47 : 45);
  const bodyTargetPx = descriptionFontSize ?? (p ? 40 : 34);

  // Caption is static (safe to measure directly); the body types out and needs
  // a hidden full-text mirror. Body is keyed on the fitted caption size so it
  // re-measures after the caption settles — one-directional, no give-back.
  // Frame-relative budgets (newspaper pattern), not font-size multiples.
  const captionBudgetPx = Math.round(frameHeight * (p ? 0.14 : 0.16));
  const bodyBudgetPx = Math.round(frameHeight * (p ? 0.26 : 0.30));
  const captionRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    captionRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : p ? 22 : 20,
    [captionText, titleTargetPx, titleFontSizeIsUserSet, captionBudgetPx, p, aspectRatio],
    captionBudgetPx,
  );
  const bodyMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: bodyPx } = useFitText(
    bodyMirrorRef,
    bodyTargetPx,
    descriptionFontSizeIsUserSet ? bodyTargetPx : p ? 18 : 16,
    [bodyText, bodyTargetPx, descriptionFontSizeIsUserSet, bodyBudgetPx, titlePx, p],
    bodyBudgetPx,
  );
  const hasVisual = Boolean(imageUrl || videoUrl);

  const reelSize = Math.min(frameWidth, frameHeight) * (p ? 0.42 : 0.3);

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["aged_paper", "dust_scratches"]} sprockets vignette>
      {/* No photo/video at all — a spinning reel with a length of filmstrip
          unspooling in a loose spiral sits behind the record panel, so the
          scene reads as "footage that hasn't survived" rather than an empty
          text box. */}
      {!hasVisual ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 0.16,
            pointerEvents: "none",
          }}
        >
          <UnspoolingFilmstrip size={reelSize} opacity={0.5} />
          <div style={{ position: "absolute", top: reelSize - reelSize * 0.18, left: reelSize - reelSize * 0.18 }}>
            <ProjectorReel size={reelSize * 0.36} opacity={0.7} beam={false} spinSpeed={0.4} />
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          padding: p ? "40px 32px" : "56px 64px",
          gap: hasVisual ? (p ? 24 : 40) : 0,
        }}
      >
        {/* The print, pulled from its sleeve — the sleeve's cut paper edge
            (a torn-triangle notch) shows behind the top-left corner. Only
            takes up frame space when a real photo/video exists — with no
            visual at all, this column collapses entirely and the record
            panel expands to fill the whole scene. */}
        {hasVisual ? (
        <div
          style={{
            position: "relative",
            flex: p ? "0 0 46%" : "1 1 52%",
            minHeight: 0,
          }}
        >
          {/* Sleeve edge peeking out behind the print's top-left corner —
              a visibly torn/ragged paper triangle, not a thin invisible line. */}
          <div
            style={{
              position: "absolute",
              top: -14,
              left: -14,
              width: "62%",
              height: "62%",
              background: `linear-gradient(135deg, ${hexToRgba(theme.text, 0.16)}, ${hexToRgba(theme.text, 0.04)})`,
              border: `1px solid ${hexToRgba(theme.text, 0.28)}`,
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
              opacity: frameReveal,
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: frameReveal,
              transform: `translateY(${printSlide}px)`,
              boxShadow: `0 20px 50px ${hexToRgba(theme.shadowBase, 0.55)}`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              {videoUrl ? (
                <DocReelClip
                  src={videoUrl}
                  imageObjectPosition={imageObjectPosition}
                  imageZoom={imageZoom}
                  zoomedOut={isZoomedOut}
                  muted={videoMuted ?? true}
                  volume={videoVolume ?? 0.35}
                  durationInFrames={videoDurationInFrames}
                  startInFrames={videoStartInFrames}
                  // photoStyle carries the Ken Burns pan/zoom transform and
                  // merges last, so it owns the framing for the clip too — the
                  // matching `zoomedOut` above keeps the two in agreement.
                  style={photoStyle}
                />
              ) : (
                <Img src={imageUrl!} style={photoStyle} />
              )}
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `2px solid ${hexToRgba(theme.accent, 0.3)}`,
                pointerEvents: "none",
              }}
            />
            {/* Grease-pencil "pulled for review" tick. */}
            <div style={{ position: "absolute", bottom: -10, right: -12, opacity: tickReveal }}>
              <GreasePencilTick seed={dur} />
            </div>
          </div>
        </div>
        ) : null}

        {/* Archival record panel — a real field-report-style block: heading,
            a full multi-line description, and a footer note. Sized to carry
            an actual paragraph rather than a one-line caption. */}
        <div
          style={{
            position: "relative",
            flex: p ? "1 1 auto" : "1 1 48%",
            minHeight: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              background: hexToRgba(theme.bg, 0.5),
              border: `1px solid ${theme.lineStrong}`,
              borderLeft: `4px solid ${theme.accent}`,
              padding: p ? "24px 26px" : "38px 42px",
              opacity: panelReveal,
              transform: `translateY(${(1 - panelReveal) * 14}px)`,
            }}
          >
            <div
              style={{
                fontFamily: DOCREEL_MONO_FONT,
                // Tracks the description size like the Dossier classification
                // badge. At 0.55x a slider move was barely perceptible on this
                // short kicker; 0.7x keeps it subordinate to the caption while
                // still responding legibly.
                fontSize: Math.round(bodyPx * 0.7),
                letterSpacing: "0.2em",
                color: hexToRgba(theme.text, 0.55),
                marginBottom: 16,
              }}
            >
              {photoPanLabel ?? "ARCHIVE PHOTOGRAPH"}
            </div>

            {captionText ? (
              <div
                ref={captionRef}
                style={{
                  fontFamily: DOCREEL_DISPLAY_FONT,
                  fontSize: titlePx,
                  width: "100%",
                  fontWeight: 500,
                  color: theme.accent,
                  lineHeight: 1.3,
                  marginBottom: bodyText ? 14 : 0,
                }}
              >
                {captionText}
              </div>
            ) : null}

            {bodyText ? (
              // `width:100%` is required, not decorative: the mirror below is
              // sized as a percentage of THIS box, and the visible copy is a
              // typewriter reveal. Left to shrink-wrap, this box tracks the
              // few characters typed so far, so the fitter measured the whole
              // body wrapped into a sliver of a column, read a huge height, and
              // shrank the text to its floor — the body rendered tiny whatever
              // size was configured. Same trap as DocreelTitleCard's narration.
              <div style={{ position: "relative", width: "100%" }}>
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
                    lineHeight: 1.6,
                  }}
                >
                  {bodyText}
                </div>
                <div
                  style={{
                    fontFamily: DOCREEL_MONO_FONT,
                    fontSize: bodyPx,
                    color: hexToRgba(theme.text, 0.9),
                    lineHeight: 1.6,
                  }}
                >
                  {visibleBodyText}
                  {bodyCursor}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Reel-Change Cue archive effect, timed near the scene's tail — the
          projectionist's changeover mark flashing as the reel runs out. */}
      <ReelChangeCue triggerFrame={Math.max(0, dur - 22)} />
    </DocReelScene>
  );
};
