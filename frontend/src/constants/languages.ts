/**
 * Content languages a project can be generated in — or translated into.
 *
 * Shared by the create-project form (BlogUrlForm) and the editor's Settings tab
 * (ProjectLanguageSettingsCard). Codes are ISO 639-1 and must stay in sync with
 * `_LANG_NAMES` in backend/app/services/language_detection.py, which maps them to the
 * human-readable names used in LLM prompts and ElevenLabs TTS normalization.
 */
export interface ContentLanguage {
  code: string;
  name: string;
}

export const SUPPORTED_CONTENT_LANGUAGES: ContentLanguage[] = [
  { code: "ar", name: "Arabic" },
  { code: "bn", name: "Bengali" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fa", name: "Persian (Farsi)" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "gu", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pa", name: "Punjabi" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh-cn", name: "Chinese (Simplified)" },
  { code: "zh-tw", name: "Chinese (Traditional)" },
];

/** "es" -> "es - Spanish"; the sentinel "auto" -> "Auto" (create form only). */
export const getLanguageOptionLabel = (code: string): string => {
  if (code === "auto") return "Auto";
  const lang = SUPPORTED_CONTENT_LANGUAGES.find((item) => item.code === code);
  return lang ? `${lang.code} - ${lang.name}` : code;
};

/** "es" -> "Spanish". Falls back to the raw code for unknown values. */
export const getLanguageName = (code: string | null | undefined): string => {
  if (!code) return "";
  const lang = SUPPORTED_CONTENT_LANGUAGES.find((item) => item.code === code.toLowerCase());
  return lang ? lang.name : code;
};
