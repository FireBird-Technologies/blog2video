"""Opt-in layout policy for built-in templates (`layout_policy` in meta.json).

Two jobs, both pure (no LLM, no DB):

- **Props contract** — `normalize_and_check` holds a layout's props to the
  `minItems` / `maxItems` already declared in `layout_prop_schema`, so a list layout
  can never reach the renderer empty or half-filled.
- **Variety** — `balance_layouts` spreads layouts across the video: nothing repeats
  back to back, no layout dominates, and a layout that needs something the scene does
  not have (a table, numbers, a quotation) is replaced by one that fits any scene.

A template without `layout_policy` is untouched by everything here.

Policy keys:
  required       {layout: [prop, ...]}          props that must be filled
  item_required  {layout: {prop: [key, ...]}}   keys every object item must carry
  paired_lists   {layout: [prop, prop]}         lists that must be the same length
  repairable     [layout, ...]                  may be refilled from the article
  always_fill    [layout, ...]                  refilled from the article on first generation
  auto_pick      [layout, ...]                  fit any scene; used as replacements
  text_layouts   [layout, ...]                  need no props; used when a fill fails
  needs          {layout: "table"|"numbers"|"quote"}
  limits         {layout: {"share": 0.15, "min_gap": 3}}
"""

import math
import re
from typing import Any

from app.services.template_service import get_meta, get_hero_layout, is_custom_template

TABLE_HINT_MARKER = "TABLE_DATA_HINT_JSON"
ENDING_LAYOUT = "ending_socials"

_NUMBER_WORDS = (
    "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|"
    "sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|"
    "ninety|hundred|thousand|million|billion|trillion"
)
_NUMBER_RE = re.compile(
    rf"\d[\d.,]*|\b(?:{_NUMBER_WORDS})(?:[\s-]+(?:{_NUMBER_WORDS}))*\b", re.IGNORECASE
)
# A quotation of at least four words; shorter quoted text is usually a label.
_QUOTE_RE = re.compile(r"[\"“„«「](?:[^\"”“»」\s]+\s+){3,}[^\"”“»」]+[\"”“»」]|「[^」]{8,}」")


def get_layout_policy(template_id: str) -> dict[str, Any] | None:
    """The template's policy, or None when it has not opted in."""
    if not template_id or is_custom_template(template_id):
        return None
    policy = (get_meta(template_id) or {}).get("layout_policy")
    return policy if isinstance(policy, dict) else None


# ─── Props contract ───────────────────────────────────────────────────────────


def _fields(template_id: str, layout: str) -> dict[str, dict]:
    schema = ((get_meta(template_id) or {}).get("layout_prop_schema") or {}).get(layout) or {}
    return {f["key"]: f for f in schema.get("fields", []) if isinstance(f, dict) and f.get("key")}


def fillable_fields(template_id: str, layout: str) -> list[dict]:
    """The content fields of a layout, for the fill prompt (no font sizes or seed)."""
    skip = {"titleFontSize", "descriptionFontSize", "seed"}
    return [f for key, f in _fields(template_id, layout).items() if key not in skip]


def _as_text(item: Any) -> str:
    if isinstance(item, dict):
        for key in ("value", "text", "label", "point", "title"):
            if str(item.get(key) or "").strip():
                return str(item[key]).strip()
        return ""
    return str(item if item is not None else "").strip()


def _clean_strings(raw: Any) -> list[str]:
    if isinstance(raw, str):
        raw = [line.strip(" \t•*·-–—") for line in raw.splitlines()]
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        text = _as_text(item)
        if text and text.lower() not in seen:
            seen.add(text.lower())
            out.append(text)
    return out


def normalize_and_check(template_id: str, layout: str, props: dict | None) -> tuple[dict, list[str]]:
    """Clean a layout's props and list what is still missing (empty list = good)."""
    out = dict(props or {})
    policy = get_layout_policy(template_id)
    required = (policy or {}).get("required", {}).get(layout)
    if not required:
        return out, []

    fields = _fields(template_id, layout)
    item_required = policy.get("item_required", {}).get(layout, {})
    limits: dict[str, int] = {}

    for key in required:
        field = fields.get(key, {})
        ftype = field.get("type", "string")
        if ftype == "string_array":
            out[key] = _clean_strings(out.get(key))
        elif ftype == "object_array":
            raw = out.get(key)
            keys = item_required.get(key, [])
            out[key] = [
                item
                for item in (raw if isinstance(raw, list) else [])
                if isinstance(item, dict) and all(str(item.get(k) or "").strip() for k in keys)
            ]
            if layout == "gift_stat":
                out[key] = [s for s in out[key] if re.search(r"\d", str(s.get("value") or ""))]
        else:
            out[key] = _as_text(out.get(key))
            continue
        if isinstance(field.get("maxItems"), int):
            out[key] = out[key][: field["maxItems"]]
        limits[key] = field.get("minItems") or 1

    pair = policy.get("paired_lists", {}).get(layout)
    if pair:
        shortest = min(len(out.get(k) or []) for k in pair)
        for k in pair:
            out[k] = (out.get(k) or [])[:shortest]

    problems = []
    for key in required:
        if key in limits:
            if len(out[key]) < limits[key]:
                problems.append(f"{key}: needs at least {limits[key]} items, has {len(out[key])}")
        elif not out[key]:
            problems.append(f"{key}: missing")
    return out, problems


def numbers_grounded(stats: Any, *sources: str) -> bool:
    """Every stat's digits appear in the source text (a refill must not invent figures)."""
    haystack = re.sub(r"[,\s]", "", " ".join(s or "" for s in sources))
    for stat in stats if isinstance(stats, list) else []:
        for digits in re.findall(r"\d[\d,.]*", str((stat or {}).get("value") or "")):
            if digits.replace(",", "").rstrip(".") not in haystack:
                return False
    return True


# ─── Article passages ─────────────────────────────────────────────────────────


def _plain_text(content: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", content or "")
    for _ in range(2):  # links can wrap an image's leftovers
        text = re.sub(r"\[([^\[\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    return re.sub(r"<[^>]+>", " ", text)


def relevant_passages(source: str, title: str, narration: str, max_chars: int = 6000) -> str:
    """The article paragraphs that best match a scene, in article order.

    The passage a scene is about can be anywhere in a long article, so a plain
    "first N characters" slice often misses it. Falls back to that slice when
    nothing matches (e.g. the article is in another language).
    """
    chunks: list[str] = []
    for para in re.split(r"\n\s*\n|\n", _plain_text(source)):
        para = re.sub(r"\s+", " ", para).strip()
        while len(para) > 900:
            cut = para.rfind(". ", 300, 900)
            cut = cut + 1 if cut > 0 else 900
            chunks.append(para[:cut].strip())
            para = para[cut:].strip()
        if len(para) >= 40:
            chunks.append(para)
    if not chunks:
        return _plain_text(source).strip()[:max_chars]

    def words(text: str) -> set[str]:
        return {w for w in re.findall(r"\w+", text.lower()) if len(w) >= 4 or w.isdigit()}

    chunk_words = [words(c) for c in chunks]
    weights: dict[str, float] = {}
    for word in words(f"{title} {narration}"):
        df = sum(word in cw for cw in chunk_words)
        if df:
            weights[word] = math.log(1 + len(chunks) / df)
    scores = [sum(w for word, w in weights.items() if word in cw) for cw in chunk_words]

    picked: list[int] = []
    used = 0
    for i in sorted(range(len(chunks)), key=lambda n: (-scores[n], n)):
        if scores[i] <= 0:
            break
        if used + len(chunks[i]) > max_chars:
            continue
        picked.append(i)
        used += len(chunks[i]) + 2
    if not picked:
        return "\n\n".join(chunks)[:max_chars]
    return "\n\n".join(chunks[i] for i in sorted(picked))


# ─── Variety ──────────────────────────────────────────────────────────────────


def is_eligible(policy: dict, layout: str, scene: dict) -> bool:
    """Whether this scene has what the layout needs (a table, numbers, a quotation)."""
    need = (policy.get("needs") or {}).get(layout)
    if not need:
        return True
    text = " ".join(str(scene.get(k) or "") for k in ("title", "narration"))
    if need == "table":
        return isinstance(scene.get("data_table_index"), int) or TABLE_HINT_MARKER in str(
            scene.get("visual_description") or ""
        )
    if need == "numbers":
        return len(_NUMBER_RE.findall(text)) >= 2
    if need == "quote":
        return bool(_QUOTE_RE.search(text))
    return True


def layout_cap(policy: dict, layout: str, content_count: int) -> int:
    """How many of the video's content scenes may use this layout."""
    share = (policy.get("limits") or {}).get(layout, {}).get("share")
    if share:
        return max(1, round(content_count * share))
    return max(2, math.ceil(content_count / 5))


def balance_layouts(template_id: str, scenes: list[dict]) -> list[dict]:
    """Spread layouts across the video. Opening, closing and table scenes never move."""
    policy = get_layout_policy(template_id)
    if not policy or not scenes:
        return scenes

    hero = get_hero_layout(template_id)
    planned = [str(s.get("preferred_layout") or "") for s in scenes]
    content = [i for i, l in enumerate(planned) if i != 0 and l != ENDING_LAYOUT]
    cap = {}
    auto = policy.get("auto_pick") or []

    def pinned(i: int) -> bool:
        return (policy.get("needs") or {}).get(planned[i]) == "table" and is_eligible(
            policy, planned[i], scenes[i]
        )

    usage: dict[str, int] = {}
    last: dict[str, int] = {}

    for pos, i in enumerate(content):
        prev = planned[i - 1]
        nxt = planned[i + 1] if i + 1 < len(planned) else ""
        current = planned[i]

        def limit(layout: str) -> int:
            if layout not in cap:
                cap[layout] = layout_cap(policy, layout, len(content))
            return cap[layout]

        gap = (policy.get("limits") or {}).get(current, {}).get("min_gap", 2)
        keep = pinned(i) or (
            bool(current)
            and current != hero
            and current != prev
            and is_eligible(policy, current, scenes[i])
            and usage.get(current, 0) < limit(current)
            and i - last.get(current, -99) >= gap
        )
        if not keep:
            ahead = [planned[j] for j in content[pos + 1 :]]
            options = [l for l in auto if l != prev and is_eligible(policy, l, scenes[i])]
            if i + 1 < len(planned) and pinned(i + 1):
                options = [l for l in options if l != nxt] or options

            def score(layout: str) -> tuple:
                distance = i - last.get(layout, -99)
                return (
                    # Over its cap; a layout with its own limit overflows last.
                    ((200 if layout in (policy.get("limits") or {}) else 100)
                     if usage.get(layout, 0) >= limit(layout) else 0)
                    + usage.get(layout, 0) * 5
                    + ahead.count(layout) * 2
                    + max(0, 3 - distance) * 10
                    + (8 if layout == nxt else 0),
                    auto.index(layout),
                )

            if options:
                current = min(options, key=score)
        planned[i] = current
        usage[current] = usage.get(current, 0) + 1
        last[current] = i
        scenes[i]["preferred_layout"] = current

    return scenes


def pick_text_layout(
    policy: dict, planned: list[str], index: int, default: str, exclude: str = ""
) -> str:
    """The prop-free layout to use when a scene's own layout cannot be filled:
    the least used one that differs from the scenes on either side."""
    options = [l for l in (policy.get("text_layouts") or []) if l != exclude]
    if not options:
        return default
    if not 0 <= index < len(planned):
        return options[0]
    neighbours = {planned[j] for j in (index - 1, index + 1) if 0 <= j < len(planned)}
    others = planned[:index] + planned[index + 1 :]
    return min(options, key=lambda l: (l in neighbours, others.count(l), options.index(l)))
