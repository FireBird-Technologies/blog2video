"""The ONE per-content-type prop schema: which keys, and what shape.

WHY THIS MODULE EXISTS
----------------------
`GeneratedSceneProps` (remotion-video/src/templates/generated/types.ts) declares
the props a scene component reads. TWO separate paths fill them:

  * template SAMPLE copy — code_generator._parse_sample_content
  * project CONTENT      — content_classifier.extract_structured_content_batch

The sample path was held to the contract by an explicit per-type key map. The
project path was not: its prompt described the fields in prose ("comparison:
left and right sides, each label + description") and never named them. So the
model emitted `left`/`right` while the component read `comparisonLeft`/
`comparisonRight`, and the scene rendered an empty frame — with nothing in
between to notice, because no layer renames keys. `sanitizeSceneProps` coerces
SHAPES and skips any key it does not recognise.

Both paths now import from here, so "which keys does content type X carry" has
exactly one answer and the two cannot drift again.

The keys below must stay in step with types.ts. `test_scene_content_schema`
asserts that.
"""
from __future__ import annotations

# The FULL field definition per content type: key, label, editor type, and any
# sub-fields or caps.
#
# This carries the editor metadata as well as the key names, because those were
# maintained SEPARATELY before — the labels and maxItems lived in a hardcoded
# `CUSTOM_CONTENT_FIELDS` in SceneEditModal.tsx while the key names lived here.
# Two definitions of the same thing, and they drifted: the frontend declared
# `steps` a flat string_array while a generated scene rendered objects, so the
# editor printed "[object Object]" on every row.
#
# Shaped exactly like build_layout_prop_schema's `fields` entries, so the
# frontend's existing generic renderer (layoutPropSchemaToFieldDefs) consumes it
# with no new code.
FIELD_DEFS_BY_TYPE: dict[str, list[dict]] = {
    "plain": [],
    "bullets": [
        {"key": "bullets", "label": "Bullet points", "type": "string_array", "maxItems": 8},
    ],
    "steps": [
        {"key": "steps", "label": "Steps", "type": "string_array", "maxItems": 8},
    ],
    "metrics": [
        {
            "key": "metrics",
            "label": "Metrics",
            "type": "object_array",
            "maxItems": 4,
            "subFields": [
                {"key": "value", "label": "Value"},
                {"key": "label", "label": "Label"},
                {"key": "suffix", "label": "Suffix", "placeholder": "%"},
            ],
        },
    ],
    "quote": [
        {"key": "quote", "label": "Quote", "type": "text"},
        {"key": "quoteAuthor", "label": "Author", "type": "string"},
    ],
    "comparison": [
        {"key": "comparisonLeft.label", "label": "Left label", "type": "string"},
        {"key": "comparisonLeft.description", "label": "Left description", "type": "text"},
        {"key": "comparisonRight.label", "label": "Right label", "type": "string"},
        {"key": "comparisonRight.description", "label": "Right description", "type": "text"},
    ],
    "timeline": [
        {
            "key": "timelineItems",
            "label": "Timeline items",
            "type": "object_array",
            "maxItems": 6,
            "subFields": [
                {"key": "label", "label": "Label"},
                {"key": "description", "label": "Description"},
            ],
        },
    ],
    "code": [
        {"key": "codeLanguage", "label": "Language", "type": "string", "placeholder": "e.g. python"},
        {"key": "codeLines", "label": "Code lines", "type": "string_array"},
    ],
}


def _keys_of(defs: list[dict]) -> frozenset[str]:
    """The contract keys a field list writes to.

    `comparison` addresses its two objects through dotted paths
    ("comparisonLeft.label"), which the editor renders as four flat inputs — the
    stored key is the part before the dot.
    """
    return frozenset(str(f["key"]).split(".", 1)[0] for f in defs)


# Which keys each content type legitimately carries. A field outside its type's
# set is dropped: the layout does not read it, and storing it would imply the
# preview shows something it cannot.
#
# Derived from FIELD_DEFS_BY_TYPE so the two cannot disagree.
FIELDS_BY_TYPE: dict[str, frozenset[str]] = {
    ctype: _keys_of(defs) for ctype, defs in FIELD_DEFS_BY_TYPE.items()
}

# Every contract key, across all types.
ALL_FIELDS: frozenset[str] = frozenset().union(*FIELDS_BY_TYPE.values())

# The names a model reaches for instead of the contract's.
#
# These are not hypothetical: `left`/`right` is what a real extraction produced
# for a comparison scene, from a prompt that said "left and right sides" without
# naming the keys. Renaming on the way out is what repairs the rows ALREADY in
# the database — a prompt fix only helps the next extraction.
#
# Applied only when the contract key is ABSENT, so a correct emission always
# wins over an alias.
ALIASES: dict[str, str] = {
    "left": "comparisonLeft",
    "right": "comparisonRight",
    "leftSide": "comparisonLeft",
    "rightSide": "comparisonRight",
    "author": "quoteAuthor",
    "quote_author": "quoteAuthor",
    "items": "timelineItems",
    "timeline": "timelineItems",
    "events": "timelineItems",
    "lines": "codeLines",
    "code": "codeLines",
    "code_lines": "codeLines",
    "language": "codeLanguage",
    "code_language": "codeLanguage",
}


# How each editor type is described to the extraction model. The prompt is
# GENERATED from FIELD_DEFS_BY_TYPE rather than retyped, so a key added above
# cannot be missing from the instructions — which is exactly how `comparison`
# came to be described as "left and right sides" with its real keys unnamed.
_TYPE_HINT: dict[str, str] = {
    "string": "string",
    "text": "string",
    "string_array": '["...", "..."]',
    "object_array": "[{{{fields}}}]",
    "number": "number",
    "color": '"#RRGGBB"',
    "select": "string",
}


def prompt_field_reference() -> str:
    """The per-type key + shape block for the extractor's instructions."""
    lines: list[str] = []
    for ctype in sorted(FIELD_DEFS_BY_TYPE):
        defs = FIELD_DEFS_BY_TYPE[ctype]
        if not defs:
            lines.append(f"      {ctype:<11} no extra fields at all")
            continue
        # comparison addresses one object through several dotted paths; show the
        # object once rather than four separate lines.
        grouped: dict[str, list[dict]] = {}
        for f in defs:
            grouped.setdefault(str(f["key"]).split(".", 1)[0], []).append(f)
        first = True
        for key, fields in grouped.items():
            if len(fields) > 1 or "." in str(fields[0]["key"]):
                sub = ", ".join(
                    f'"{str(f["key"]).split(".", 1)[1]}": "..."' for f in fields
                )
                shape = "{" + sub + "}"
            else:
                f = fields[0]
                shape = _TYPE_HINT.get(str(f.get("type")), "string")
                if shape.startswith("[{"):
                    sub = ", ".join(
                        f'"{sf["key"]}": "..."' for sf in (f.get("subFields") or [])
                    )
                    shape = "[{" + sub + "}]"
            label = ctype if first else ""
            lines.append(f'      {label:<11} "{key}": {shape}')
            first = False
    return "\n".join(lines)


def normalise_fields(payload: dict, content_type: str) -> dict:
    """Rename aliases, coerce shapes, drop anything the type does not carry.

    The three steps are ordered on purpose: an alias has to become a contract
    key BEFORE it can be coerced or kept, and the drop runs last so a coerced
    value that came back None is removed rather than stored as null.

    Returns a new dict; the input is not mutated.
    """
    allowed = FIELDS_BY_TYPE.get(content_type, frozenset())
    out: dict = {}

    # 1. Aliases -> contract keys. A key the contract already has wins.
    renamed: dict = {}
    for key, value in payload.items():
        target = ALIASES.get(key, key)
        if target != key and (target in payload or target in renamed):
            continue  # the real key is present; the alias is redundant
        renamed[target] = value

    # 2 + 3. Coerce what the type carries, drop the rest.
    for key, value in renamed.items():
        if key not in allowed:
            continue
        coerced = coerce_field(key, value)
        if coerced is not None:
            out[key] = coerced
    return out


def coerce_field(key: str, value):
    """Force one sample field into the SHAPE GeneratedSceneProps declares, or drop it.

    The filter below used to check the key NAME only, so any JSON the model felt
    like emitting was stored verbatim. Two real crashes from template 196, both
    from a model that "helpfully" enriched a string into an object:

        quoteAuthor: {"name": "Ayesha Raza", "role": "Daily commuter"}
            -> `(author || 'Y').trim()` — TypeError, trim is not a function
        bullets: [{"lead": "Upfront fares", "detail": "see the exact price"}]
            -> "Objects are not valid as a React child ({lead, detail})"

    Both took down the whole scene through the error boundary. The generated
    code was CORRECT — it read the props exactly as types.ts declares them; the
    DATA was the wrong shape, so no amount of scene-code gating would catch it.
    This is the enforcement point.

    Salvage where the intent is obvious (pull `name` out of an author object,
    join `lead`/`detail` into one bullet string) and drop where it is not — a
    dropped field means the deterministic fallback fills in, which always
    renders.
    """
    def _string(v) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return str(v)
        if isinstance(v, dict):
            # {"name": ..., "role": ...} and friends: take the likeliest label.
            for k in ("name", "label", "text", "value", "title", "lead"):
                got = v.get(k)
                if isinstance(got, str) and got.strip():
                    return got.strip()
        return None

    def _string_list(v) -> list[str] | None:
        if not isinstance(v, list):
            return None
        out: list[str] = []
        for item in v:
            if isinstance(item, dict):
                # {"lead": ..., "detail": ...} -> "lead — detail"
                lead = _string(item)
                detail = item.get("detail") or item.get("description")
                if lead and isinstance(detail, str) and detail.strip():
                    out.append(f"{lead} — {detail.strip()}")
                    continue
                if lead:
                    out.append(lead)
                    continue
                return None
            got = _string(item)
            if got:
                out.append(got)
        return out or None

    def _labelled_list(v, desc_key: str) -> list[dict] | None:
        """[{label, description}] / [{value, label, suffix}] entries."""
        if not isinstance(v, list):
            return None
        out: list[dict] = []
        for item in v:
            if not isinstance(item, dict):
                return None
            entry: dict = {}
            for field in ("value", "label", "suffix", desc_key):
                got = item.get(field)
                if isinstance(got, str) and got.strip():
                    entry[field] = got.strip()
                elif isinstance(got, (int, float)) and not isinstance(got, bool):
                    entry[field] = str(got)
            if entry:
                out.append(entry)
        return out or None

    def _pair(v) -> dict | None:
        if not isinstance(v, dict):
            return None
        label = _string(v.get("label") or v.get("title"))
        desc = _string(v.get("description") or v.get("detail") or v.get("text"))
        if not label:
            return None
        return {"label": label, "description": desc or ""}

    if key in ("sceneTitle", "displayText", "quote", "quoteAuthor", "codeLanguage"):
        return _string(value)
    if key in ("bullets", "steps", "codeLines"):
        return _string_list(value)
    if key == "metrics":
        return _labelled_list(value, "label")
    if key == "timelineItems":
        return _labelled_list(value, "description")
    if key in ("comparisonLeft", "comparisonRight"):
        return _pair(value)
    return None
