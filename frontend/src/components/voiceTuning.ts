/** Shared voice-tuning constants, helpers, and types used by BlogUrlForm (step 3)
 *  and ProjectVoiceSettingsCard (change-voice modal). */

export const VOICE_STABILITY_DEFAULT = 0.5;
export const VOICE_STABILITY_MIN = 0;
export const VOICE_STABILITY_MAX = 1;
export const VOICE_SPEED_DEFAULT = 1.0;
export const VOICE_SPEED_MIN = 0.7;
export const VOICE_SPEED_MAX = 1.2;
export const VOICE_TUNING_STEP = 0.05;
// Style exaggeration (ElevenLabs). Capped at 0.5 — higher values introduce artifacts, and high
// style + low stability sounds distorted. Stored as the 4th element of the voice_emotion array.
export const VOICE_STYLE_DEFAULT = 0;
export const VOICE_STYLE_MIN = 0;
export const VOICE_STYLE_MAX = 0.5;

/** Emotion audio tags the user can pick (paid). The chosen value is stored as the 3rd element of
 *  the voice_emotion array and injected by the backend as a "[<value>]" tag before each sentence. */
export const VOICE_EMOTIONS: { value: string; label: string }[] = [
  { value: "excited", label: "Excited" },
  { value: "happy", label: "Happy" },
  { value: "calm", label: "Calm" },
  { value: "serious", label: "Serious" },
  { value: "curious", label: "Curious" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "whispers", label: "Whispering" },
];
export const VOICE_EMOTION_VALUES = new Set(VOICE_EMOTIONS.map((e) => e.value));

/** Parse the stored ["<stability>","<speed>","<emotion>","<style>","<enabled>"] array (from
 *  preferred_voice_emotion / a project) into [stability, speed, emotion, style, enabled]. Elements
 *  3–5 are optional. The 5th element ("1"/"0") remembers whether Advanced Options was last enabled,
 *  so the sliders keep their last-enabled values even while the toggle is off. Legacy values without
 *  it (≥2 elements) are treated as enabled; a missing/empty raw means disabled with defaults. */
export function parseVoiceTuning(raw: string | null | undefined): [number, number, string, number, boolean] {
  if (raw) {
    try {
      const v = JSON.parse(raw);
      const s = Number(v[0]);
      const sp = Number(v[1]);
      const em = typeof v[2] === "string" && VOICE_EMOTION_VALUES.has(v[2]) ? v[2] : "";
      const styleRaw = Number(v[3]);
      const st = Number.isFinite(styleRaw)
        ? Math.max(VOICE_STYLE_MIN, Math.min(VOICE_STYLE_MAX, styleRaw))
        : VOICE_STYLE_DEFAULT;
      const enabled = v[4] === "0" ? false : true; // legacy (no 5th) → enabled
      if (Number.isFinite(s) && Number.isFinite(sp)) return [s, sp, em, st, enabled];
    } catch {
      /* fall through to defaults */
    }
  }
  return [VOICE_STABILITY_DEFAULT, VOICE_SPEED_DEFAULT, "", VOICE_STYLE_DEFAULT, false];
}

/** Serialize slider + emotion + style values + enabled flag to the canonical string array the
 *  backend expects. Emotion is optional ("" = no tag); style is clamped; enabled is "1"/"0". */
export function serializeVoiceTuning(stability: number, speed: number, emotion: string, style: number, enabled: boolean): string {
  const em = VOICE_EMOTION_VALUES.has(emotion) ? emotion : "";
  const st = Math.max(VOICE_STYLE_MIN, Math.min(VOICE_STYLE_MAX, style));
  return JSON.stringify([stability.toFixed(2), speed.toFixed(2), em, st.toFixed(2), enabled ? "1" : "0"]);
}

export interface VoiceTuning {
  enabled: boolean;
  stability: number;
  speed: number;
  emotion: string;
  style: number;
}
