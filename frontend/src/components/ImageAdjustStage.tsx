import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrimmedClipVideo } from "../utils/trimmedClipPlayback";

const FILMSTRIP_FRAME_MIN = 8;
const FILMSTRIP_FRAME_MAX = 20;

/** One cell in the trim-bar filmstrip — seeks to `time` once metadata is ready. */
function FilmstripThumb({ src, time }: { src: string; time: number }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let cancelled = false;

    const seek = () => {
      if (cancelled) return;
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const clamped = Math.max(0, Math.min(time, dur - 0.04));
      if (Math.abs(video.currentTime - clamped) <= 0.03) return;
      video.currentTime = clamped;
    };

    const onMeta = () => seek();
    video.addEventListener("loadedmetadata", onMeta);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src, time]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      className="h-full flex-1 min-w-0 object-cover bg-gray-900 border-r border-black/20 last:border-r-0"
      draggable={false}
    />
  );
}

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
  clipDurationSeconds,
  sceneDurationSeconds,
  startSeconds,
  onStartChange,
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
  /** Trim bar (clip only). Total clip length; when longer than the scene, the
   *  user can pick which window plays. Omit (or for images) to hide the bar. */
  clipDurationSeconds?: number;
  /** How long the scene shows the clip — the width of the visible window. */
  sceneDurationSeconds?: number;
  /** Current start offset into the clip, in seconds. */
  startSeconds?: number;
  /** Called as the user drags the window; receives the new start in seconds. */
  onStartChange?: (start: number) => void;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const localWindowRef = useRef<HTMLDivElement | null>(null);
  const cropPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  const noteNaturalSize = (w: number, h: number) => {
    if (w > 0 && h > 0) setNatural({ w, h });
  };

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

  // ── Trim bar (clip only) ────────────────────────────────────────────────
  const trimBarRef = useRef<HTMLDivElement | null>(null);
  const [trimBarWidth, setTrimBarWidth] = useState(0);
  const clipDur = clipDurationSeconds ?? 0;
  const sceneDur = sceneDurationSeconds ?? 0;
  // Only worth showing when the clip is longer than the scene — otherwise the
  // whole clip is used and there is nothing to choose.
  const showTrim =
    isVideo && onStartChange != null && clipDur > 0 && sceneDur > 0 && clipDur > sceneDur + 0.05;
  const windowFrac = clipDur > 0 ? Math.min(1, sceneDur / clipDur) : 1;
  const start = Math.max(0, Math.min(startSeconds ?? 0, Math.max(0, clipDur - sceneDur)));
  const startFrac = clipDur > 0 ? start / clipDur : 0;
  const clipVideoProps = isVideo
    ? {
        clipDurationSeconds: clipDur > 0 ? clipDur : undefined,
        sceneDurationSeconds: sceneDur > 0 ? sceneDur : undefined,
        startSeconds: start,
      }
    : null;

  const filmstripFrameCount = Math.min(
    FILMSTRIP_FRAME_MAX,
    Math.max(FILMSTRIP_FRAME_MIN, Math.floor(trimBarWidth / 44) || FILMSTRIP_FRAME_MIN),
  );
  const filmstripTimes = useMemo(() => {
    if (!showTrim || clipDur <= 0) return [];
    const count = filmstripFrameCount;
    return Array.from({ length: count }, (_, i) =>
      count === 1 ? 0 : (i / (count - 1)) * clipDur,
    );
  }, [showTrim, clipDur, filmstripFrameCount]);

  const setTrimBarNode = useCallback((node: HTMLDivElement | null) => {
    trimBarRef.current = node;
    if (!node) return;
    const w = node.getBoundingClientRect().width;
    if (w > 0) setTrimBarWidth(w);
  }, []);

  useEffect(() => {
    if (!showTrim) {
      setTrimBarWidth(0);
      return;
    }
    const el = trimBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setTrimBarWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTrim, src]);

  const beginTrimDrag = (clientX: number) => {
    const el = trimBarRef.current;
    if (!el || !onStartChange) return;
    const move = (cx: number) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      // Center the window on the pointer, then clamp so it stays in the clip.
      const centerFrac = (cx - r.left) / r.width;
      let s = (centerFrac - windowFrac / 2) * clipDur;
      s = Math.max(0, Math.min(s, Math.max(0, clipDur - sceneDur)));
      onStartChange(Number(s.toFixed(2)));
    };
    move(clientX);
    const onMove = (e: MouseEvent) => move(e.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const beginTrimTouch = (clientX: number) => {
    const el = trimBarRef.current;
    if (!el || !onStartChange) return;
    const move = (cx: number) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const centerFrac = (cx - r.left) / r.width;
      let s = (centerFrac - windowFrac / 2) * clipDur;
      s = Math.max(0, Math.min(s, Math.max(0, clipDur - sceneDur)));
      onStartChange(Number(s.toFixed(2)));
    };
    move(clientX);
    const onMove = (e: TouchEvent) => {
      if (e.touches[0]) move(e.touches[0].clientX);
    };
    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  };

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
  const positioned = (opts?: { isPreview?: boolean; extraStyle?: React.CSSProperties }) => {
    const style: React.CSSProperties = {
      position: "absolute",
      left: offsetX,
      top: offsetY,
      width: mediaW,
      height: mediaH,
      maxWidth: "none",
      ...opts?.extraStyle,
    };
    return isVideo ? (
      <TrimmedClipVideo
        src={src}
        style={style}
        ref={opts?.isPreview ? cropPreviewVideoRef : undefined}
        autoPlay
        preload="auto"
        draggable={false}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) noteNaturalSize(v.videoWidth, v.videoHeight);
        }}
        {...(clipVideoProps ?? {})}
      />
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
      <TrimmedClipVideo
        src={src}
        className="absolute inset-0 w-full h-full"
        style={style}
        ref={cropPreviewVideoRef}
        autoPlay
        preload="auto"
        draggable={false}
        onLoadedMetadata={
          onMeasure
            ? (e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) noteNaturalSize(v.videoWidth, v.videoHeight);
              }
            : undefined
        }
        {...(clipVideoProps ?? {})}
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
    <>
    {/* Outer stage: holds the dimmed overflow around the crop window. The padding
        reserves the room the overflow is drawn into. */}
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
          {showOverflow ? positioned({ isPreview: true }) : objectFitMedia(true)}
        </div>
      </div>
    </div>

    {/* Trim bar: which part (in time) of a longer clip the scene shows. The whole
        clip is the track; the bright window is what plays and is dragged. */}
    {showTrim && (
      <div className="mx-auto mt-3" style={{ maxWidth: "min(100%, 44rem)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-black-400 uppercase tracking-wider mb-1 mt-2">
            Clip trim
          </span>
          <span className="text-[11px] text-gray-400 tabular-nums">
            {start.toFixed(1)}s – {Math.min(clipDur, start + sceneDur).toFixed(1)}s
            <span className="text-gray-300"> / {clipDur.toFixed(1)}s</span>
          </span>
        </div>
        <div
          ref={setTrimBarNode}
          onMouseDown={(e) => {
            e.preventDefault();
            beginTrimDrag(e.clientX);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) beginTrimTouch(e.touches[0].clientX);
          }}
          className="relative w-full h-10 rounded-lg bg-gray-800 overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
        >
          {/* Filmstrip — one <video> per sample point; avoids canvas/CORS issues. */}
          <div aria-hidden className="absolute inset-0 flex overflow-hidden pointer-events-none">
            {filmstripTimes.map((time, i) => (
              <FilmstripThumb key={`${src}-${i}-${time.toFixed(2)}`} src={src} time={time} />
            ))}
          </div>
          {/* Dim the parts of the clip outside the selected window. */}
          <div
            aria-hidden
            className="absolute top-0 bottom-0 left-0 bg-black/55 pointer-events-none"
            style={{ width: `${startFrac * 100}%` }}
          />
          <div
            aria-hidden
            className="absolute top-0 bottom-0 bg-black/55 pointer-events-none"
            style={{ left: `${(startFrac + windowFrac) * 100}%`, right: 0 }}
          />
          {/* The visible window. */}
          <div
            className="absolute top-0 bottom-0 rounded-md ring-2 ring-purple-400 pointer-events-none"
            style={{ left: `${startFrac * 100}%`, width: `${windowFrac * 100}%` }}
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-purple-400 rounded-l" />
            <div className="absolute inset-y-0 right-0 w-1 bg-purple-400 rounded-r" />
          </div>
        </div>
        <p className="mt-1 text-[10px] text-gray-400 leading-relaxed">
          Drag to choose which {sceneDur.toFixed(1)}s of the clip this scene shows.
        </p>
      </div>
    )}
    </>
  );
}
