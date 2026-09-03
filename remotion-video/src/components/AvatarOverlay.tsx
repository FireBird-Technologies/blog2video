import React from "react";
import { OffthreadVideo, useVideoConfig } from "remotion";

export type AvatarShape = "circle" | "rounded" | "square";
export type AvatarPosition =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right";

export interface AvatarOverlayProps {
  /** Resolved video source (staticFile(scene.avatarVideoFile)). */
  src: string;
  aspectRatio?: string; // "landscape" | "portrait"
  /** circle | rounded | square. Drives both the corner radius and the box aspect. */
  shape?: AvatarShape;
  /** Box width as a fraction of composition width (0.10-0.32). */
  size?: number;
  position?: AvatarPosition;
  /**
   * What sits behind the presenter.
   *   undefined/null  the clip keeps its own baked photographic background
   *   "transparent"   matted clip composites straight onto the scene
   *   "#RRGGBB"       matted clip over this solid colour
   *
   * Only meaningful when `src` is a matted ProRes 4444 clip with an alpha channel — over a
   * plain mp4 the fill is simply hidden behind opaque pixels.
   */
  bg?: string | null;
  /** Overlay opacity 0.2-1.0. Applied to the CLIP, not the wrapper, so a solid
   *  background colour stays solid while the presenter fades. */
  opacity?: number;
  /**
   * Which region of the clip to show: a focal point in percent plus a zoom.
   *
   * The roster photos are framed inconsistently — two are shot so tight that no
   * source crop can add margin — so the user picks the region on the ACTUAL
   * rendered clip instead. Same model scene images use (imageFocusX/Y +
   * imageZoom). Defaults reproduce the previous hardcoded anchor, so an unset
   * scene renders exactly as before.
   */
  focusX?: number;
  focusY?: number;
  zoom?: number;
}

/** Defaults shared by both twins — keep in sync with the backend column defaults. */
export const AVATAR_DEFAULT_SHAPE: AvatarShape = "circle";
export const AVATAR_DEFAULT_POSITION: AvatarPosition = "bottom_left";
export const AVATAR_DEFAULT_SIZE_LANDSCAPE = 0.16;
export const AVATAR_DEFAULT_SIZE_PORTRAIT = 0.22;

/**
 * Persistent talking-head avatar clip, overlaid in a corner of a scene.
 *
 * The clip is a muxed h264+aac mp4 (LongCat), but its audio is MUTED here —
 * the scene's voiceover already plays via a separate <Audio>, so an un-muted
 * overlay would double the speech.
 *
 * The render service emits a clip in whatever aspect its SOURCE PORTRAIT had —
 * NOT always landscape. The 16:9 roster photos give ~720×400, but a 2:3 photo
 * (and any custom portrait a user uploads) gives ~400×720. object-fit: cover crops to the box
 * without distorting; objectPosition biases that crop toward the head so a
 * portrait clip does not lose its mouth. Assuming landscape here is what caused
 * portrait clips to render badly cropped.
 */
export const AvatarOverlay: React.FC<AvatarOverlayProps> = ({
  src,
  aspectRatio = "landscape",
  shape = AVATAR_DEFAULT_SHAPE,
  size,
  position = AVATAR_DEFAULT_POSITION,
  bg = null,
  opacity = 1,
  // 50/35 reproduces the previous hardcoded anchor, so an unset scene is unchanged.
  focusX = 50,
  focusY = 35,
  zoom = 1,
}) => {
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;

  const frac =
    size ??
    (isPortrait ? AVATAR_DEFAULT_SIZE_PORTRAIT : AVATAR_DEFAULT_SIZE_LANDSCAPE);
  const boxWidth = Math.round(width * frac);
  // Height follows the shape rather than a forced 9:16 slab: circle/square are
  // 1:1, rounded is a 4:5 head-and-shoulders card.
  const boxHeight = shape === "rounded" ? Math.round(boxWidth * 1.25) : boxWidth;

  const radius =
    shape === "circle"
      ? "50%"
      : shape === "square"
        ? 0
        : Math.round(boxWidth * 0.08);

  const margin = Math.round(width * (isPortrait ? 0.032 : 0.022));
  const [vert, horiz] = position.split("_");

  // "original" is an explicit request to show the clip AS FILMED, so it must
  // behave exactly like no background at all from here down. Collapsing it once
  // keeps the invariant the rest of this component relies on: `fill` is truthy
  // only when `src` really is the matted clip. Without this the sentinel would
  // reach CSS as `background-color: original` and, far worse, tell Remotion to
  // decode an alpha channel out of an opaque mp4.
  const fill = bg === "original" ? null : bg;

  // "transparent" means the presenter should look cut out and placed on the scene,
  // so the chrome that makes the overlay read as a *box* — the frame shadow and the
  // corner rounding — is dropped. Keeping them would draw exactly the outline the
  // user asked to remove.
  const isCutout = fill === "transparent";

  // Mirrors the preview twin's mask, which cannot rely on the wrapper's
  // overflow clip alone: a <video> on its own GPU compositor layer is masked
  // with an axis-aligned approximation on some drivers, turning a circle into
  // a rounded square. clip-path is a geometric clip and survives that path.
  // The headless renderer here never hits it, but the twins must agree on
  // shape or preview and export would disagree.
  const clipPath = isCutout
    ? undefined
    : shape === "circle"
      ? "circle(50% at 50% 50%)"
      : `inset(0 round ${typeof radius === "number" ? `${radius}px` : radius})`;

  const style: React.CSSProperties = {
    position: "absolute",
    zIndex: 90, // below logo (100) / captions, above scene content
    [vert === "top" ? "top" : "bottom"]: margin,
    [horiz === "right" ? "right" : "left"]: margin,
    width: boxWidth,
    height: boxHeight,
    overflow: "hidden",
    borderRadius: isCutout ? 0 : radius,
    clipPath,
    boxShadow: isCutout ? undefined : "0 4px 18px rgba(0,0,0,0.28)",
    backgroundColor: fill && !isCutout ? fill : undefined,
  };

  return (
    <div style={style}>
      <OffthreadVideo
        src={src}
        muted
        // `fill` is only ever set when `src` is the matted ProRes 4444 clip (see
        // the `bg` doc above) — an unmatted mp4 never reaches here with `fill`
        // truthy. Note this reads `fill`, not `bg`: "original" IS a set bg but
        // explicitly means the un-matted clip, so asking for alpha would be wrong.
        // `transparent` tells Remotion's compositor to actually decode/keep the
        // alpha channel instead of extracting opaque JPEG frames (the render-wide
        // default from remotion.config.ts). Without this prop, even a genuinely
        // alpha-bearing ProRes source composites as a solid opaque box — confirmed
        // by rendering the same clip with and without this prop.
        transparent={Boolean(fill)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // The clip's aspect follows its SOURCE PORTRAIT, not this box: a 16:9
          // photo gives 720x400, a 2:3 photo gives 400x720. Centre-cropping a
          // portrait clip into the square box keeps only the middle band and cuts
          // off the mouth, so the focal point defaults ABOVE centre (50/35) to keep
          // the whole face. The user can override it per scene via the frame picker.
          objectPosition: `${focusX}% ${focusY}%`,
          // Zoom pushes further into the frame than `cover` already does. The
          // transform-origin follows the focal point so zooming magnifies what the
          // user chose rather than drifting toward the middle.
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          transformOrigin: `${focusX}% ${focusY}%`,
          opacity,
          // Rounded in its own paint as well as by the wrapper — see clipPath.
          borderRadius: isCutout ? 0 : radius,
        }}
      />
    </div>
  );
};
