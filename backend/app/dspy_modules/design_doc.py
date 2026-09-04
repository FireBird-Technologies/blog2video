"""Design documents — the template's design, authored in prose before any code.

WHY THIS REPLACED THE BLUEPRINT
-------------------------------
The blueprint stage this supersedes tried to solve template sameness by giving
the model a richer vocabulary to pick from: 9 eras, 19 decor systems, 25
artifact motions, per-content-type layout variants, bookend arrangements. All of
it was rendered into the prompt under the header

    "AVAILABLE KIT VOCABULARY — you MUST choose from these exact values."

That is the bug, not the fix. With a fixed menu, two brands differ by which
CELL of a fixed grid they land in — a permutation, not a design. The blueprint
then needed a bank of ~16 divergence constraints, a house-style score and a
reject-and-reroll loop to fight its own vocabulary, and templates still
converged.

This module removes the menu. The model is told it is the art director, that
nothing is pre-decided, and to invent the template's design. Divergence comes
from three places instead of from constraint machinery:

  1. `brand_description` — a narrative design brief, not a colour list.
  2. Temperature 1.0 with nothing pulling toward a shared vocabulary.
  3. Per-scene documents, so each scene is designed on its own terms.

WHAT SURVIVES VALIDATION
------------------------
Only render-correctness, never taste:

  * scene count clamped to [3, 12] and roles coerced BY POSITION (first=intro,
    last=outro) — so the bookends are structural, not something the model can
    forget;
  * `image_mode` restricted to "background" | "half" with a side, because those
    are the only two forms that stay readable at every copy length;
  * fonts/decor/surface/transitions snapped through render_registry, because a
    value outside those sets silently renders as the system default.

This stage can never fail generation: `fallback_design_docs()` synthesises a
usable doc set if the model fails twice.
"""
from __future__ import annotations

import json
import re
from typing import Any

import dspy

from app.dspy_modules import ensure_dspy_configured, get_design_doc_lm
# The ONE taxonomy, imported rather than restated. `match_scenes_to_archetypes`
# keys on these exact strings, so a duplicated list here would drift and silently
# break content routing — and duplicated vocabularies are what produced the
# convergence this whole refactor removed.
from app.services.content_classifier import CONTENT_TYPES
from app.services.render_registry import validate_render_hints

# 3 = the two-tier type contract. props.titleFontSize sizes props.sceneTitle
# (the scene's title and largest type); props.descriptionFontSize sizes
# props.displayText and every content prop, label and caption. There is no
# eyebrow tier and no props.sceneTitleFontSize.
#
# v1/v2 templates bound titleFontSize to props.displayText and demoted the title
# to a small eyebrow. Their stored code, sample copy and font defaults are
# untouched and keep rendering that way — this number is how every read path
# tells the two contracts apart.
DESIGN_DOC_VERSION = 3

# Scene count, INCLUDING the intro and outro — so the model is choosing 6-9
# content scenes between its bookends.
#
# The floor is high on purpose: a blog post has enough beats to fill it, and a
# short template forces several unrelated sections through one layout, which
# reads as repetition even when the layouts themselves are distinct. The ceiling
# is where per-scene generation cost stops buying variety — past it the model
# starts producing near-duplicates of scenes it already designed.
MIN_SCENES = 8
MAX_SCENES = 11

# Prose docs shorter than this are not designs, they are labels ("a metrics
# scene"), and a scene built from one falls back to the model's house style.
MIN_SCENE_DOC_CHARS = 80
MIN_GENERAL_DOC_CHARS = 150

IMAGE_MODES = ("background", "half")
LANDSCAPE_SIDES = ("left", "right")
PORTRAIT_SIDES = ("top", "bottom")
IMAGE_SIDES = LANDSCAPE_SIDES + PORTRAIT_SIDES

# Content kinds every template must be able to render.
#
# A blog post routinely contains all four, and each needs a layout built for it —
# a process forced into a statistics layout is how a template starts looking
# generic. These fix the scene's PURPOSE only: two templates' metrics scenes
# should look nothing alike.
#
# Not a design vocabulary. `plain`, `bullets`, `quote` and `code` are deliberately
# NOT required: they are the director's to choose, and forcing a code scene onto a
# brand that never shows code would be worse than omitting it.
REQUIRED_CONTENT_TYPES = ("metrics", "timeline", "comparison", "steps")

# Which OTHER content kinds a layout built for one kind can still host well.
#
# A scene's design doc names the single kind it was built for, and that becomes
# its primary routing key. But a template has 6-9 content layouts and an article
# has whatever it has, so an article with three "bullets" sections and no
# timeline would send everything to one layout and leave the rest unused. These
# are the SECOND-choice matches: a steps layout renders a timeline acceptably
# because both are ordered sequences; a metrics layout hosts a comparison
# because both set figures against each other.
#
# Strictly a fallback ranking — `match_scenes_to_archetypes` consumes primaries
# before any of these, so a real metrics layout always beats a metrics-capable
# comparison layout. Keys and values must be members of CONTENT_TYPES.
COMPATIBLE_CONTENT_TYPES: dict[str, tuple[str, ...]] = {
    "steps": ("timeline", "bullets"),
    "timeline": ("steps", "bullets"),
    "bullets": ("steps", "plain"),
    "metrics": ("comparison",),
    "comparison": ("metrics", "bullets"),
    "quote": ("plain",),
    "plain": ("quote", "bullets"),
    "code": ("plain",),
}

# What a bookend holds. Neither is content-routed — the intro carries the title
# and the outro the CTA — so "plain" is the honest label for both.
_BOOKEND_CONTENT_TYPE = "plain"

# The smallest type that survives a 1920x1080 frame after H.264. Below this a
# label is illegible in playback, so a doc that names such a size is asking the
# scene builder to produce something unreadable.
MIN_ON_SCREEN_PX = 22

# A doc's px values are scaled up by whatever factor lifts its SMALLEST type to
# the floor — but only up to this, because beyond it the doc was written at a
# wholly different scale and rescaling would blow up its headlines. Such a doc is
# better re-rolled than patched.
MAX_TYPE_RESCALE = 2.75

# Sizes at or below this are almost never type — they are hairlines, borders,
# gaps and radii, which are legitimately small. Rescaling them would thicken
# every rule in the design.
#
# The exception is a value the doc explicitly calls type ("a label at 6px"):
# ignoring it there would let a wholly UI-scale doc through unrepaired, because
# its smallest TYPE size never registers. _TYPE_CONTEXT_RE catches that.
_NON_TYPE_PX_CEILING = 8

# Whether a SMALL px value describes type, decided by what the number is
# attached to rather than by what appears near it.
#
# Two earlier attempts failed on real docs, and both failure modes are worth
# keeping in mind:
#   * a wide "any typographic word within 40 chars" window matched
#     "a red dot (6px diameter)" and rejected a usable doc at x22;
#   * adding a forward exclusion list still matched "Below the heading, a 1px
#     full-width rule", because the disqualifying noun ("rule") comes AFTER the
#     number while the type word ("heading") comes before it.
#
# So the test is now the noun the number MODIFIES — the words immediately
# following it, plus the shape/rule vocabulary that disqualifies it outright.
# Anything ambiguous is treated as non-type: a missed rescale merely leaves one
# small label, whereas a false positive throws away the whole design.
_SHAPE_NOUN_RE = re.compile(
    r"^\s*(?:diameter|wide|tall|high|thick|thin|rule|line|border|stroke|dot|bar"
    r"|square|circle|gap|inset|margin|padding|radius|grid|spacing|tick|marker"
    r"|full-width|solid|dashed)",
    re.IGNORECASE,
)
_TYPE_NOUN_RE = re.compile(
    r"\b(?:type|text|label|caption|eyebrow|kicker|headline|heading|title|body"
    r"|copy|numeral|font|serif|sans|monospace|wordmark|lettering)\b"
    r"[^.;]{0,24}$",
    re.IGNORECASE,
)

_PX_RE = re.compile(r"(?<![\w.])(\d{1,3})\s*px\b")

# "56-64px" / "56 to 64px" — only the second number carries the unit, so a
# naive px-only rewrite turns the range inside out ("56-117px"). Matched first
# so both ends scale together.
_PX_RANGE_RE = re.compile(r"(?<![\w.])(\d{1,3})\s*(-|–|\s+to\s+)\s*(\d{1,3})\s*px\b")


def _rescale_doc_type(doc: str) -> tuple[str, float]:
    """Lift a doc's undersized type to the on-screen floor.

    Returns (doc, factor). factor == 1.0 means nothing needed changing.

    The design stage is told the canvas size, but when it ignores that and writes
    "12px" the scene builder faithfully renders 12px — measured on template 174,
    where 48 of 76 px values were <=24px. This is the deterministic backstop for
    that, applied to the WHOLE doc proportionally so the design's internal
    hierarchy (label : body : headline) survives intact; scaling only the
    offending values would flatten it.

    Values <= _NON_TYPE_PX_CEILING are left alone — they are hairlines and gaps,
    not type.
    """
    def _is_type(m: re.Match) -> bool:
        """Whether this px value describes TYPE (and so must clear the floor)."""
        px = int(m.group(1))
        if px > _NON_TYPE_PX_CEILING:
            return True
        # Small: type only if the noun it modifies is not a shape/rule AND a
        # typographic noun sits just before it. See _SHAPE_NOUN_RE.
        if _SHAPE_NOUN_RE.match(doc[m.end() : m.end() + 24]):
            return False
        return bool(_TYPE_NOUN_RE.search(doc[: m.start()]))

    sizes = [int(m.group(1)) for m in _PX_RE.finditer(doc) if _is_type(m)]
    if not sizes:
        return doc, 1.0
    smallest = min(sizes)
    if smallest >= MIN_ON_SCREEN_PX:
        return doc, 1.0

    factor = MIN_ON_SCREEN_PX / smallest
    if factor > MAX_TYPE_RESCALE:
        # Written at an entirely different scale; the caller re-rolls instead.
        return doc, factor

    def _scale(px: int) -> int:
        return max(MIN_ON_SCREEN_PX, round(px * factor))

    def _sub_range(m: re.Match) -> str:
        lo, sep, hi = int(m.group(1)), m.group(2), int(m.group(3))
        if not _is_type(m):
            return m.group(0)
        return f"{_scale(lo)}{sep}{_scale(hi)}px"

    def _sub(m: re.Match) -> str:
        if not _is_type(m):
            return m.group(0)
        return f"{_scale(int(m.group(1)))}px"

    # Ranges first: "56-64px" carries the unit only on the second number, so a
    # px-only pass would scale the top and leave the bottom, inverting the range.
    return _PX_RE.sub(_sub, _PX_RANGE_RE.sub(_sub_range, doc)), factor


class GenerateTemplateDesignDocs(dspy.Signature):
    """Design a video template for this brand, from scratch.

    You are the art director. Nothing is pre-decided: there is no layout
    catalog, no component menu, no style preset, no list of eras or motifs to
    choose from. Invent this template's design.

    Produce a GENERAL doc — the template's shared identity: palette roles,
    typographic character, spatial system, motion personality, and the recurring
    visual thread that ties the scenes together. Every scene inherits it, and it
    is what makes the template read as one thing rather than a pile of slides.

    Then produce ONE doc PER SCENE — 8 to 11 scenes INCLUDING the opening and
    the ending. The FIRST scene is always the opening, the LAST always the
    ending.

    BETWEEN THEM, FOUR SCENES ARE REQUIRED. A blog post routinely contains all
    four kinds of content, and each needs a layout actually built for it —
    forcing a process into a layout designed for statistics is how a template
    starts looking generic:

      metrics     two to four figures with labels; the NUMBERS are the focal
                  element, set far larger than anything around them
      timeline    dated or sequential events, in order, with the progression
                  itself visible
      comparison  two things set against each other, given equal weight
      steps       an ordered process, numbered, read as a sequence

    Then add 2 to 5 MORE scenes of your own choosing — a quote, a list, a plain
    narrative beat, a code sample, whatever this brand's story actually needs.

    THESE ARE PURPOSES, NOT DESIGNS. Two templates' metrics scenes must look
    nothing alike: one a ruled ledger with figures on a baseline, another a
    single hero numeral with a side rail, another a quadrant. What is fixed is
    what the scene is FOR — never how it looks. Design each one from this
    brand's own identity, exactly as you would an unconstrained scene.

    Each scene doc must be COMPLETE enough to build the scene from alone:
    its visual description, its concrete layout geometry (where things sit, at
    what proportion, in BOTH landscape and portrait), its focal element, its
    typographic treatment, and its motion beat. Write it as instructions to
    someone who cannot see the other scenes.

    EVERY SCENE HAS THE SAME FOUR ZONES. Place all four in every doc — a scene
    that designs around only one of them cannot be built:

      1. THE TITLE (props.sceneTitle) — a 5 to 7 word line naming what this
         scene is about. It is the scene's MAIN LABEL and its LARGEST TYPE.
         Say where it sits and how it is treated.
      2. THE DISPLAY TEXT (props.displayText) — one or two short sentences of
         supporting copy, set at body scale beneath or beside the title.
      3. THE CONTENT PROPS — whatever this scene's content type carries
         (bullets, metrics, steps, a timeline, a quote, a comparison, code).
         Set at body scale, as their own rows or cells.
      4. THE IMAGE — only when this scene carries one; see IMAGES below.

    THERE ARE EXACTLY TWO TYPE SIZES ON A FRAME: the title's, and one body size
    shared by the display text, the content props, and every label, caption and
    marker. Do NOT design a third tier — no small tracked kicker above the
    title, no eyebrow, no chapter label sized independently. A scene needing a
    label should make it a label AT BODY SIZE. This is a hard constraint on the
    build, not a stylistic preference: there is no third size to give it.

    EVERY SCENE'S TITLE IS TREATED DIFFERENTLY. You can see the other scenes in
    this template; make each title's placement, alignment, and entrance its own
    — one flush left over a rule, one centred and large, one set against the
    image edge. Nine scenes whose titles all sit top-left in the same weight is
    one scene repeated nine times.

    IMAGES. Decide per scene whether it carries an image at all. A scene whose
    design is purely typographic SHOULD say no — a template where every scene
    demands a photo is a worse template. When a scene does carry one, it must
    use EXACTLY ONE of two forms, because these are the only two that stay
    readable at every copy length:

      "background" - the image fills the frame behind everything, always with an
                     overlay/scrim above it so the type stays legible. The image
                     itself stays opaque; readability comes from the scrim.
      "half"       - the image occupies exactly one half: left or right in
                     landscape, top or bottom in portrait. Say which.

    No insets, no floating image cards, no collages, no quarter-panels, no
    circular crops.

    THE FIRST SCENE IS THE VIDEO'S TITLE CARD, AND MUST READ AS AN OPENING.
    Its TITLE (props.sceneTitle) is the video's title, the single focal element,
    and the LARGEST TYPE IN THE TEMPLATE — set it at the very top of the size
    range, not at the size a content scene uses. The display text is a subtitle
    beneath it at body scale. An opening carries NO bullets, no metric grid, no
    timeline, no step list: a title card that arrives already full of data is
    not an opening, it is a content slide in the wrong position. Give the title
    real focal presence — this is the frame that establishes the whole video.

    THE LAST SCENE MUST READ AS AN ENDING. Its title is a sign-off, and the
    closing call-to-action buttons and social handles are supplied to it at
    render time — design a closing scene that HOSTS them inside its own layout,
    with real room reserved for a row of buttons and a row of handles. Like the
    opening it carries no content props: an ending is a close, not another data
    beat. Do not design a generic centred card, and do not omit space for the
    CTA and socials.

    THE BRAND LOGO IS NOT YOURS TO PLACE. It is a corner watermark the render
    path composites over every finished frame, at a size and position no scene
    controls. Never design a scene around a logo, and keep the bottom-right
    corner free of anything the watermark would sit on top of.

    THE SCENE LAYOUTS MUST BE INDEPENDENT DESIGNS. Not one geometry recoloured N
    times, and not variations on a theme — genuinely different compositions that
    happen to share an identity. Two scenes with the same skeleton is the
    failure mode to avoid. If two of your scenes could be described by the same
    sentence, redesign one of them.

    YOU ARE DESIGNING A 1920x1080 VIDEO FRAME (or 1080x1920 portrait) — NOT A
    WEB PAGE. It is watched from across a room and compressed to H.264. Type that
    reads fine in a UI is invisible here: 12px is a sixth of a percent of the
    frame height and does not survive the encoder. NOTHING SMALLER THAN 22px
    EVER APPEARS ON SCREEN. That is a floor, not a target:

        hero numeral   120-240px      headline        48-88px
        sub-head       40-64px        body copy       28-36px
        caption        24-30px        label / eyebrow 22-28px

    (Those are LANDSCAPE figures. Portrait is SMALLER, not larger — the canvas
    is 1080 wide against landscape's 1920, so the same point size eats nearly
    twice the line: headline 36-60px, body 26-38px there.)

    PREFER DESCRIBING TYPE BY ROLE AND RELATIVE WEIGHT — "a small monospace
    label, roughly a third the size of the value beside it" — over absolute
    pixels. The scene builder derives exact sizes from a scale, and a role reads
    correctly at any canvas size. Where you do name a number, take it from the
    ranges above.

    The same applies to every other measurement: spacing, rules and margins are a
    percentage of the frame or a multiple of the type size, not a UI-scale
    constant. A 1px hairline and a 4px gap disappear at this scale.

    COLOUR: name roles ("the brand accent", "the canvas colour", "the text
    colour at 60%"), not hex values. The scene builder binds those to the user's
    live palette, so a hex you invent here is a colour the user can never change
    — and two independently-chosen hexes are how a scene ends up dark-on-dark.
    Say what a colour IS FOR and let the palette supply it.

    THIS TEMPLATE HAS EXACTLY THREE COLOURS — accent, canvas, text — AND NO
    OTHERS. Do not name a hue at all: no "vivid blue category cards", no "deep
    navy panel", no "warm coral marker". Not a hex, not a colour word, not a
    secondary palette.

    The brief you are given DESCRIBES A WEBSITE, and websites carry secondary
    palettes this template does not have. A brief saying the brand uses "vivid
    blue, purple and deep navy category cards" is telling you what the brand
    looks like in a browser, NOT giving you colours to design with. Write that
    energy into the accent's ROLE and into the composition instead — more
    accent, bolder blocks, higher contrast.

    This is the single most expensive thing to get wrong here: the scene builder
    is HARD-GATED on the three palette colours, so a doc that asks for a blue
    card produces a scene that is rejected and rebuilt from scratch, every time,
    until the rollouts run out.
    """

    brand_context: str = dspy.InputField(
        desc="The brand's factual data: colours, fonts, style, category, patterns."
    )
    brand_description: str = dspy.InputField(
        desc="A narrative design brief for this brand — its register, temperature "
             "and compositional character. This is your strongest signal; design "
             "FROM it rather than from the colour values."
    )
    user_brief: str = dspy.InputField(
        desc="The user's own words, when they supplied a prompt or document "
             "(may be empty). Explicit requests here outrank your own instincts."
    )

    general_doc: str = dspy.OutputField(
        desc="The template's shared design identity, as prose. Palette roles, "
             "typographic character, spatial system, motion personality, the "
             "recurring visual thread. No JSON, no bullet lists of enum values."
    )
    scenes_json: str = dspy.OutputField(
        desc='JSON array, ORDERED. The first element must be the opening '
             '(role="intro") and the last the ending (role="outro"); everything '
             'between is role="content". Each element: '
             '{"id": short_slug, "role": "intro"|"content"|"outro", '
             '"doc": the full prose design document for this scene, '
             '"content_type": one of plain|bullets|steps|metrics|code|quote'
             '|comparison|timeline — WHAT KIND OF CONTENT this scene is built '
             'to hold. The four required scenes carry "metrics", "timeline", '
             '"comparison" and "steps"; the bookends are "plain". This routes '
             'real article content to the right layout, so it must describe the '
             'scene honestly rather than flatter it. '
             '"best_for": ONE SENTENCE naming the kind of article content this '
             'scene should receive, written for whoever assigns real content to '
             'it later — e.g. "A dense scannable list of named features." or '
             '"Two or three figures given equal weight." Several scenes in this '
             'template will share a content_type, and this sentence is what '
             'tells them apart, so say what makes THIS one the right home: how '
             'many items it holds well, how much text each can carry, and what '
             'it emphasises. Do NOT restate the visual design — whoever reads '
             'this is choosing content, not drawing the scene. '
             '"supports_image": true|false, '
             '"image_mode": "background"|"half"|null, '
             '"image_side": "left"|"right"|"top"|"bottom"|null}. '
             'image_mode and image_side are null when supports_image is false. '
             'For "background", image_side is null. For "half", give the '
             'landscape side ("left"/"right") OR the portrait side '
             '("top"/"bottom") — the other orientation is derived. '
             'REMINDER, because it governs every doc you write here: this is a '
             '1920x1080 VIDEO frame, so no type smaller than 22px is ever '
             'named (body 28-36, headline 68-100, hero numeral 120-240), and '
             'colours are named by ROLE (accent / canvas / text), never as hex.'
    )
    render_hints: str = dspy.OutputField(
        desc='JSON: {"heading_font": ..., "body_font": ..., "surface_default": ..., '
             '"decor_system": ..., "transition_family": [...]}. These are the few '
             'values the renderer must be able to resolve. Name what actually '
             'fits the design you just wrote; anything unrenderable is snapped to '
             'the nearest real value rather than rejected.',
        # OPTIONAL, and deliberately so. JSONAdapter compares the parsed keys to
        # the signature with strict equality (`fields.keys() != output_fields
        # .keys()`), so ONE missing field raises AdapterParseError and the whole
        # design stage is thrown away — measured on template 181, which lost a
        # complete, high-quality doc set (general_doc + all 8 scenes present)
        # because this single trailing field was truncated from the response.
        # It ran out of attempts and fell back to the deterministic docs.
        #
        # A default makes the field optional to `apply_output_field_defaults`,
        # which fills it in instead of raising. Nothing is lost: these values
        # are advisory and validate_render_hints("") already returns the full
        # default identity + transition set.
        default="",
    )


def _extract_json(raw: Any, want: type) -> Any:
    """Parse a JSON value out of an LLM field, tolerating fences and prose.

    Models wrap JSON in ```json fences, prepend "Here is the array:", or emit a
    trailing comma. None of that should cost a design stage, so this digs the
    first well-formed array/object out of the text rather than failing.
    """
    if isinstance(raw, want):
        return raw
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None

    # Strip markdown fences.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, want):
            return parsed
    except (ValueError, TypeError):
        pass

    # Fall back to the first balanced array/object in the text.
    opener, closer = ("[", "]") if want is list else ("{", "}")
    start = text.find(opener)
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == opener:
            depth += 1
        elif text[i] == closer:
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(text[start : i + 1])
                    return parsed if isinstance(parsed, want) else None
                except (ValueError, TypeError):
                    return None
    return None


def _slug(value: Any, fallback: str) -> str:
    if not isinstance(value, str) or not value.strip():
        return fallback
    out = re.sub(r"[^a-z0-9_]+", "_", value.strip().lower()).strip("_")
    return out[:48] or fallback


def _normalise_image(scene: dict, repairs: list[str], label: str) -> None:
    """Force a scene onto one of the two legal image forms, or off images.

    Mutates `scene` in place. The two forms exist because they are the only ones
    that stay readable at every copy length; an inset or a collage looks fine
    with the sample text and breaks on a real headline.
    """
    supports = scene.get("supports_image")
    if not isinstance(supports, bool):
        # Ambiguous rather than absent: an image_mode implies it meant yes.
        supports = bool(scene.get("image_mode"))
        repairs.append(f"{label}: supports_image was not a bool -> {supports}")

    if not supports:
        scene["supports_image"] = False
        scene["image_mode"] = None
        scene["image_side"] = None
        return

    mode = scene.get("image_mode")
    if not isinstance(mode, str) or mode.strip().lower() not in IMAGE_MODES:
        # A capable scene with no legal mode: "half" is the safer default —
        # it cannot hide the copy the way an unscrimmed background can.
        repairs.append(f"{label}: image_mode {mode!r} -> 'half'")
        mode = "half"
    else:
        mode = mode.strip().lower()
    scene["supports_image"] = True
    scene["image_mode"] = mode

    if mode == "background":
        scene["image_side"] = None
        return

    side = scene.get("image_side")
    side = side.strip().lower() if isinstance(side, str) else ""
    if side not in IMAGE_SIDES:
        repairs.append(f"{label}: image_side {side!r} -> 'left'")
        side = "left"
    scene["image_side"] = side


def _normalise_scenes(raw: Any, repairs: list[str]) -> list[dict] | None:
    """Coerce the model's scene array into a usable, ordered plan.

    Returns None when there is nothing salvageable, so the caller can retry or
    fall back.
    """
    items = _extract_json(raw, list)
    if not isinstance(items, list):
        return None

    scenes: list[dict] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        doc = item.get("doc")
        if not isinstance(doc, str) or len(doc.strip()) < MIN_SCENE_DOC_CHARS:
            # A one-line "doc" is a label, not a design; a scene built from it
            # reverts to the model's house style, which is what we are escaping.
            repairs.append(f"scene {i}: doc too short ({len(str(doc or ''))} chars), dropped")
            continue
        _ct = item.get("content_type")
        _ct = _ct.strip().lower() if isinstance(_ct, str) else ""
        scene = {
            "id": _slug(item.get("id"), f"scene_{i}"),
            "role": item.get("role"),
            "doc": doc.strip(),
            # Unknown values fall to "plain" rather than being dropped: an
            # unroutable scene still renders, it just never wins a content match.
            "content_type": _ct if _ct in CONTENT_TYPES else _BOOKEND_CONTENT_TYPE,
            # One sentence saying what article content belongs here. Several
            # scenes share a content_type, so this is what tells them apart when
            # the layout is chosen; `content_type` alone can only say "any of
            # these three". Absent on older docs — _archetype_entry falls back
            # to a generic line per content kind.
            "best_for": (
                item.get("best_for").strip()
                if isinstance(item.get("best_for"), str) else ""
            ),
            "supports_image": item.get("supports_image"),
            "image_mode": item.get("image_mode"),
            "image_side": item.get("image_side"),
        }
        scenes.append(scene)

    if len(scenes) < MIN_SCENES:
        # Short of the floor. Reported rather than padded: a template is only as
        # varied as the layouts actually designed for it, and synthesising the
        # missing scenes here would mean inventing designs the art-direction
        # stage never wrote — exactly the generic filler this refactor removes.
        # generate_design_docs() retries, and falls back to a full doc set if the
        # second attempt is short too.
        repairs.append(f"only {len(scenes)} usable scenes, need {MIN_SCENES}")
        return None

    if len(scenes) > MAX_SCENES:
        # Keep the bookends; drop from the middle, which is where repetition
        # collects anyway.
        repairs.append(f"scene count {len(scenes)} -> {MAX_SCENES}")
        scenes = scenes[: MAX_SCENES - 1] + [scenes[-1]]

    # Roles are decided by POSITION, not by what the model labelled them.
    # A model that forgets to mark its ending must still produce a template with
    # an ending, and the pipeline keys off these roles for CTA placement.
    for i, scene in enumerate(scenes):
        if i == 0:
            expected = "intro"
        elif i == len(scenes) - 1:
            expected = "outro"
        else:
            expected = "content"
        if scene.get("role") != expected:
            repairs.append(f"{scene['id']}: role {scene.get('role')!r} -> {expected!r} (by position)")
        scene["role"] = expected

    # Bookends are never content-routed: the intro carries the title, the outro
    # the CTA. Labelling them otherwise would let an article's metrics land on
    # the title card.
    scenes[0]["content_type"] = _BOOKEND_CONTENT_TYPE
    scenes[-1]["content_type"] = _BOOKEND_CONTENT_TYPE

    # THE ENDING NEVER CARRIES AN IMAGE.
    #
    # The render path forces this anyway (see build_custom_meta), but a doc that
    # still ASKS for one produces scene code built around an image slot — a
    # layout with a permanent hole in it once the backend declines to fill it.
    # Stamping it here means the scene builder never sees an image-capable
    # ending, so the geometry it designs is the geometry that ships.
    #
    # An ending is a call to action: a photo behind the CTA and the social
    # handles competes with the only elements that scene exists to present.
    scenes[-1]["supports_image"] = False
    scenes[-1]["image_mode"] = None
    scenes[-1]["image_side"] = None

    # De-duplicate ids — they become layout ids downstream, where a collision
    # would silently make two scenes share prop schemas and image capability.
    seen: set[str] = set()
    for i, scene in enumerate(scenes):
        base = scene["id"]
        if base in seen:
            n = 2
            while f"{base}_{n}" in seen:
                n += 1
            scene["id"] = f"{base}_{n}"
        seen.add(scene["id"])

    for scene in scenes:
        _normalise_image(scene, repairs, scene["id"])
        # Lift web-scale type to the on-screen floor. Done per scene rather than
        # across the set so one scene written at UI scale does not drag up a
        # sibling that was already correct.
        _doc, _factor = _rescale_doc_type(scene["doc"])
        if _factor > MAX_TYPE_RESCALE:
            repairs.append(
                f"{scene['id']}: type written at UI scale (x{_factor:.1f} off) — unusable"
            )
            return None
        if _factor != 1.0:
            scene["doc"] = _doc
            repairs.append(f"{scene['id']}: type scaled x{_factor:.2f} to the {MIN_ON_SCREEN_PX}px floor")

    return scenes


def _missing_required_types(scenes: list[dict]) -> list[str]:
    """Which REQUIRED_CONTENT_TYPES no middle scene covers."""
    present = {
        s.get("content_type")
        for s in scenes[1:-1]  # bookends are never content-routed
        if isinstance(s, dict)
    }
    return [t for t in REQUIRED_CONTENT_TYPES if t not in present]


def _fill_missing_types(docs: dict, theme: dict | None, name: str) -> list[str]:
    """Graft the fallback's scene for each missing required type. Mutates `docs`.

    The last resort, reached only when two samples both missed a type. A grafted
    scene is generic — it comes from the deterministic fallback, not from this
    brand's director — so this trades a little distinctiveness for the guarantee
    that every template can render every kind of content. Losing the whole run
    over one absent scene type would be the worse trade.
    """
    notes: list[str] = []
    missing = _missing_required_types(docs["scenes"])
    if not missing:
        return notes

    donors = {
        s["content_type"]: s
        for s in fallback_design_docs(theme, name)["scenes"]
        if s.get("content_type") in missing
    }
    seen_ids = {s["id"] for s in docs["scenes"]}
    for t in missing:
        donor = donors.get(t)
        if not donor:
            continue
        graft = dict(donor)
        graft["role"] = "content"
        while graft["id"] in seen_ids:
            graft["id"] = f"{graft['id']}_2"
        seen_ids.add(graft["id"])
        # Insert before the ending so the outro stays last.
        docs["scenes"].insert(len(docs["scenes"]) - 1, graft)
        notes.append(f"grafted a generic '{t}' scene (director omitted it twice)")

    # The graft can push past the ceiling; drop from the middle, never a bookend
    # and never one of the required scenes.
    while len(docs["scenes"]) > MAX_SCENES:
        for i in range(len(docs["scenes"]) - 2, 0, -1):
            if docs["scenes"][i]["content_type"] not in REQUIRED_CONTENT_TYPES:
                docs["scenes"].pop(i)
                break
        else:
            break
    return notes


def validate_design_docs(
    general_doc: Any,
    scenes_json: Any,
    render_hints: Any,
    *,
    require_content_types: bool = True,
) -> tuple[dict | None, list[str]]:
    """Validate + repair one design-doc set. Returns (docs, repairs).

    `docs` is None when the output is unusable and the caller should retry.
    Everything recoverable is repaired rather than rejected — a design stage
    that fails costs the user a full generation.
    """
    repairs: list[str] = []

    doc = general_doc if isinstance(general_doc, str) else ""
    doc = doc.strip()
    if len(doc) < MIN_GENERAL_DOC_CHARS:
        # The general doc is the only thing holding the scenes together; without
        # it they are independent designs with nothing shared, which is the
        # opposite failure from the one this refactor fixes.
        return None, [f"general_doc too short ({len(doc)} chars)"]

    scenes = _normalise_scenes(scenes_json, repairs)
    if scenes is None:
        return None, repairs + ["scenes_json unusable"]

    missing = _missing_required_types(scenes) if require_content_types else []
    if missing:
        # Reported, not patched here. generate_design_docs() re-rolls once — a
        # second sample usually covers them, and a scene the DIRECTOR designed
        # beats one grafted in from the generic fallback. Only if the retry also
        # misses does the caller fill the gap.
        repairs.append(f"missing required scene types: {', '.join(missing)}")
        return None, repairs

    hints = validate_render_hints(render_hints)

    return (
        {
            "version": DESIGN_DOC_VERSION,
            "general_doc": doc,
            "scenes": scenes,
            "identity": hints["identity"],
            "transition_family": hints["transition_family"],
        },
        repairs,
    )


def generate_design_docs(
    brand_context: str,
    brand_description: str = "",
    user_brief: str = "",
    *,
    attempts: int = 2,
    theme: dict | None = None,
    name: str = "",
) -> tuple[dict | None, list[str]]:
    """Author the template's design docs. Returns (docs, repairs).

    Returns (None, repairs) if every attempt fails — the caller falls back to
    `fallback_design_docs()`. Never raises for a model failure.
    """
    ensure_dspy_configured()
    lm = get_design_doc_lm()
    predictor = dspy.ChainOfThought(GenerateTemplateDesignDocs)

    all_repairs: list[str] = []
    for attempt in range(attempts):
        try:
            with dspy.context(lm=lm):
                result = predictor(
                    brand_context=brand_context,
                    brand_description=brand_description or "",
                    user_brief=user_brief or "",
                )
        except Exception as e:  # noqa: BLE001
            all_repairs.append(f"attempt {attempt + 1} raised {type(e).__name__}: {e}")
            print(f"[F7-DEBUG] [DESIGN-DOC] attempt {attempt + 1} raised: {e}")
            continue

        docs, repairs = validate_design_docs(
            getattr(result, "general_doc", ""),
            getattr(result, "scenes_json", ""),
            getattr(result, "render_hints", ""),
            # On the LAST attempt, a doc set whose only fault is a missing
            # required type is accepted and the gap is grafted below. Re-rolling
            # again would cost another call and usually miss the same type.
            require_content_types=(attempt < attempts - 1),
        )
        all_repairs.extend(repairs)
        if docs is not None:
            all_repairs.extend(_fill_missing_types(docs, theme, name))
            print(
                f"[F7-DEBUG] [DESIGN-DOC] {len(docs['scenes'])} scenes "
                f"({sum(1 for s in docs['scenes'] if s['supports_image'])} image-capable), "
                f"fonts={docs['identity']['heading_font']}/{docs['identity']['body_font']}, "
                f"repairs={len(repairs)}"
            )
            for s in docs["scenes"]:
                print(
                    f"[F7-DEBUG] [DESIGN-DOC]   {s['role']:<7} {s['id']:<24} "
                    f"img={s['image_mode'] or 'none'}"
                    f"{'/' + s['image_side'] if s['image_side'] else ''} "
                    f"doc={len(s['doc'])}c"
                )
            return docs, all_repairs
        print(f"[F7-DEBUG] [DESIGN-DOC] attempt {attempt + 1} unusable: {repairs}")

    return None, all_repairs


def fallback_design_docs(theme: dict | None, name: str = "") -> dict:
    """A deterministic doc set, used only when the model fails outright.

    Deliberately plain. Its job is to keep a generation alive, not to be a good
    design — a template built from this should be regenerated. It still honours
    the two image forms and the bookend rule so the rest of the pipeline behaves
    identically.
    """
    theme = theme if isinstance(theme, dict) else {}
    style = (theme.get("style") or "clean and modern").strip()
    category = (theme.get("category") or "general").strip()
    brand = (name or "the brand").strip()

    general = (
        f"A restrained template for {brand} ({category}). Visual identity: {style}. "
        "The brand accent is used only for rules, markers and emphasis; backgrounds "
        "stay on the brand canvas colour and body copy on the brand text colour. "
        "Typography carries the design: one clear focal element per scene, generous "
        "space around it, and a consistent left-aligned rhythm broken only where a "
        "scene calls for a centred statement. Motion is quiet — a single entrance "
        "beat per scene, short staggers, no competing animations."
    )

    def _scene(
        sid: str,
        role: str,
        doc: str,
        mode: str | None,
        side: str | None,
        content_type: str = _BOOKEND_CONTENT_TYPE,
    ) -> dict:
        return {
            "id": sid,
            "role": role,
            "doc": doc,
            "content_type": content_type,
            "supports_image": mode is not None,
            "image_mode": mode,
            "image_side": side,
        }

    scenes = [
        _scene(
            "opening", "intro",
            "The opening. A full-bleed image sits behind everything with a heavy scrim "
            "over it so the type stays legible. The brand logo sits top-left at a "
            "generous size; the headline is set large and low in the frame, aligned "
            "left, rising into place with a single spring. In portrait the headline "
            "moves to the vertical centre and the logo shrinks. One accent rule draws "
            "in beneath the headline as the scene settles.",
            "background", None,
        ),
        _scene(
            "statement", "content",
            "A purely typographic scene, no image. The headline is set very large and "
            "centred with wide margins, filling the frame on its own; a short eyebrow "
            "label sits above it in small caps with letter-spacing. In portrait the "
            "type scales down and the margins tighten. The words reveal in a short "
            "stagger; nothing else moves.",
            None, None,
        ),
        _scene(
            "detail", "content",
            "A split scene. The image occupies the left half at full height in "
            "landscape, and the top half at full width in portrait. The remaining half "
            "holds a stacked list of short rows, each with a small accent marker, "
            "entering one after another on a brief stagger. The rows are capped so they "
            "never overflow, and the text column is centred vertically in its half.",
            "half", "left", "bullets",
        ),
        _scene(
            "figures", "content",
            "A data scene with no image. Figures are laid out across a ruled baseline — "
            "a row in landscape, a stack in portrait — each numeral large and tabular "
            "with its label small and muted beneath. The numerals count up as they "
            "arrive, staggered left to right. A single hairline runs under the row.",
            None, None, "metrics",
        ),
        _scene(
            "quotation", "content",
            "A quotation scene, no image. The quote is set at large display size across "
            "the middle of the frame with an oversized punctuation mark bleeding off the "
            "left edge behind it, and the attribution sits beneath in small muted caps. "
            "In portrait the mark shrinks and the quote wraps to more lines. The quote "
            "reveals line by line; the attribution fades in last.",
            None, None, "quote",
        ),
        _scene(
            "feature", "content",
            "A split scene mirroring the earlier one: the image takes the RIGHT half at "
            "full height in landscape and the BOTTOM half in portrait. The other half "
            "carries a short headline over a paragraph of body copy, aligned to the "
            "inside edge with generous outer margin. The text side enters first, the "
            "image wipes in behind it.",
            "half", "right", "plain",
        ),
        _scene(
            "sequence", "content",
            "A stepped sequence with no image. Each item is a numbered row — a large "
            "muted numeral, a rule, then its label — stacked vertically in landscape and "
            "in portrait alike, but with fewer rows and tighter spacing in portrait. An "
            "accent line grows downward through the numerals as the rows arrive one "
            "after another.",
            None, None, "steps",
        ),
        _scene(
            "chronology", "content",
            "A timeline with no image. Events run along a single axis — horizontal in "
            "landscape, vertical in portrait — each marked by a node on an accent rule, "
            "with its date set small and tight above the label. The rule draws itself "
            "from the first node to the last as the scene opens, and each node pops in "
            "as the line reaches it. Events are capped so the axis never crowds.",
            None, None, "timeline",
        ),
        _scene(
            "versus", "content",
            "A comparison with no image, split down the middle by a single hairline. "
            "Each side carries a short heading above a stacked list, given equal width "
            "in landscape and equal height in portrait. The two sides enter from "
            "opposite edges and settle together, so the pairing reads as a balance "
            "rather than a sequence.",
            None, None, "comparison",
        ),
        _scene(
            "closing", "outro",
            "The ending. The brand logo sits centred in the upper third with the closing "
            "headline beneath it, and the call-to-action buttons and social handles are "
            "arranged in a row below that, inside the scene's own margins rather than "
            "as an overlay. In portrait everything stacks and the buttons go full-width. "
            "The whole group fades and rises together in one calm beat.",
            None, None,
        ),
    ]

    return {
        "version": DESIGN_DOC_VERSION,
        "general_doc": general,
        "scenes": scenes,
        **validate_render_hints(
            {
                "heading_font": (theme.get("fonts") or {}).get("heading"),
                "body_font": (theme.get("fonts") or {}).get("body"),
            }
        ),
    }


def scene_for_index(docs: dict | None, index: int) -> dict | None:
    """The scene doc at `index`, or None."""
    if not isinstance(docs, dict):
        return None
    scenes = docs.get("scenes")
    if not isinstance(scenes, list) or not (0 <= index < len(scenes)):
        return None
    scene = scenes[index]
    return scene if isinstance(scene, dict) else None


def content_scenes(docs: dict | None) -> list[dict]:
    """The middle scenes, in order (everything that is not a bookend)."""
    if not isinstance(docs, dict):
        return []
    return [
        s
        for s in (docs.get("scenes") or [])
        if isinstance(s, dict) and s.get("role") == "content"
    ]
