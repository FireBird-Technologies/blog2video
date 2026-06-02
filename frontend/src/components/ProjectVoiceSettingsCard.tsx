import { useEffect, useMemo, useRef, useState } from "react";
import VoiceItem, {
  formatVoiceSubtitle,
  getMyVoiceDisplayName,
  subtitleForSavedVoice,
} from "./VoiceItem";
import {
  getMyVoices,
  changeProjectVoice,
  getVoiceChangeStatus,
  BACKEND_URL,
  type SavedVoiceFromAPI,
} from "../api/client";

const PREBUILT_VOICES = [
  { gender: "female", accent: "american", key: "female_american", name: "Rachel", desc: "Warm & confident, clear narration" },
  { gender: "female", accent: "british", key: "female_british", name: "Alice", desc: "Soft & polished, refined tone" },
  { gender: "male", accent: "american", key: "male_american", name: "Bill", desc: "Friendly & articulate, conversational" },
  { gender: "male", accent: "british", key: "male_british", name: "Daniel", desc: "Calm & authoritative, smooth delivery" },
] as const;

const prebuiltPreviewUrl = (key: string): string => {
  const base = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
  return `${base}/voices/preview-audio?key=${encodeURIComponent(key)}`;
};

interface Props {
  projectId: number;
  /** Current project voice settings */
  voiceGender: string;
  voiceAccent: string;
  customVoiceId: string | null | undefined;
  isPro: boolean;
  /** Reload the project after a successful voice change */
  onChanged: () => void | Promise<unknown>;
  onError: (message: string) => void;
  /** Prompt the user to upgrade when they pick a gated voice */
  onUpgrade?: () => void;
}

interface VoiceDisplay {
  name: string;
  subtitle: string;
  previewKey: string;
  previewUrl: string | null;
}

/**
 * Settings-tab card showing the project's current voice (preview only). The
 * "Change voice" button opens a modal to pick a new voice; saving regenerates
 * every scene's voiceover verbatim in that voice. It counts as a new video
 * (deducts one credit) and resets the project so it can be re-rendered.
 */
export default function ProjectVoiceSettingsCard({
  projectId,
  voiceGender,
  voiceAccent,
  customVoiceId,
  isPro,
  onChanged,
  onError,
  onUpgrade,
}: Props) {
  const [savedVoices, setSavedVoices] = useState<SavedVoiceFromAPI[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // Regeneration progress (scene-by-scene) while the new voiceover is generated.
  const [regenerating, setRegenerating] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);

  // Pending selection while the modal is open.
  const [selGender, setSelGender] = useState(voiceGender);
  const [selAccent, setSelAccent] = useState(voiceAccent);
  const [selCustomId, setSelCustomId] = useState((customVoiceId ?? "").trim());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    let active = true;
    setLoadingVoices(true);
    getMyVoices()
      .then((res) => {
        if (active) setSavedVoices(res.data);
      })
      .catch(() => {
        if (active) setSavedVoices([]);
      })
      .finally(() => {
        if (active) setLoadingVoices(false);
      });
    return () => {
      active = false;
      audioRef.current?.pause();
    };
  }, []);

  const stopPreview = () => {
    audioRef.current?.pause();
    setPlayingKey(null);
  };

  const playPreview = (key: string, url: string | null) => {
    if (!url) return;
    if (playingKey === key) {
      stopPreview();
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.pause();
    el.src = url;
    el.onended = () => setPlayingKey(null);
    el.play().then(() => setPlayingKey(key)).catch(() => setPlayingKey(null));
  };

  const currentCustom = (customVoiceId ?? "").trim();

  // Resolve the project's current voice into something displayable/playable.
  const currentVoice: VoiceDisplay = useMemo(() => {
    if (currentCustom) {
      const saved = savedVoices.find((v) => v.voice_id === currentCustom);
      if (saved) {
        return {
          name: getMyVoiceDisplayName(saved.name).displayName,
          subtitle: subtitleForSavedVoice(saved),
          previewKey: `current_${saved.voice_id}`,
          previewUrl: saved.preview_url ?? null,
        };
      }
      return {
        name: "Custom voice",
        subtitle: formatVoiceSubtitle(voiceGender, voiceAccent, "Your selected voice"),
        previewKey: `current_${currentCustom}`,
        previewUrl: null,
      };
    }
    const pre =
      PREBUILT_VOICES.find((v) => v.gender === voiceGender && v.accent === voiceAccent) ??
      PREBUILT_VOICES[0];
    return {
      name: pre.name,
      subtitle: formatVoiceSubtitle(pre.gender, pre.accent, pre.desc),
      previewKey: `current_${pre.key}`,
      previewUrl: prebuiltPreviewUrl(pre.key),
    };
  }, [currentCustom, savedVoices, voiceGender, voiceAccent]);

  const hasChanges = useMemo(() => {
    if (selCustomId) return selCustomId !== currentCustom;
    return currentCustom !== "" || selGender !== voiceGender || selAccent !== voiceAccent;
  }, [selCustomId, currentCustom, selGender, selAccent, voiceGender, voiceAccent]);

  const openModal = () => {
    // Reset the pending selection to the current voice each time we open.
    setSelGender(voiceGender);
    setSelAccent(voiceAccent);
    setSelCustomId(currentCustom);
    stopPreview();
    setModalOpen(true);
  };

  const closeModal = () => {
    if (regenerating) return; // don't allow closing mid-regeneration
    stopPreview();
    setModalOpen(false);
  };

  const finishRegen = async (error?: string | null) => {
    stopPolling();
    setRegenerating(false);
    setChanging(false);
    if (error) {
      onError(error);
      setModalOpen(false);
      return;
    }
    setModalOpen(false);
    await onChanged();
  };

  const pollStatus = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getVoiceChangeStatus(projectId);
        if (data.total > 0) setTotal(data.total);
        setCompleted(data.completed);
        setProgressPct(data.progress);
        if (data.done || !data.active) {
          await finishRegen(data.error);
        }
      } catch {
        // transient poll failure — keep trying until the next tick
      }
    }, 1200);
  };

  const handleSave = async () => {
    if (!hasChanges || changing || regenerating) return;
    setChanging(true);
    try {
      stopPreview();
      const { data } = await changeProjectVoice(projectId, {
        voice_gender: selGender,
        voice_accent: selAccent,
        custom_voice_id: selCustomId,
      });
      setTotal(data.total);
      setCompleted(0);
      setProgressPct(0);
      setRegenerating(true);
      pollStatus();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      onError(detail || "Failed to change the voice. Please try again.");
      setChanging(false);
    }
  };

  return (
    <div>
      <h2 className="text-base font-medium text-gray-900 mb-1">Voice</h2>
      <p className="text-xs text-gray-400 mb-5">
        The narration voice for this project. Changing it regenerates every scene's
        voiceover and counts as a new video.
      </p>
      <div className="glass-card p-6 flex flex-col gap-4">
        {/* Current voice — preview only (spinner while a custom voice resolves) */}
        {loadingVoices && currentCustom ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-gray-200/60 bg-white/60 p-3">
            <span className="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
            <p className="text-xs text-gray-500">Loading voice…</p>
          </div>
        ) : (
          <VoiceItem
            name={currentVoice.name}
            subtitle={currentVoice.subtitle}
            hasPreview={!!currentVoice.previewUrl}
            isPlaying={playingKey === currentVoice.previewKey}
            onPlay={() => playPreview(currentVoice.previewKey, currentVoice.previewUrl)}
            isSelected
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">
            Changing the voice uses one video credit.
          </p>
          <button
            type="button"
            onClick={openModal}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
          >
            Change voice
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {regenerating ? "Generating voiceover" : "Change voice"}
              </h3>
              {!regenerating && (
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {regenerating ? (
              <div className="px-6 py-8 flex flex-col items-center gap-4">
                <span className="w-9 h-9 border-[3px] border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-700">Generating new voiceover…</p>
                <div className="w-full">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500 text-center tabular-nums">
                    {total > 0 ? `${completed} of ${total} scenes • ${progressPct}%` : `${progressPct}%`}
                  </p>
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  This may take a moment. Please keep this open.
                </p>
              </div>
            ) : (
              <>
            <div className="px-6 py-4 overflow-y-auto space-y-2">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                Select and play to preview
              </p>

              {/* User's saved + custom voices */}
              {loadingVoices ? (
                <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50/60 border border-gray-200/60">
                  <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
                  <p className="text-[11px] text-gray-500">Loading your voices…</p>
                </div>
              ) : savedVoices.length === 0 ? (
                <p className="text-[11px] text-gray-500 py-3 px-3 rounded-xl bg-gray-50/60 border border-gray-200/60">
                  No saved voices. Add voices from the Voices page to use them here.
                </p>
              ) : (
                savedVoices.map((saved) => {
                  const selected = selCustomId === saved.voice_id;
                  const canSelect = isPro || (saved.plan !== "paid" && !saved.custom_voice_id);
                  const key = `pick_saved_${saved.voice_id}`;
                  const { displayName } = getMyVoiceDisplayName(saved.name);
                  const isCustom = !!saved.custom_voice_id;
                  return (
                    <VoiceItem
                      key={`pick_saved_${saved.id}`}
                      name={displayName}
                      subtitle={subtitleForSavedVoice(saved)}
                      hasPreview={!!saved.preview_url}
                      isPlaying={playingKey === key}
                      onPlay={() => playPreview(key, saved.preview_url ?? null)}
                      isSelected={selected}
                      onClick={() => {
                        if (!canSelect) {
                          onUpgrade?.();
                          return;
                        }
                        setSelCustomId(saved.voice_id);
                        if (saved.gender) setSelGender(saved.gender);
                        if (saved.accent) setSelAccent(saved.accent);
                      }}
                      badge={
                        isCustom ? (
                          <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Custom</span>
                        ) : saved.plan === "paid" ? (
                          <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Premium</span>
                        ) : null
                      }
                      actions={selected ? <Checkmark /> : null}
                    />
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">Uses one video credit.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={changing}
                  className="px-4 py-2.5 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!hasChanges || changing}
                  onClick={handleSave}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {changing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Regenerating…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Checkmark() {
  return (
    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}
