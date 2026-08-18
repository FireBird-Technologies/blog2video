import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import {
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
  GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY,
} from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";

/**
 * EditorialBodyV2 — "Overlap"
 *
 * Variant of `editorial_body` (the live base is `Editorial.tsx`; the
 * `EditorialBody.tsx` file in the remotion-video tree is orphaned dead code — do
 * not model this on it).
 *
 * Every other gridcraft layout — the base included — is a centred glass card at
 * 90%×80% with its content laid out inside. That shared silhouette is exactly what
 * makes variants of them look alike, so this one BREAKS THE CARD:
 *
 *   • the image runs FULL-BLEED to the frame edges, as the ground rather than a
 *     cell — no other gridcraft layout does this;
 *   • the copy sits on a narrow glass panel that OVERLAPS the image, pushed off
 *     centre and hard against one edge, so the composition is asymmetric where the
 *     base is a symmetric 50/50 split;
 *   • a thick accent bar sits on the panel's leading edge as the only accent, per
 *     the template's one-hot-colour rule.
 *
 * With no image there is no ground to overlap, so it falls back to a large
 * off-centre type block on the page — still not the base's card.
 *
 * Motion is different in kind, not just timing: the base scales one card up
 * together; here the image pushes in from the edge (a slow parallax drift) while
 * the panel slides across it from the opposite side.
 *
 * NOTE the image slot is FULL-BLEED, so it declares its own imageBoxConfig +
 * LAYOUT_IMAGE_ASPECT entries rather than inheriting the base's half-card.
 *
 * `Blobs` is rendered once by the composition wrapper — do NOT re-render it here.
 */
export const EditorialBodyV2: React.FC<GridcraftLayoutProps> = ({
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
  textColor,
  titleFontSize,
  descriptionFontSize,
  aspectRatio,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const accent = accentColor || COLORS.ACCENT;
  const ink = textColor || COLORS.DARK;

  const sansFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const serifFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  // Template signature: serif in landscape, sans in portrait.
  const titleFontFamily = p ? sansFontFamily : serifFontFamily;

  const hasMedia = Boolean(imageUrl || videoUrl);

  const spr = (delay: number) =>
    spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 100 } });

  const mediaP = spr(0);
  const panelP = spr(10);
  const headP = spr(18);
  const bodyP = spr(24);

  /** Slow parallax on the full-bleed ground — it keeps drifting after it lands. */
  const drift = interpolate(frame, [0, 220], [0, p ? 26 : 34], {
    extrapolateRight: "clamp",
  });

  // Panel geometry. Landscape: a tall column hard against the left. Portrait: a
  // wide block sitting low, since a side column has no room to breathe.
  // With no image there is no ground to overlap and the narrow column would leave
  // most of the frame empty, so the panel opens out and the type scales up.
  const panelW = p ? "84%" : hasMedia ? "46%" : "72%";
  const headPx = titleFontSize ?? (p ? 65 : hasMedia ? 64 : 76);
  const bodyPx = descriptionFontSize ?? (p ? 37 : hasMedia ? 38 : 42);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sansFontFamily }}>
      {/* ── Full-bleed ground ── */}
      {hasMedia ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            opacity: interpolate(mediaP, [0, 1], [0, 1]),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: `-${p ? 30 : 40}px`,
              // Push-in + ongoing drift: the ground is never quite still.
              transform: `scale(${interpolate(mediaP, [0, 1], [1.12, 1.04])}) translateX(${
                p ? 0 : -drift
              }px) translateY(${p ? -drift : 0}px)`,
            }}
          >
            <ZoomCropImg
              src={imageUrl}
              videoUrl={videoUrl}
              videoMuted={videoMuted}
              videoVolume={videoVolume}
              videoDurationInFrames={videoDurationInFrames}
              videoStartInFrames={videoStartInFrames}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
            />
          </div>
          {/* Scrim under the panel side only, so the picture stays legible where it
              shows and the glass panel still has something to sit against. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              // Tuned by eye against a real photo: strong enough that the glass
              // panel has a quiet ground, but stopping short of washing its half of
              // the picture out to flat background colour.
              background: p
                ? `linear-gradient(0deg, ${COLORS.BG}E6 0%, ${COLORS.BG}99 34%, ${COLORS.BG}00 62%)`
                : `linear-gradient(90deg, ${COLORS.BG}D9 0%, ${COLORS.BG}80 40%, ${COLORS.BG}00 70%)`,
            }}
          />
        </div>
      ) : null}

      {/* ── Copy panel, overlapping the ground ── */}
      <div
        style={{
          position: "absolute",
          left: p ? "8%" : "7%",
          width: panelW,
          // Landscape: vertically centred column, sliding in from the left.
          // Portrait: sits low over the image, rising into place.
          // Centring uses translate(-50%) on the Y axis, so the animated offset is
          // composed as a SEPARATE translate — mixing the two in one function is
          // how the panel ends up half a frame off.
          ...(p ? { bottom: "9%" } : { top: "50%" }),
          transform: p
            ? `translateY(${interpolate(panelP, [0, 1], [40, 0])}px)`
            : `translateY(-50%) translateX(${interpolate(panelP, [0, 1], [-48, 0])}px)`,
          opacity: interpolate(panelP, [0, 1], [0, 1]),
          display: "flex",
        }}
      >
        {/* Accent bar on the panel's leading edge — the one hot element. */}
        <div
          style={{
            width: p ? 8 : 10,
            borderRadius: 999,
            backgroundColor: accent,
            flexShrink: 0,
            transform: `scaleY(${interpolate(panelP, [0, 1], [0, 1])})`,
            transformOrigin: "top center",
          }}
        />
        <div
          style={{
            ...glass(false),
            flex: 1,
            minWidth: 0,
            marginLeft: p ? 18 : 22,
            padding: p ? "34px 32px" : "44px 40px",
            // glass() is 0.65-alpha white, which is fine over the template's flat
            // page but not over a busy photograph — lift it so the body copy keeps
            // its contrast wherever the image happens to be dark.
            backgroundColor: "rgba(255,255,255,0.88)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.16)",
          }}
        >
          <div
            style={{
              fontSize: headPx,
              fontWeight: 700,
              lineHeight: 1.12,
              fontFamily: titleFontFamily,
              color: ink,
              wordBreak: "break-word",
              opacity: interpolate(headP, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(headP, [0, 1], [18, 0])}px)`,
            }}
          >
            {title}
          </div>

          {narration ? (
            <div
              style={{
                marginTop: p ? 18 : 22,
                fontSize: bodyPx,
                lineHeight: 1.55,
                color: ink,
                opacity: interpolate(bodyP, [0, 1], [0, 1]) * 0.86,
                wordBreak: "break-word",
                transform: `translateY(${interpolate(bodyP, [0, 1], [14, 0])}px)`,
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
