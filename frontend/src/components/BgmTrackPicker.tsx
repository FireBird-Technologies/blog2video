import { useEffect, useMemo, useRef, useState } from "react";
import type { BgmTrack } from "../api/client";

type BgmTrackPickerProps = {
  tracks: BgmTrack[];
  value: string | null;
  onChange: (trackId: string | null) => void;
  /** Preview playback volume, 0–1. Mirrors the volume the video will use. */
  volume?: number;
  /** Tighter rows for the side-by-side settings card. */
  compact?: boolean;
  className?: string;
};

/** Seconds → "m:ss". */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** "Mood • 1:23 — description", skipping whatever the backend didn't send. */
function trackSubtitle(track: BgmTrack): string {
  const left = [track.mood, track.duration_seconds != null ? formatDuration(track.duration_seconds) : null]
    .filter(Boolean)
    .join(" • ");
  const desc = (track.description ?? "").trim();
  if (left && desc) return `${left} — ${desc}`;
  return desc || left;
}

const ALL_MOODS = "__all__";

/**
 * Browsing UI for the background-music catalog, shared by the create wizard and
 * the project Audio settings. Both surfaces previously rendered the same catalog
 * differently — the settings one through a dropdown with no preview at all, so a
 * track could only be auditioned by selecting it first.
 *
 * Preview playback follows the voice-picker pattern: one audio element at a time,
 * cleared on both `ended` and `error` (an unhandled error otherwise leaves the row
 * stuck showing "playing"), and stopped on unmount so audio never outlives the modal.
 */
export default function BgmTrackPicker({
  tracks,
  value,
  onChange,
  volume = 1,
  compact = false,
  className = "",
}: BgmTrackPickerProps) {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<string>(ALL_MOODS);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Facet values come from the data, like the template genre dropdown, so a new
  // mood in the catalog needs no frontend change.
  const moods = useMemo(
    () => Array.from(new Set(tracks.map((t) => t.mood).filter(Boolean))).sort(),
    [tracks],
  );

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (mood !== ALL_MOODS && t.mood !== mood) return false;
      if (!q) return true;
      return (
        t.display_name.toLowerCase().includes(q) ||
        (t.mood ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [tracks, query, mood]);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };

  // Keep a live preview at the volume the user is currently dialling in.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // Audio is not part of the React tree, so it survives unmount unless stopped.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const togglePreview = (track: BgmTrack) => {
    if (playingId === track.track_id) {
      stopPreview();
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.r2_url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(track.track_id);
  };

  const rowPad = compact ? "gap-2.5 p-2" : "gap-3 p-3";
  const playSize = compact ? "w-8 h-8" : "w-10 h-10";
  const nameSize = compact ? "text-xs" : "text-sm";
  const isFiltered = query.trim() !== "" || mood !== ALL_MOODS;

  return (
    <div className={className}>
      <div className="relative mb-2">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search music"
          aria-label="Search background music"
          className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300"
        />
      </div>

      {moods.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {/* Single-select: with ~12 moods across 14 tracks, combining them would
              mostly produce one-item lists. Search does the finer filtering. */}
          <button
            type="button"
            onClick={() => setMood(ALL_MOODS)}
            aria-pressed={mood === ALL_MOODS}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              mood === ALL_MOODS
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {moods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(mood === m ? ALL_MOODS : m)}
              aria-pressed={mood === m}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                mood === m
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className={`space-y-1.5 ${compact ? "max-h-[260px]" : "max-h-[320px]"} overflow-y-auto`}>
        {/* Pinned regardless of search — clearing music must never hide behind a query. */}
        <button
          type="button"
          onClick={() => {
            stopPreview();
            onChange(null);
          }}
          className={`w-full flex items-center ${rowPad} rounded-xl border-2 transition-all text-left ${
            !value
              ? "border-purple-500 bg-purple-50/60 shadow-[0_0_0_4px_rgba(124,58,237,0.08)]"
              : "border-gray-200/60 bg-white/60 hover:border-purple-300/60 hover:bg-purple-50/20"
          }`}
        >
          <div className={`${playSize} rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-400`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`${nameSize} font-semibold text-gray-800`}>None</div>
            <p className="text-[11px] text-gray-500 mt-0.5">No background music</p>
          </div>
          {!value && (
            <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>

        {visibleTracks.map((track) => {
          const isSelected = value === track.track_id;
          const isPlaying = playingId === track.track_id;
          const subtitle = trackSubtitle(track);
          return (
            <div
              key={track.track_id}
              role="button"
              onClick={() => onChange(isSelected ? null : track.track_id)}
              className={`flex items-center ${rowPad} rounded-xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? "border-purple-500 bg-purple-50/60 shadow-[0_0_0_4px_rgba(124,58,237,0.08)]"
                  : "border-gray-200/60 bg-white/60 hover:border-purple-300/60 hover:bg-purple-50/20"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePreview(track);
                }}
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? `Pause ${track.display_name}` : `Play ${track.display_name}`}
                className={`shrink-0 ${playSize} rounded-full flex items-center justify-center transition-all ${
                  isPlaying
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700"
                }`}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`${nameSize} font-semibold text-gray-800 truncate`}>{track.display_name}</div>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug truncate" title={subtitle}>
                  {subtitle}
                </p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0 ml-1">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {visibleTracks.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-xs text-gray-500">No tracks match your search.</p>
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setMood(ALL_MOODS);
                }}
                className="mt-2 text-[11px] font-medium text-purple-600 hover:text-purple-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
