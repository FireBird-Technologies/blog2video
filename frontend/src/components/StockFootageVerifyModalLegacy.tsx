import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  BACKEND_URL,
  approveStockFootage,
  getPendingStockFootage,
  linkStockFootage,
  uploadStockFootage,
  type PendingFootageScene,
  type StockClip,
} from "../api/client";
import { StockFootageModal } from "./StockFootageModal";
import { getSceneLayoutLabel } from "../utils/layoutLabels";

/**
 * DEPRECATED — frozen copy of the old mid-pipeline (pre-scene-gen) review
 * gate, kept only for any project still parked at the legacy
 * `awaiting_footage` status when the post-generation review gate shipped
 * (see StockFootageVerifyModal.tsx for the current flow). New projects never
 * enter this state. TODO(cleanup): delete this file once no rows remain at
 * `awaiting_footage`.
 *
 * Generation gate: the project is parked at `awaiting_footage` with one
 * auto-picked clip per image-capable scene. The user steps through the scenes,
 * swaps anything they dislike, and approves — which resumes the pipeline.
 *
 * Blocking by design: generation cannot continue until the user acts, and the
 * project stays parked indefinitely if they leave (resumable from the Dashboard).
 */
export function StockFootageVerifyModalLegacy({
  projectId,
  templateId,
  isPro = false,
  onApproved,
  onClose,
}: {
  projectId: number;
  templateId?: string | null;
  /** Paid owners swap clips for free; free owners spend AI edits — drives the
   *  cost notice shown next to the "Change clip" action. */
  isPro?: boolean;
  /** Called after the pipeline resumes, so the caller can go back to polling. */
  onApproved: () => void;
  /** Leave the gate without approving; the project stays paused. */
  onClose?: () => void;
}) {
  const [scenes, setScenes] = useState<PendingFootageScene[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

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

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approveStockFootage(projectId);
      onApproved();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLoadError(detail || "Could not resume generation.");
      setApproving(false);
    }
  };

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">Review stock footage</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                We picked a clip for each scene. Swap any you don't like, then continue —
                your video is built once you approve.
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={approving}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-50"
                title="Close (your project stays paused)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
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
                    <video
                      key={clipUrl}
                      src={clipUrl}
                      muted
                      loop
                      autoPlay
                      playsInline
                      preload="auto"
                      className="w-full h-full object-cover"
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
                        pick a clip with "Change clip".
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                      <span className="text-sm">No clip for this scene yet</span>
                      <span className="text-xs">Use "Change clip" to pick one</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={swapping}
                    className="absolute top-2 right-2 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 border border-white text-purple-700 text-xs font-medium shadow hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-60"
                    title="Change clip"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16.5 3.964a2.5 2.5 0 113.536 3.536L7 20.5H3v-4L16.5 3.964z" />
                    </svg>
                    Change clip
                  </button>
                </div>

                {current.clip?.author && (
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
                disabled={index === 0 || approving}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index >= total - 1 || approving}
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
                onClick={handleApprove}
                disabled={approving || swapping}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                {approving ? "Starting…" : "Approve & create video"}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </>,
    document.body,
  );
}
