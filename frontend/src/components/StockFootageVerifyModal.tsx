import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import ReactDOM from "react-dom";
import {
  BACKEND_URL,
  approveStockFootage,
  rejectStockFootage,
  getPendingStockFootage,
  linkStockFootage,
  updateSceneImageFocus,
  uploadStockFootage,
  type PendingFootageScene,
  type StockClip,
} from "../api/client";
import { StockFootageModal } from "./StockFootageModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { ImageAdjustStage } from "./ImageAdjustStage";
import {
  getImageBoxAspectRatio,
  isImageBoxCircular,
  normalizeLayoutId,
} from "./remotion/imageBoxConfig";
import { getTemplateConfig } from "./remotion/templateConfig";
import { getSceneLayoutLabel } from "../utils/layoutLabels";
import { TrimmedClipVideo } from "../utils/trimmedClipPlayback";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const clampFocus = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Post-generation review gate: the video is fully generated (scenes +
 * remotion data already written) and the project sits at
 * `awaiting_stock_footage_review` with one auto-picked clip per
 * image-capable scene. The user steps through the scenes, swaps anything
 * they dislike, then either approves (keep the auto-picked clips) or rejects
 * everything (fall back to images / hide).
 *
 * Always visible while the DB status says so — no local/session state drives
 * it, so it reappears on every reload for as long as the project is
 * unresolved (even reopening the project after a long time away). Not
 * dismissible except by resolving (approve or reject); there is no "leave it
 * parked" affordance since the video already exists underneath.
 */
export function StockFootageVerifyModal({
  projectId,
  templateId,
  projectAspectRatio,
  isPro = false,
  onResolved,
}: {
  projectId: number;
  templateId?: string | null;
  /** Drives the crop-window shape in the clip editor ("landscape" | "portrait"). */
  projectAspectRatio?: string | null;
  /** Paid owners swap clips for free; free owners spend AI edits — drives the
   *  cost notice shown next to the "Change clip" action. */
  isPro?: boolean;
  /** Called after approve OR reject finalizes the project (both land on
   *  GENERATED), so the caller can reload and hide the modal. */
  onResolved: () => void;
}) {
  const [scenes, setScenes] = useState<PendingFootageScene[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // ── Clip framing editor ────────────────────────────────────────────────────
  // Same affordances as the editor's "Adjust clip" modal (pan, zoom, trim), but
  // scoped to the scene under review and saved straight through the image-focus
  // endpoint — there is no staged Save in this gate.
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingFraming, setSavingFraming] = useState(false);
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [startSeconds, setStartSeconds] = useState(0);
  const [dragging, setDragging] = useState(false);
  const cropWindowRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef({ x: 50, y: 50 });
  const panRef = useRef<{
    startX: number;
    startY: number;
    startFx: number;
    startFy: number;
  } | null>(null);

  useEffect(() => {
    focusRef.current = { x: focusX, y: focusY };
  }, [focusX, focusY]);

  // Open the editor scrolled to the BOTTOM so the zoom slider and trim bar are
  // visible without hunting for them. Re-pins as the stage/filmstrip lay out
  // (the scroll port is `flex-1`, so only its CONTENT changes size), and stops
  // once the user scrolls away from the bottom themselves.
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!editorOpen) return;
    const el = editorScrollRef.current;
    if (!el) return;
    let pinned = true;
    const SCROLL_BOTTOM_SLOP = 4;
    const onScroll = () => {
      pinned = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_SLOP;
    };
    const pinToBottom = () => {
      if (pinned) el.scrollTop = el.scrollHeight;
    };
    pinToBottom();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(pinToBottom);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    const raf1 = requestAnimationFrame(pinToBottom);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(pinToBottom));
    const timer = window.setTimeout(pinToBottom, 250);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [editorOpen]);

  const load = useCallback(async () => {
    try {
      const res = await getPendingStockFootage(projectId);
      setScenes(res.data.scenes || []);
      setLoadError(null);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLoadError(detail || "Could not load the scenes to review.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = scenes?.[index] ?? null;
  const total = scenes?.length ?? 0;
  const sceneHasVisual = (s: PendingFootageScene) =>
    s.clip != null || s.fallback_image != null;
  const allHaveClips = useMemo(
    () => (scenes ?? []).every(sceneHasVisual),
    [scenes],
  );

  const mediaBase =
    (BACKEND_URL && BACKEND_URL.trim()) ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "");

  const clipUrl = current?.clip
    ? current.clip.url.startsWith("http")
      ? current.clip.url
      : `${mediaBase}${current.clip.url}`
    : null;

  const fallbackImageUrl = current?.fallback_image
    ? current.fallback_image.url.startsWith("http")
      ? current.fallback_image.url
      : `${mediaBase}${current.fallback_image.url}`
    : null;

  /** Replace this scene's clip with one chosen from the picker. */
  const handleSwap = async (clip: StockClip, audio: { muted: boolean; volume: number }) => {
    if (!current) return;
    setPickerOpen(false);
    setSwapping(true);
    try {
      // Upload creates the asset but deliberately does NOT touch the scene —
      // the editor stages that and commits on Save. There is no Save here, so
      // link it explicitly or the new clip is orphaned and the scene keeps the
      // old one (even across a refresh).
      const res = await uploadStockFootage(projectId, current.scene_id, clip);
      await linkStockFootage(projectId, current.scene_id, res.data.filename);
      void audio; // audio prefs are applied per-scene in the editor after generation
      await load();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLoadError(detail || "Could not replace that clip.");
    } finally {
      setSwapping(false);
    }
  };

  /** Saved framing for the scene under review, applied to the preview so it
   *  matches the render (and updates after an "Edit clip" save). Same math as
   *  the scene editor's thumbnail. */
  const previewFramingStyle = useMemo((): CSSProperties => {
    const fx = clampFocus(Number(current?.image_focus_x ?? 50));
    const fy = clampFocus(Number(current?.image_focus_y ?? 50));
    const z = Math.max(ZOOM_MIN, Number(current?.image_zoom) || 1);
    return {
      objectFit: z < 1 ? "contain" : "cover",
      objectPosition: z < 1 ? "center" : `${fx}% ${fy}%`,
      transform: `scale(${z})`,
      transformOrigin: z < 1 ? "center center" : `${fx}% ${fy}%`,
    };
  }, [current?.image_focus_x, current?.image_focus_y, current?.image_zoom]);

  /** Crop-window shape for the scene being reviewed, matching the editor.
   *  Custom templates carry their resolved ratio on the descriptor; everything
   *  else is derived from the layout id. */
  const cropAspectRatio = useMemo(() => {
    const fromDescriptor = current?.image_box_aspect_ratio?.trim();
    if (fromDescriptor) return fromDescriptor;
    const cfg = getTemplateConfig(templateId || "default");
    return getImageBoxAspectRatio(
      current?.layout ? normalizeLayoutId(current.layout) : null,
      projectAspectRatio || "landscape",
      cfg.baseWidth,
      cfg.baseHeight,
    );
  }, [
    current?.image_box_aspect_ratio,
    current?.layout,
    projectAspectRatio,
    templateId,
  ]);

  const cropCircular = useMemo(
    () => isImageBoxCircular(current?.layout ?? null),
    [current?.layout],
  );

  /** Seed the editor from whatever framing the scene already carries. */
  const openEditor = () => {
    if (!current) return;
    setFocusX(clampFocus(Number(current.image_focus_x ?? 50)));
    setFocusY(clampFocus(Number(current.image_focus_y ?? 50)));
    setZoom(
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(current.image_zoom) || 1)),
    );
    setStartSeconds(Math.max(0, Number(current.video_start_seconds) || 0));
    setDragging(false);
    panRef.current = null;
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (savingFraming) return;
    setEditorOpen(false);
    setDragging(false);
    panRef.current = null;
  };

  const handlePanMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFx: focusRef.current.x,
      startFy: focusRef.current.y,
    };
    setDragging(true);
  };

  const handlePanTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    panRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startFx: focusRef.current.x,
      startFy: focusRef.current.y,
    };
    setDragging(true);
  };

  // Drag-to-pan: focus moves opposite the cursor, as a percentage of the crop
  // window, so the grabbed point tracks the pointer.
  useEffect(() => {
    if (!dragging || !editorOpen) return;
    if (!panRef.current) return;

    const applyPan = (clientX: number, clientY: number) => {
      const el = cropWindowRef.current;
      if (!el || !panRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const { startX, startY, startFx, startFy } = panRef.current;
      const dxPct = ((clientX - startX) / rect.width) * 100;
      const dyPct = ((clientY - startY) / rect.height) * 100;
      setFocusX(clampFocus(startFx - dxPct));
      setFocusY(clampFocus(startFy - dyPct));
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
  }, [dragging, editorOpen]);

  /** Persist framing + trim immediately — this gate has no staged Save. */
  const handleSaveFraming = async () => {
    if (!current) return;
    setSavingFraming(true);
    try {
      await updateSceneImageFocus(
        projectId,
        current.scene_id,
        clampFocus(focusX),
        clampFocus(focusY),
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)),
        startSeconds,
      );
      await load();
      setEditorOpen(false);
      setDragging(false);
      panRef.current = null;
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLoadError(detail || "Could not save the clip framing.");
    } finally {
      setSavingFraming(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approveStockFootage(projectId);
      onResolved();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLoadError(detail || "Could not approve the clips.");
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setConfirmRejectOpen(false);
    setRejecting(true);
    try {
      await rejectStockFootage(projectId);
      onResolved();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLoadError(detail || "Could not finish rejecting the clips.");
      setRejecting(false);
    }
  };

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Review stock footage</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Your video is ready — review the auto-picked clips below, then approve,
              swap any you don't like, or reject them all to fall back to images.
            </p>
          </div>

          {!isPro && (
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800">
                Changing a clip costs <span className="font-semibold">3 AI edits</span>. Your
                auto-picked clip is free — upgrade to Pro or Standard to swap clips for free.
              </p>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-gray-50">
            {loadError && (
              <p className="mb-3 text-sm text-red-600">{loadError}</p>
            )}

            {scenes == null ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : total === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No scenes need footage. You can continue.
              </p>
            ) : current ? (
              <>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                      Scene {current.order}
                      {current.layout
                        ? ` · ${getSceneLayoutLabel(templateId, current.layout)}`
                        : ""}
                    </p>
                    <h4 className="text-base font-semibold text-gray-900 truncate">
                      {current.title}
                    </h4>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                    {index + 1} of {total}
                  </span>
                </div>

                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  {swapping ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 z-10">
                      <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                      <span className="text-xs text-white/80">Converting to 30&nbsp;fps…</span>
                    </div>
                  ) : null}
                  {clipUrl ? (
                    <TrimmedClipVideo
                      key={clipUrl}
                      src={clipUrl}
                      muted
                      autoPlay
                      playsInline
                      preload="auto"
                      className="w-full h-full"
                      // Mirror the saved framing + trim, so what's reviewed here
                      // matches what renders (and reflects an "Edit clip" save).
                      style={previewFramingStyle}
                      clipDurationSeconds={current.clip?.duration_seconds ?? undefined}
                      sceneDurationSeconds={Number(current.duration_seconds) || undefined}
                      startSeconds={Math.max(0, Number(current.video_start_seconds) || 0)}
                    />
                  ) : fallbackImageUrl ? (
                    <>
                      <img
                        src={fallbackImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 right-2 z-10 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] text-white/90">
                        No matching stock clip — using article image instead. You can
                        pick a clip with “Change clip”.
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                      <span className="text-sm">No clip for this scene yet</span>
                      <span className="text-xs">Use “Change clip” to pick one</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                    {clipUrl && (
                      <button
                        type="button"
                        onClick={openEditor}
                        disabled={swapping}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 border border-white text-purple-700 text-xs font-medium shadow hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-60"
                        title="Adjust framing and trim"
                      >
                        {/* Crop marks — matches the editor's adjust affordance. */}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" />
                        </svg>
                        Edit clip
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      disabled={swapping}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 border border-white text-purple-700 text-xs font-medium shadow hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-60"
                      title="Change clip"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16.5 3.964a2.5 2.5 0 113.536 3.536L7 20.5H3v-4L16.5 3.964z" />
                      </svg>
                      Change clip
                    </button>
                  </div>
                </div>

                {/* Framing readout — mirrors the adjust modal, so the saved
                    zoom/position/trim is visible without opening the editor. */}
                {clipUrl && (
                  <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-gray-400">
                      {current.clip?.author}
                      {current.clip?.provider ? ` · ${current.clip.provider}` : ""}
                    </p>
                    <p className="text-[11px] text-gray-500 tabular-nums">
                      Zoom {(Math.max(ZOOM_MIN, Number(current.image_zoom) || 1)).toFixed(2)}× · X{" "}
                      {Math.round(clampFocus(Number(current.image_focus_x ?? 50)))}% · Y{" "}
                      {Math.round(clampFocus(Number(current.image_focus_y ?? 50)))}%
                      {Number(current.video_start_seconds) > 0
                        ? ` · Starts at ${Number(current.video_start_seconds).toFixed(2)}s`
                        : ""}
                    </p>
                  </div>
                )}

                {!clipUrl && current.clip?.author && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    {current.clip.author}
                    {current.clip.provider ? ` · ${current.clip.provider}` : ""}
                  </p>
                )}

                {/* Scene strip — jump straight to any scene. */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {scenes.map((s, i) => (
                    <button
                      key={s.scene_id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`w-7 h-7 rounded-md text-[11px] font-medium border transition-colors ${
                        i === index
                          ? "bg-purple-600 text-white border-purple-600"
                          : s.clip || s.fallback_image
                            ? "bg-white text-gray-600 border-gray-300 hover:border-purple-300"
                            : "bg-amber-50 text-amber-700 border-amber-300"
                      }`}
                      title={
                        s.clip
                          ? s.title
                          : s.fallback_image
                            ? `${s.title} — using article image`
                            : `${s.title} — no clip yet`
                      }
                    >
                      {s.order}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-2 bg-white">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0 || approving || rejecting}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index >= total - 1 || approving || rejecting}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <div className="flex items-center gap-3">
              {!allHaveClips && total > 0 && (
                <span className="text-[11px] text-amber-600">
                  Some scenes have no clip or image
                </span>
              )}
              <button
                type="button"
                onClick={() => setConfirmRejectOpen(true)}
                disabled={approving || swapping || rejecting}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {rejecting ? "Reverting…" : "Reject all"}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || swapping || rejecting}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                {approving ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirmRejectOpen}
        onClose={() => setConfirmRejectOpen(false)}
        title="Reject all stock footage clips?"
        subtitle="Every auto-picked clip will be discarded"
        warningMessage="Scenes will fall back to an existing image where one is available; scenes with no image will simply hide the visual. This cannot be undone."
        confirmLabel="Yes, reject all"
        confirmLoadingLabel="Reverting…"
        onConfirm={handleReject}
        // Must sit above this modal's z-[140], or the confirm dialog opens behind it.
        zIndexClass="z-[150]"
      />

      {pickerOpen && current && (
        <StockFootageModal
          projectId={projectId}
          initialQuery={current.title}
          // Must sit above this modal's z-[140], or the picker opens behind it.
          zIndexClass="z-[150]"
          onClose={() => setPickerOpen(false)}
          onSelect={handleSwap}
        />
      )}

      {/* Clip framing + trim editor. Above z-[140] so it isn't hidden by the
          review modal underneath. */}
      {editorOpen && current && clipUrl && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeEditor}
          />
          <div className="relative w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden min-h-0">
            <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Edit clip
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  Drag to pan when zoomed in. Use the slider to zoom, and the bar
                  below to pick which part of the clip plays.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={savingFraming}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-50"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div ref={editorScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50">
              <div className="p-4 sm:p-5">
                <ImageAdjustStage
                  src={clipUrl}
                  isVideo
                  focusX={focusX}
                  focusY={focusY}
                  zoom={zoom}
                  aspectRatio={cropAspectRatio}
                  circular={cropCircular}
                  dragging={dragging}
                  onMouseDown={handlePanMouseDown}
                  onTouchStart={handlePanTouchStart}
                  windowRef={cropWindowRef}
                  clipDurationSeconds={current.clip?.duration_seconds ?? undefined}
                  sceneDurationSeconds={Number(current.duration_seconds) || undefined}
                  startSeconds={startSeconds}
                  onStartChange={setStartSeconds}
                />

                <div className="mt-4 flex flex-col gap-2 max-w-2xl mx-auto w-full">
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-14 shrink-0 tabular-nums">Zoom</span>
                    <input
                      type="range"
                      min={ZOOM_MIN}
                      max={ZOOM_MAX}
                      step={0.05}
                      value={zoom}
                      onChange={(e) =>
                        setZoom(
                          Math.min(
                            ZOOM_MAX,
                            Math.max(ZOOM_MIN, Number(e.target.value)),
                          ),
                        )
                      }
                      className="flex-1 min-w-0 h-1 w-full cursor-pointer appearance-none accent-purple-600 [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-gray-200 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-purple-600"
                    />
                    <span className="w-12 text-right text-xs text-gray-500 tabular-nums">
                      {zoom.toFixed(2)}×
                    </span>
                  </label>
                </div>

                <div className="mt-3 text-xs text-gray-500 text-center tabular-nums">
                  Position: X {Math.round(focusX)}% · Y {Math.round(focusY)}% · Zoom{" "}
                  {zoom.toFixed(2)}×
                  {startSeconds > 0 ? ` · Starts at ${startSeconds.toFixed(2)}s` : ""}
                </div>
              </div>
            </div>

            <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-white">
              <button
                type="button"
                onClick={() => {
                  setFocusX(50);
                  setFocusY(50);
                  setZoom(1);
                  setStartSeconds(0);
                }}
                disabled={savingFraming}
                className="mr-auto px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={closeEditor}
                disabled={savingFraming}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFraming}
                disabled={savingFraming}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                {savingFraming ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
