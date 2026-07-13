"""Strict, structure-preserving translation of scene content.

Used by the change-language job to rewrite a project's on-screen and narration text
into a new language **without touching layout, images, colors, numbers, or links**.

Scene visual props live as JSON in ``Scene.remotion_code`` — a descriptor shaped
``{"layout": <id>, "layoutProps": {...}}`` (the column name is historical; it holds
JSON, not JSX). Translating "layout props" therefore means rewriting *string leaves*
inside that object while keeping every key, every number, and every identifier intact.

Deciding which leaves are text is done in three passes, in this order:

1. **Denylist** — keys that are identifiers/URLs/colors are never translated, even when
   the template schema types them as ``string``. This pass is load-bearing, not a
   safety net: ``websiteLink`` is declared ``type: "string"`` in several built-in
   templates, so trusting the schema alone would translate a URL.
2. **Schema** — ``meta.json → layout_prop_schema[layout].fields`` gives typed fields
   (``string``/``text`` translate; ``number``/``boolean``/``select``/``color``/
   ``chart_table``/``ticker_table`` do not). ``select`` values are render-time enums.
3. **Prose fallback** — schemas are incomplete. ``nightfall/cinematic_title`` declares
   only font-size fields, yet renders a title and body at runtime. So an unschema'd
   string key is translated when it *looks like prose* (see ``_looks_like_prose``).

Arrays get element-level treatment: ``string_array`` is translated only when the key
isn't a known code/identifier list (``codeLines`` is source code), and ``object_array``
subfields are filtered by subkey (translate ``label``, keep ``value``/``suffix``).
"""

from __future__ import annotations

import re
from typing import Any

from app.observability.logging import get_logger

logger = get_logger(__name__)

# A path to a translatable leaf inside layoutProps: a tuple of dict keys / list indices.
Path = tuple[Any, ...]


# ─────────────────────────────── denylists ───────────────────────────────

# Exact prop keys that must never be translated, regardless of schema type.
# Sourced from real descriptors (see routers/pipeline.py ending_socials block) and
# from the string-typed fields across backend/templates/*/meta.json.
_DENY_KEYS: frozenset[str] = frozenset({
    # image / media assignment
    "assignedImage", "imageUrl", "imageSrc", "image", "src", "backgroundImage",
    "logoUrl", "iconUrl", "icon", "avatar", "poster",
    # links
    "websiteLink", "secondaryWebsiteLink", "websiteUrl", "websiteDomain", "link", "url", "href",
    # socials / handles are account identifiers, not prose
    "socials", "handles", "handle", "username",
    # code & code metadata
    "codeLines", "codeLanguage", "code",
    # Chart/series payloads and type discriminators. NOTE: `chartTable` / `tickerTable`
    # are deliberately NOT denied — their `headers` and row cells mix prose ("Step",
    # "Action", "GOLD PURITY", "Paste your URL") with data ("Rs. 431,600", "24K", "Q1").
    # We recurse into them and let ``is_translatable_value`` decide cell by cell.
    "chartType", "contentType", "structuredContent",
    "data", "series", "columns", "datasets",
    # tickers / symbols are identifiers
    "marketSymbol", "symbol", "ticker",
    # single glyphs / monograms — translating them destroys the design
    "monogramLetter", "illuminatedLetter", "chapterKanji", "leftKanji", "rightKanji",
    "kanjiTitle", "quoteRoman", "romanTitle",
})

# Suffix patterns (case-insensitive) for keys that are never prose.
_DENY_SUFFIXES: tuple[str, ...] = (
    "url", "link", "href", "color", "colour", "image", "src",
    "id", "key", "token", "fontsize", "size", "opacity", "width", "height",
)

# Schema field types that carry translatable prose.
_TEXT_TYPES: frozenset[str] = frozenset({"string", "text"})

# Schema field types that never carry prose. ``select`` values are render-time enums.
# ``chart_table``/``ticker_table`` are NOT listed: they are containers whose headers and
# cells mix prose with data, so they get walked and judged leaf by leaf.
_NON_TEXT_TYPES: frozenset[str] = frozenset({
    "number", "boolean", "select", "color",
})

# Schema field types that are containers to recurse into rather than translate directly.
_CONTAINER_TYPES: frozenset[str] = frozenset({
    "object_array", "string_array", "array", "chart_table", "ticker_table", "object",
})

# object_array subfield keys that are NEVER prose, regardless of content.
#
# This is a denylist rather than a whitelist because the same subkey means different
# things per layout: `keyPoints[].value` / `points[].value` hold whole sentences, while
# `metrics[].value` / `stats[].value` hold "$251B". Name alone can't decide — so we deny
# the structural/identifier subkeys here and let ``is_translatable_value`` judge the rest
# by content (it rejects numbers, currency, percentages, URLs, colors, and glyphs).
#
# Subkeys observed across backend/templates/*/meta.json object_arrays:
#   label value lead body q a desc detail sub number icon description title text
#   platform enabled suffix delta compareValue compareLabel valuesStr headers rows
#   ctaButtonText websiteLink showWebsiteButton
_ARRAY_DENY_SUBKEYS: frozenset[str] = frozenset({
    # rendering flags / enums
    "enabled", "showWebsiteButton", "platform", "icon",
    # numeric or unit-bearing companions of a prose sibling
    "suffix", "delta", "number", "compareValue", "valuesStr",
})

# Values that are pure data even when they sit under a prose-y key.
_URL_RE = re.compile(r"^\s*(https?://|www\.|mailto:|/|#)", re.I)
_HEX_COLOR_RE = re.compile(r"^\s*#?[0-9a-f]{3,8}\s*$", re.I)
# Numbers, currency, percentages, deltas: "$251B", "-2.4%", "1,204", "12x", "3:45"
_NUMERIC_TOKEN_RE = re.compile(
    r"^\s*[+\-]?[$€£¥]?\s*[\d][\d,._:]*\s*(%|[kmbtx]|bn|mn)?\s*[$€£¥]?\s*$", re.I
)

# Data cells that DO contain letters but are still not prose. These show up constantly in
# chartTable/tickerTable rows, where translating them would corrupt the rendered table.
#
# Each pattern must match the ENTIRE string — "Gold 24K Tola" is a real column header and
# must stay translatable, while the bare cell "24K" must not.
_DATA_TOKEN_RES: tuple[re.Pattern[str], ...] = (
    # Currency with a KNOWN symbol/code prefix or suffix: "Rs. 431,600", "USD 1,204", "12,000 PKR".
    # The alpha part must be an actual currency token — a generic `[a-z]{1,4}` would swallow
    # real headers like "PER 10 GRAM".
    re.compile(
        r"^\s*(?:(?:rs|usd|eur|gbp|pkr|inr|aed|jpy|cny|cad|aud|chf)\.?\s*|[$€£¥₹])?\s*"
        r"[+\-]?[\d][\d,._]*\s*"
        r"(?:(?:rs|usd|eur|gbp|pkr|inr|aed|jpy|cny|cad|aud|chf)\.?|[$€£¥₹])?\s*$",
        re.I,
    ),
    # Dates: "Jul 01, 26", "Jun 30, 2026", "2026-07-01", "01/07/26"
    re.compile(
        r"^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*\d{2,4}\s*$",
        re.I,
    ),
    re.compile(r"^\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\s*$"),
    # Short alphanumeric codes / grades / periods: "Q1", "24K", "18K", "H2", "FY26", "AAPL"
    re.compile(r"^\s*[a-z]{0,3}\d{1,4}[a-z]{0,2}\s*$", re.I),
    # Amounts with a spelled-out magnitude: "$1.2 billion", "3.6 million", "$1.145 T".
    # The magnitude word is a unit here, not prose — handing it to an LLM risks the
    # number being rewritten or re-formatted along with it.
    re.compile(
        r"^\s*[+\-]?[$€£¥₹]?\s*[\d][\d,._]*\s*"
        r"(?:t|k|m|b|bn|mn|thousand|million|billion|trillion|lakh|crore)\.?\s*$",
        re.I,
    ),
    # Bare filenames / asset identifiers that appear as table cells, e.g.
    # "20210225_052918_ss01_u0001_pansharpened_clip.png". Not caught by _URL_RE.
    re.compile(r"^\s*\S+\.(?:png|jpe?g|gif|webp|svg|mp4|mp3|wav|pdf|csv|json|tif{1,2})\s*$", re.I),
    # snake_case machine identifiers, e.g. "ssc14_u0005". Underscores only — a hyphen
    # rule would swallow real prose like "state-of-the-art".
    re.compile(r"^\s*[a-z0-9]+(?:_[a-z0-9]+)+\s*$", re.I),
)

# Anything with no letters at all (punctuation, arrows, glyphs).
_HAS_LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)


def _is_data_token(text: str) -> bool:
    """True when the whole string is a data cell (currency, date, code) rather than prose."""
    return any(rx.match(text) for rx in _DATA_TOKEN_RES)


def _key_is_denied(key: str) -> bool:
    if key in _DENY_KEYS:
        return True
    lowered = key.lower()
    return lowered.endswith(_DENY_SUFFIXES)


def is_translatable_value(value: Any) -> bool:
    """True when ``value`` is a string carrying human-readable prose.

    Rejects URLs, hex colors, pure numeric/currency tokens, and letterless strings —
    ``"$251B"`` stays put while its sibling label ``"Total flows"`` is translated.
    """
    if not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped:
        return False
    if _URL_RE.search(stripped):
        return False
    if _HEX_COLOR_RE.match(stripped):
        return False
    if _NUMERIC_TOKEN_RE.match(stripped):
        return False
    if _is_data_token(stripped):
        return False
    if not _HAS_LETTER_RE.search(stripped):
        return False
    return True


def _looks_like_prose(key: str, value: Any) -> bool:
    """Fallback for keys absent from the layout schema.

    Template schemas are incomplete — ``nightfall/cinematic_title`` declares only
    font-size fields yet renders title/body text. Treat an unschema'd string as prose
    when it passes the value checks and isn't a single all-caps identifier token
    (e.g. ``"AAPL"``).
    """
    if _key_is_denied(key) or not is_translatable_value(value):
        return False
    stripped = str(value).strip()
    # A lone ALL-CAPS token with no spaces is almost certainly a symbol/acronym.
    if " " not in stripped and stripped.isupper() and len(stripped) <= 6:
        return False
    return True


# ─────────────────────────── prop tree traversal ───────────────────────────


def _field_types(layout: str, schema: dict | None) -> dict[str, str]:
    """Map ``prop key -> schema type`` for one layout. Empty when no schema exists."""
    layout_meta = ((schema or {}).get(layout) or {})
    out: dict[str, str] = {}
    for field in layout_meta.get("fields", []) or []:
        if isinstance(field, dict) and "key" in field:
            # Responsive font-size sliders are numbers regardless of declared type.
            if field.get("responsive"):
                out[field["key"]] = "number"
            else:
                out[field["key"]] = field.get("type", "string")
    return out


def _collect_from_container(value: Any, key: str, base: Path, out: list[Path]) -> None:
    """Recurse into a list/dict prop value, appending paths to prose leaves."""
    if isinstance(value, str):
        if is_translatable_value(value):
            out.append(base)
        return

    if isinstance(value, list):
        for i, item in enumerate(value):
            if isinstance(item, str):
                if is_translatable_value(item):
                    out.append(base + (i,))
            elif isinstance(item, list):
                # Nested list, e.g. a chartTable/tickerTable row (list of cells).
                _collect_from_container(item, key, base + (i,), out)
            elif isinstance(item, dict):
                for sub_key, sub_val in item.items():
                    if sub_key in _ARRAY_DENY_SUBKEYS or _key_is_denied(sub_key):
                        continue
                    if isinstance(sub_val, (list, dict)):
                        # e.g. nested option lists inside a card/step item
                        _collect_from_container(sub_val, sub_key, base + (i, sub_key), out)
                    elif is_translatable_value(sub_val):
                        out.append(base + (i, sub_key))
        return

    if isinstance(value, dict):
        for sub_key, sub_val in value.items():
            if _key_is_denied(sub_key):
                continue
            _collect_from_container(sub_val, sub_key, base + (sub_key,), out)


def collect_translatable_props(layout: str, props: dict, schema: dict | None) -> list[Path]:
    """Return paths (into ``props``) of every leaf that should be translated.

    ``schema`` is ``meta.json["layout_prop_schema"]`` for the scene's template, i.e.
    keyed by layout id. Order is deterministic (dict insertion order) so that
    ``apply_translations`` can zip results back positionally.
    """
    if not isinstance(props, dict):
        return []

    types = _field_types(layout, schema)
    paths: list[Path] = []

    for key, value in props.items():
        if _key_is_denied(key):
            continue

        declared = types.get(key)

        if declared in _NON_TEXT_TYPES:
            continue

        if declared in _TEXT_TYPES:
            if is_translatable_value(value):
                paths.append((key,))
            continue

        if declared in _CONTAINER_TYPES:
            _collect_from_container(value, key, (key,), paths)
            continue

        # Unschema'd key: nested containers get walked, scalars get the prose heuristic.
        if isinstance(value, (list, dict)):
            _collect_from_container(value, key, (key,), paths)
        elif _looks_like_prose(key, value):
            paths.append((key,))

    return paths


def get_values_at(props: dict, paths: list[Path]) -> list[str]:
    """Read the string leaf at each path."""
    values: list[str] = []
    for path in paths:
        cur: Any = props
        for step in path:
            cur = cur[step]
        values.append(cur)
    return values


def apply_translations(props: dict, paths: list[Path], values: list[str]) -> dict:
    """Return a deep-ish copy of ``props`` with each path replaced by its new value.

    Mutates only the containers along each path, so untouched branches (images, chart
    data, colors) keep their exact original objects. Length mismatch is a programming
    error — raise rather than silently corrupt a descriptor.
    """
    if len(paths) != len(values):
        raise ValueError(f"paths/values length mismatch: {len(paths)} != {len(values)}")

    import copy

    out = copy.deepcopy(props)
    for path, new_value in zip(paths, values):
        cur: Any = out
        for step in path[:-1]:
            cur = cur[step]
        cur[path[-1]] = new_value
    return out


def translate_descriptor(
    descriptor: dict,
    target_language: str,
    schema: dict | None,
    translate_fn,
    *,
    context: str = "",
) -> dict:
    """Translate the prose leaves of one scene descriptor in place-by-copy.

    ``layout`` and every non-prose leaf are preserved byte-for-byte. ``translate_fn``
    takes ``(texts, target_language, context)`` and must return a same-length list.
    On any failure the ORIGINAL descriptor is returned unchanged — a language change
    must never corrupt a scene's visuals.
    """
    if not isinstance(descriptor, dict):
        return descriptor

    layout = descriptor.get("layout") or ""
    props = descriptor.get("layoutProps")
    if not isinstance(props, dict) or not props:
        return descriptor

    paths = collect_translatable_props(str(layout), props, schema)
    if not paths:
        return descriptor

    originals = get_values_at(props, paths)
    try:
        translated = translate_fn(originals, target_language, context=context)
    except Exception:
        logger.exception("[LANG] descriptor translation failed for layout=%s; keeping original", layout)
        return descriptor

    if not isinstance(translated, list) or len(translated) != len(originals):
        logger.warning(
            "[LANG] translator returned %s items for %s inputs (layout=%s); keeping original",
            len(translated) if isinstance(translated, list) else "non-list",
            len(originals),
            layout,
        )
        return descriptor

    # Fall back per-item: never write an empty/non-string over real copy.
    safe = [
        t if isinstance(t, str) and t.strip() else o
        for t, o in zip(translated, originals)
    ]

    out = dict(descriptor)
    out["layoutProps"] = apply_translations(props, paths, safe)
    return out
