import { useEffect, useRef, useState } from "react";

/**
 * Framing stage for the "Adjust image/clip" modals.
 *
 * Rather than clipping the media to the crop box (which hides everything outside
 * it), the FULL media is drawn dimmed, and the part that will actually render is
 * re-drawn at full brightness inside a bright-bordered window. Users can see what
 * they are cropping away and drag it into place.
 *
 * ── Geometry ────────────────────────────────────────────────────────────────
 * The renderer uses `object-fit: cover` + `object-position: fx% fy%` + a scale.
 * `cover` scales the media by `max(boxW/natW, boxH/natH)`; `object-position: f%`
 * then offsets it by `(boxSize - mediaSize) * f/100`. Reproducing that here means
 * the preview matches the final frame exactly.
 *
 * When zoom < 1 the renderer switches to `contain` + center — the media is fully
 * inside the window, so nothing is cropped and there is nothing to dim. In that
 * case (and before the natural size is known) we fall back to the plain
 * object-fit rendering.
 */
export function ImageAdjustStage({
  src,
  isVideo,
  focusX,
  focusY,
  zoom,
  aspectRatio,
  circular,
  dragging,
  onMouseDown,
  onTouchStart,
  windowRef,
}: {
  src: string;
  isVideo: boolean;
  focusX: number;
  focusY: number;
  zoom: number;
  /** CSS aspect-ratio for the crop window, e.g. "16 / 9". */
  aspectRatio: string;
  circular?: boolean;
  dragging?: boolean;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  /** Ref to the crop window — existing pan math measures against this element. */
  windowRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const localWindowRef = useRef<HTMLDivElement | null>(null);

  // Reset the measured natural size when the source changes, so a previously
  // measured image never positions a different one.
  useEffect(() => setNatural(null), [src]);

  useEffect(() => {
    const el = localWindowRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspectRatio]);

  const zoomedOut = zoom < 1;
  const showOverflow = Boolean(natural && box && !zoomedOut);

  // Media size + offset inside the crop window, mirroring cover + object-position.
  let mediaW = 0;
  let mediaH = 0;
  let offsetX = 0;
  let offsetY = 0;
  if (natural && box) {
    const scale = Math.max(box.w / natural.w, box.h / natural.h) * zoom;
    mediaW = natural.w * scale;
    mediaH = natural.h * scale;
    offsetX = (box.w - mediaW) * (focusX / 100);
    offsetY = (box.h - mediaH) * (focusY / 100);
  }

  /** Absolutely-positioned copy of the media at the computed crop geometry. */
  const positioned = (extraStyle?: React.CSSProperties) => {
    const style: React.CSSProperties = {
      position: "absolute",
      left: offsetX,
      top: offsetY,
      width: mediaW,
      height: mediaH,
      maxWidth: "none",
      ...extraStyle,
    };
    return isVideo ? (
      <video src={src} muted loop autoPlay playsInline preload="auto" style={style} draggable={false} />
    ) : (
      <img src={src} alt="" style={style} draggable={false} />
    );
  };

  /** Fallback: plain object-fit rendering (zoomed out, or size not yet known). */
  const objectFitMedia = (onMeasure: boolean) => {
    const style: React.CSSProperties = {
      objectFit: zoomedOut ? "contain" : "cover",
      objectPosition: zoomedOut ? "center" : `${focusX}% ${focusY}%`,
      transform: `scale(${zoom})`,
      transformOrigin: zoomedOut ? "center center" : `${focusX}% ${focusY}%`,
    };
    return isVideo ? (
      <video
        src={src}
        muted
        loop
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full"
        style={style}
        draggable={false}
        onLoadedMetadata={
          onMeasure
            ? (e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) setNatural({ w: v.videoWidth, h: v.videoHeight });
              }
            : undefined
        }
      />
    ) : (
      <img
        src={src}
        alt="Adjust preview"
        className="absolute inset-0 w-full h-full"
        style={style}
        draggable={false}
        onLoad={
          onMeasure
            ? (e) => {
                const i = e.currentTarget;
                if (i.naturalWidth && i.naturalHeight)
                  setNatural({ w: i.naturalWidth, h: i.naturalHeight });
              }
            : undefined
        }
      />
    );
  };

  return (
    // Outer stage: holds the dimmed overflow around the crop window. The padding
    // reserves the room the overflow is drawn into.
    <div
      className="relative mx-auto overflow-hidden rounded-xl bg-black/90"
      style={{ maxWidth: "min(100%, 44rem)", padding: showOverflow ? "10%" : 0 }}
    >
      <div className="relative" style={{ aspectRatio, maxHeight: "56vh", margin: "0 auto" }}>
        {/* Dimmed full-media layer, drawn behind and around the crop window. */}
        {showOverflow && (
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ opacity: 0.35 }}>
            {positioned()}
          </div>
        )}

        {/* The crop window — exactly what the renderer will show. */}
        <div
          ref={(node) => {
            localWindowRef.current = node;
            if (windowRef) {
              (windowRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{ aspectRatio, ...(circular ? { borderRadius: "50%" } : {}) }}
          className={`absolute inset-0 w-full h-full overflow-hidden ${
            circular ? "" : "rounded-lg"
          } ring-2 ring-white/90 select-none touch-none ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {showOverflow ? positioned() : objectFitMedia(true)}
        </div>
      </div>
    </div>
  );
}
