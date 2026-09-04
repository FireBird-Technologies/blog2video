import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

/**
 * Drag-to-pan, scroll/slider-to-zoom crop picker for a single locally-selected
 * image file. Adapted from SceneEditModal's "Adjust image framing" mechanics
 * (hand-rolled pointer listeners, no library), but self-contained and, unlike
 * that one, actually rasterizes the chosen region into a new image file via
 * canvas rather than just storing a CSS focal point — the output IS the
 * cropped photo, not a live framing applied on top of the original.
 *
 * `aspectRatio` should match the actual on-screen box the cropped photo ends
 * up in (e.g. "4 / 5" for the avatar overlay's "rounded" shape — see
 * AvatarOverlay's boxHeight math) so what the user frames here is exactly
 * what shows in the video.
 */
export default function ImageCropOverlay({
  file,
  aspectRatio = "4 / 5",
  onCancel,
  onCropped,
}: {
  file: File;
  aspectRatio?: string;
  onCancel: () => void;
  /** Called with the cropped image as a new File, same mime type as the source. */
  onCropped: (cropped: File) => void;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; startFx: number; startFy: number } | null>(null);
  const focusRef = useRef({ x: focusX, y: focusY });

  useEffect(() => {
    focusRef.current = { x: focusX, y: focusY };
  }, [focusX, focusY]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  useEffect(() => {
    if (!dragging) return;
    const applyPan = (clientX: number, clientY: number) => {
      const el = previewRef.current;
      const pan = panRef.current;
      if (!el || !pan) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dxPct = ((clientX - pan.startX) / rect.width) * 100;
      const dyPct = ((clientY - pan.startY) / rect.height) * 100;
      setFocusX(clamp(pan.startFx - dxPct));
      setFocusY(clamp(pan.startFy - dyPct));
    };
    const onMouseMove = (e: MouseEvent) => applyPan(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      applyPan(touch.clientX, touch.clientY);
    };
    const endPan = () => {
      setDragging(false);
      panRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", endPan);
    window.addEventListener("touchend", endPan);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("touchend", endPan);
    };
  }, [dragging]);

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      setZoom((z) => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)) * 100) / 100);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    panRef.current = { startX: e.clientX, startY: e.clientY, startFx: focusRef.current.x, startFy: focusRef.current.y };
    setDragging(true);
  };
  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    panRef.current = { startX: touch.clientX, startY: touch.clientY, startFx: focusRef.current.x, startFy: focusRef.current.y };
    setDragging(true);
  };

  /** Rasterize the current pan/zoom selection into a new File, matching the
   *  object-fit:cover math the CSS preview already uses so what's shown is
   *  exactly what gets cropped. */
  const handleConfirm = useCallback(async () => {
    if (!naturalSize) return;
    setProcessing(true);
    try {
      const [arW, arH] = aspectRatio.split("/").map((n) => parseFloat(n.trim()));
      const outW = 800;
      const outH = Math.round((outW * arH) / arW);

      const img = new Image();
      img.src = imgSrc as string;
      await new Promise((resolve, reject) => {
        if (img.complete) resolve(null);
        else {
          img.onload = () => resolve(null);
          img.onerror = reject;
        }
      });

      // Transcribe the preview's CSS exactly, in this order, or the output
      // won't be the region the user framed:
      //
      //   1. object-fit: cover      → scale to fill the box
      //   2. object-position: fx fy → distribute the OVERFLOW by percentage.
      //      This is not "centre the focal point": at fx=0 the image's left
      //      edge meets the box's left edge, at fx=100 the right edges meet.
      //   3. transform: scale(zoom) with transformOrigin: fx% fy% → note the
      //      origin resolves against the BOX, not the scaled image.
      //
      // No clamping: the CSS preview doesn't clamp either, so clamping here
      // would silently snap the export away from what was on screen.
      const coverScale = Math.max(outW / naturalSize.w, outH / naturalSize.h);
      const coverW = naturalSize.w * coverScale;
      const coverH = naturalSize.h * coverScale;

      // (2) object-position
      const posX = (outW - coverW) * (focusX / 100);
      const posY = (outH - coverH) * (focusY / 100);

      // (3) scale about the box-relative origin
      const originX = outW * (focusX / 100);
      const originY = outH * (focusY / 100);
      const destX = originX + (posX - originX) * zoom;
      const destY = originY + (posY - originY) * zoom;
      const scaledW = coverW * zoom;
      const scaledH = coverH * zoom;

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, destX, destY, scaledW, scaledH);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, 0.92),
      );
      if (!blob) throw new Error("Could not process image");

      const ext = mimeType === "image/png" ? "png" : "jpg";
      const cropped = new File([blob], `avatar-photo-cropped.${ext}`, { type: mimeType });
      onCropped(cropped);
    } finally {
      setProcessing(false);
    }
  }, [aspectRatio, file.type, focusX, focusY, imgSrc, naturalSize, onCropped, zoom]);

  if (!imgSrc) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Frame your photo</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Drag to reposition, scroll or use the slider to zoom. This exact
          framing is what gets used to generate your avatar.
        </p>
      </div>

      <div
        ref={previewRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ aspectRatio }}
        className={`relative mx-auto w-full max-w-[220px] rounded-xl overflow-hidden border-2 border-gray-200 select-none touch-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <img
          src={imgSrc}
          alt="Crop preview"
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: "cover",
            objectPosition: `${focusX}% ${focusY}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${focusX}% ${focusY}%`,
          }}
          draggable={false}
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-gray-700 max-w-[220px] mx-auto">
        <span className="shrink-0 text-xs text-gray-400">Zoom</span>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(e.target.value))))}
          className="flex-1 min-w-0 h-1 cursor-pointer accent-purple-600"
        />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-4 py-2.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={processing}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-all"
        >
          {processing ? "Processing…" : "Use this framing"}
        </button>
      </div>
    </div>
  );
}
