import { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  getVoices,
  getMyVoices,
  saveVoice,
  deleteSavedVoice,
  createCustomVoice,
  designVoiceFromPreset,
  designVoiceFromPrompt,
  type ElevenLabsVoice,
  type VoiceDesignPreview,
  type VoiceDesignResponse,
  type SavedVoiceFromAPI,
} from "../api/client";
import VoiceItem, { getMyVoiceDisplayName, subtitleForSavedVoice, subtitleFromElevenLabs } from "../components/VoiceItem";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import UpgradePlanModal from "../components/UpgradePlanModal";
import { useAuth } from "../hooks/useAuth";

const VOICE_GENDERS = ["female", "male", "neutral"];
const VOICE_AGE_RANGES = ["child", "teen", "young", "middle-aged", "elderly"];
const VOICE_PERSONAS = ["professional", "friendly", "calm", "warm", "confident", "energetic"];
const VOICE_SPEEDS = ["slow", "medium", "fast"];
const VOICE_ACCENTS = ["American", "British", "Australian", "Indian", "Irish", "Southern US", "neutral"];

/** All + 3 voice-type category tabs. Full voice list available to everyone; tabs just filter the view. */
const PREBUILT_TABS = ["All", "Professional", "Warm & calm", "Expressive"] as const;
type PrebuiltTabValue = (typeof PREBUILT_TABS)[number];

const VOICE_TYPE_KEYWORDS: Record<Exclude<PrebuiltTabValue, "All">, string[]> = {
  Professional: [
    "professional", "narrator", "documentary", "news", "serious", "authoritative",
    "articulate", "educated", "thoughtful", "corporate", "business", "formal",
  ],
  "Warm & calm": [
    "warm", "calm", "soothing", "relaxing", "peaceful", "gentle", "soft",
    "friendly", "conversational", "approachable", "casual", "welcoming", "natural",
  ],
  Expressive: [
    "playful", "energetic", "dramatic", "bold", "confident", "lively", "emotional",
    "expressive", "theatrical", "storytelling", "dynamic", "passionate", "charismatic",
  ],
};

function getVoiceType(voice: ElevenLabsVoice): Exclude<PrebuiltTabValue, "All"> {
  const text = [
    voice.name ?? "",
    voice.description ?? "",
    voice.category ?? "",
    ...Object.keys(voice.labels ?? {}),
    ...Object.values(voice.labels ?? {}),
  ]
    .join(" ")
    .toLowerCase();
  if (VOICE_TYPE_KEYWORDS.Professional.some((kw) => text.includes(kw))) return "Professional";
  if (VOICE_TYPE_KEYWORDS["Warm & calm"].some((kw) => text.includes(kw))) return "Warm & calm";
  if (VOICE_TYPE_KEYWORDS.Expressive.some((kw) => text.includes(kw))) return "Expressive";
  // When no keywords match, assign deterministically so each tab gets some voices
  const hash = (voice.voice_id ?? "").split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const tabs: Exclude<PrebuiltTabValue, "All">[] = ["Professional", "Warm & calm", "Expressive"];
  return tabs[Math.abs(hash) % tabs.length];
}

/** Local display type for a saved voice (id can be number from API). */
export type SavedVoice = SavedVoiceFromAPI;

export default function MyVoices() {
  const { user } = useAuth();
  const isPro = user?.plan === "pro" || user?.plan === "standard";
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myVoices, setMyVoices] = useState<SavedVoiceFromAPI[]>([]);
  const [myVoicesLoaded, setMyVoicesLoaded] = useState(false);
  const playingId = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Tracks which voice/preview is playing so we can show pause icon. */
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Voice attributes (design form) state
  const [presetGender, setPresetGender] = useState("");
  const [presetAge, setPresetAge] = useState("");
  const [presetPersona, setPresetPersona] = useState("");
  const [presetSpeed, setPresetSpeed] = useState("");
  const [presetAccent, setPresetAccent] = useState("");
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetPreviews, setPresetPreviews] = useState<VoiceDesignPreview[]>([]);
  const [presetError, setPresetError] = useState<string | null>(null);

  // Custom prompt design state
  const [customPrompt, setCustomPrompt] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customPreviews, setCustomPreviews] = useState<VoiceDesignPreview[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  /** Last design API response for saving to custom_voices (prompt + response / form + response). */
  const [lastPresetDesignResponse, setLastPresetDesignResponse] = useState<VoiceDesignResponse | null>(null);
  const [lastCustomDesignResponse, setLastCustomDesignResponse] = useState<VoiceDesignResponse | null>(null);

  const [showDesignModal, setShowDesignModal] = useState(false);
  const [hasAddedVoiceThisSession, setHasAddedVoiceThisSession] = useState(false);
  const [prebuiltTab, setPrebuiltTab] = useState<PrebuiltTabValue>("All");
  /** Create custom voice: exactly one method at a time — form or type. */
  const [createVoiceMode, setCreateVoiceMode] = useState<"form" | "prompt">("form");
  const [deleteVoiceTarget, setDeleteVoiceTarget] = useState<SavedVoiceFromAPI | null>(null);
  /** voice_id of the generated voice currently being saved (show loader on Save button). */
  const [savingVoiceId, setSavingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  useEffect(() => {
    const load = async () => {
      setMyVoicesLoaded(false);
      try {
        const res = await getMyVoices();
        setMyVoices(res.data ?? []);
      } catch {
        setMyVoices([]);
      } finally {
        setMyVoicesLoaded(true);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (showDesignModal) {
      setHasAddedVoiceThisSession(false);
    } else {
      setPresetGender("");
      setPresetAge("");
      setPresetPersona("");
      setPresetSpeed("");
      setPresetAccent("");
      setPresetPreviews([]);
      setPresetError(null);
      setLastPresetDesignResponse(null);
      setCustomPrompt("");
      setCustomPreviews([]);
      setCustomError(null);
      setLastCustomDesignResponse(null);
      setSavingVoiceId(null);
      setPlayingVoiceId(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      playingId.current = null;
    }
  }, [showDesignModal]);

  const loadVoices = async () => {
    setError(null);
    try {
      const res = await getVoices();
      setVoices(res.data.voices ?? []);
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string }; status?: number } }).response?.data?.detail as string | undefined
        : "Failed to load voices";
      setError(message || "Failed to load voices. Make sure ElevenLabs API key is configured.");
      setVoices([]);
    } finally {
      setLoaded(true);
    }
  };

  const playPreview = (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) return;
    const id = voice.voice_id;
    if (playingId.current === id && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      playingId.current = null;
      setPlayingVoiceId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    playingId.current = id;
    setPlayingVoiceId(id);
    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    audio.play().catch(() => {
      playingId.current = null;
      setPlayingVoiceId(null);
    });
    audio.onended = () => {
      playingId.current = null;
      setPlayingVoiceId(null);
    };
  };

  const prebuiltVoicesByTab = useMemo(() => {
    if (prebuiltTab === "All") return voices;
    return voices.filter((v) => getVoiceType(v) === prebuiltTab);
  }, [voices, prebuiltTab]);

  const playDesignPreview = (preview: VoiceDesignPreview) => {
    if (!preview.audio_base_64) return;
    const id = preview.generated_voice_id;
    const mime = preview.media_type || "audio/mpeg";
    const dataUrl = `data:${mime};base64,${preview.audio_base_64}`;
    if (playingId.current === id && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      playingId.current = null;
      setPlayingVoiceId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(dataUrl);
    audioRef.current = audio;
    playingId.current = id;
    setPlayingVoiceId(id);
    audio.play().catch(() => {
      playingId.current = null;
      setPlayingVoiceId(null);
    });
    audio.onended = () => {
      playingId.current = null;
      setPlayingVoiceId(null);
    };
  };

  const addExistingToMyVoices = async (voice: ElevenLabsVoice) => {
    if (hasAddedVoiceThisSession || myVoices.some((v) => v.voice_id === voice.voice_id)) return;
    const labels = voice.labels ?? {};
    try {
      const res = await saveVoice({
        voice_id: voice.voice_id,
        name: voice.name,
        preview_url: voice.preview_url ?? undefined,
        source: "prebuilt",
        gender: labels.gender ? labels.gender.charAt(0).toUpperCase() + labels.gender.slice(1).toLowerCase() : undefined,
        accent: labels.accent ? labels.accent.charAt(0).toUpperCase() + labels.accent.slice(1).toLowerCase() : undefined,
        description: voice.description?.trim() || undefined,
      });
      setMyVoices((prev) => [...prev, res.data]);
      setHasAddedVoiceThisSession(true);
      setShowDesignModal(false);
    } catch (err) {
      console.error("Failed to save voice:", err);
    }
  };

  /** Save a generated (custom) voice: create custom_voice record (prompt/response or form), then add to saved_voices. */
  const addGeneratedToMyVoices = async (
    source: "form" | "prompt",
    preview: VoiceDesignPreview,
    formFields: { gender?: string; age?: string; persona?: string; speed?: string; accent?: string } | null,
    promptText: string | null,
    designResponse: VoiceDesignResponse | null
  ) => {
    if (hasAddedVoiceThisSession || myVoices.some((v) => v.voice_id === preview.generated_voice_id)) return;
    setSavingVoiceId(preview.generated_voice_id);
    try {
      const customRes = await createCustomVoice({
        voice_id: preview.generated_voice_id,
        source,
        prompt_text: promptText ?? undefined,
        response: designResponse ? (designResponse as unknown as Record<string, unknown>) : undefined,
        form_gender: formFields?.gender,
        form_age: formFields?.age,
        form_persona: formFields?.persona,
        form_speed: formFields?.speed,
        form_accent: formFields?.accent,
        audio_base64: preview.audio_base_64 ?? undefined,
      });
      const savedRes = await saveVoice({
        voice_id: preview.generated_voice_id,
        name: customRes.data.name,
        audio_base64: preview.audio_base_64 ?? undefined,
        source: "custom",
        custom_voice_id: customRes.data.id,
      });
      setMyVoices((prev) => [...prev, savedRes.data]);
      setHasAddedVoiceThisSession(true);
      setShowDesignModal(false);
    } catch (err) {
      console.error("Failed to save voice:", err);
    } finally {
      setSavingVoiceId(null);
    }
  };

  const removeFromMyVoices = async (id: number) => {
    try {
      await deleteSavedVoice(id);
      setMyVoices((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error("Failed to delete voice:", err);
    }
  };

  const customVoices = myVoices.filter((v) => v.source === "custom" || !!v.audio_base64);

  const playSavedPreview = (saved: SavedVoiceFromAPI) => {
    const id = saved.voice_id;
    if (playingId.current === id && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      playingId.current = null;
      setPlayingVoiceId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    playingId.current = id;
    setPlayingVoiceId(id);
    const src = saved.audio_base64
      ? `data:audio/mpeg;base64,${saved.audio_base64}`
      : saved.preview_url;
    if (!src) return;
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.play().catch(() => {
      playingId.current = null;
      setPlayingVoiceId(null);
    });
    audio.onended = () => {
      playingId.current = null;
      setPlayingVoiceId(null);
    };
  };

  const handlePresetGenerate = async () => {
    setPresetError(null);
    setPresetPreviews([]);
    setPresetLoading(true);
    try {
      const res = await designVoiceFromPreset({
        gender: presetGender || undefined,
        age: presetAge || undefined,
        persona: presetPersona || undefined,
        speed: presetSpeed || undefined,
        accent: presetAccent || undefined,
      });
      setLastPresetDesignResponse(res.data);
      const previews = res.data.previews ?? [];
      setPresetPreviews(previews);
      if (previews.length > 0) playDesignPreview(previews[0]);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail as string | undefined
        : "Generation failed";
      setPresetError(msg || "Failed to generate voice. Try different options.");
    } finally {
      setPresetLoading(false);
    }
  };

  const handleCustomGenerate = async () => {
    const prompt = customPrompt.trim();
    if (prompt.length < 20) {
      setCustomError("Enter at least 20 characters.");
      return;
    }
    if (prompt.length > 1000) {
      setCustomError("Keep under 1000 characters.");
      return;
    }
    setCustomError(null);
    setCustomPreviews([]);
    setCustomLoading(true);
    try {
      const res = await designVoiceFromPrompt({ prompt });
      setLastCustomDesignResponse(res.data);
      const previews = res.data.previews ?? [];
      setCustomPreviews(previews);
      if (previews.length > 0) playDesignPreview(previews[0]);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail as string | undefined
        : "Generation failed";
      setCustomError(msg || "Failed to generate voice. Try a different prompt.");
    } finally {
      setCustomLoading(false);
    }
  };

  const openDesignModalOrUpgrade = () => {
    if (!isPro) {
      setShowUpgrade(true);
      return;
    }
    setShowDesignModal(true);
  };

  const createCustomVoiceButton = (
    <button
      type="button"
      onClick={openDesignModalOrUpgrade}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      New voice
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Voices</h1>
        {createCustomVoiceButton}
      </div>
      <p className="text-sm text-gray-500 max-w-md">
        Add custom or prebuilt voices. Saved voices appear in the Voice step when creating a video.
      </p>

      {!myVoicesLoaded ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <span className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading your voices…</p>
        </div>
      ) : myVoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mb-4 bg-purple-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom voices yet</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm">
            Create your first voice with our voice designer. Choose options or describe the voice
            you want—then add it to use in your videos.
          </p>
          <button
            type="button"
            onClick={openDesignModalOrUpgrade}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + New voice
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-4 mb-2">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">Custom voices</label>
          </div>
          {customVoices.length > 0 ? (
            <ul className="space-y-2 mb-6">
              {customVoices.map((saved) => {
                const hasPreview = !!(saved.preview_url || saved.audio_base64);
                const isPlaying = playingVoiceId === saved.voice_id;
                const { displayName } = getMyVoiceDisplayName(saved.name);
                return (
                  <li key={saved.id} className="group">
                    <VoiceItem
                      name={displayName}
                      subtitle={subtitleForSavedVoice(saved)}
                      hasPreview={hasPreview}
                      isPlaying={isPlaying}
                      onPlay={() => playSavedPreview(saved)}
                      className="group"
                      actions={
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromMyVoices(saved.id);
                            }}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                            title="Remove from Voice step"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteVoiceTarget(saved);
                            }}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                            title="Delete voice"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[11px] text-gray-500 mb-6">No custom voices yet.</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">Prebuilt voices</label>
        {!loaded ? (
          <p className="text-[11px] text-gray-500">Loading voices…</p>
        ) : voices.length === 0 ? (
          <p className="text-[11px] text-gray-500">No voices loaded. Check your API key.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
            
              <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
                {PREBUILT_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPrebuiltTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      prebuiltTab === tab ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <ul className="space-y-2 max-h-[320px] overflow-y-auto [scrollbar-gutter:stable]">
              {prebuiltVoicesByTab.map((voice) => {
                const saved = myVoices.find((v) => v.voice_id === voice.voice_id);
                const isPlaying = playingVoiceId === voice.voice_id;
                const { displayName } = getMyVoiceDisplayName(voice.name);
                return (
                  <li key={voice.voice_id} className="group">
                    <VoiceItem
                      name={displayName}
                      subtitle={subtitleFromElevenLabs(voice)}
                      hasPreview={!!voice.preview_url}
                      isPlaying={isPlaying}
                      onPlay={() => playPreview(voice)}
                      isSelected={!!saved}
                      className="group"
                      actions={
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {saved ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromMyVoices(saved.id);
                              }}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              title="Remove from Voice step"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isPro) {
                                  setShowUpgrade(true);
                                  return;
                                }
                                addExistingToMyVoices(voice);
                              }}
                              className="p-1 text-gray-300 hover:text-purple-600 transition-colors"
                              title="Add to Voice step"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <ConfirmDeleteModal
        open={deleteVoiceTarget !== null}
        onClose={() => setDeleteVoiceTarget(null)}
        title="Delete this voice?"
        subtitle={deleteVoiceTarget ? getMyVoiceDisplayName(deleteVoiceTarget.name).displayName : undefined}
        warningMessage="This voice will be removed from your list. This cannot be undone."
        onConfirm={async () => {
          if (deleteVoiceTarget) {
            await removeFromMyVoices(deleteVoiceTarget.id);
            setDeleteVoiceTarget(null);
          }
        }}
      />

      <UpgradePlanModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Update to a paid plan"
        subtitle="Create and use custom voices in your videos. Upgrade to Pro or Standard to unlock."
      />

      {showDesignModal &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDesignModal(false)} />
            <div className="relative w-full max-w-xl bg-white border border-gray-200/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7 mt-5 max-h-[85vh] overflow-y-auto transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-semibold text-gray-900">Create custom voice</h2>
                <button
                  type="button"
                  onClick={() => setShowDesignModal(false)}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-5">
                <div className="rounded-xl bg-purple-600 px-5 py-3 mb-1">
                  <h2 className="text-base font-semibold text-white">Create your custom voice</h2>
                </div>

                {/* Choose one method only */}
                <div>
                  <p className="text-[11px] text-gray-500 mb-2">Choose one way to create your voice:</p>
                  <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-full">
                    <button
                      type="button"
                      onClick={() => setCreateVoiceMode("form")}
                      className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        createVoiceMode === "form"
                          ? "bg-white text-purple-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      Build from options
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateVoiceMode("prompt")}
                      className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        createVoiceMode === "prompt"
                          ? "bg-white text-purple-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      Describe in your own words
                    </button>
                  </div>
                </div>

                {/* Build from options — only when form mode */}
                {createVoiceMode === "form" && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Build from options
                  </label>
                  <p className="mt-0.5 text-[11px] text-gray-400 leading-relaxed mb-3">
                    Fill in the fields below; we’ll generate voice previews — play then add to custom voice.
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                          Gender <span className="text-gray-300 font-normal normal-case">(optional)</span>
                        </label>
                        <select
                          value={presetGender}
                          onChange={(e) => setPresetGender(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                        >
                          <option value=""> </option>
                          {VOICE_GENDERS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                          Voice <span className="text-gray-300 font-normal normal-case">(optional)</span>
                        </label>
                        <select
                          value={presetAge}
                          onChange={(e) => setPresetAge(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                        >
                          <option value=""> </option>
                          {VOICE_AGE_RANGES.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                        Persona <span className="text-gray-300 font-normal normal-case">(optional)</span>
                      </label>
                      <select
                        value={presetPersona}
                        onChange={(e) => setPresetPersona(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                      >
                        <option value=""> </option>
                        {VOICE_PERSONAS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                        Speed <span className="text-gray-300 font-normal normal-case">(optional)</span>
                      </label>
                      <select
                        value={presetSpeed}
                        onChange={(e) => setPresetSpeed(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                      >
                        <option value=""> </option>
                        {VOICE_SPEEDS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                        Accent / language <span className="text-gray-300 font-normal normal-case">(optional)</span>
                      </label>
                      <select
                        value={presetAccent}
                        onChange={(e) => setPresetAccent(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                      >
                        <option value=""> </option>
                        {VOICE_ACCENTS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (presetLoading) return;
                        const first = presetPreviews[0];
                        if (first && playingVoiceId === first.generated_voice_id) {
                          playDesignPreview(first);
                        } else if (first) {
                          playDesignPreview(first);
                        } else {
                          handlePresetGenerate();
                        }
                      }}
                      disabled={presetLoading}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title={presetLoading ? "Generating…" : presetPreviews[0] && playingVoiceId === presetPreviews[0]?.generated_voice_id ? "Pause" : "Play"}
                    >
                      {presetLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      ) : presetPreviews[0] && playingVoiceId === presetPreviews[0].generated_voice_id ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        presetPreviews[0] &&
                        addGeneratedToMyVoices(
                          "form",
                          presetPreviews[0],
                          {
                            gender: presetGender || undefined,
                            age: presetAge || undefined,
                            persona: presetPersona || undefined,
                            speed: presetSpeed || undefined,
                            accent: presetAccent || undefined,
                          },
                          null,
                          lastPresetDesignResponse
                        )
                      }
                      disabled={
                        presetPreviews.length === 0 ||
                        myVoices.some((v) => v.voice_id === presetPreviews[0]?.generated_voice_id) ||
                        savingVoiceId === presetPreviews[0]?.generated_voice_id
                      }
                      className="py-1.5 px-2 min-w-[3rem] text-[11px] font-medium rounded-lg border border-gray-200/60 text-purple-600 hover:bg-purple-50 hover:text-purple-700 disabled:text-gray-400 disabled:border-gray-100 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {savingVoiceId === presetPreviews[0]?.generated_voice_id ? (
                        <>
                          <span className="w-3 h-3 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
                          Saving…
                        </>
                      ) : presetPreviews.length > 0 && myVoices.some((v) => v.voice_id === presetPreviews[0]?.generated_voice_id) ? (
                        "Saved"
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                  {presetError && <p className="mt-2 text-[11px] text-red-500">{presetError}</p>}
                </div>
                )}

                {/* Describe in your own words — only when prompt mode */}
                {createVoiceMode === "prompt" && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Describe in your own words
                  </label>
                  <p className="mt-0.5 text-[11px] text-gray-400 leading-relaxed mb-2">
                    Describe the voice (20–1000 characters); we’ll generate previews — play then add to custom voice.
                  </p>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. A warm, middle-aged British woman with a calm, storytelling tone."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all resize-y"
                  />
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (customLoading || customPrompt.trim().length < 20) return;
                          const first = customPreviews[0];
                          if (first && playingVoiceId === first.generated_voice_id) {
                            playDesignPreview(first);
                          } else if (first) {
                            playDesignPreview(first);
                          } else {
                            handleCustomGenerate();
                          }
                        }}
                        disabled={customLoading || customPrompt.trim().length < 20}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        title={customLoading ? "Generating…" : customPreviews[0] && playingVoiceId === customPreviews[0]?.generated_voice_id ? "Pause" : "Play"}
                      >
                        {customLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                        ) : customPreviews[0] && playingVoiceId === customPreviews[0].generated_voice_id ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          customPreviews[0] &&
                          addGeneratedToMyVoices(
                            "prompt",
                            customPreviews[0],
                            null,
                            customPrompt.trim() || null,
                            lastCustomDesignResponse
                          )
                        }
                        disabled={
                          customPreviews.length === 0 ||
                          myVoices.some((v) => v.voice_id === customPreviews[0]?.generated_voice_id) ||
                          savingVoiceId === customPreviews[0]?.generated_voice_id
                        }
                        className="py-1.5 px-2 min-w-[3rem] text-[11px] font-medium rounded-lg border border-gray-200/60 text-purple-600 hover:bg-purple-50 hover:text-purple-700 disabled:text-gray-400 disabled:border-gray-100 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        {savingVoiceId === customPreviews[0]?.generated_voice_id ? (
                          <>
                            <span className="w-3 h-3 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
                            Saving…
                          </>
                        ) : customPreviews.length > 0 && myVoices.some((v) => v.voice_id === customPreviews[0]?.generated_voice_id) ? (
                          "Saved"
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">{customPrompt.length} / 1000</span>
                  </div>
                  {customError && <p className="mt-2 text-[11px] text-red-500">{customError}</p>}
                </div>
                )}

              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
