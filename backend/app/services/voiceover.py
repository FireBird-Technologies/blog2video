import asyncio
import os
import re
import time
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
DURATION_PAD = 1.0  # extra seconds added to voiceover duration for scene

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


def _get_voice_id(project: Project) -> str | None:
    gender = getattr(project, "voice_gender", "female")
    if gender == "none":
        return None

    custom = getattr(project, "custom_voice_id", None)
    custom_str = custom.strip() if isinstance(custom, str) else None
    if custom_str:
        return custom_str

    accent = getattr(project, "voice_accent", "american")
    return VOICE_MAP.get((gender, accent), DEFAULT_VOICE_ID)


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


def _spell_digits_for_tts(text: str, content_language: str | None = None) -> str:
    """Force numbers to be read clearly, digit-by-digit with separator words.

    Examples:
    - 2026 -> "2 0 2 6"
    - 12.50 -> "1 2 point 5 0"
    - 2026-03-24 -> "2 0 2 6 dash 0 3 dash 2 4"
    - $199 -> "dollar 1 9 9"
    """
    if not text:
        return text

    digit_map, symbol_map = _number_lexicon(content_language)

    def _expand_numeric_token(token: str) -> str:
        parts: list[str] = []
        for idx, ch in enumerate(token):
            if ch.isdigit():
                parts.append(digit_map.get(ch, ch))
            elif ch in symbol_map:
                # Speak separators only when they are between digits.
                # This avoids saying "point" for trailing punctuation like "2026."
                prev_ch = token[idx - 1] if idx > 0 else ""
                next_ch = token[idx + 1] if idx + 1 < len(token) else ""
                if ch in {".", "/", "-"} and not (prev_ch.isdigit() and next_ch.isdigit()):
                    continue
                parts.append(symbol_map[ch])
            elif ch == ",":
                # Ignore thousands separators so 10,000 -> 1 0 0 0 0
                continue
        return " ".join(parts) if parts else token

    def _replace(match: re.Match[str]) -> str:
        return _expand_numeric_token(match.group(0))

    # Match standalone numeric-like chunks to avoid rewriting alphanumeric words.
    # Supports currency prefix, separators (.,/,-), and percent suffix.
    pattern = r"(?<![A-Za-z0-9])[\$€£₹]?\d[\d,./-]*%?(?![A-Za-z0-9])"
    return re.sub(pattern, _replace, text)


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
            model_id="eleven_multilingual_v2",
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
    scenes: list[Scene], db: Session, video_style: str | None = None, content_language: str = "English"
) -> list[str]:
    """Generate voiceover audio for all scenes concurrently.

    Phase A: Expand narration texts in parallel (Claude LLM calls, semaphore=4).
    Phase B: Generate TTS audio concurrently (ElevenLabs, semaphore=2, each in
             its own DB session via run_in_executor since the SDK is sync).

    video_style (explainer | promotional | storytelling) shapes expansion tone.
    """
    from app.dspy_modules.voiceover_expand import expand_narration_to_voiceover
    from app.database import SessionLocal

    style = (video_style or "explainer").strip().lower() or "explainer"

    # ── Phase A: Parallel LLM expansion ──────────────────────────
    expand_sem = asyncio.Semaphore(4)

    async def _expand(scene: Scene) -> str:
        if not scene.narration_text or not scene.narration_text.strip():
            return scene.narration_text or ""
        async with expand_sem:
            return await expand_narration_to_voiceover(
                scene.narration_text, scene.title, video_style=style, content_language=content_language
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
            original = scene.narration_text
            scene.narration_text = expanded_text
            tts_db.commit()

            path = generate_voiceover(scene, tts_db, use_expanded=False)

            # Restore original narration_text
            scene.narration_text = original
            tts_db.commit()
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
            return await loop.run_in_executor(
                None, _tts_in_thread, scene.id, expanded_text, scene.order
            )

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
