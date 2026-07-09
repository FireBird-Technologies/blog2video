import asyncio
import json
import os
import re
import time
from typing import Callable
import requests
from mutagen.mp3 import MP3
from elevenlabs import ElevenLabs
from sqlalchemy.orm import Session

from app.config import settings
from app.models.scene import Scene
from app.models.project import Project
from app.models.asset import Asset, AssetType
from app.services import r2_storage
from app.observability.logging import get_logger

logger = get_logger(__name__)

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
SCENE_DELAY = 2  # seconds between scenes to avoid rate limits
DURATION_PAD = 1.0  # extra seconds held after the voiceover ends, per scene

# ElevenLabs premade voices -- narrator / documentary style
# Verified against the official premade voice list:
# https://elevenlabs-sdk.mintlify.app/voices/premade-voices
VOICE_MAP = {
    ("female", "american"): "21m00Tcm4TlvDq8ikWAM",  # Rachel  -- american, calm, narration
    ("male", "american"): "pqHfZKP75CvOlQylNhV4",    # Bill    -- american, strong, documentary
    ("female", "british"): "Xb7hH8MSUJpSbSDYk0k2",   # Alice   -- british, confident, news
    ("male", "british"): "onwK4e9ZLuTAKqWW03F9",     # Daniel  -- british, deep, news presenter
}

# Fallback: Bill (american male documentary voice) if no match
DEFAULT_VOICE_ID = "pqHfZKP75CvOlQylNhV4"
ELEVENLABS_VOICE_META_URL = "https://api.elevenlabs.io/v1/voices/{voice_id}"

# TTS models. Default narration stays on v2. The paid "Advanced Options" path (any project with
# voice_emotion tuning set) routes through v3 — the only model with real emotion control — and
# injects the user-selected emotion audio tag (e.g. [excited], [calm]) per sentence.
TTS_MODEL_DEFAULT = "eleven_multilingual_v2"
TTS_MODEL_EXPRESSIVE = "eleven_v3"

# Emotion audio tags the user can pick in Advanced Options. The chosen one is injected as
# "[<emotion>]" before each sentence. Unknown/missing values fall back to DEFAULT_EMOTION so
# legacy 2-element voice_emotion values keep their original [excited] behaviour.
SUPPORTED_EMOTIONS = {"excited", "happy", "calm", "serious", "curious", "sad", "angry", "whispers"}
DEFAULT_EMOTION = "excited"

# User-tunable voice settings, stored on the project as a JSON string array ["<strength>","<speed>"]
# in the voice_emotion column. Strength (0..1) is creativity-forward (higher = more creative) and is
# inverted to a v3 stability preset at synthesis (stability = 1 - strength). Speed = synthesis pace.
VOICE_STABILITY_RANGE = (0.0, 1.0)
VOICE_SPEED_RANGE = (0.7, 1.2)
# Style exaggeration is capped well below 1.0 — values above ~0.5 introduce artifacts on v3.
VOICE_STYLE_RANGE = (0.0, 0.5)
DEFAULT_STYLE = 0.0

# v3 accepts only discrete stability presets: Creative (0.0, most expressive/tag-responsive),
# Natural (0.5), Robust (1.0, steadiest). The inverted Strength value snaps to the nearest preset.
_V3_STABILITY_PRESETS = (0.0, 0.5, 1.0)

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def _parse_voice_tuning(raw: str | None) -> tuple[float, float, str | None, float] | None:
    """Parse the stored ["<stability>","<speed>","<emotion>","<style>"] array into clamped
    (stability, speed, emotion, style).

    The emotion (3rd) and style (4th) elements are optional: legacy 2-element values fall back to
    DEFAULT_EMOTION + DEFAULT_STYLE; a present-but-empty/invalid emotion means "no emotion tag"
    (None) and a missing/invalid style means DEFAULT_STYLE. Returns None on any missing/parse/shape
    error so a bad value silently falls back to the per-video-style defaults instead of crashing TTS.
    """
    if not raw:
        return None
    try:
        values = json.loads(raw)
        stability = float(values[0])
        speed = float(values[1])
    except (ValueError, TypeError, IndexError, json.JSONDecodeError):
        return None
    # Emotion (3rd element) is optional. Legacy 2-element values keep the original [excited]
    # behaviour; a present-but-empty/invalid value means "no emotion tag" (None).
    if isinstance(values, list) and len(values) >= 3:
        candidate = str(values[2]).strip().lower()
        emotion = candidate if candidate in SUPPORTED_EMOTIONS else None
    else:
        emotion = DEFAULT_EMOTION
    # Style (4th element) is optional; missing/invalid → DEFAULT_STYLE.
    style = DEFAULT_STYLE
    if isinstance(values, list) and len(values) >= 4:
        try:
            style = float(values[3])
        except (TypeError, ValueError):
            style = DEFAULT_STYLE
    stability = max(VOICE_STABILITY_RANGE[0], min(VOICE_STABILITY_RANGE[1], stability))
    speed = max(VOICE_SPEED_RANGE[0], min(VOICE_SPEED_RANGE[1], speed))
    style = max(VOICE_STYLE_RANGE[0], min(VOICE_STYLE_RANGE[1], style))
    return stability, speed, emotion, style


def _snap_v3_stability(value: float) -> float:
    """Snap a continuous Strength value to the nearest v3 stability preset (0.0/0.5/1.0)."""
    return min(_V3_STABILITY_PRESETS, key=lambda preset: abs(preset - value))


def _inject_emotion_tag(text: str, emotion: str | None = None) -> str:
    """Prefix the chosen "[<emotion>]" audio tag before every sentence so the v3 model keeps a
    consistent delivery across the whole scene (tags affect the text that follows them).

    Emotion is optional: when None/empty/unsupported, the text is returned unchanged (no tag)."""
    if not text or not text.strip():
        return text
    if not emotion or emotion not in SUPPORTED_EMOTIONS:
        return text
    tag = f"[{emotion}]"
    sentences = [s for s in _SENTENCE_SPLIT_RE.split(text.strip()) if s]
    if not sentences:
        return text
    return " ".join(f"{tag} {s}" for s in sentences)


def _voice_settings_for_video_style(video_style: str | None) -> dict | None:
    """Return ElevenLabs voice_settings tuned by video style.

    Promotional  → ad-like delivery: dynamic emphasis, high energy, punchy cadence.
    Storytelling → cinematic narrator: expressive and warm, but coherent across scenes.
    Explainer    → documentary narration: steady, authoritative, cinematic and clear.
    """
    style = (video_style or "explainer").strip().lower()

    if style == "promotional":
        return {
            "stability": 0.22,
            "similarity_boost": 0.72,
            "style": 0.95,
            "use_speaker_boost": True,
        }

    if style == "storytelling":
        return {
            "stability": 0.50,
            "similarity_boost": 0.82,
            "style": 0.82,
            "use_speaker_boost": True,
        }
        
    return {
        "stability": 0.82,
        "similarity_boost": 0.90,
        "style": 0.38,
        "use_speaker_boost": True,
    }


def resolve_voice_id(gender: str | None, accent: str | None, custom_voice_id: str | None) -> str | None:
    """Resolve an ElevenLabs voice id from gender/accent/custom selection (no Project needed).

    Returns None for the "no voice" (mute) selection; a custom voice id wins when provided;
    otherwise maps (gender, accent) → premade voice, falling back to DEFAULT_VOICE_ID.
    """
    if (gender or "female") == "none":
        return None
    custom_str = custom_voice_id.strip() if isinstance(custom_voice_id, str) else None
    if custom_str:
        return custom_str
    return VOICE_MAP.get((gender or "female", accent or "american"), DEFAULT_VOICE_ID)


def _get_voice_id(project: Project) -> str | None:
    return resolve_voice_id(
        getattr(project, "voice_gender", "female"),
        getattr(project, "voice_accent", "american"),
        getattr(project, "custom_voice_id", None),
    )


PREVIEW_SAMPLE_TEXT = "Here's a quick preview of how your narration will sound with these settings."


def synthesize_voice_preview(
    *,
    gender: str | None,
    accent: str | None,
    custom_voice_id: str | None,
    voice_emotion: str | None,
    video_style: str | None = None,
) -> bytes:
    """Synthesize a short fixed sample with the given voice + tuning and return mp3 bytes.

    Mirrors generate_voiceover's expressive path: when tuning is present, runs v3 with the
    stability/style/speed settings + injected emotion tag; otherwise the default v2 path with
    video-style settings. Raises ValueError if no voice is selected (mute).
    """
    voice_id = resolve_voice_id(gender, accent, custom_voice_id)
    if voice_id is None:
        raise ValueError("No voice selected for preview.")
    text = PREVIEW_SAMPLE_TEXT
    tuning = _parse_voice_tuning(voice_emotion)
    if tuning is not None:
        strength, speed, emotion, style = tuning
        model_id = TTS_MODEL_EXPRESSIVE
        text = _inject_emotion_tag(text, emotion)
        voice_settings: dict = {
            "stability": _snap_v3_stability(1.0 - strength),
            "style": style,
            "speed": speed,
            "use_speaker_boost": True,
        }
    else:
        model_id = TTS_MODEL_DEFAULT
        voice_settings = _voice_settings_for_video_style(video_style) or {}
    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    audio = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=model_id,
        output_format="mp3_44100_128",
        voice_settings=voice_settings,
    )
    return b"".join(audio)


def _get_audio_duration(filepath: str) -> float:
    """Get the duration of an MP3 file in seconds."""
    try:
        audio = MP3(filepath)
        return audio.info.length
    except Exception:
        # Fallback: estimate from file size (~16KB per second at 128kbps)
        try:
            size = os.path.getsize(filepath)
            return size / 16000
        except Exception:
            return 10.0


def _fetch_voice_meta(voice_id: str) -> dict | None:
    """Fetch ElevenLabs voice metadata for diagnostics."""
    if not voice_id or not settings.ELEVENLABS_API_KEY:
        return None
    try:
        resp = requests.get(
            ELEVENLABS_VOICE_META_URL.format(voice_id=voice_id),
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        if not isinstance(payload, dict):
            return None
        return payload
    except Exception:
        return None


WORDS_PER_SECOND = 2.5  # average speaking pace for duration estimation

SUPPORTED_CONTENT_LANGUAGE_CODES = {
    "ar", "bn", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "gu",
    "he", "hi", "hu", "id", "it", "ja", "ko", "ml", "mr", "nl", "no", "pa",
    "pl", "pt", "ro", "ru", "sv", "ta", "te", "th", "tr", "uk", "ur", "vi",
    "zh-cn", "zh-tw",
}


def _normalize_language_key(content_language: str | None) -> str:
    raw = (content_language or "").strip().lower()
    if not raw:
        return "en"
    mapping = {
        "en": "en",
        "english": "en",
        "es": "es",
        "spanish": "es",
        "fr": "fr",
        "french": "fr",
        "de": "de",
        "german": "de",
        "it": "it",
        "italian": "it",
        "pt": "pt",
        "portuguese": "pt",
        "hi": "hi",
        "hindi": "hi",
        "ar": "ar",
        "arabic": "ar",
        "bn": "bn",
        "bengali": "bn",
        "cs": "cs",
        "czech": "cs",
        "da": "da",
        "danish": "da",
        "el": "el",
        "greek": "el",
        "fa": "fa",
        "persian": "fa",
        "farsi": "fa",
        "fi": "fi",
        "finnish": "fi",
        "gu": "gu",
        "gujarati": "gu",
        "he": "he",
        "hebrew": "he",
        "hu": "hu",
        "hungarian": "hu",
        "id": "id",
        "indonesian": "id",
        "ja": "ja",
        "japanese": "ja",
        "ko": "ko",
        "korean": "ko",
        "ml": "ml",
        "malayalam": "ml",
        "mr": "mr",
        "marathi": "mr",
        "nl": "nl",
        "dutch": "nl",
        "no": "no",
        "norwegian": "no",
        "pa": "pa",
        "punjabi": "pa",
        "pl": "pl",
        "polish": "pl",
        "ro": "ro",
        "romanian": "ro",
        "ru": "ru",
        "russian": "ru",
        "sv": "sv",
        "swedish": "sv",
        "ta": "ta",
        "tamil": "ta",
        "te": "te",
        "telugu": "te",
        "th": "th",
        "thai": "th",
        "tr": "tr",
        "turkish": "tr",
        "uk": "uk",
        "ukrainian": "uk",
        "ur": "ur",
        "urdu": "ur",
        "vi": "vi",
        "vietnamese": "vi",
        "zh-cn": "zh-cn",
        "chinese (simplified)": "zh-cn",
        "zh-tw": "zh-tw",
        "chinese (traditional)": "zh-tw",
    }
    if raw in mapping:
        return mapping[raw]
    if raw in SUPPORTED_CONTENT_LANGUAGE_CODES:
        return raw
    base = raw.split("-")[0] if "-" in raw else raw
    if base in SUPPORTED_CONTENT_LANGUAGE_CODES:
        return base
    return base or "en"


def _number_lexicon(content_language: str | None) -> tuple[dict[str, str], dict[str, str]]:
    """Return (digit_map, symbol_map) for TTS number expansion in target language."""
    lang = _normalize_language_key(content_language)
    lexicons: dict[str, tuple[dict[str, str], dict[str, str]]] = {
        "en": (
            {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"},
            {"$": "dollar", "€": "euro", "£": "pound", "₹": "rupee", ".": "point", "/": "slash", "-": "dash", "%": "percent"},
        ),
        "ar": (
            {"0": "sifr", "1": "wahid", "2": "ithnan", "3": "thalatha", "4": "arbaa", "5": "khamsa", "6": "sitta", "7": "sabaa", "8": "thamaniya", "9": "tisaa"},
            {"$": "dolar", "€": "yuro", "£": "jinayh", "₹": "rubiya", ".": "fasila", "/": "slash", "-": "waseela", "%": "bil mia"},
        ),
        "bn": (
            {"0": "shunyo", "1": "ek", "2": "dui", "3": "tin", "4": "char", "5": "pach", "6": "chhoy", "7": "sat", "8": "at", "9": "noy"},
            {"$": "dolar", "€": "euro", "£": "pound", "₹": "rupi", ".": "doshomik", "/": "slash", "-": "dash", "%": "shotangsho"},
        ),
        "cs": (
            {"0": "nula", "1": "jedna", "2": "dva", "3": "tri", "4": "ctyri", "5": "pet", "6": "sest", "7": "sedm", "8": "osm", "9": "devet"},
            {"$": "dolar", "€": "euro", "£": "libra", "₹": "rupie", ".": "carka", "/": "lomitko", "-": "pomlcka", "%": "procent"},
        ),
        "da": (
            {"0": "nul", "1": "en", "2": "to", "3": "tre", "4": "fire", "5": "fem", "6": "seks", "7": "syv", "8": "otte", "9": "ni"},
            {"$": "dollar", "€": "euro", "£": "pund", "₹": "rupi", ".": "komma", "/": "skraastreg", "-": "bindestreg", "%": "procent"},
        ),
        "es": (
            {"0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro", "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve"},
            {"$": "dolar", "€": "euro", "£": "libra", "₹": "rupia", ".": "coma", "/": "barra", "-": "guion", "%": "por ciento"},
        ),
        "el": (
            {"0": "miden", "1": "ena", "2": "dyo", "3": "tria", "4": "tessera", "5": "pente", "6": "eksi", "7": "efta", "8": "okto", "9": "ennea"},
            {"$": "dolario", "€": "evro", "£": "lira", "₹": "roupia", ".": "komma", "/": "kathestos", "-": "pavla", "%": "tois ekato"},
        ),
        "fa": (
            {"0": "sefr", "1": "yek", "2": "do", "3": "se", "4": "chahar", "5": "panj", "6": "shesh", "7": "haft", "8": "hasht", "9": "noh"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupiye", ".": "momayez", "/": "slash", "-": "khat tire", "%": "darsad"},
        ),
        "fi": (
            {"0": "nolla", "1": "yksi", "2": "kaksi", "3": "kolme", "4": "nelja", "5": "viisi", "6": "kuusi", "7": "seitseman", "8": "kahdeksan", "9": "yhdeksan"},
            {"$": "dollari", "€": "euro", "£": "punta", "₹": "rupia", ".": "pilkku", "/": "kauttaviiva", "-": "tavuviiva", "%": "prosenttia"},
        ),
        "fr": (
            {"0": "zero", "1": "un", "2": "deux", "3": "trois", "4": "quatre", "5": "cinq", "6": "six", "7": "sept", "8": "huit", "9": "neuf"},
            {"$": "dollar", "€": "euro", "£": "livre", "₹": "roupie", ".": "virgule", "/": "barre", "-": "tiret", "%": "pour cent"},
        ),
        "gu": (
            {"0": "shunya", "1": "ek", "2": "be", "3": "tran", "4": "char", "5": "panch", "6": "chh", "7": "sat", "8": "aath", "9": "nav"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupiyo", ".": "dashansh", "/": "slash", "-": "dash", "%": "takaa"},
        ),
        "he": (
            {"0": "efes", "1": "echad", "2": "shtayim", "3": "shalosh", "4": "arba", "5": "chamesh", "6": "shesh", "7": "sheva", "8": "shmone", "9": "tesha"},
            {"$": "dolar", "€": "euro", "£": "libra", "₹": "rupiya", ".": "nekuda", "/": "slash", "-": "makaf", "%": "ahuz"},
        ),
        "de": (
            {"0": "null", "1": "eins", "2": "zwei", "3": "drei", "4": "vier", "5": "funf", "6": "sechs", "7": "sieben", "8": "acht", "9": "neun"},
            {"$": "dollar", "€": "euro", "£": "pfund", "₹": "rupie", ".": "komma", "/": "schragstrich", "-": "bindestrich", "%": "prozent"},
        ),
        "hu": (
            {"0": "nulla", "1": "egy", "2": "ketto", "3": "harom", "4": "negy", "5": "ot", "6": "hat", "7": "het", "8": "nyolc", "9": "kilenc"},
            {"$": "dollar", "€": "euro", "£": "font", "₹": "rupia", ".": "vesszo", "/": "perjel", "-": "kotjel", "%": "szazalek"},
        ),
        "id": (
            {"0": "nol", "1": "satu", "2": "dua", "3": "tiga", "4": "empat", "5": "lima", "6": "enam", "7": "tujuh", "8": "delapan", "9": "sembilan"},
            {"$": "dolar", "€": "euro", "£": "pound", "₹": "rupee", ".": "koma", "/": "garis miring", "-": "tanda hubung", "%": "persen"},
        ),
        "it": (
            {"0": "zero", "1": "uno", "2": "due", "3": "tre", "4": "quattro", "5": "cinque", "6": "sei", "7": "sette", "8": "otto", "9": "nove"},
            {"$": "dollaro", "€": "euro", "£": "sterlina", "₹": "rupia", ".": "virgola", "/": "barra", "-": "trattino", "%": "per cento"},
        ),
        "ja": (
            {"0": "rei", "1": "ichi", "2": "ni", "3": "san", "4": "yon", "5": "go", "6": "roku", "7": "nana", "8": "hachi", "9": "kyu"},
            {"$": "doru", "€": "yuro", "£": "pondo", "₹": "rupi", ".": "ten", "/": "surasshu", "-": "haifun", "%": "pasento"},
        ),
        "ko": (
            {"0": "yeong", "1": "il", "2": "i", "3": "sam", "4": "sa", "5": "o", "6": "yuk", "7": "chil", "8": "pal", "9": "gu"},
            {"$": "dalleo", "€": "yuro", "£": "paundeu", "₹": "rupi", ".": "jeom", "/": "seullaesi", "-": "daesi", "%": "peosenteu"},
        ),
        "ml": (
            {"0": "poojyam", "1": "onnu", "2": "randu", "3": "moonu", "4": "naalu", "5": "anchu", "6": "aaru", "7": "ezhu", "8": "ettu", "9": "onpathu"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupa", ".": "dashamsham", "/": "slash", "-": "dash", "%": "shatamanam"},
        ),
        "mr": (
            {"0": "shunya", "1": "ek", "2": "don", "3": "teen", "4": "char", "5": "pach", "6": "saha", "7": "sat", "8": "aath", "9": "nau"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupaye", ".": "dashansh", "/": "slash", "-": "dash", "%": "takke"},
        ),
        "nl": (
            {"0": "nul", "1": "een", "2": "twee", "3": "drie", "4": "vier", "5": "vijf", "6": "zes", "7": "zeven", "8": "acht", "9": "negen"},
            {"$": "dollar", "€": "euro", "£": "pond", "₹": "roepie", ".": "komma", "/": "schuine streep", "-": "koppelteken", "%": "procent"},
        ),
        "no": (
            {"0": "null", "1": "en", "2": "to", "3": "tre", "4": "fire", "5": "fem", "6": "seks", "7": "sju", "8": "atte", "9": "ni"},
            {"$": "dollar", "€": "euro", "£": "pund", "₹": "rupi", ".": "komma", "/": "skraastrek", "-": "bindestrek", "%": "prosent"},
        ),
        "pa": (
            {"0": "sifar", "1": "ikk", "2": "do", "3": "tin", "4": "char", "5": "panj", "6": "chhe", "7": "satt", "8": "ath", "9": "nau"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupai", ".": "dashamlav", "/": "slash", "-": "dash", "%": "pratishat"},
        ),
        "pl": (
            {"0": "zero", "1": "jeden", "2": "dwa", "3": "trzy", "4": "cztery", "5": "piec", "6": "szesc", "7": "siedem", "8": "osiem", "9": "dziewiec"},
            {"$": "dolar", "€": "euro", "£": "funt", "₹": "rupia", ".": "przecinek", "/": "ukosnik", "-": "myslnik", "%": "procent"},
        ),
        "pt": (
            {"0": "zero", "1": "um", "2": "dois", "3": "tres", "4": "quatro", "5": "cinco", "6": "seis", "7": "sete", "8": "oito", "9": "nove"},
            {"$": "dolar", "€": "euro", "£": "libra", "₹": "rupia", ".": "virgula", "/": "barra", "-": "hifen", "%": "por cento"},
        ),
        "ro": (
            {"0": "zero", "1": "unu", "2": "doi", "3": "trei", "4": "patru", "5": "cinci", "6": "sase", "7": "sapte", "8": "opt", "9": "noua"},
            {"$": "dolar", "€": "euro", "£": "lira", "₹": "rupie", ".": "virgula", "/": "slash", "-": "cratima", "%": "la suta"},
        ),
        "ru": (
            {"0": "nol", "1": "odin", "2": "dva", "3": "tri", "4": "chetyre", "5": "pyat", "6": "shest", "7": "sem", "8": "vosem", "9": "devyat"},
            {"$": "dollar", "€": "evro", "£": "funt", "₹": "rupi", ".": "zapyataya", "/": "slesh", "-": "tire", "%": "protsent"},
        ),
        "sv": (
            {"0": "noll", "1": "ett", "2": "tva", "3": "tre", "4": "fyra", "5": "fem", "6": "sex", "7": "sju", "8": "atta", "9": "nio"},
            {"$": "dollar", "€": "euro", "£": "pund", "₹": "rupi", ".": "komma", "/": "snedstreck", "-": "bindestreck", "%": "procent"},
        ),
        "ta": (
            {"0": "poojyam", "1": "ondru", "2": "irandu", "3": "moondru", "4": "naangu", "5": "ainthu", "6": "aaru", "7": "ezhu", "8": "ettu", "9": "onpathu"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupai", ".": "dhasam", "/": "slash", "-": "dash", "%": "sathaveedam"},
        ),
        "te": (
            {"0": "sunna", "1": "okati", "2": "rendu", "3": "moodu", "4": "naalugu", "5": "aidu", "6": "aaru", "7": "edu", "8": "enimidi", "9": "tommidi"},
            {"$": "dolar", "€": "yuro", "£": "pound", "₹": "rupayi", ".": "dhashamsha", "/": "slash", "-": "dash", "%": "shatam"},
        ),
        "th": (
            {"0": "soon", "1": "nueng", "2": "song", "3": "sam", "4": "si", "5": "ha", "6": "hok", "7": "chet", "8": "paet", "9": "kao"},
            {"$": "dollar", "€": "euro", "£": "pound", "₹": "rupee", ".": "chut", "/": "slash", "-": "dash", "%": "percent"},
        ),
        "tr": (
            {"0": "sifir", "1": "bir", "2": "iki", "3": "uc", "4": "dort", "5": "bes", "6": "alti", "7": "yedi", "8": "sekiz", "9": "dokuz"},
            {"$": "dolar", "€": "euro", "£": "sterlin", "₹": "rupi", ".": "virgul", "/": "bolu", "-": "tire", "%": "yuzde"},
        ),
        "uk": (
            {"0": "nul", "1": "odyn", "2": "dva", "3": "try", "4": "chotyry", "5": "pyat", "6": "shist", "7": "sim", "8": "visim", "9": "devyat"},
            {"$": "dolar", "€": "yevro", "£": "funt", "₹": "rupiya", ".": "koma", "/": "slesh", "-": "tyre", "%": "vidsotok"},
        ),
        "ur": (
            {"0": "sifar", "1": "aik", "2": "do", "3": "teen", "4": "char", "5": "panch", "6": "chhe", "7": "saat", "8": "aath", "9": "nau"},
            {"$": "dolar", "€": "euro", "£": "pound", "₹": "rupay", ".": "ashariya", "/": "slash", "-": "dash", "%": "fi sad"},
        ),
        "vi": (
            {"0": "khong", "1": "mot", "2": "hai", "3": "ba", "4": "bon", "5": "nam", "6": "sau", "7": "bay", "8": "tam", "9": "chin"},
            {"$": "do la", "€": "euro", "£": "bang", "₹": "rupee", ".": "phay", "/": "gach cheo", "-": "gach ngang", "%": "phan tram"},
        ),
        "zh-cn": (
            {"0": "ling", "1": "yi", "2": "er", "3": "san", "4": "si", "5": "wu", "6": "liu", "7": "qi", "8": "ba", "9": "jiu"},
            {"$": "mei yuan", "€": "ou yuan", "£": "ying bang", "₹": "lu bi", ".": "dian", "/": "xie gang", "-": "heng gang", "%": "bai fen zhi"},
        ),
        "zh-tw": (
            {"0": "ling", "1": "yi", "2": "er", "3": "san", "4": "si", "5": "wu", "6": "liu", "7": "qi", "8": "ba", "9": "jiu"},
            {"$": "mei yuan", "€": "ou yuan", "£": "ying bang", "₹": "lu bi", ".": "dian", "/": "xie gang", "-": "heng gang", "%": "bai fen zhi"},
        ),
        "hi": (
            {"0": "shunya", "1": "ek", "2": "do", "3": "teen", "4": "char", "5": "paanch", "6": "chhah", "7": "saat", "8": "aath", "9": "nau"},
            {"$": "dolar", "€": "euro", "£": "pound", "₹": "rupaye", ".": "dashamlav", "/": "slash", "-": "dash", "%": "pratishat"},
        ),
    }
    if lang in lexicons:
        return lexicons[lang]

    # For supported languages without custom word maps, use neutral tokenization.
    # This avoids injecting English words while still separating numeric chunks
    # so the TTS model can pronounce digits/symbols in the target language.
    if lang in SUPPORTED_CONTENT_LANGUAGE_CODES:
        neutral_digits = {str(i): str(i) for i in range(10)}
        neutral_symbols = {"$": "$", "€": "€", "£": "£", "₹": "₹", ".": ".", "/": "/", "-": "-", "%": "%"}
        return neutral_digits, neutral_symbols

    return lexicons["en"]


# Spoken word for leading '+' in E.164-style numbers (fallback "plus" works in most TTS locales).
_PLUS_WORD_BY_LANG: dict[str, str] = {
    "en": "plus",
    "de": "plus",
    "fr": "plus",
    "es": "más",
    "it": "più",
    "pt": "mais",
    "nl": "plus",
    "sv": "plus",
    "no": "pluss",
    "da": "plus",
    "fi": "plus",
    "pl": "plus",
    "cs": "plus",
    "hu": "plusz",
    "ro": "plus",
    "el": "syn",
    "ru": "plyus",
    "uk": "plyus",
    "tr": "artı",
    "ar": "plus",
    "he": "plus",
    "hi": "plus",
    "ja": "purasu",
    "ko": "peulloseu",
    "zh-cn": "plus",
    "zh-tw": "plus",
    "vi": "cộng",
    "th": "plus",
    "id": "plus",
    "bn": "plus",
    "ta": "plus",
    "te": "plus",
    "ml": "plus",
    "mr": "plus",
    "pa": "plus",
    "ur": "plus",
    "fa": "plus",
}


def _plus_word_for_language(content_language: str | None) -> str:
    lang = _normalize_language_key(content_language)
    return _PLUS_WORD_BY_LANG.get(lang, "plus")


def _digits_only(s: str) -> str:
    return "".join(ch for ch in s if ch.isdigit())


def _collapse_ws(s: str) -> str:
    return re.sub(r"\s+", "", s)


def _looks_like_date_token(t_nocomma: str) -> bool:
    """True if the token is a common date form (not a phone)."""
    if re.match(r"^\d{4}-\d{2}-\d{2}$", t_nocomma):
        return True
    if re.match(r"^\d{4}-\d{2}$", t_nocomma):
        return True
    if re.match(r"^\d{1,2}/\d{1,2}/\d{2,4}$", t_nocomma):
        return True
    if re.match(r"^\d{1,2}-\d{1,2}-\d{4}$", t_nocomma):
        return True
    if re.match(r"^\d{1,2}\.\d{1,2}\.\d{2,4}$", t_nocomma):
        return True
    return False


def _looks_like_date_span(raw: str) -> bool:
    rs = _collapse_ws(raw)
    return _looks_like_date_token(rs)


def _should_spell_long_straight_number_token(
    t_nocomma: str,
    *,
    had_comma: bool,
    had_leading_currency: bool,
    had_percent_suffix: bool,
) -> bool:
    """Digit-by-digit when total digits > 4 and the token is a simple numeric (dots/dashes ok), not money/dates."""
    if had_comma or had_leading_currency or had_percent_suffix:
        return False
    if _looks_like_date_token(t_nocomma):
        return False
    d = _digits_only(t_nocomma)
    if len(d) <= 4:
        return False
    if not re.match(r"^[\d.\-/]+$", t_nocomma):
        return False
    return True


def _should_spell_loose_phone_span(raw: str) -> bool:
    """True for spaced/parenthesized/+ numbers with >4 digits total, excluding dates/money-style."""
    if not raw or not raw.strip():
        return False
    r = raw.strip()
    if "," in r:
        return False
    body = r[1:].lstrip() if r.startswith("+") else r
    if not body or not re.match(r"^[\d() \t\u00a0.\-/]+$", body):
        return False
    d = _digits_only(r)
    if len(d) <= 4:
        return False
    if _looks_like_date_span(r):
        return False
    rs = _collapse_ws(r)
    if re.match(r"^\d+\.\d+$", rs):
        return False
    return True


# E.164 / NANP-style spans with spaces, parentheses, or slashes (not commas).
_LOOSE_PHONE_SPAN_RE = re.compile(
    r"(?<![A-Za-z0-9+])"
    r"(?:\+\s*[\d() \t\u00a0.\-/]+|"
    r"(?<!\d)\d[\d() \t\u00a0.\-/]{4,}\d)"
    r"(?![A-Za-z0-9+])"
)


def _should_spell_number_token_for_tts(raw: str) -> bool:
    """Digit-by-digit for phones, long IDs, and straight numbers with >4 digits (dots/dashes ok).

    Left natural: 4-digit years, short prices (e.g. 12.50), comma-separated amounts, currency,
    and common date shapes.
    """
    if not raw or not raw.strip():
        return False
    raw_s = raw.strip()
    had_leading_currency = raw_s[0] in "$€£₹"
    had_percent_suffix = raw_s.endswith("%")

    t = raw_s
    if t[0] in "$€£₹":
        t = t[1:]
    if t.endswith("%"):
        t = t[:-1]
    had_comma = "," in t
    t_nocomma = t.replace(",", "")

    # All decimals (e.g. 9.99, 12.50, 9.875, 1234.56): natural — TTS reads them as numbers
    if re.match(r"^\d+\.\d+$", t_nocomma):
        return False

    if _looks_like_date_token(t_nocomma):
        return False

    analysis = t_nocomma[1:] if t_nocomma.startswith("+") else t_nocomma
    if not analysis:
        return False

    if _looks_like_date_token(analysis):
        return False

    d = _digits_only(analysis)
    if not d:
        return False

    if had_comma:
        return False

    if analysis.isdigit() and len(d) == 4:
        y = int(d)
        if 1000 <= y <= 2099:
            return False

    return _should_spell_long_straight_number_token(
        analysis,
        had_comma=had_comma,
        had_leading_currency=had_leading_currency,
        had_percent_suffix=had_percent_suffix,
    )


def _expand_spelled_numeric_token(
    token: str,
    digit_map: dict[str, str],
    symbol_map: dict[str, str],
    plus_word: str,
    *,
    phone_mode: bool,
) -> str:
    """Expand a number/phone token to spaced words for TTS. phone_mode: '.' between digits → dash word."""
    parts: list[str] = []
    t = token.strip()
    if t.startswith("+"):
        parts.append(plus_word)
        t = t[1:].lstrip()
    dash_word = symbol_map.get("-", "-")
    for idx, ch in enumerate(t):
        if ch.isdigit():
            parts.append(digit_map.get(ch, ch))
        elif ch in " \t\n\r\u00a0":
            continue
        elif ch in "()":
            continue
        elif ch == ",":
            continue
        elif ch in symbol_map:
            prev_ch = t[idx - 1] if idx > 0 else ""
            next_ch = t[idx + 1] if idx + 1 < len(t) else ""
            if ch in {".", "/", "-"} and not (prev_ch.isdigit() and next_ch.isdigit()):
                continue
            spoken = symbol_map[ch]
            if phone_mode and ch == ".":
                spoken = dash_word
            parts.append(spoken)
    return " ".join(parts) if parts else token


def _expand_decimals_for_tts(text: str, content_language: str | None = None) -> str:
    """Replace decimal numbers with explicit spoken form so TTS says 'point' not 'thousand'.

    1.5   -> "1 point 5"
    9.875 -> "9 point 875"
    $3.50 -> "$3 point 50"

    Skips dates (2024-01-15, 12/31) since those use hyphens/slashes not dots.
    """
    lang = _normalize_language_key(content_language)
    point_word = {
        "en": "point",
        "fr": "virgule", "de": "Komma", "es": "coma", "it": "virgola",
        "pt": "vírgula", "nl": "komma", "sv": "komma", "da": "komma",
        "no": "komma", "fi": "pilkku", "pl": "przecinek", "cs": "čárka",
        "hu": "vessző", "ro": "virgulă", "ru": "запятая", "uk": "кома",
        "ar": "فاصلة", "hi": "दशमलव", "ja": "テン", "ko": "점",
        "zh-cn": "点", "zh-tw": "點", "tr": "virgül", "el": "κόμμα",
    }.get(lang, "point")

    def _replace(m: re.Match[str]) -> str:
        prefix = m.group(1) or ""
        integer_part = m.group(2)
        decimal_part = m.group(3)
        return f"{prefix}{integer_part} {point_word} {decimal_part}"

    # Optional currency, integer digits, literal dot, decimal digits.
    # Lookbehind/ahead prevent matching inside words or slash-separated dates.
    pattern = (
        r"(?<![A-Za-z0-9/\-])"
        r"([\$€£₹]?)"
        r"(\d+)"
        r"\."
        r"(\d+)"
        r"(?![A-Za-z0-9/\-])"
    )
    return re.sub(pattern, _replace, text)


def _spell_digits_for_tts(text: str, content_language: str | None = None) -> str:
    """Expand phone-like spans and straight numbers (>4 digits) digit-by-digit for TTS.

    Digit-by-digit: +44 20 …, 800 555 1212, 12345, 12.345, 1-2-3-4-5, +3531…

    Natural: 4-digit years, totals with ≤4 digits (e.g. 12.50), dates, $/€ amounts, commas,
    percentages.
    """
    if not text:
        return text

    text = _expand_decimals_for_tts(text, content_language)

    digit_map, symbol_map = _number_lexicon(content_language)
    plus_word = _plus_word_for_language(content_language)

    def _replace_loose(m: re.Match[str]) -> str:
        raw = m.group(0).strip()
        if not _should_spell_loose_phone_span(raw):
            return m.group(0)
        return _expand_spelled_numeric_token(
            raw, digit_map, symbol_map, plus_word, phone_mode=True
        )

    text = _LOOSE_PHONE_SPAN_RE.sub(_replace_loose, text)

    def _replace_compact(m: re.Match[str]) -> str:
        raw = m.group(0)
        if not _should_spell_number_token_for_tts(raw):
            return raw
        return _expand_spelled_numeric_token(
            raw, digit_map, symbol_map, plus_word, phone_mode=True
        )

    # Standalone numeric chunks: optional +, currency, separators; avoid touching alphanumerics.
    pattern = (
        r"(?<![A-Za-z0-9+])"
        r"(?:\+\d[\d,./-]*|"
        r"[\$€£₹]?\d[\d,./-]*)"
        r"%?(?![A-Za-z0-9])"
    )
    return re.sub(pattern, _replace_compact, text)


def _spell_abbreviations_for_tts(text: str) -> str:
    """Spell all-caps abbreviations letter-by-letter for clearer TTS output.

    Examples:
    - AI -> "A I"
    - NASA -> "N A S A"
    - U.S.A. -> "U S A"
    """
    if not text:
        return text

    # Dotted abbreviations first (U.S., U.S.A., etc.)
    def _replace_dotted(match: re.Match[str]) -> str:
        token = match.group(0)
        letters = [ch for ch in token if ch.isalpha()]
        return " ".join(letters)

    text = re.sub(r"\b(?:[A-Z]\.){2,}[A-Z]?\b\.?", _replace_dotted, text)

    # Plain all-caps words (2+ chars), but skip common Roman numerals.
    roman_numerals = {
        "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
        "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    }

    def _replace_caps(match: re.Match[str]) -> str:
        token = match.group(0)
        if token in roman_numerals:
            return token
        return " ".join(list(token))

    return re.sub(r"\b[A-Z]{2,}\b", _replace_caps, text)


def generate_voiceover(scene: Scene, db: Session, use_expanded: bool = False) -> str:
    """
    Generate voiceover audio for a scene using ElevenLabs TTS.
    After generation, updates scene.duration_seconds to audio length + 1s.
    If voice_gender is "none", skips TTS and estimates duration from word count.
    Retries on connection errors.
    
    If use_expanded is True, expands narration_text into detailed voiceover before generating audio.

    Returns:
        str: Local path to the generated audio file (empty string if no audio)
    """
    # Skip scenes with no narration (e.g. hero opening)
    if not scene.narration_text or not scene.narration_text.strip():
        return ""

    # Determine voice from project preferences
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    voice_id = _get_voice_id(project) if project else None
    voice_settings = _voice_settings_for_video_style(getattr(project, "video_style", None) if project else None)
    if project:
        configured_custom = getattr(project, "custom_voice_id", None)
        configured_custom = configured_custom.strip() if isinstance(configured_custom, str) else None
        voice_meta = _fetch_voice_meta(voice_id) if voice_id else None
        labels = voice_meta.get("labels", {}) if isinstance(voice_meta, dict) else {}
        logger.info(
            "[VOICEOVER] Scene %s voice resolution: resolved=%s source=%s project_custom=%s gender=%s accent=%s voice_name=%s voice_category=%s voice_labels=%s",
            scene.order,
            voice_id,
            "custom" if configured_custom else "map",
            configured_custom,
            getattr(project, "voice_gender", None),
            getattr(project, "voice_accent", None),
            voice_meta.get("name") if isinstance(voice_meta, dict) else None,
            voice_meta.get("category") if isinstance(voice_meta, dict) else None,
            labels if isinstance(labels, dict) else {},
            extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
        )

    # Use narration_text directly (it should already be expanded if needed)
    voiceover_text = scene.narration_text
    if not voiceover_text or not voiceover_text.strip():
        return ""
    content_language = getattr(project, "content_language", None) if project else None
    voiceover_text = _spell_digits_for_tts(voiceover_text, content_language)
    voiceover_text = _spell_abbreviations_for_tts(voiceover_text)

    # Advanced Options (paid): when voice tuning is set, route this project through the expressive
    # v3 model, inject the [excited] tag per sentence, and apply the user's Strength + Speed.
    # Strength is creativity-forward: higher Strength → MORE creative, so it maps to a LOWER v3
    # stability preset (v3 stability 0.0 = Creative … 1.0 = Robust). Hence stability = 1 - strength.
    tuning = _parse_voice_tuning(getattr(project, "voice_emotion", None) if project else None)
    model_id = TTS_MODEL_DEFAULT
    if tuning is not None:
        strength, speed, emotion, style = tuning
        model_id = TTS_MODEL_EXPRESSIVE
        voiceover_text = _inject_emotion_tag(voiceover_text, emotion)
        voice_settings = {
            "stability": _snap_v3_stability(1.0 - strength),
            "style": style,
            "speed": speed,
            "use_speaker_boost": True,
        }
        logger.info(
            "[VOICEOVER] Scene %s expressive mode: model=%s emotion=%s strength=%s stability=%s style=%s speed=%s",
            scene.order,
            model_id,
            emotion or "none",
            strength,
            voice_settings["stability"],
            style,
            speed,
            extra={"project_id": scene.project_id},
        )

    # No-audio mode: estimate duration from word count, skip TTS
    if voice_id is None:
        word_count = len(voiceover_text.split())
        estimated_duration = max(5.0, word_count / WORDS_PER_SECOND)
        scene.duration_seconds = round(
            max(settings.MIN_SCENE_DURATION_SECONDS, estimated_duration + DURATION_PAD), 1
        )
        scene.voiceover_path = None
        db.commit()
        logger.info(
            "[VOICEOVER] Scene %s: no-audio mode, estimated %ss from %s words",
            scene.order,
            scene.duration_seconds,
            word_count,
            extra={"project_id": scene.project_id},
        )
        return ""

    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    audio_dir = os.path.join(
        settings.MEDIA_DIR, f"projects/{scene.project_id}/audio"
    )
    os.makedirs(audio_dir, exist_ok=True)

    filename = f"scene_{scene.order}.mp3"
    output_path = os.path.join(audio_dir, filename)

    def _try_tts(vid: str) -> None:
        """Run TTS with given voice_id; writes to output_path and updates scene. Raises on failure."""
        audio_generator = client.text_to_speech.convert(
            text=voiceover_text,
            voice_id=vid,
            model_id=model_id,
            output_format="mp3_44100_128",
            voice_settings=voice_settings,
        )
        with open(output_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)
        audio_duration = _get_audio_duration(output_path)
        scene.duration_seconds = round(
            max(settings.MIN_SCENE_DURATION_SECONDS, audio_duration + DURATION_PAD), 1
        )
        scene.voiceover_path = output_path
        db.commit()
        r2_key_val = None
        r2_url_val = None
        if r2_storage.is_r2_configured():
            try:
                uid = scene.project.user_id
                r2_url_val = r2_storage.upload_project_audio(
                    uid, scene.project_id, output_path, filename
                )
                r2_key_val = r2_storage.audio_key(uid, scene.project_id, filename)
            except Exception as e:
                logger.warning(
                    "[VOICEOVER] R2 upload failed for %s: %s",
                    filename,
                    e,
                    extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
                )
        asset = Asset(
            project_id=scene.project_id,
            asset_type=AssetType.AUDIO,
            original_url=None,
            local_path=output_path,
            filename=filename,
            r2_key=r2_key_val,
            r2_url=r2_url_val,
        )
        db.add(asset)
        db.commit()
        logger.info(
            "[VOICEOVER] Scene %s: audio=%.1fs, scene=%ss",
            scene.order,
            audio_duration,
            scene.duration_seconds,
            extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
        )

    def _is_voice_not_found(err: Exception) -> bool:
        s = str(err).lower()
        return "voice_not_found" in s or ("404" in s and "voice" in s)

    last_error = None
    used_custom = bool(
        project
        and isinstance(getattr(project, "custom_voice_id", None), str)
        and getattr(project, "custom_voice_id").strip()
    )
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            _try_tts(voice_id)
            return output_path
        except Exception as e:
            last_error = e
            logger.warning(
                "[VOICEOVER] Scene %s attempt %s/%s failed: %s",
                scene.order,
                attempt,
                MAX_RETRIES,
                e,
                extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
            )
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)

    # If custom voice was not found (404), retry once with premade fallback
    if last_error and used_custom and _is_voice_not_found(last_error):
        fallback_id = DEFAULT_VOICE_ID
        if project:
            key = (
                getattr(project, "voice_gender", "male"),
                getattr(project, "voice_accent", "american"),
            )
            fallback_id = VOICE_MAP.get(key, DEFAULT_VOICE_ID)
        logger.warning(
            "[VOICEOVER] Scene %s: custom voice not found, falling back to premade (%s)",
            scene.order,
            fallback_id,
            extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
        )
        try:
            _try_tts(fallback_id)
            return output_path
        except Exception as fallback_err:
            logger.error(
                "[VOICEOVER] Scene %s fallback TTS failed: %s",
                scene.order,
                fallback_err,
                extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
            )
            raise fallback_err from last_error

    raise last_error  # type: ignore


async def generate_all_voiceovers(
    scenes: list[Scene],
    db: Session,
    video_style: str | None = None,
    content_language: str = "English",
    verbatim: bool = False,
    progress_cb: "Callable[[], None] | None" = None,
    expressive: bool = False,
) -> list[str]:
    """Generate voiceover audio for all scenes concurrently.

    Phase A: Expand narration texts in parallel (Claude LLM calls, semaphore=4).
    Phase B: Generate TTS audio concurrently (ElevenLabs, semaphore=2, each in
             its own DB session via run_in_executor since the SDK is sync).

    The expanded text is persisted into ``scene.narration_text`` so the script
    shown in the editor always matches the spoken voiceover word-for-word.

    When ``verbatim`` is True, Phase A is skipped entirely and each scene's
    existing ``narration_text`` is spoken as-is (used when changing the project
    voice, where the narration is already final and must stay same-to-same).

    ``progress_cb`` is invoked once per scene as its audio finishes, so callers
    can drive a scene-by-scene progress bar.

    video_style (explainer | promotional | storytelling) shapes expansion tone.
    """
    from app.dspy_modules.voiceover_expand import expand_narration_to_voiceover
    from app.database import SessionLocal

    style = (video_style or "explainer").strip().lower() or "explainer"

    # ── Phase A: Parallel LLM expansion (skipped in verbatim mode) ─
    if verbatim:
        expanded_texts: list = [s.narration_text or "" for s in scenes]
    else:
        expand_sem = asyncio.Semaphore(4)

        async def _expand(scene: Scene) -> str:
            if not scene.narration_text or not scene.narration_text.strip():
                return scene.narration_text or ""
            async with expand_sem:
                return await expand_narration_to_voiceover(
                    scene.narration_text, scene.title, video_style=style,
                    content_language=content_language, expressive=expressive,
                )

        expanded_texts = await asyncio.gather(
            *[_expand(s) for s in scenes], return_exceptions=True
        )
        # Replace exceptions with original text
        for i, result in enumerate(expanded_texts):
            if isinstance(result, Exception):
                logger.warning(
                    "[VOICEOVER] Expand failed for scene %s: %s",
                    scenes[i].order,
                    result,
                    extra={"project_id": scenes[i].project_id},
                )
                expanded_texts[i] = scenes[i].narration_text or ""

    # ── Phase B: Concurrent TTS (semaphore=2, per-thread DB session) ─
    tts_sem = asyncio.Semaphore(2)
    loop = asyncio.get_event_loop()

    def _tts_in_thread(scene_id: int, expanded_text: str, scene_order: int) -> str:
        """Run TTS in a thread with its own DB session."""
        tts_db = SessionLocal()
        try:
            scene = tts_db.query(Scene).filter(Scene.id == scene_id).first()
            if not scene:
                return ""
            # Persist the expanded text so the on-screen narration script always
            # matches the spoken voiceover. In verbatim mode expanded_text is just
            # the existing narration_text, so this is a no-op write.
            scene.narration_text = expanded_text
            tts_db.commit()

            path = generate_voiceover(scene, tts_db, use_expanded=False)
            return path
        except Exception as e:
            logger.error(
                "[VOICEOVER] TTS failed for scene %s: %s",
                scene_order,
                e,
            )
            try:
                tts_db.rollback()
            except Exception:
                pass
            return ""
        finally:
            tts_db.close()

    async def _bounded_tts(scene: Scene, expanded_text: str) -> str:
        async with tts_sem:
            result = await loop.run_in_executor(
                None, _tts_in_thread, scene.id, expanded_text, scene.order
            )
            if progress_cb is not None:
                try:
                    progress_cb()
                except Exception:
                    pass
            return result

    paths_raw = await asyncio.gather(
        *[_bounded_tts(s, t) for s, t in zip(scenes, expanded_texts)],
        return_exceptions=True,
    )

    # ── Collect results ──────────────────────────────────────────
    paths: list[str] = []
    for i, p in enumerate(paths_raw):
        if isinstance(p, Exception):
            logger.error(
                "[VOICEOVER] Scene %s TTS error: %s",
                scenes[i].order,
                p,
                extra={"project_id": scenes[i].project_id},
            )
            paths.append("")
        else:
            paths.append(p or "")

    return paths
