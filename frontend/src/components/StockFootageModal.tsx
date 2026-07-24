import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { searchStockFootage, type StockClip } from "../api/client";

/**
 * Stock-footage picker. Searches Pexels + Pixabay and returns one clip to the
 * caller, which stages it and commits on the scene modal's Save (matching how
 * "reuse an existing image" already behaves).
 *
 * Provider attribution is shown on every card and links back to the source
 * page — required by both providers' licences.
 */

/** AI-edit credits charged per clip added. Mirrors STOCK_FOOTAGE_CREDIT_COST on the backend. */
export const STOCK_FOOTAGE_CREDIT_COST = 3;

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

/** Plays the preview MP4 on hover; falls back to the still thumbnail otherwise. */
function ClipCard({
  clip,
  selected,
  onSelect,
}: {
  clip: StockClip;
  selected: boolean;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (hovered) {
      el.currentTime = 0;
      void el.play().catch(() => {
        /* autoplay refused — the thumbnail stays visible */
      });
    } else {
      el.pause();
    }
  }, [hovered]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
        selected ? "border-purple-500" : "border-gray-200 hover:border-purple-300"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative w-full h-28 bg-gray-100">
          {clip.thumbnail_url ? (
            <img
              src={clip.thumbnail_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
          {hovered && clip.preview_url ? (
            <video
              ref={videoRef}
              src={clip.preview_url}
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : null}
          {clip.duration ? (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
              {formatDuration(clip.duration)}
            </span>
          ) : null}
          {/* Videos already at the composition's 30 fps map 1:1 onto the
              timeline — no frames get duplicated when we normalise on ingest,
              so motion stays smoothest. These are also sorted to the front. */}
          {clip.fps != null && Math.abs(clip.fps - 30) < 0.01 && (
            <span
              className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-semibold tracking-wide"
              title="Native 30 fps — matches the video timeline exactly"
            >
              30 FPS
            </span>
          )}
          {selected && (
            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
      </button>
      <div className="px-2 py-1.5 bg-white flex items-center justify-between gap-2">
        <a
          href={clip.page_url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[10px] text-gray-500 hover:text-purple-600 truncate"
          title={`${clip.author} on ${clip.provider}`}
          onClick={(e) => e.stopPropagation()}
        >
          {clip.author}
        </a>
        <span className="text-[9px] uppercase tracking-wide text-gray-400 shrink-0">
          {clip.provider}
        </span>
      </div>
    </div>
  );
}

export function StockFootageModal({
  projectId,
  initialQuery,
  onClose,
  onSelect,
  boxAspect,
  zIndexClass = "z-[126]",
}: {
  projectId: number;
  /** Seeded from the scene's visual description so the first search is useful. */
  initialQuery?: string;
  onClose: () => void;
  /** Returns the chosen clip plus the audio preference set here in the picker. */
  onSelect: (clip: StockClip, audio: { muted: boolean; volume: number }) => void;
  /**
   * The target scene's image box as a CSS aspect string ("512 / 720"), from
   * getImageBoxAspectRatio(). Steers the orientation we ask Pexels for and which
   * rendition we download — a box that isn't full-bleed doesn't need 1080p.
   */
  boxAspect?: string;
  /**
   * Stacking layer. Defaults to the scene-editor context; a caller that is
   * itself a modal must pass a higher layer or this renders behind it.
   */
  zIndexClass?: string;
}) {
  const [query, setQuery] = useState(initialQuery?.slice(0, 80) ?? "");
  const [clips, setClips] = useState<StockClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StockClip | null>(null);
  const [searched, setSearched] = useState(false);
  // Audio preview of the SELECTED clip (uses the provider preview, which carries
  // the original audio). Defaults muted; the choice is passed back on confirm.
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewVolume, setPreviewVolume] = useState(0.35);
  const previewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, previewVolume));
  }, [previewVolume, selected]);

  // Guards against a slow earlier request overwriting a newer one's results.
  const requestSeq = useRef(0);

  /** Always queries every configured provider; results arrive interleaved. */
  const runSearch = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) return;
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      // "512 / 720" -> the box's size on the 1080p render canvas, scaled so the
      // limiting side matches the canvas (what the renderer effectively does).
      let boxDims: { w: number; h: number } | null = null;
      if (boxAspect) {
        const [wRaw, hRaw] = boxAspect.split("/").map((p) => Number(p.trim()));
        if (Number.isFinite(wRaw) && Number.isFinite(hRaw) && wRaw > 0 && hRaw > 0) {
          const scale = Math.min(1920 / wRaw, 1080 / hRaw);
          boxDims = { w: Math.round(wRaw * scale), h: Math.round(hRaw * scale) };
        }
      }
      try {
        const res = await searchStockFootage(projectId, {
          q: term,
          provider: "all",
          per_page: 24,
          ...(boxDims ? { box_w: boxDims.w, box_h: boxDims.h } : {}),
        });
        if (seq !== requestSeq.current) return;
        setClips(res.data.clips || []);
        setSearched(true);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || "Could not search stock footage. Please try again.");
        setClips([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [projectId, boxAspect],
  );

  // Seeded query runs once on open so the grid is not empty.
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      void runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portalled to <body>: when this picker is opened from inside another modal,
  // rendering in place would trap it in that modal's stacking context and no
  // z-index could bring it to the front.
  return ReactDOM.createPortal(
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">Add stock footage</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Clips are converted to 30&nbsp;fps so they stay in sync with your video.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <form
            className="flex-1 min-w-[220px] flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clips — e.g. city skyline, newsroom"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors disabled:opacity-60"
            >
              Search
            </button>
          </form>
        </div>

        <div className="p-5 bg-gray-50 overflow-auto flex-1 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : clips.length === 0 ? (
            <p className="text-sm text-gray-500">
              {searched ? "No clips matched that search." : "Search for a clip to get started."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {clips.map((clip) => (
                <ClipCard
                  key={`${clip.provider}-${clip.id}`}
                  clip={clip}
                  selected={selected?.id === clip.id && selected?.provider === clip.provider}
                  onSelect={() => setSelected(clip)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Selected-clip preview with audio controls. The provider preview
            carries the original audio, so the user can hear and set the level
            here before the clip is even processed. */}
        {selected && (
          <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center gap-4">
            <video
              ref={previewRef}
              src={selected.preview_url}
              poster={selected.thumbnail_url || undefined}
              muted={previewMuted}
              loop
              autoPlay
              playsInline
              className="w-28 h-16 object-cover rounded-lg bg-black flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPreviewMuted((m) => !m)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    previewMuted
                      ? "border-gray-300 text-gray-600 hover:border-purple-300"
                      : "border-purple-300 bg-purple-50 text-purple-700"
                  }`}
                >
                  {previewMuted ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l-4-4m0 4l4-4" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                  {previewMuted ? "Audio off" : "Audio on"}
                </button>
                {!previewMuted && (
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    Volume
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={previewVolume}
                      onChange={(e) => setPreviewVolume(Number(e.target.value))}
                      className="w-28 accent-purple-600"
                    />
                    <span className="tabular-nums w-8">{Math.round(previewVolume * 100)}%</span>
                  </label>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1 truncate">
                {selected.author} · {selected.provider}
                {previewMuted ? "" : " — audio will play under the voiceover"}
              </p>
            </div>
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">
              Costs {STOCK_FOOTAGE_CREDIT_COST} AI edits
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() =>
                selected && onSelect(selected, { muted: previewMuted, volume: previewVolume })
              }
              className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm disabled:opacity-60"
            >
              Use this clip
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
