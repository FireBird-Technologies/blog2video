import React, { createContext, useContext } from "react";
import { Video, useVideoConfig } from "remotion";

export type AvatarShape = "circle" | "rounded" | "square";
export type AvatarPosition =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right";

export interface AvatarOverlayProps {
  /** Resolved video URL (the AVATAR asset's R2/local url). */
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

export interface AvatarSettings {
  shape?: AvatarShape;
  size?: number;
  position?: AvatarPosition;
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

/**
 * Project-level avatar presentation, provided once by VideoPreview.
 *
 * Every template delegates to this component, so threading four more props
 * through ~24 adapter call sites would be pure churn — the overlay reads the
 * settings itself and explicit props still win when passed.
 */
export const AvatarSettingsContext = createContext<AvatarSettings>({});

/**
 * Player-side twin of remotion-video/src/components/AvatarOverlay.tsx. Same
 * corner talking-head overlay and identical sizing math, but this tree streams
 * a URL (uses <Video>, the interactive-playback element) rather than
 * staticFile(<OffthreadVideo>). Any change here must be mirrored there or the
 * preview and the final render will disagree.
 *
 * Muted: the scene's voiceover already plays via a separate <Audio>, so the
 * clip's own muxed audio must be suppressed or speech would double.
 */
export const AvatarOverlay: React.FC<AvatarOverlayProps> = ({
  src,
  aspectRatio = "landscape",
  shape: shapeProp,
  size: sizeProp,
  position: positionProp,
  bg: bgProp,
  opacity: opacityProp,
  focusX: focusXProp,
  focusY: focusYProp,
  zoom: zoomProp,
}) => {
  const ctx = useContext(AvatarSettingsContext);
  const shape = shapeProp ?? ctx.shape ?? AVATAR_DEFAULT_SHAPE;
  const size = sizeProp ?? ctx.size;
  const position = positionProp ?? ctx.position ?? AVATAR_DEFAULT_POSITION;
  const bg = bgProp ?? ctx.bg ?? null;
  // "original" explicitly means "show the clip as filmed", so from here down it
  // must behave exactly like no background — otherwise it reaches CSS as
  // `background-color: original`. Mirrors the same collapse in the render twin
  // (remotion-video/src/components/AvatarOverlay.tsx).
  const fill = bg === "original" ? null : bg;
  const opacity = opacityProp ?? ctx.opacity ?? 1;
  // 50/35 reproduces the previous hardcoded anchor, so an unset scene is unchanged.
  const focusX = focusXProp ?? ctx.focusX ?? 50;
  const focusY = focusYProp ?? ctx.focusY ?? 35;
  const zoom = zoomProp ?? ctx.zoom ?? 1;

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

  // "transparent" means the presenter should look cut out and placed on the scene,
  // so the chrome that makes the overlay read as a *box* — the frame shadow and the
  // corner rounding — is dropped. Keeping them would draw exactly the outline the
  // user asked to remove.
  const isCutout = fill === "transparent";

  const style: React.CSSProperties = {
    position: "absolute",
    zIndex: 90, // below logo (100) / captions, above scene content
    [vert === "top" ? "top" : "bottom"]: margin,
    [horiz === "right" ? "right" : "left"]: margin,
    width: boxWidth,
    height: boxHeight,
    overflow: "hidden",
    borderRadius: isCutout ? 0 : radius,
    boxShadow: isCutout ? undefined : "0 4px 18px rgba(0,0,0,0.28)",
    backgroundColor: fill && !isCutout ? fill : undefined,
  };

  return (
    <div style={style}>
      <Video
        src={src}
        muted
        // Hold the whole composition while this clip buffers rather than letting
        // it play silently-blank and drift out of sync with the voiceover it is
        // lip-synced to. VideoPreview also preloads avatarUrl up front, so this
        // should rarely trigger — it is the safety net for a cold cache.
        pauseWhenBuffering
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
        }}
      />
    </div>
  );
};
