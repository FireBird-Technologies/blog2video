"""
Batch content classifier — replaces the 16 per-scene DSPy calls for custom templates.

For each scene's narration, extracts:
  - contentType: "bullets" | "metrics" | "code" | "quote" | "comparison" | "timeline" | "steps" | "plain"
  - structured fields: bullets[], metrics[], codeLines[], quote, quoteAuthor, etc.

Uses ONE cheap Haiku call for ALL scenes instead of 16 expensive Sonnet calls.
"""

import json
import logging
import re
from collections import Counter

import dspy

from app.dspy_modules import ensure_dspy_configured, get_theme_lm  # Haiku — cheap and fast
from app.services.scene_content_schema import (
    ALIASES,
    FIELD_DEFS_BY_TYPE,
    normalise_fields,
    prompt_field_reference,
)

logger = logging.getLogger(__name__)

# The canonical content-type taxonomy.
#
# SINGLE SOURCE OF TRUTH — do not duplicate this list. A blueprint layout's
# `best_for` must draw from it, because match_scenes_to_archetypes() keys the
# scene->variant mapping on these exact strings. When the two drift, matching
# silently degrades to round-robin and the only symptom is a debug log line, so
# app.dspy_modules.blueprint imports this constant to validate against.
#
# "dataviz" is deliberately absent: charts and tables are rendered by dedicated
# kit scenes, never by a generated content archetype.
CONTENT_TYPES: frozenset[str] = frozenset({
    "plain",
    "bullets",
    "steps",
    "metrics",
    "code",
    "quote",
    "comparison",
    "timeline",
})


class BatchContentExtractor(dspy.Signature):
    """Extract structured content from multiple scene narrations in one pass.

    For EACH scene, analyze the narration and determine:
    1. contentType — what kind of content this is
    2. structured fields — parsed data the component needs to render

    Content types:
    - "bullets" — narration lists multiple items/features/benefits/services/products
    - "steps" — narration describes a sequential process or ordered instructions
    - "metrics" — narration contains specific numbers/statistics/KPIs
    - "code" — narration contains code snippets or technical syntax
    - "quote" — narration contains a direct quote or testimonial
    - "comparison" — narration compares two things (vs, before/after, old/new)
    - "timeline" — narration describes events in chronological order
    - "plain" — general narrative text where NO distinct items can be extracted

    THE SCENE'S LAYOUT IS ALREADY CHOSEN. Each scene carries `layout` and
    `layout_best_for` — the layout it will render in, and ONE SENTENCE saying
    what content that layout is for ("A scannable list of six to eight short
    named items."). Extract the shape THAT SENTENCE DESCRIBES. This is the whole
    job: the layout decides which props the component receives, so content of
    the wrong shape leaves it half-empty and falling back.

    Read the sentence against the scene's own title and narration. It tells you
    not just the KIND of content but how much of it the layout holds well — how
    many items, and how much text each can carry. Extract to fit that.

    WHEN THE NARRATION CANNOT FILL THE LAYOUT, SAY SO — return the type you CAN
    fill and never pad, guess or invent to make a layout look complete. A wrong
    layout is repaired downstream; fabricated content is not repairable, because
    nothing afterwards knows it was invented. This is the one rule that outranks
    matching the layout.

    THE ONE EXCEPTION — `required_content_type`. A scene carrying that field has
    had its layout chosen BY A PERSON, who is looking at the frame and wants it
    filled. There is no downstream repair for that case: the component renders
    the declared shape or renders empty. So for that scene ONLY, return exactly
    the named contentType, using exactly the keys in `required_fields`, and
    re-read the narration through that shape — a sequence of events can be a
    before/after comparison, a two-sided contrast, or a set of steps depending
    on which is asked for. Reshaping what the narration SAYS is expected here;
    inventing facts it does not contain is still forbidden. If the narration
    genuinely carries nothing that can take that shape, return the type you can
    fill and the caller will keep the scene's previous content.

    Scenes marked role "intro" or "outro" are NOT content-routed — the intro
    carries the video's title and the outro the closing CTA. Always return
    "plain" for those, with no structured fields.

    Extraction rules:
    - Extract ONLY content present in the narration — NEVER invent data
    - Choose the type that matches what the narration ACTUALLY contains and what
      the scene's `layout_best_for` sentence asks for. No type is preferred a
      priori.
    USE THESE EXACT FIELD NAMES. The scene component reads these keys and no
    others — a field under any other name is dropped at the render boundary and
    the frame comes out empty, which is precisely what "left"/"right" did to a
    real comparison scene:

{_FIELD_REFERENCE}

    Emit ONLY "contentType" plus that type's fields. A title or a body-text key
    is discarded — the scene takes those from elsewhere.

    EDITABLE PROPS. A scene may also carry `editable_props` — fields the layout
    itself declares (a kicker, a panel label, a caption), each with a key, a
    label and the default the designer wrote. Return a "layoutProps" object
    giving values for them.

    RETURN A KEY ONLY WHERE THE NARRATION GIVES SOMETHING BETTER THAN THE
    DEFAULT, and omit it otherwise — the default then stands. Many defaults are
    deliberate: a panel number derived from the scene's position, a caption left
    empty on purpose. Never invent a value to fill a field, and never restate
    the scene's title or display text in one.

    Notes on the individual types:
    - bullets: including in prose ("offers three services: Go for rides, Eat for
      food, and Get for groceries" → ["Go for rides", "Eat for food",
      "Get for groceries"]). Extract ALL mentioned items, preserving their names.
    - plain: prose with no extractable items, steps or data — the honest answer
      when nothing else fits, not a last resort.

    Output MUST be a valid JSON array with one object per scene.
    """

    scenes_json: str = dspy.InputField(
        desc=(
            "JSON array of scenes: [{scene_index, role, layout, layout_best_for, title, "
            "narration, visual_description}]. `layout` is the layout this scene WILL "
            "render in and `layout_best_for` a sentence describing the content it is "
            "for — extract the shape that sentence asks for. `role` is intro/content/outro; "
            "bookends are always \"plain\". Use BOTH narration AND visual_description "
            "to extract items — visual_description often names explicitly what should "
            "appear on screen."
        )
    )
    content_language: str = dspy.InputField(
        desc="Target language for extracted content"
    )

    extracted_json: str = dspy.OutputField(
        desc='JSON array of extracted content, one per scene: [{"contentType": "...", "bullets": [...], ...}]. Must be valid JSON, no markdown wrapping.'
    )


# The per-type key/shape block is GENERATED from scene_content_schema rather
# than typed into the docstring above, so adding a key there cannot leave the
# instructions stale. A docstring cannot interpolate at class-definition time,
# so the placeholder is filled here.
BatchContentExtractor.__doc__ = (BatchContentExtractor.__doc__ or "").replace(
    "{_FIELD_REFERENCE}", prompt_field_reference()
)


def _coerce_layout_prop(value, ftype: str):
    """Force one declared-prop value into its declared editor type, or drop it.

    Same contract as the structured-content coercion: a value that cannot be
    salvaged is dropped so the designer's default stands, which always renders.
    """
    if ftype in ("string", "text", "color", "select"):
        if isinstance(value, str):
            return value.strip() or None
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
        return None
    if ftype == "number":
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return value
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return None
    if ftype == "string_array":
        if not isinstance(value, list):
            return None
        out = [str(v).strip() for v in value if isinstance(v, (str, int, float))]
        out = [v for v in out if v]
        return out or None
    if ftype == "object_array":
        if not isinstance(value, list):
            return None
        out2 = [v for v in value if isinstance(v, dict)]
        return out2 or None
    return None


async def extract_structured_content_batch(
    scenes_data: list[dict],
    content_language: str = "English",
    layout_best_for: dict[str, str] | None = None,
    layout_prop_schemas: dict[str, list[dict]] | None = None,
    required_content_type: str | None = None,
) -> list[dict]:
    """Extract structured content for ALL scenes in one LLM call.

    Replaces the old per-scene DSPy TemplateSceneToDescriptor which made
    ~16 expensive calls generating both layoutConfig (wasted) and structuredContent.
    This makes ONE cheap Haiku call for just the structuredContent.

    `layout_best_for` maps layout id -> the SENTENCE describing what content
    that layout is for (`meta["layout_best_for"]`). When given, each scene's
    already-chosen layout and that sentence are shown to the model so it
    extracts the shape the layout needs. Optional so the non-custom callers are
    unaffected. A legacy taxonomy list is accepted and joined.

    Returns list of dicts, each with at minimum {"contentType": "..."}.
    """
    ensure_dspy_configured()

    # Build minimal scene data for the LLM.
    #
    # `preferred_layout` and the scene's role are the load-bearing additions.
    # The caller has always passed preferred_layout in scenes_data; this
    # comprehension dropped it, so the classifier could not know which layout a
    # scene would render in — nor that scene 0 was a title card — and chose a
    # content type with no relation to either. Every scene in a real project
    # came back "bullets", including the intro.
    _total = len(scenes_data)
    scenes_input = []
    for i, s in enumerate(scenes_data):
        _layout = s.get("preferred_layout") or ""
        _role = s.get("role") or (
            "intro" if i == 0 else "outro" if (i == _total - 1 and _total > 1) else "content"
        )
        _entry = {
            "scene_index": i,
            "role": _role,
            "title": s.get("title", ""),
            "narration": s.get("narration", ""),
            "visual_description": s.get("visual_description", ""),
        }
        # A HARD target type, set only by the layout-switch path.
        #
        # Batch generation leaves this None and keeps the honest behaviour: the
        # extractor returns whatever the narration can actually fill. But when a
        # user deliberately picks a layout, that layout is the requirement — the
        # scene renders its declared shape or nothing, so coming back with the
        # type the narration "prefers" leaves the layout empty and the switch
        # looking broken.
        if required_content_type:
            _entry["required_content_type"] = required_content_type
            _entry["required_fields"] = [
                str(f["key"]) for f in FIELD_DEFS_BY_TYPE.get(required_content_type, [])
            ]
        if _layout:
            _entry["layout"] = _layout
            _bf = (layout_best_for or {}).get(_layout)
            if isinstance(_bf, list):  # legacy taxonomy list
                _bf = ", ".join(str(k) for k in _bf) if _bf else ""
            if isinstance(_bf, str) and _bf.strip():
                _entry["layout_best_for"] = _bf.strip()
            _declared = (layout_prop_schemas or {}).get(_layout)
            if isinstance(_declared, list) and _declared:
                _entry["editable_props"] = [
                    {
                        "key": f.get("key"),
                        "label": f.get("label"),
                        "type": f.get("type"),
                        "default": f.get("default"),
                    }
                    for f in _declared
                    if isinstance(f, dict) and f.get("key")
                ]
        scenes_input.append(_entry)

    print(f"[F7-DEBUG] [CONTENT-EXTRACT] Extracting structured content for {len(scenes_input)} scenes in ONE call")

    module = dspy.ChainOfThought(BatchContentExtractor)

    # Use Haiku — this is structured extraction, not creative work
    haiku_lm = get_theme_lm()
    with dspy.context(lm=haiku_lm):
        result = module(
            scenes_json=json.dumps(scenes_input),
            content_language=content_language or "English",
        )

    # Parse the result
    raw = (result.extracted_json or "").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[F7-DEBUG] [CONTENT-EXTRACT] JSON parse failed: {e}, raw={raw[:200]}")
        # Fallback: all scenes get "plain"
        extracted = [{"contentType": "plain"} for _ in scenes_data]

    # Ensure we have one result per scene
    if not isinstance(extracted, list):
        extracted = [{"contentType": "plain"} for _ in scenes_data]
    while len(extracted) < len(scenes_data):
        extracted.append({"contentType": "plain"})

    # Validate array fields — LLM sometimes returns strings instead of arrays
    # A string where an array belongs, BEFORE the schema pass.
    #
    # This one is a genuine repair rather than a rename: the model returns a
    # newline-joined block often enough to be worth salvaging, and
    # scene_content_schema's coercion only accepts a real list.
    ARRAY_FIELDS = ("bullets", "steps", "codeLines", "lines", "code")
    for sc in extracted:
        if not isinstance(sc, dict):
            continue
        for field in ARRAY_FIELDS:
            val = sc.get(field)
            if isinstance(val, str) and val.strip():
                items = [line.strip() for line in val.strip().splitlines() if line.strip()]
                # Strip leading numbering like "1. ", "1) ", "- ", "* "
                items = [re.sub(r'^(\d+[\.\)]\s*|[-*]\s+)', '', item) for item in items]
                sc[field] = items if items else [val.strip()]
                print(f"[F7-DEBUG] [CONTENT-EXTRACT] Fixed {field}: string → {len(sc[field])} items")

    # THE SCHEMA PASS: rename aliases, coerce shapes, drop unknown keys.
    #
    # The prompt above now names every contract key, but a prompt only helps the
    # NEXT extraction — this is what repairs the rows already written. It is
    # also the only layer that can: sanitizeSceneProps coerces shapes and skips
    # any key it does not recognise, so `left` reached the component untouched
    # and the comparison scene rendered an empty frame.
    #
    # One authority for "which keys does content type X carry", shared with the
    # template sample-copy path — see services/scene_content_schema.py.
    for i, sc in enumerate(extracted):
        if not isinstance(sc, dict):
            extracted[i] = {"contentType": "plain"}
            continue
        ctype = sc.get("contentType") or "plain"
        if ctype not in CONTENT_TYPES:
            ctype = "plain"
        cleaned = normalise_fields(sc, ctype)
        _dropped = sorted(
            k for k in sc
            if k != "contentType" and k not in cleaned and ALIASES.get(k, k) not in cleaned
        )
        if _dropped:
            print(
                f"[F7-DEBUG] [CONTENT-EXTRACT] Scene {i} ({ctype}): dropped "
                f"{_dropped} — not fields this content type carries"
            )
        cleaned["contentType"] = ctype

        # Values for the scene's OWN declared props, validated against the
        # schema that declared them.
        #
        # Kept OUT of structuredContent — these belong in the descriptor's
        # `layoutProps`, a different channel with different writers — so it
        # travels under a private key the caller lifts off and removes.
        _declared = (layout_prop_schemas or {}).get(
            (scenes_data[i].get("preferred_layout") if i < len(scenes_data) else "") or ""
        )
        _lp = sc.get("layoutProps")
        if isinstance(_declared, list) and _declared and isinstance(_lp, dict):
            _by_key = {
                f["key"]: f for f in _declared if isinstance(f, dict) and f.get("key")
            }
            _out: dict = {}
            for _k, _v in _lp.items():
                _field = _by_key.get(_k)
                if not _field:
                    continue  # not a prop this scene declared
                _coerced = _coerce_layout_prop(_v, str(_field.get("type") or "string"))
                # Omitting a key is how the model says "the default is right",
                # and echoing the default back means the same thing.
                if _coerced is None or _coerced == _field.get("default"):
                    continue
                _out[_k] = _coerced
            if _out:
                cleaned["__layoutProps"] = _out

        extracted[i] = cleaned

    # Debug: log what was extracted
    for i, sc in enumerate(extracted[:len(scenes_data)]):
        ct = sc.get("contentType", "plain")
        fields = [k for k in sc.keys() if k != "contentType" and sc[k]]
        print(f"[F7-DEBUG] [CONTENT-EXTRACT] Scene {i}: contentType={ct}, fields={fields}")

    return extracted[:len(scenes_data)]


# Structured props that belong to a specific content type. Stripped when a
# scene's type changes, so a bullets payload cannot ride along on a scene that
# is now "plain" — which is exactly what put a bullet list on project 1209's
# intro.
_TYPE_PROP_KEYS: frozenset[str] = frozenset({
    "bullets", "steps", "metrics", "timelineItems", "codeLines", "codeLanguage",
    "quote", "quoteAuthor", "comparisonLeft", "comparisonRight",
})


def _layout_hosts_kinds(kinds: list, content_type: str) -> bool:
    """Whether a layout declaring `kinds` can render `content_type` well."""
    # Local import: design_doc imports CONTENT_TYPES from this module.
    from app.dspy_modules.design_doc import COMPATIBLE_CONTENT_TYPES

    if not kinds:
        # A layout that declares nothing cannot be said to mismatch.
        return True
    if content_type in kinds:
        return True
    return any(content_type in COMPATIBLE_CONTENT_TYPES.get(k, ()) for k in kinds)


def _layout_hosts(layout: str, content_type: str, best_for: dict) -> bool:
    """Whether `layout` can render `content_type` well.

    True when the type is in the layout's own `best_for`, or is a documented
    compatible substitute for something it lists (COMPATIBLE_CONTENT_TYPES —
    the same ranked map the design stage uses to widen an archetype's remit).
    """
    kinds = best_for.get(layout)
    return _layout_hosts_kinds(kinds if isinstance(kinds, list) else [], content_type)


async def refill_structured_content_for_layout(
    *,
    template_id: str,
    layout_id: str,
    title: str,
    narration: str,
    visual_description: str = "",
    content_language: str = "English",
) -> dict | None:
    """Re-extract ONE scene's structured content for a layout it just moved to.

    WHY THIS EXISTS

    Changing a scene's layout rewrote `contentVariantIndex` and nothing else, so
    the scene kept whatever `structuredContent` it already had. Moving a `plain`
    scene onto a timeline layout left it with no `timelineItems`, so the scene
    mapped an empty array and fell back to `displayText` — which it ALSO renders
    as its subtitle, printing the same sentence twice.

    Generation solves this by extracting content FOR the assigned layout. A
    layout switch is the same problem one scene at a time, so it reuses the same
    call rather than a second implementation.

    Returns the new structuredContent, or None when nothing should change —
    a non-content layout, no metadata, or an extraction that failed. The caller
    keeps what it had in that case, which always renders.
    """
    if not layout_id.startswith("content_"):
        # intro/outro/data-viz are not content-routed.
        return None
    try:
        from app.services.template_service import get_meta

        meta = get_meta(template_id) or {}
    except Exception:  # noqa: BLE001
        logger.warning(
            "[LAYOUT-SWITCH] no meta for template %s — cannot refill %s",
            template_id, layout_id,
        )
        return None

    # `layout_content_types[layout_id]` used to gate this call, but the value it
    # holds is never read below — `layout_best_for` is what actually steers the
    # extraction. Older/archetype-less templates never populate
    # `layout_content_types`, which made this bail out and silently leave the
    # scene on its old contentType forever. Gate on `layout_best_for` instead —
    # the thing this call actually needs — so those templates get a real
    # extraction pass too.
    best_for = meta.get("layout_best_for") or {}
    if not isinstance(best_for.get(layout_id), str) or not best_for[layout_id].strip():
        logger.warning(
            "[LAYOUT-SWITCH] no layout_best_for entry for %s on template %s — "
            "refill skipped, scene keeps its prior structuredContent",
            layout_id, template_id,
        )
        return None

    # The layout's DECLARED shape. Unlike `best_for` (prose, a hint), this is the
    # machine-readable type the component actually renders, so it is passed as a
    # hard requirement rather than a suggestion — the user picked this layout and
    # expects it filled.
    target_ct = (meta.get("layout_content_types") or {}).get(layout_id)
    target_ct = target_ct if isinstance(target_ct, str) and target_ct else None

    try:
        out = await extract_structured_content_batch(
            [
                {
                    "title": title,
                    "narration": narration,
                    "visual_description": visual_description,
                    "preferred_layout": layout_id,
                    "role": "content",
                }
            ],
            content_language=content_language,
            layout_best_for=best_for,
            required_content_type=target_ct,
        )
    except Exception:  # noqa: BLE001 — a failed refill must not fail the switch
        logger.exception("[LAYOUT-SWITCH] content refill failed for %s", layout_id)
        return None

    if not out or not isinstance(out[0], dict):
        return None
    sc = out[0]
    sc.pop("__layoutProps", None)

    # Validate against the target, because the prompt is guidance and the model
    # can still return the type the narration "prefers". Writing that would put
    # e.g. `steps` into a comparison layout, which renders as empty panels — the
    # exact symptom this refill exists to prevent.
    if target_ct and sc.get("contentType") != target_ct:
        logger.warning(
            "[LAYOUT-SWITCH] %s wants '%s' but extraction returned '%s' — coercing",
            layout_id, target_ct, sc.get("contentType"),
        )
        coerced = normalise_fields(sc, target_ct)
        if not coerced:
            # An honest miss: the narration carries nothing that can take this
            # shape. Returning None keeps the scene's PREVIOUS content, which at
            # least renders — better than writing an empty payload.
            logger.warning(
                "[LAYOUT-SWITCH] %s: nothing coercible to '%s'; keeping prior content",
                layout_id, target_ct,
            )
            return None
        coerced["contentType"] = target_ct
        sc = coerced
    return sc


def reconcile_layouts_and_content(
    scenes_meta: list[dict],
    structured_contents: list[dict],
    layout_content_types: dict | None,
) -> list[dict]:
    """Make each scene's layout and its extracted props agree. Returns layouts.

    Runs after extraction and before the descriptor is written, and is the point
    at which the layout stops being a guess:

      1. BOOKENDS ARE NEVER CONTENT-ROUTED. The intro carries the video's title
         and the outro the CTA, so both are forced to "plain" with their
         structured props stripped. The design stage already does this
         (design_doc.py) and so does sample-copy generation (code_generator.py);
         the project pipeline was the only path without the rule, which is why a
         real intro shipped with a four-item bullet list.

      2. A CONTENT SCENE WHOSE PROPS ITS LAYOUT CANNOT HOLD GETS A NEW LAYOUT.
         The extractor is told to fill the assigned layout and to say so
         honestly when the narration cannot — never to invent. So a mismatch
         here means the content is real and the layout is wrong, and the layout
         is the cheaper of the two to change.

    `layout_content_types` maps layout id -> its taxonomy key
    (`meta["layout_content_types"]`). This check is machine-readable on purpose:
    the prose `best_for` sentence is what the LLM picks with, but a mismatch has
    to be detectable without another model call.

    Mutates `structured_contents` in place (bookend normalisation) and returns
    the layout id per scene, so the caller writes ONE decision to both
    `scene.preferred_layout` and the descriptor.
    """
    from app.dspy_modules.design_doc import _BOOKEND_CONTENT_TYPE

    from app.dspy_modules.design_doc import COMPATIBLE_CONTENT_TYPES

    # Two maps, and the split is what makes "exact" mean anything.
    #
    #   primary  — the ONE kind each layout was designed for. A layout listed
    #              here for the scene's type is a real home for it.
    #   best_for — that kind widened through COMPATIBLE_CONTENT_TYPES, i.e. what
    #              the layout can also host acceptably.
    #
    # Comparing against the widened list alone made every check pass: a timeline
    # layout tolerates bullets, so a bullets scene sitting on one never moved.
    primary: dict[str, str] = {}
    best_for: dict[str, list[str]] = {}
    for _lid, _ct in (layout_content_types or {}).items():
        if isinstance(_ct, list):  # legacy ranked list — element 0 is the primary
            _kinds = [k for k in _ct if isinstance(k, str)]
            if _kinds:
                primary[_lid] = _kinds[0]
                best_for[_lid] = _kinds
        elif isinstance(_ct, str) and _ct:
            primary[_lid] = _ct
            _kinds = [_ct]
            for _alt in COMPATIBLE_CONTENT_TYPES.get(_ct, ()):
                if _alt not in _kinds:
                    _kinds.append(_alt)
            best_for[_lid] = _kinds
    total = len(scenes_meta)
    out: list[str] = []

    for i, meta in enumerate(scenes_meta):
        layout = meta.get("preferred_layout") or ""
        role = meta.get("role") or (
            "intro" if i == 0 else "outro" if (i == total - 1 and total > 1) else "content"
        )
        sc = structured_contents[i] if i < len(structured_contents) else {}
        if not isinstance(sc, dict):
            sc = {}
            if i < len(structured_contents):
                structured_contents[i] = sc

        if role in ("intro", "outro"):
            sc["contentType"] = _BOOKEND_CONTENT_TYPE
            for key in _TYPE_PROP_KEYS:
                sc.pop(key, None)
            out.append(role)
            continue

        ctype = sc.get("contentType") or "plain"
        if not layout or not layout.startswith("content_"):
            out.append(layout)
            continue

        # A layout that lists this type in its OWN best_for is a real match.
        # COMPATIBLE_CONTENT_TYPES is deliberately permissive — it exists to
        # widen an archetype's remit so no content is left homeless — so
        # "merely tolerable" is not good enough to keep when a layout actually
        # built for this content is going spare. Prefer exact; accept tolerable
        # only when nothing exact is free.
        # A layout DESIGNED for this kind, not merely able to tolerate it.
        _exact = [
            lid for lid, _p in primary.items()
            if lid.startswith("content_") and _p == ctype
        ]
        if primary.get(layout) == ctype:
            out.append(layout)
            continue

        _neighbours = {out[i - 1] if i else ""}
        _fresh_exact = [lid for lid in _exact if lid not in _neighbours]
        if _fresh_exact:
            _chosen = _fresh_exact[0]
        elif _layout_hosts(layout, ctype, best_for):
            # Tolerable, and nothing exact is free — keep it rather than churn.
            _chosen = layout
        else:
            _tolerable = [
                lid for lid in best_for
                if lid.startswith("content_") and _layout_hosts(lid, ctype, best_for)
            ]
            _fresh = [lid for lid in _tolerable if lid not in _neighbours]
            _chosen = (_fresh or _tolerable or _exact or [layout])[0]

        if _chosen != layout:
            print(
                f"[F7-DEBUG] [RECONCILE] Scene {i}: {layout} is not built for "
                f"'{ctype}' -> {_chosen}"
            )
        out.append(_chosen)

    return [{"preferred_layout": lid} for lid in out]


def match_scenes_to_archetypes(
    structured_contents: list[dict],
    archetypes: list[dict | str],
) -> list[int]:
    """Match each scene to the best content archetype based on its contentType.

    Returns a list of archetype indices (into the content_codes array).
    Ensures adjacent scenes don't use the same archetype for visual diversity.

    `archetypes` can be either:
    - Current: [{"id": "menu_showcase", "content_type": "bullets",
                 "best_for": "A scannable list of short named items."}, ...]
      `best_for` is now a SENTENCE for the layout picker; `content_type` is the
      taxonomy key this function routes on.
    - Older: [{"id": "menu_showcase", "best_for": ["bullets", "steps"]}, ...]
      `best_for` was the ranked taxonomy list. Still read, so templates
      generated before the change keep routing.
    - Oldest: ["hero_intro", "bullets_list", ...] — no metadata, round-robin.
    """
    # Normalize to new format
    normalized: list[dict] = []
    for a in archetypes:
        if isinstance(a, str):
            normalized.append({"id": a, "best_for": []})
        elif isinstance(a, dict):
            # `best_for` is a SENTENCE in current templates and a ranked taxonomy
            # LIST in older ones. Routing needs the taxonomy, so prefer the
            # explicit `content_type` and fall back to the legacy list shape.
            _bf = a.get("best_for")
            if isinstance(_bf, list):
                _kinds = [k for k in _bf if isinstance(k, str)]
            else:
                _ct = a.get("content_type")
                _kinds = [_ct] if isinstance(_ct, str) and _ct else []
                if _kinds:
                    from app.dspy_modules.design_doc import COMPATIBLE_CONTENT_TYPES

                    for _alt in COMPATIBLE_CONTENT_TYPES.get(_kinds[0], ()):
                        if _alt not in _kinds:
                            _kinds.append(_alt)
            normalized.append({"id": a.get("id", "unknown"), "best_for": _kinds})
        else:
            normalized.append({"id": "unknown", "best_for": []})

    # Build lookup: contentType → best archetype index.
    #
    # TWO PASSES, and the split is load-bearing. `best_for` is a RANKED list —
    # element 0 is the kind the layout was actually designed for, the rest are
    # acceptable second choices (see COMPATIBLE_CONTENT_TYPES). A single
    # first-wins pass over the flat list would let archetype 0's *secondary* tag
    # claim a type before archetype 3's *primary* one was ever considered, so
    # widening best_for would route metrics content to a bullets layout that
    # merely tolerates metrics. Claim every primary first, then let secondaries
    # fill only the types still unspoken for.
    type_to_archetype: dict[str, int] = {}
    for i, arch in enumerate(normalized):
        best_for = arch.get("best_for") or []
        if best_for and best_for[0] not in type_to_archetype:
            type_to_archetype[best_for[0]] = i
    for i, arch in enumerate(normalized):
        for content_type in (arch.get("best_for") or [])[1:]:
            if content_type not in type_to_archetype:
                type_to_archetype[content_type] = i

    print(f"[F7-DEBUG] [MATCH] Type→archetype mapping: {type_to_archetype}")

    num_archetypes = len(normalized)
    archetype_id_list = [a["id"] for a in normalized]
    assignments: list[int] = []
    last_assigned = -1  # Track last assignment to avoid adjacent repeats

    for scene_idx, sc in enumerate(structured_contents):
        content_type = sc.get("contentType", "plain")

        # Try to match by content type
        best = type_to_archetype.get(content_type)

        # If best match is same as last scene, try alternatives for diversity.
        #
        # ONLY AMONG ARCHETYPES THAT CAN HOST THIS CONTENT. This used to take
        # `alternatives[scene_idx % len(alternatives)]` — a positional
        # round-robin over every other archetype, with no reference to the
        # content at all. It fires whenever two consecutive scenes share a type,
        # which for a list-heavy article is nearly every scene, so the content
        # match was discarded almost every time and scenes landed on layouts
        # built for other data.
        #
        # Variety still matters, but not enough to hand a scene a layout that
        # cannot draw what it holds. When nothing else can host the type, the
        # repeat is the better answer and is kept.
        if best is not None and best == last_assigned and num_archetypes > 1:
            _compatible = [
                i for i in range(num_archetypes)
                if i != last_assigned
                and _layout_hosts_kinds(normalized[i].get("best_for") or [], content_type)
            ]
            if _compatible:
                best = _compatible[scene_idx % len(_compatible)]
                print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type}, avoided repeat, using archetype {best} ({archetype_id_list[best]})")
            else:
                print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type}, repeat kept — no other archetype hosts it")
        elif best is not None:
            print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type} → archetype {best} ({archetype_id_list[best]})")
        else:
            # No specific archetype for this type — round-robin
            best = scene_idx % num_archetypes
            print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type}, no specific match → fallback archetype {best} ({archetype_id_list[best]})")

        assignments.append(best)
        last_assigned = best

    # Summary
    dist = Counter(archetype_id_list[a] for a in assignments)
    print(f"[F7-DEBUG] [MATCH] Final distribution: {dict(dist)}")

    return assignments
