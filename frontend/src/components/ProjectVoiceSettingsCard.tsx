import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CraftYourVoiceCard from "./CraftYourVoiceCard";
import VoiceItem, {
  formatVoiceSubtitle,
  getMyVoiceDisplayName,
  subtitleForSavedVoice,
} from "./VoiceItem";
import {
  getMyVoices,
  changeProjectVoice,
  deleteProjectVoiceover,
  BACKEND_URL,
  type SavedVoiceFromAPI,
} from "../api/client";
import AdvancedVoiceOptions from "./AdvancedVoiceOptions";
import { parseVoiceTuning, serializeVoiceTuning, type VoiceTuning } from "./voiceTuning";

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
  /** Current project voice tuning (the voice_emotion column value). */
  voiceEmotion: string | null;
  isPro: boolean;
  onError: (message: string) => void;
  /** Prompt the user to upgrade when they pick a gated voice */
  onUpgrade?: () => void;
  /**
   * Notify the parent that a background voiceover operation has started, so the
   * page-level progress modal can take over (it survives tab switches/refresh).
   */
  onOperationStarted: (op: { kind: "voice_change" | "delete"; total: number }) => void;
}

interface VoiceDisplay {
  name: string;
  subtitle: string;
  previewKey: string;
  previewUrl: string | null;
}

/**
 * Settings-tab card showing the project's current voice (preview only).
 *
 * - "Change voice" / "Add voiceover" opens a modal to pick a voice; confirming
 *   regenerates every scene's voiceover verbatim in that voice (counts as a new
 *   video — deducts one credit).
 * - "Delete voiceover" (only when a voiceover exists) makes the video mute and
 *   does NOT deduct a credit.
 *
 * Both kick off a background job; progress is shown by the page-level
 * VoiceOperationModal (via onOperationStarted), not here.
 */
export default function ProjectVoiceSettingsCard({
  projectId,
  voiceGender,
  voiceAccent,
  customVoiceId,
  voiceEmotion,
  isPro,
  onError,
  onUpgrade,
  onOperationStarted,
}: Props) {
  const [savedVoices, setSavedVoices] = useState<SavedVoiceFromAPI[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [showVoiceConfirm, setShowVoiceConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Tab switch inside the modal: Voice picker vs Advanced Options (matches step 3 of the URL form).
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Voice tuning state for the Advanced Options panel (Pro only).
  const [tuning, setTuning] = useState<VoiceTuning>(() => {
    const [stability, speed, emotion, style, enabled] = parseVoiceTuning(voiceEmotion);
    return { enabled, stability, speed, emotion, style };
  });

  // Whether the project currently has a voiceover. When false, the card offers
  // "Add voiceover" instead of "Change voice".
  const hasVoiceover = voiceGender !== "none";

  // Pending selection while the modal is open.
  const [selGender, setSelGender] = useState(voiceGender);
  const [selAccent, setSelAccent] = useState(voiceAccent);
  const [selCustomId, setSelCustomId] = useState((customVoiceId ?? "").trim());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

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

  const initialTuning = useMemo<VoiceTuning>(() => {
    const [stability, speed, emotion, style, enabled] = parseVoiceTuning(voiceEmotion);
    return { enabled, stability, speed, emotion, style };
  }, [voiceEmotion]);

  const hasChanges = useMemo(() => {
    const voiceChanged = selCustomId
      ? selCustomId !== currentCustom
      : currentCustom !== "" || selGender !== voiceGender || selAccent !== voiceAccent;
    const tuningChanged = isPro &&
      serializeVoiceTuning(tuning.stability, tuning.speed, tuning.emotion, tuning.style, tuning.enabled) !==
      serializeVoiceTuning(initialTuning.stability, initialTuning.speed, initialTuning.emotion, initialTuning.style, initialTuning.enabled);
    return voiceChanged || tuningChanged;
  }, [selCustomId, currentCustom, selGender, selAccent, voiceGender, voiceAccent, tuning, initialTuning, isPro]);

  const openModal = () => {
    // Reset the pending selection to the current voice each time we open.
    setSelGender(voiceGender);
    setSelAccent(voiceAccent);
    setSelCustomId(currentCustom);
    setTuning(initialTuning);
    setShowAdvanced(false);
    stopPreview();
    setModalOpen(true);
  };

  const closeModal = () => {
    stopPreview();
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!hasChanges || changing) return;
    setChanging(true);
    try {
      stopPreview();
      // gender/accent are display-only metadata; the voice_id drives generation.
      // Never send "none" (it would skip TTS) — fall back to the defaults.
      const { data } = await changeProjectVoice(projectId, {
        voice_gender: selGender && selGender !== "none" ? selGender : "female",
        voice_accent: selAccent && selAccent !== "none" ? selAccent : "american",
        custom_voice_id: selCustomId,
        voice_emotion: isPro
          ? serializeVoiceTuning(tuning.stability, tuning.speed, tuning.emotion, tuning.style, tuning.enabled)
          : undefined,
      });
      setModalOpen(false);
      onOperationStarted({ kind: "voice_change", total: data.total });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      onError(detail || "Failed to change the voice. Please try again.");
    } finally {
      setChanging(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      stopPreview();
      const { data } = await deleteProjectVoiceover(projectId);
      onOperationStarted({ kind: "delete", total: data.total });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      onError(detail || "Failed to delete the voiceover. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <ConfirmDeleteModal
        open={showVoiceConfirm}
        onClose={() => setShowVoiceConfirm(false)}
        title="Proceed with voice regeneration?"
        warningMessage="This will deduct 1 video count from your quota. Do you want to continue?"
        confirmLabel="Proceed"
        confirmLoadingLabel="Starting..."
        iconVariant="warning"
        onConfirm={async () => {
          setShowVoiceConfirm(false);
          await handleSave();
        }}
      />
      <ConfirmDeleteModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete voiceover?"
        warningMessage="This removes the narration from every scene and makes the video mute. This won't use a video credit."
        confirmLabel="Delete voiceover"
        confirmLoadingLabel="Deleting..."
        iconVariant="danger"
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await handleDelete();
        }}
      />
      <h2 className="text-base font-medium text-gray-900 mb-1">Voice</h2>
      <p
        className="text-xs text-gray-400 mb-3 truncate"
        title="The narration voice for this project. Changing it regenerates every scene's voiceover and counts as a new video."
      >
        The narration voice for this project…
      </p>
      <div className="glass-card p-4 flex flex-col gap-2">
        {/* Current voice — preview only (spinner while a custom voice resolves) */}
        {!hasVoiceover ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-gray-200/60 bg-white/60 p-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l4-4m0 4l-4-4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">No voiceover</p>
              <p className="text-[11px] text-gray-400">This video is muted. Add a voiceover to narrate it.</p>
            </div>
          </div>
        ) : loadingVoices && currentCustom ? (
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
            {hasVoiceover
              ? "Changing the voice uses one video credit."
              : "Adding a voiceover uses one video credit."}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {hasVoiceover && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl transition-colors text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/60 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Delete voiceover"
                )}
              </button>
            )}
            <button
              type="button"
              onClick={openModal}
              disabled={deleting}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {hasVoiceover ? "Change voice" : "Add voiceover"}
            </button>
          </div>
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
                {hasVoiceover ? "Change voice" : "Add voiceover"}
              </h3>
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
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-2">
              {/* Tab switch — Voice picker vs Advanced Options (matches step 3 of the URL form) */}
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  {showAdvanced && isPro ? "Advanced Options" : "Select and play to preview"}
                </label>
                <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      !(showAdvanced && isPro)
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPro) {
                        onUpgrade?.();
                        return;
                      }
                      setShowAdvanced(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      showAdvanced && isPro
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Advanced Options
                    <span className="inline-flex h-4 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[9px] font-semibold text-white">
                      Premium
                    </span>
                  </button>
                </div>
              </div>

              {!(showAdvanced && isPro) ? (
                <>
                  {/* Clone your voice — navigates to voiceover page */}
                  <CraftYourVoiceCard
                    isPro={isPro}
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("tab", "voices");
                      params.set("openCustomVoiceCreator", "1");
                      navigate(`/dashboard?${params.toString()}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const params = new URLSearchParams();
                        params.set("tab", "voices");
                        params.set("openCustomVoiceCreator", "1");
                        navigate(`/dashboard?${params.toString()}`);
                      }
                    }}
                  />

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
                </>
              ) : (
                <AdvancedVoiceOptions
                  value={tuning}
                  onChange={setTuning}
                  voiceGender={selGender}
                  voiceAccent={selAccent}
                  customVoiceId={selCustomId}
                />
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
                  onClick={() => setShowVoiceConfirm(true)}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {changing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </div>
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
