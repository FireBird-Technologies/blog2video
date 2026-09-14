import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import { WhiteboardClip } from "../components/WhiteboardClip";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

/**
 * marker_story__v2 — "Framed Photo".
 *
 * Variant of `marker_story`. Same props, different composition: a wide,
 * rectangular photo sits in a hand-drawn frame across the TOP of the scene,
 * and the title + narration stack centred beneath it — the inverse of the
 * base's side-by-side split. With no image, the photo band collapses and the
 * copy simply centres in the full frame.
 *
 * The image slot is a wide rectangle here (the base is a tall 0.309 × 0.88
 * side panel), so it has its own entries in
 * `frontend/src/components/remotion/imageBoxConfig.ts` and
 * `backend/app/services/image_dimensions.py` — the `__vN` suffix is NOT
 * stripped when those are looked up.
 *
 * Filter IDs carry a `-msv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

/** Photo band, as a fraction of frame height/width. Same shape both orientations
 *  (a wide rectangle) — only the copy below it has to reflow for portrait. */
const PHOTO_TOP = 0.06;
const PHOTO_SIDE_MARGIN = 0.07;
const PHOTO_HEIGHT_LANDSCAPE = 0.46;
const PHOTO_HEIGHT_PORTRAIT = 0.32;

export const MarkerStoryV2: React.FC<WhiteboardLayoutProps> = ({
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
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const hasImage = !!(imageUrl || videoUrl);
  const { height } = useVideoConfig();

  const photoHeightFrac = p ? PHOTO_HEIGHT_PORTRAIT : PHOTO_HEIGHT_LANDSCAPE;
  // Where the copy block starts: right under the photo band (with a gap) when
  // there is one, or vertically centred in the whole frame when there isn't.
  const copyTop = hasImage ? PHOTO_TOP + photoHeightFrac + 0.06 : 0;

  // The photo drops in and settles, then the copy writes on after it lands.
  const photoDrop = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const copyStart = hasImage ? 20 : 0;
  const titleProgress = interpolate(frame, [copyStart, copyStart + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bodyProgress = interpolate(frame, [copyStart + 14, copyStart + 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const doodleProgress = interpolate(frame, [copyStart + 30, copyStart + 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Photo settles from a slightly higher, more scaled-down pose into rest.
  const photoY = interpolate(photoDrop, [0, 1], [-28, 0]);
  const photoScale = interpolate(photoDrop, [0, 1], [0.96, 1]);

  const titleClipRight = 100 - titleProgress * 100;
  const bodyClipRight = 100 - bodyProgress * 100;

  const doodleDash = 420;
  const doodleOff = doodleDash * (1 - doodleProgress);

  /* ── Auto-fit (title + body) ───────────────────────────────────────
     Both are rendered TWICE: an invisible (opacity:0) full-text copy that
     establishes layout size and is safe to measure, plus an absolutely
     positioned copy revealed via clip-path — the full text is in the DOM from
     frame 0. Same approach as the `marker_story` base. The copy's available
     height is whatever is left under the photo band (or the whole frame minus
     margins when there is no photo), so the fit budget is derived from that
     rather than a flat fraction of the frame. */
  const copyAvailFrac = hasImage ? 1 - copyTop - 0.06 : 0.7;
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitBodyRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 86 : 58);
  const fitBodyTarget = descriptionFontSize ?? (p ? 37 : 28);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, hasImage, height],
    Math.round(height * copyAvailFrac * 0.42),
  );
  const { px: fitBodyPx } = useFitText(
    fitBodyRef,
    fitBodyTarget,
    descriptionFontSizeIsUserSet ? fitBodyTarget : Math.round(fitBodyTarget * 0.5),
    [narration, fitBodyTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, hasImage, height],
    Math.round(height * copyAvailFrac * 0.5),
  );

  const visualStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
    objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
    transform: `scale(${imageZoom ?? 1})`,
    transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
  };

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="grain-msv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.05" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink-msv2" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="63" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkDoodle-msv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="27" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkFrame-msv2" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="44" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain-msv2)" fill="none" />
      </svg>

      {/* ── Framed photo band, across the TOP ─────────────────────────── */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            top: `${PHOTO_TOP * 100}%`,
            left: `${PHOTO_SIDE_MARGIN * 100}%`,
            right: `${PHOTO_SIDE_MARGIN * 100}%`,
            height: `${photoHeightFrac * 100}%`,
            opacity: photoDrop,
            transform: `translateY(${photoY}px) scale(${photoScale})`,
            zIndex: 6,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: 10,
              boxShadow: "0 16px 34px rgba(0,0,0,0.18)",
              background: "rgba(0,0,0,0.05)",
            }}
          >
            {videoUrl ? (
              <WhiteboardClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={visualStyle}
              />
            ) : (
              <Img src={imageUrl!} style={visualStyle} />
            )}
          </div>

          {/* Hand-drawn frame around the band, drawn OVER the photo edges so it
              reads as a sketched border rather than a CSS rectangle. */}
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
            viewBox="0 0 1000 460"
            preserveAspectRatio="none"
            aria-hidden
          >
            <rect
              x={5}
              y={5}
              width={990}
              height={450}
              rx={8}
              fill="none"
              stroke={textColor}
              strokeWidth={7}
              filter="url(#inkFrame-msv2)"
            />
          </svg>
        </div>
      )}

      {/* ── Copy block, centred BELOW the photo (or in the full frame with
          no photo) ───────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: `${copyTop * 100}%`,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          // Portrait's copy band (from copyTop to the bottom of the frame) is
          // much taller than landscape's — the frame itself is taller, and the
          // image band above takes a smaller share of it. Centring the copy in
          // that whole band, as landscape still does, left a large empty gap
          // between the image and the title. Anchoring to the top instead
          // (with a small pad so it doesn't touch the image) pulls the text up
          // right under the photo. Only when there IS an image: with no image
          // `copyTop` is 0 and the copy band is the whole frame, where centring
          // is still correct — flex-start there would pin the title to the
          // very top edge instead.
          justifyContent: p && hasImage ? "flex-start" : "center",
          // Side padding also sets how much safe margin the bottom-corner
          // doodle clusters get to sit in outside this column (see the note
          // on those clusters below) — 13% here isn't just for the text.
          // Side padding also sets how much safe margin the bottom-corner
          // doodle clusters get outside this column (see the note on those
          // clusters below). Landscape's clusters are now sized in real px to
          // match portrait's, so they need much less margin here than
          // portrait's still-large ones do.
          // Portrait-with-image adds a little top padding so the now
          // top-anchored copy doesn't sit flush against the `copyTop`
          // boundary — the same 6% breathing room `copyTop` already leaves
          // under the photo itself. The no-image case stays centred (see the
          // justifyContent note above), so it keeps a flat side-only padding.
          padding: p ? (hasImage ? "6% 19% 0" : "0 19%") : "0 12%",
          boxSizing: "border-box",
          zIndex: 10,
        }}
      >
        {/* Title with clip reveal */}
        <div style={{ position: "relative", width: "100%" }}>
          <div
            ref={fitTitleRef}
            style={{
              opacity: 0,
              fontSize: fitTitlePx,
              lineHeight: 1.06,
              fontWeight: 700,
              width: "100%",
            }}
          >
            {title}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(0 ${titleClipRight}% 0 0)`,
              color: textColor,
              fontSize: fitTitlePx,
              lineHeight: 1.06,
              fontWeight: 700,
              filter: "url(#ink-msv2)",
              width: "100%",
            }}
          >
            {title}
          </div>
        </div>

        {/* Short accent rule under the title, centred */}
        <svg
          style={{
            display: "block",
            width: p ? 200 : 260,
            height: 12,
            marginTop: 12,
            marginLeft: "auto",
            marginRight: "auto",
          }}
          viewBox="0 0 260 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,6 Q65,2 130,7 Q195,12 260,5"
            fill="none"
            stroke={accentColor}
            strokeWidth={5}
            strokeLinecap="round"
            filter="url(#inkDoodle-msv2)"
            strokeDasharray={300}
            strokeDashoffset={300 * (1 - titleProgress)}
          />
        </svg>

        {/* Body with clip reveal */}
        <div style={{ position: "relative", marginTop: p ? 18 : 20, width: "100%" }}>
          <div
            ref={fitBodyRef}
            style={{
              opacity: 0,
              fontSize: fitBodyPx,
              lineHeight: 1.34,
              width: "100%",
            }}
          >
            {narration}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(0 ${bodyClipRight}% 0 0)`,
              color: textColor,
              fontSize: fitBodyPx,
              lineHeight: 1.34,
              filter: "url(#ink-msv2)",
              width: "100%",
            }}
          >
            {narration}
          </div>
        </div>
      </div>

      {/* Marker doodle clusters anchored to the BOTTOM CORNERS — decoration,
          not competition for attention. Each corner gets a fuller mix: three
          hand-struck stars at varying size, two cross sparkles and a small
          hand-drawn loop, all sharing one dash-in.

          Width is given in PERCENT-OF-FRAME but chosen per orientation so the
          two actually render at the SAME real size: portrait (720px wide) and
          landscape (1280px wide) have very different pixel-per-percent ratios,
          so a shared percentage — as used through several earlier passes —
          made the landscape clusters visibly larger for the same width value.
          9% of 1280 ≈ 16% of 720 ≈ 115px, which is what both are pinned to.

          Either way, width is capped to stay OUTSIDE the copy's own side
          padding (19% portrait / 12% landscape — see the copy block above,
          sized to match each cluster's own footprint). Capping to the padding
          isn't just "keep it small": the copy's fit budget lets a long
          title/narration grow tall enough to reach past 95% of frame height
          (its font shrinks to fit width, not height), so no vertical position
          alone can guarantee clearance from it — only staying out of its
          horizontal column can. The viewBox is taller than wide (100x170) so
          the same six marks still read as a full cluster in that narrow
          footprint. */}
      <svg
        style={{
          position: "absolute",
          bottom: "4%",
          left: "2%",
          width: p ? "16%" : "9%",
          height: "auto",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 4,
        }}
        viewBox="0 0 100 170"
        fill="none"
        aria-hidden
      >
        <g filter="url(#inkDoodle-msv2)" strokeLinecap="round" strokeLinejoin="round">
          {/* Stars — small to large, stacked down the column rather than
              spread wide (the column itself is narrow: viewBox 100 units
              wide vs 170 tall). */}
          <path
            d="M18,140 L21,127 L32,137 L16,132 L36,129 Z"
            stroke={accentColor}
            strokeWidth={2.4}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M55,75 L58,63 L68,71 L53,67 L72,65 Z"
            stroke={textColor}
            strokeWidth={2}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M70,155 L72,146 L80,153 L68,149 L84,147 Z"
            stroke={accentColor}
            strokeWidth={1.8}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          {/* Cross sparkles */}
          <path
            d="M30,105 L30,117 M24,111 L36,111"
            stroke={accentColor}
            strokeWidth={2.2}
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M62,25 L62,35 M57,30 L67,30"
            stroke={textColor}
            strokeWidth={2}
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          {/* Small hand-drawn loop, tying the cluster together */}
          <path
            d="M22,60 C 28,46 44,44 48,57 C 51,68 38,75 29,68 C 22,63 32,54 41,57"
            stroke={textColor}
            strokeWidth={2.2}
            strokeOpacity={0.65}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
        </g>
      </svg>

      <svg
        style={{
          position: "absolute",
          bottom: "4%",
          right: "2%",
          width: p ? "16%" : "9%",
          height: "auto",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 4,
        }}
        viewBox="0 0 100 170"
        fill="none"
        aria-hidden
      >
        <g filter="url(#inkDoodle-msv2)" strokeLinecap="round" strokeLinejoin="round">
          {/* Stars — mirrored (x -> 100-x) placement from the left cluster */}
          <path
            d="M82,140 L79,127 L68,137 L84,132 L64,129 Z"
            stroke={accentColor}
            strokeWidth={2.4}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M45,75 L42,63 L32,71 L47,67 L28,65 Z"
            stroke={textColor}
            strokeWidth={2}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M30,155 L28,146 L20,153 L32,149 L16,147 Z"
            stroke={accentColor}
            strokeWidth={1.8}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          {/* Cross sparkles */}
          <path
            d="M70,105 L70,117 M64,111 L76,111"
            stroke={accentColor}
            strokeWidth={2.2}
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M38,25 L38,35 M33,30 L43,30"
            stroke={textColor}
            strokeWidth={2}
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          {/* Small hand-drawn loop */}
          <path
            d="M78,60 C 72,46 56,44 52,57 C 49,68 62,75 71,68 C 78,63 68,54 59,57"
            stroke={textColor}
            strokeWidth={2.2}
            strokeOpacity={0.65}
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
        </g>
      </svg>

      {/* Extra artwork for the NO-IMAGE case: with no photo band to anchor the
          top of the frame, the page would read as thin, so it gets its own
          drawn furniture — a light-bulb "idea" doodle and a thought cloud —
          placed in the upper corners, well clear of the centred copy. */}
      {!hasImage && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 4,
          }}
          viewBox={p ? "0 0 720 1280" : "0 0 1280 720"}
          fill="none"
          aria-hidden
        >
          <g
            filter="url(#inkDoodle-msv2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          >
            {/* Light bulb, upper right */}
            <path
              d={
                p
                  ? "M582,120 a34,34 0 1,1 40,0 c-8,7 -12,13 -13,22 l-14,0 c-1,-9 -5,-15 -13,-22 Z"
                  : "M1102,90 a34,34 0 1,1 40,0 c-8,7 -12,13 -13,22 l-14,0 c-1,-9 -5,-15 -13,-22 Z"
              }
              stroke={textColor}
              strokeWidth={3}
              fill="none"
            />
            <path
              d={p ? "M589,152 L615,152 M591,162 L613,162" : "M1109,122 L1135,122 M1111,132 L1133,132"}
              stroke={textColor}
              strokeWidth={3}
            />
            <path
              d={
                p
                  ? "M602,58 L602,42 M552,92 L537,84 M652,92 L667,84 M562,52 L552,40 M642,52 L652,40"
                  : "M1122,28 L1122,12 M1072,62 L1057,54 M1172,62 L1187,54 M1082,22 L1072,10 M1162,22 L1172,10"
              }
              stroke={accentColor}
              strokeWidth={3}
              strokeOpacity={0.75}
            />
            {/* Thought cloud, upper left */}
            <path
              d={
                p
                  ? "M100,120 q-30,0 -30,-26 q0,-24 26,-25 q4,-26 34,-26 q26,0 32,22 q28,2 28,26 q0,29 -32,29 Z"
                  : "M120,110 q-28,0 -28,-24 q0,-22 24,-23 q4,-24 32,-24 q24,0 30,20 q26,2 26,24 q0,27 -30,27 Z"
              }
              stroke={textColor}
              strokeWidth={3}
              strokeOpacity={0.55}
              fill="none"
            />
            <path
              d={
                p
                  ? "M90,140 a9,9 0 1,0 0.1,0 M75,158 a6,6 0 1,0 0.1,0"
                  : "M108,130 a8,8 0 1,0 0.1,0 M94,146 a5.5,5.5 0 1,0 0.1,0"
              }
              stroke={textColor}
              strokeWidth={2.5}
              strokeOpacity={0.55}
              fill="none"
            />
          </g>
        </svg>
      )}
    </AbsoluteFill>
  );
};
