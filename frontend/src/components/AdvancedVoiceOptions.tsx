import { useCallback, useEffect, useRef, useState } from "react";
import { previewVoice } from "../api/client";
import { useErrorModal } from "../contexts/ErrorModalContext";
import {
  VOICE_EMOTIONS,
  VOICE_STABILITY_MIN,
  VOICE_STABILITY_MAX,
  VOICE_SPEED_MIN,
  VOICE_SPEED_MAX,
  VOICE_STYLE_MIN,
  VOICE_STYLE_MAX,
  VOICE_TUNING_STEP,
  serializeVoiceTuning,
  type VoiceTuning,
} from "./voiceTuning";

interface Props {
  value: VoiceTuning;
  onChange: (next: VoiceTuning) => void;
  voiceGender: string;
  voiceAccent: string;
  customVoiceId: string;
}

/** Exact step-3 single-panel markup, extracted into a controlled, self-contained component.
 *  Used by BlogUrlForm (step 3) and ProjectVoiceSettingsCard (change-voice modal). */
export default function AdvancedVoiceOptions({ value, onChange, voiceGender, voiceAccent, customVoiceId }: Props) {
  const { showError } = useErrorModal();

  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopVoicePreview = useCallback(() => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewState("idle");
  }, []);

  const handleVoicePreview = useCallback(async () => {
    if (previewState === "playing") {
      stopVoicePreview();
      return;
    }
    if (previewState === "loading") return;
    setPreviewState("loading");
    try {
      const url = await previewVoice({
        voice_gender: voiceGender,
        voice_accent: voiceAccent,
        custom_voice_id: customVoiceId || undefined,
        voice_emotion: serializeVoiceTuning(value.stability, value.speed, value.emotion, value.style, true),
      });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      const audio = new Audio(url);
      audio.addEventListener("ended", stopVoicePreview);
      previewAudioRef.current = audio;
      await audio.play();
      setPreviewState("playing");
    } catch (err: any) {
      setPreviewState("idle");
      const status = err?.response?.status;
      if (status === 429) showError("Please wait a moment before previewing again.");
      else if (status === 403) showError("Voice preview requires a Pro or Standard plan.");
      else showError("Couldn't generate a voice preview. Please try again.");
    }
  }, [previewState, stopVoicePreview, showError, voiceGender, voiceAccent, customVoiceId, value]);

  // Cleanup audio on unmount.
  useEffect(() => () => stopVoicePreview(), [stopVoicePreview]);

  const { enabled, stability, speed, emotion, style } = value;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50/60 border border-gray-200/60">
        <div>
          <p className="text-sm font-medium text-gray-700">Enable</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange({ ...value, enabled: !enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-purple-600" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
      <div
        className={`space-y-4 transition-opacity ${enabled ? "" : "opacity-50 pointer-events-none select-none"}`}
        aria-disabled={!enabled}
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-gray-600">
              Emotion <span className="font-normal text-gray-400">(optional)</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VOICE_EMOTIONS.map((em) => {
              const selected = emotion === em.value;
              return (
                <button
                  key={em.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...value, emotion: selected ? "" : em.value })}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    selected
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"
                  }`}
                >
                  {em.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Pick one to steer delivery, or leave unselected.</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-600">Expressiveness</span>
            <span className="text-[11px] text-gray-400 tabular-nums">{stability.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={VOICE_STABILITY_MIN}
            max={VOICE_STABILITY_MAX}
            step={VOICE_TUNING_STEP}
            value={stability}
            onChange={(e) => onChange({ ...value, stability: parseFloat(e.target.value) })}
            className="w-full accent-purple-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Steady</span>
            <span>Expressive</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-600">Character</span>
            <span className="text-[11px] text-gray-400 tabular-nums">{style.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={VOICE_STYLE_MIN}
            max={VOICE_STYLE_MAX}
            step={VOICE_TUNING_STEP}
            value={style}
            onChange={(e) => onChange({ ...value, style: parseFloat(e.target.value) })}
            className="w-full accent-purple-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Natural</span>
            <span>Dramatic</span>
          </div>
          {style >= 0.4 && stability >= 0.7 && (
            <p className="text-[10px] text-amber-600 mt-0.5">High Character + high Expressiveness can sound distorted — try lowering one.</p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-600">Speed</span>
            <span className="text-[11px] text-gray-400 tabular-nums">{speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={VOICE_SPEED_MIN}
            max={VOICE_SPEED_MAX}
            step={VOICE_TUNING_STEP}
            value={speed}
            onChange={(e) => onChange({ ...value, speed: parseFloat(e.target.value) })}
            className="w-full accent-purple-600 cursor-pointer"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Narration pace at synthesis (0.7–1.2x).</p>
        </div>
        <button
          type="button"
          onClick={handleVoicePreview}
          disabled={previewState === "loading"}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-700 transition-colors disabled:opacity-50"
        >
          {previewState === "loading" ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
              Generating…
            </>
          ) : previewState === "playing" ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              Stop
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
              Listen to a sample
            </>
          )}
        </button>
      </div>
    </div>
  );
}
