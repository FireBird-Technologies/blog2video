"""Detect content language from text. Used to ensure script, display text, and voiceover match scraped content language."""

import re

from app.observability.logging import get_logger

logger = get_logger(__name__)

# ISO 639-1 codes to human-readable names for LLM prompts
_LANG_NAMES: dict[str, str] = {
    # Existing
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "ru": "Russian",
    "ja": "Japanese",
    "zh-cn": "Chinese (Simplified)",
    "zh-tw": "Chinese (Traditional)",
    "ko": "Korean",
    "ar": "Arabic",
    "hi": "Hindi",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish",
    "el": "Greek",
    "he": "Hebrew",
    "ro": "Romanian",
    "hu": "Hungarian",
    "cs": "Czech",
    "uk": "Ukrainian",

    "fa": "Persian (Farsi)",
    "ur": "Urdu",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
    "kn": "Kannada",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "si": "Sinhala",
    "ne": "Nepali",

    "ms": "Malay",
    "tl": "Filipino (Tagalog)",

    "af": "Afrikaans",
    "sw": "Swahili",
    "zu": "Zulu",
    "xh": "Xhosa",

    "et": "Estonian",
    "lv": "Latvian",
    "lt": "Lithuanian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "hr": "Croatian",
    "sr": "Serbian",
    "bs": "Bosnian",
    "mk": "Macedonian",
    "sq": "Albanian",

    "is": "Icelandic",
    "mt": "Maltese",
    "ga": "Irish",
    "cy": "Welsh",

    "hy": "Armenian",
    "ka": "Georgian",
    "az": "Azerbaijani",
    "kk": "Kazakh",
    "uz": "Uzbek",
    "mn": "Mongolian",

    "am": "Amharic",
    "so": "Somali",
    "yo": "Yoruba",
    "ig": "Igbo",
    "ha": "Hausa",

    "km": "Khmer",
    "lo": "Lao",
    "my": "Burmese",

    # Variants sometimes returned
    "zh": "Chinese",
    "pt-br": "Portuguese (Brazil)",
    "pt-pt": "Portuguese (Portugal)",
}

# Minimum confidence (0–1) to trust detection. Below this, fall back to English.
_MIN_CONFIDENCE = 0.75

# Minimum chars of prose to attempt detection (code-heavy content needs more)
_MIN_SAMPLE_CHARS = 80


def _detect_from_script_heuristics(text: str) -> str | None:
    """Detect language from Unicode script patterns for short/ambiguous samples."""
    if not text:
        return None

    # Arabic-script block (used by Urdu/Arabic/Persian).
    arabic_chars = re.findall(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]", text)
    if not arabic_chars:
        return None

    # If Arabic-script dominates, prefer Urdu when Urdu-specific letters exist.
    total_letters = re.findall(r"[^\W\d_]", text, flags=re.UNICODE)
    arabic_ratio = (len(arabic_chars) / max(1, len(total_letters))) if total_letters else 0.0
    if arabic_ratio < 0.3:
        return None

    # Urdu-specific characters frequently present in Urdu prose.
    if re.search(r"[ٹڈڑںھہےیگچپژک]", text):
        return "ur"

    # Fallback for Arabic-script text when Urdu markers are absent.
    return "ar"


def _sample_for_detection(text: str) -> str:
    """
    Extract a prose-only sample suitable for language detection.
    - Strips code blocks (they skew detection: 'if', 'for', 'return' look like English)
    - Uses content before "═══ CODE BLOCKS" if present
    - Takes up to 5000 chars for better reliability
    """
    t = text.strip()
    # Use only prose before code blocks (scraper injects this marker)
    if "═══ CODE BLOCKS" in t:
        t = t.split("═══ CODE BLOCKS")[0].strip()
    # Strip fenced code blocks (```...```) — code skews detection (e.g. 'if', 'for' look like English)
    t = re.sub(r"```[\s\S]*?```", "\n", t)
    t = " ".join(t.split())
    return t[:5000]


def detect_content_language(text: str | None) -> str:
    """
    Detect the primary language of the given text using FastText (fast-langdetect).
    Returns ISO 639-1 code (e.g. 'en', 'es'). Falls back to 'en' if detection fails,
    confidence is low, or text is empty.
    """
    if not text or not text.strip():
        return "en"

    sample = _sample_for_detection(text)
    script_guess = _detect_from_script_heuristics(sample)
    if script_guess:
        return script_guess

    if len(sample) < _MIN_SAMPLE_CHARS:
        return "en"

    try:
        from fast_langdetect import detect, LangDetectConfig

        # Allow full sample (up to 5000 chars) — default truncation to 80 chars hurts accuracy
        config = LangDetectConfig(max_input_length=5000)
        # Use full model for higher accuracy (~95%); auto falls back to lite on MemoryError
        results = detect(sample, model="full", k=1, config=config)
        if not results:
            return "en"

        top = results[0]
        code = (top.get("lang") or "").lower()
        score = top.get("score", 1.0)

        # Require minimum confidence to avoid wrong detections
        if score < _MIN_CONFIDENCE:
            # For short/noisy text, script heuristics are often more reliable than
            # a low-confidence model prediction.
            heuristic_guess = _detect_from_script_heuristics(sample)
            if heuristic_guess:
                return heuristic_guess
            logger.info(
                "[LANG] Low confidence %.2f for '%s', defaulting to English",
                score,
                code,
            )
            return "en"

        # Normalize fastText codes to ISO 639-1
        if code.startswith("zh"):
            code = "zh-cn"
        elif code.startswith("pt"):
            code = "pt"

        return code or "en"
    except Exception as e:
        logger.debug(
            "[LANG] Detection failed, defaulting to English: %s",
            e,
        )
        return "en"


def get_content_language_for_project(project) -> str:
    """
    Get content_language for a project. If not set, detect from blog_content.
    Returns human-readable language name for LLM prompts (e.g. 'English', 'Spanish').
    """
    code = getattr(project, "content_language", None)
    if code and str(code).strip():
        return get_language_for_prompt(str(code).strip())
    content = getattr(project, "blog_content", None) or ""
    detected = detect_content_language(content)
    return get_language_for_prompt(detected)


def get_language_for_prompt(code: str) -> str:
    """
    Convert ISO 639-1 code to a string suitable for LLM prompts.
    E.g. 'es' -> 'Spanish', 'en' -> 'English'.
    Unknown codes are returned as-is (LLM can usually infer).
    """
    return _LANG_NAMES.get(code.lower(), code)


def normalize_preferred_language_code(value: str | None) -> str | None:
    """Normalize user-provided language preference to ISO-like code when possible.

    Accepts either language code (e.g. "ur", "en") or language name
    (e.g. "Urdu", "English"). Returns lower-case code when resolved,
    otherwise returns a lower-cased trimmed value.
    """
    raw = (value or "").strip()
    if not raw:
        return None

    lowered = raw.lower()
    if lowered in _LANG_NAMES:
        return lowered

    # Reverse-map known language names to their codes.
    for code, name in _LANG_NAMES.items():
        if lowered == name.lower():
            return code

    return lowered
