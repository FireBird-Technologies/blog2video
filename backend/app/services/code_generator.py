"""
AI code generator — uses DSPy with Refine for self-correcting Remotion component generation.

Each scene is generated individually via DSPy ChainOfThought, wrapped in dspy.Refine
so failed validations trigger targeted feedback + retry on just the failing scene.
All scenes run in PARALLEL via asyncio.gather.
"""

import asyncio
import contextlib
import functools
import hashlib
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from functools import partial
from unittest.mock import patch

import dspy

from app.config import settings
from app.dspy_modules import (
    ensure_dspy_configured,
    get_custom_lm,
    get_scene_edit_lm,
    get_scene_type_lm,
)
from app.dspy_modules.design_doc import (
    MAX_SCENES,
    fallback_design_docs,
    generate_design_docs,
)
from app.models.custom_template import CustomTemplate
from app.services.scene_code_critic import critique_scene_code
from app.services.scene_content_schema import FIELDS_BY_TYPE, coerce_field
from app.services.code_validator import (
    clean_code,
    validate_component_code,
    validate_wrapped_component_code,
)

logger = logging.getLogger(__name__)

# 5 attempts per scene (1 initial + 4 retries). Affordable only because
# _suppress_offer_feedback() removes Refine's between-rollout advice call: a
# failing scene costs 5 LLM calls here, the same as 3 attempts cost before.
REFINE_N = 4
MAX_SCENE_EDIT_RETRIES = 3  # Repair attempts for a single-scene AI edit (P4)


class SceneEditExhausted(RuntimeError):
    """A single-scene edit used every repair attempt without producing valid code.

    Distinct from an ordinary RuntimeError so the API can show the user plain
    language instead of the validator trace this carries. The trace is kept on
    the exception for the server log and for support.
    """


# ─── DSPy Signatures ─────────────────────────────────────────


class GenerateDesignSystem(dspy.Signature):
    """Given a brand's visual identity, create a concrete CSS design system for video scenes.

    Output ONLY concrete CSS values (under 2000 chars) covering:
    - Background treatment: exact CSS (gradients, solid colors, or patterns)
    - Card/container style: border-radius, box-shadow, border, background
    - Text treatment: font sizes, text-shadow or glow, color usage

    COLOURS: use ONLY the three brand colours given in brand_context (accent, bg,
    text). Do NOT invent a fourth — no hand-picked greys for muted text, no
    second background tone for a gradient end, no semantic red/green. A scene
    that follows an invented colour is REJECTED by the palette gate, and the
    design system is the most common place those colours come from: a
    `--color-text-muted: #6B7280` here became a stubbed scene downstream.
    For secondary text and panel tints, say WHICH palette slot to use
    (a muted text, a panel fill, a hairline) rather than naming a hex —
    the renderer derives those from bg and text and guarantees they are readable.

    Do NOT include: spring configs, animation physics, decorative elements, or entrance patterns.
    Those are creative choices each scene makes independently.
    """

    brand_context: str = dspy.InputField(desc="Brand identity: name, colors, fonts, style, patterns, personality")
    design_system: str = dspy.OutputField(desc="Concise design system (under 2000 chars) with CSS values for backgrounds, cards, and text only. Every colour must be one of the brand's three (or one of them at partial alpha) — never an invented hex.")


class GenerateSceneCode(dspy.Signature):
    """Generate a single Remotion video scene as a React component.

    Write a component assigned to `const SceneComponent`. No imports — every API
    below is already a global.

    ════════════════════════════════════════════════════════════════════════
    THE TEN RULES. Every one is machine-checked; breaking any is an automatic
    reject and a wasted rebuild. Satisfy all ten FIRST, then design.

     1. TITLE AND DISPLAY TEXT — every scene renders BOTH, at the two different
        sizes rule 7 defines. Copy these shapes exactly:
            const { width, height } = useVideoConfig();
            const colW = width * (isPortrait ? 0.86 : 0.44);  // THIS text's box
            ...
            <FitText fontSize={titleSize} minFontSize={24} maxLines={2}
              containerWidth={colW} maxHeight={height*0.40}>{props.sceneTitle}</FitText>
            <FitText fontSize={bodySize} minFontSize={20} maxLines={4}
              containerWidth={colW} maxHeight={height*0.26}>{props.displayText}</FitText>
        `titleSize` is props.titleFontSize (the TITLE only); `bodySize` is
        props.descriptionFontSize (everything else) — both from rule 7. Never a
        bare number here, never another default, and NEVER `titleSize` on the
        display text: it is body copy, not a headline.
        THE TITLE ALWAYS GETS THE TALLER BOX: FitText shrinks to its maxHeight,
        so a title budgeted under the body renders smaller.
        Never put whiteSpace:'nowrap' on a FitText: it voids maxLines.
     2. FIT EVERY VARIABLE-LENGTH TEXT. props.quote and props.metrics values are
        checked too. Any text whose length you do not control gets <FitText>.
        EVERY <FitText> MUST BE TOLD ITS BOX — this is checked on each one:
          containerWidth = the REAL width in px of the box the text sits in,
            from useVideoConfig().width times your layout's fraction: a
            half-split ~0.44, a full-bleed line 0.86, a 40% rail 0.4. Without it
            FitText assumes 86% of the WHOLE frame — a ~2x overestimate inside a
            column, so text renders far too big and breaks mid-word.
          maxHeight = the height that text block actually owns, for anything
            that can wrap (maxLines > 1). Without it there is no vertical
            budget and long copy overflows downward off the frame.
        Never guess these as bare pixel numbers — always derive them from
        useVideoConfig() so they hold in BOTH orientations.
     3. MOTION — at least TWO interpolate()/spring() calls driving visible
        motion. interpolate ranges are NUMBERS ONLY (never '0%'); spring's
        from/to are NUMBERS, never objects.
     4. LOGO — on EVERY scene, guarded exactly like this:
            {props.logoUrl && typeof props.logoUrl === 'string' && (
              <Img src={props.logoUrl} data-logo="1" style={{width: 190, height: 'auto',
                   maxHeight: 190, objectFit: 'contain'}} />
            )}
        Required and checked, but props.logoUrl is undefined on every scene:
        the real brand mark is a corner watermark the render path composites
        over the finished frame. Never build a layout around it, and keep the
        bottom-right corner clear.
     5. IMAGE — do exactly what `scene_doc` says and nothing else.
        Its IMAGE section names one of three, and there is no fourth:
          BACKGROUND — full frame, rendered FIRST at zIndex 0, content above at
            zIndex 1 with position:'relative', and a BACKDROP OVERLAY between
            them. A full-bleed slot written AFTER the content paints over the
            layout and is rejected.
            The overlay is ALWAYS derived from the brand canvas — a gradient or
            wash built with withAlpha(bg, …), e.g.
                background: `linear-gradient(180deg, ${withAlpha(bg, 0.25)} 0%,
                             ${withAlpha(bg, 0.65)} 62%, ${withAlpha(bg, 0.88)} 100%)`
            NEVER a black or white wash and never a raw rgba() literal: a black
            scrim on a cream brand reads as a different template. Darken the
            overlay, never the <Img> — the photo stays fully opaque
            (objectFit:'cover', no opacity reduction).
          HALF — a BOUNDED box: 50% width x 100% height landscape, 100% x 50%
            portrait, on the side named. It is a normal flex/grid child. Never
            position:'absolute', never inset:0, never full-bleed — those make it
            a BACKGROUND, which is a different mode and is rejected here.
          NONE — declare no hasImage, render no props.imageUrl, reserve no slot.
        When there IS an image:
            const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
        and put data-content-img="1" on the slot's CONTAINER div, never on <Img>.
     6. COLOUR — three roles, read once at the top, and NEVER a hex literal for
        anything you draw:
            const bg = props.brandColors.background;
            const text = props.brandColors.text;
            const accent = props.brandColors.accent;
        BACKGROUND — the root fill is always `bg` (or the brand gradient when
          props.brandColors.bg2 exists). Never repaint the whole frame another
          colour: every scene shares one canvas, or the background changes as
          the viewer scrubs.
        TEXT — `text` is the colour of TYPE. EVERY string you paint uses it:
          headline, body, bullets, labels, captions, numerals, and anything from
          props.layoutProps. A kicker you invented is still text. On any surface
          that is not `bg`, use readableOn(thatSurface) so the type still clears
          4.5:1 against what is behind it.
        ACCENT — `accent` is for FILLS and SHAPES ONLY: rules, underlines,
          markers, borders, bars, dots, panel edges, icon strokes. It is NOT
          contrast-corrected, so using it AS TYPE is how the most important
          number on a frame becomes the least readable thing on it. For
          accent-coloured type: color: ensureContrast(accent, bg).
        Never introduce a fourth hue — withAlpha() gives you the same hue
        softer, and that is the right move for a tint, a scrim or a muted label.
        HARD GATE, and the most common rejection: colours named in the
        brand_context or a doc ("vivid blue cards") describe the brand's
        WEBSITE, not your palette. There are three. Use withAlpha(accent, …)
        where you wanted a second hue.
     7. TYPE SIZE — THERE ARE EXACTLY TWO SIZES ON THE FRAME AND NO THIRD.
        Both defaults are CHECKED NUMERICALLY. Write them once, at the top:
            const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68);
            const bodySize  = props.descriptionFontSize ?? (isPortrait ? 30 : 34);
        titleSize sizes props.sceneTitle and NOTHING ELSE. bodySize sizes
        EVERYTHING else: the display text, every content prop, and every label,
        caption, kicker and props.layoutProps string.

        props.sceneTitle IS NOT AN EYEBROW. Sizing it off bodySize is REJECTED —
        it puts the title at body scale and the Title slider then moves nothing.
        A small kicker above it is a SEPARATE string, from props.layoutProps.

        Four things are enforced:
          a. BOTH read their prop with ??. A hardcoded size makes the editor's
             sliders do nothing.
          b. BOTH defaults are `isPortrait ? P : L` ternaries, never one flat
             number.
          c. title > body in BOTH orientations. Aim ~2.2x landscape, ~1.7x
             portrait.
          d. Every default sits inside its band, INCLUSIVE:
                 title  landscape 48-88   portrait 36-60
                 body   landscape 28-44   portrait 26-38
             PORTRAIT IS SMALLER THAN LANDSCAPE HERE — the opposite of the
             usual convention, and the most common reason a scene is rejected.

        THERE IS NO props.sceneTitleFontSize — reading it is rejected, and a
        third constant is a slider the editor does not have. Every other size is
        a RATIO of `titleSize` or `bodySize` (a small label is bodySize * 0.8),
        never a second literal. Nothing below 22px: this is a 1920x1080 video
        watched across a room and crushed by H.264.
        WRAP THE TEXT REGION IN <FitBlock> so title and body shrink TOGETHER
        when the pair overflows:
            <FitBlock style={{display:'flex', flexDirection:'column', gap: 18}}>
              <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>…</FitText>
              <div style={{fontSize: bodySize}}>…</div>
            </FitBlock>
        A <FitText> fits its OWN box; only <FitBlock> sees that a title and a
        paragraph each fit while the pair overflows the column.
     8. FONTS — there are exactly TWO font props and no others:
            fontFamily: props.headingFont || "inherit"   // headings, display type
            fontFamily: props.bodyFont || "inherit"      // body, labels, captions
        The fallback is the literal "inherit", NEVER a font name. Any scene that
        renders body copy must bind props.bodyFont somewhere — a scene whose
        headings use the template's face while its body falls back to the system
        sans reads as two different designs.
        THERE IS NO MONO FONT PROP. For code, tickers, tabular figures or any
        other monospaced treatment, write the GENERIC family only:
            fontFamily: 'monospace'
        Never a named face — 'Geist Mono', 'JetBrains Mono', 'SF Mono' and the
        like are not loaded by the renderer, so they silently fall back to the
        system sans and the scene loses the exact distinction it asked for.
     9. ORIENTATION — declare it and branch on it:
            const isPortrait = props.aspectRatio === 'portrait';
        Render genuinely different JSX per orientation, not one tree with tweaked
        numbers. Any list/grid MUST branch. Cap every mapped array:
            (props.bullets ?? []).slice(0, isPortrait ? 3 : 4)
    10. NEVER — props.narrationText on screen (it is the voiceover);
        props.contentType as visible text; scene counters ("01 / 09"); invented
        sample copy or fallback arrays of fake data; overflow other than
        overflow:'hidden' on the root; any pre-injected name beyond FitText,
        FitBlock, readableOn, ensureContrast, withAlpha (and SocialIcons in the
        ending).
    ════════════════════════════════════════════════════════════════════════

    DESIGN FROM `scene_doc`. It describes THIS scene's layout, focal element,
    type treatment and motion beat, in both orientations. Build what it says —
    it was written for this brand. `general_doc` is the shared identity every
    scene inherits; `built_so_far` lists the other scenes, and yours must be a
    different composition from all of them.

    CRAFT — the measured defaults of this product's hand-built templates. Use
    them unless `scene_doc` says otherwise; it owns composition, these own craft.
      SAFE AREA   horizontal inset 6-8%; vertical 12-14% portrait / 5-7%
                  landscape. Content occupies 0.46-0.78 of the frame, never 1.0.
      TYPE        rule 7 owns the numbers and the two-tier rule. A hero NUMERAL
                  (a single stat, not the title) may go to 240.
      TRACKING    title -0.01 to -0.05em; small caps labels +0.06 to +0.2em.
      LEADING     title 1.0-1.15; body 1.3-1.5; numerals 0.95-1.05.
      WEIGHT      title 900; body 300-400; label 600-700.
      MOTION      spring {damping:20, stiffness:80} default;
                  {damping:16, stiffness:210, mass:1.2} for a slam.
                  Entrances: primary at frame 0-3, secondary +10, tertiary +25;
                  fades 12-20 frames; stagger i*3 (dense) or i*8 (cards).
                  EXIT at durationInFrames - 25, over 12-20 frames.
      SCRIM       3 stops, 180deg, inflection at 62%:
                  0.25 @0% -> 0.08 @30% -> 0.65 @62% -> 0.88 @100%.
      CAPS        metrics 3 · stack 3 · stats 4 · timeline 5 · code 12 lines.
      OVERFLOW    every flex child holding text sets minWidth: 0; running text
                  sets overflowWrap:'break-word'; fixed-size decals flexShrink:0.

    PROPS the scene receives:
      sceneTitle       THE SCENE'S TITLE, 5-7 words — its main label and the
                       LARGEST TYPE on the frame. Always rendered, at titleSize.
      displayText      supporting copy, 1-2 sentences. Always rendered, at
                       bodySize, alongside the content prop and the image.
      narrationText    the VOICEOVER — never rendered
      imageUrl? imageObjectPosition? imageZoom? hasVideo?
      logoUrl? brandImages?
      brandColors      { primary, accent, background, text, bg2? }
      aspectRatio      'landscape' | 'portrait'
      sceneIndex totalScenes contentType
      bullets? metrics? steps? timelineItems? quote? quoteAuthor?
      comparisonLeft? comparisonRight? codeLines? codeLanguage?
      chartTable? chartType? chartSummary?
      titleFontSize? descriptionFontSize? headingFont? bodyFont?
      layoutProps?     YOUR OWN EDITABLE FIELDS — DECLARE 2-5 ON EVERY SCENE.
                       Every string this scene invents — a kicker, a panel
                       label, a caption, a footnote — is read as
                         props.layoutProps?.kicker ?? "KEY POINTS"
                       never inlined as a literal. Those become the only fields
                       a user can edit; a hardcoded string is frozen forever.
                       camelCase, naming MEANING not styling. A key you declare
                       but never read this way is dropped.
      ctaProps?        ENDING SCENE ONLY — see the ending contract in scene_doc

    CONTENT ARRAYS: when props.bullets / steps / metrics / timelineItems is
    present, render each item as its OWN row or cell — never one paragraph —
    staggered by i*12 frames. When absent, fall back to splitting
    props.displayText into sentences, or render it as one item. NEVER invent
    example data, and never write `props.bullets || [{...}]`.

    STOCK FOOTAGE (props.hasVideo): a clip is already painted behind the
    component. Keep the image slot's geometry and its data-content-img="1"
    marker, leave it EMPTY (no <Img>, no backgroundColor, no nested
    gradient div), and make the root transparent. props.imageUrl is
    undefined here — never render the hasImage-false full-width branch,
    which has nowhere for the clip.

    AVAILABLE GLOBALS (do NOT import, do NOT redeclare):
      React · useCurrentFrame() · useVideoConfig() -> {fps, width, height,
      durationInFrames} · interpolate · spring · Easing · AbsoluteFill ·
      Sequence · Img · random(seed)
      FitText · FitBlock · readableOn(bg) · ensureContrast(fg, bg) ·
      withAlpha(hex, a) · SocialIcons (ending scene only)
    Everything else you build yourself from divs, spans and inline styles.

    EASING — this list is EXHAUSTIVE; any other member crashes the render.
      curves      linear ease quad cubic sin circle exp bounce step0 step1
      wrappers    in(fn) out(fn) inOut(fn)
      parametric  bezier(a,b,c,d) poly(n) back(s) elastic(b)
    No quint/quart/sine/expo/inOutCubic/easeInOut — compose instead:
        Easing.inOut(Easing.cubic) · Easing.out(Easing.exp)
        Easing.bezier(.16,1,.3,1)
    """

    brand_context: str = dspy.InputField(desc="Brand name, colors, fonts, style, category, personality")
    design_system: str = dspy.InputField(desc="Shared visual styling — follow for consistency")
    general_doc: str = dspy.InputField(
        desc=(
            "THE TEMPLATE'S SHARED DESIGN IDENTITY, written for this brand: palette roles, "
            "typographic character, spatial system, motion personality, the recurring visual "
            "thread. EVERY scene in this template inherits it, and that is what makes them read "
            "as one template rather than a pile of slides. Follow it — it OUTRANKS any generic "
            "habit or default you would otherwise apply."
        ),
        default="",
    )
    scene_doc: str = dspy.InputField(
        desc=(
            "THIS SCENE'S OWN DESIGN DOCUMENT — its visual description, concrete layout geometry "
            "in both orientations, focal element, typographic treatment, motion beat, and its "
            "image contract. It was written specifically for this scene. BUILD WHAT IT "
            "DESCRIBES: do not substitute a composition of your own, and do not fall back on a "
            "familiar arrangement because it is easier. Where it and this prompt disagree about "
            "LAYOUT, the document wins; where they disagree about the technical contract "
            "(props, validation rules), this prompt wins."
        ),
        default="",
    )
    built_so_far: str = dspy.InputField(
        desc=(
            "One-line summaries of the layouts ALREADY built in this template (empty for the "
            "first scene). Your scene must be a different composition from each of them — not a "
            "variation, not the same skeleton with different content. Two scenes that could be "
            "described by the same sentence is the failure to avoid."
        ),
        default="",
    )
    scene_type: str = dspy.InputField(desc="'intro', 'content', or 'outro'")
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes being generated")
    current_code: str = dspy.InputField(
        desc=(
            "Empty when generating fresh. When editing: the scene's CURRENT code. Produce a "
            "modified version of it, preserving everything the user did not ask to change."
        ),
        default="",
    )
    edit_instruction: str = dspy.InputField(
        desc=(
            "Empty when generating fresh. When editing: the user's requested change to this "
            "scene. Apply it faithfully. If it conflicts with layout_spec.geometry, THE USER "
            "WINS — the layout is theirs to change, and the blueprint is a starting point, not "
            "a constraint on what they may ask for. Keep every technical contract intact "
            "(props-only text, the image/logo conditionals, the data-content-img marker, "
            "overflow guards)."
        ),
        default="",
    )
    previous_failure: str = dspy.InputField(
        desc=(
            "Empty on the first attempt. On a retry: the EXACT validation error from your "
            "previous attempt, with the offending source lines when available. Fix EVERY "
            "error reported here. Change ONLY what is broken — keep the intended layout, "
            "geometry and motion of your previous attempt."
        ),
        default="",
    )

    code: str = dspy.OutputField(desc="Complete SceneComponent code (const SceneComponent = (props) => { ... };)")
    image_box_width_fraction_landscape: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the `if (!isPortrait) { ... }` (or `!p && ...`) branch of your code: "
            "fraction of the LANDSCAPE 1920x1080 canvas WIDTH occupied by the image container (0.0 to 1.0). "
            "Examples: 0.5 if image container is width: '50%' of the scene, 1.0 if width: '100%'. "
            "Read this directly from the width style you set on the element with data-content-img=\"1\" "
            "in the LANDSCAPE branch. If the scene has no image, output 1.0."
        )
    )
    image_box_height_fraction_landscape: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the LANDSCAPE branch of your code: "
            "fraction of the LANDSCAPE 1920x1080 canvas HEIGHT occupied by the image container (0.0 to 1.0). "
            "Examples: 1.0 if height: '100%' of scene, 0.5 if height: '50%' (top/bottom half). "
            "Read this from the height style of the LANDSCAPE branch's data-content-img element. "
            "If the scene has no image, output 1.0."
        )
    )
    image_box_width_fraction_portrait: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the `if (isPortrait) { ... }` (or `p && ...`) branch of your code: "
            "fraction of the PORTRAIT 1080x1920 canvas WIDTH occupied by the image container (0.0 to 1.0). "
            "Common portrait layouts use width: '100%' (image stacked above text) → output 1.0. "
            "Read this from the width style of the PORTRAIT branch's data-content-img element. "
            "If portrait reuses the landscape branch (same JSX), output the landscape width fraction."
        )
    )
    image_box_height_fraction_portrait: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the PORTRAIT branch of your code: "
            "fraction of the PORTRAIT 1080x1920 canvas HEIGHT occupied by the image container (0.0 to 1.0). "
            "Common portrait layouts: image is the top 40-50% (height: '45%') → output 0.45. "
            "Read this from the height style of the PORTRAIT branch's data-content-img element. "
            "If portrait reuses the landscape branch, output the landscape height fraction."
        )
    )


# ─── Scene scoring ────────────────────────────────────────────
#
# The bar an attempt must clear to be accepted without a retry. Deliberately
# generous: the checks below are quality NUDGES, and each costs a full extra LLM
# call when it forces a re-roll. At the old 0.75 any TWO -0.15 nudges (e.g. "no
# overflow guard" + "does not branch on isPortrait", both common on blueprint
# templates) sank an otherwise VALID scene to 0.70 and bought another rollout for
# cosmetic reasons. 0.6 still forces a retry on the genuinely bad combinations
# (hardcoded data -0.3 + contentType leak -0.2 = 0.5) while letting valid,
# slightly-imperfect scenes through.
REFINE_THRESHOLD = 0.6

# The code critic's band: scenes scoring at or above this are trusted, and
# anything below it (but at or above REFINE_THRESHOLD) is good enough to ship yet
# carries at least one soft defect worth a second opinion.
#
# It sits above 0.85 deliberately. Every design-adherence miss is worth exactly
# -0.15, so a scene whose ONLY defect was ignoring its scene doc scored 0.85; a
# gate at `score < 0.85` meant precisely those were never reviewed. 0.9 keeps
# them in scope while skipping a scene whose only flaw is a -0.1 (no tonal
# depth, an uncapped list map) — not worth a full extra rollout.
#
# This is now the only second-opinion pass. A vision check that rendered each
# suspect scene and critiqued the pixels used to sit alongside it in the 0.6-0.85
# band; it shipped dark, was never enabled, and was removed along with its shot
# server. The critics that remain read code, not pixels — see scene_code_critic
# for what that can and cannot catch, and scene_runtime_check for the geometry
# defects that need the component actually run.
CODE_CRITIC_THRESHOLD = 0.9

# Absolute font-size sanity bounds, per role and orientation, in px against a
# 1920x1080 / 1080x1920 canvas. These are the outer limits of legibility — below
# the floor copy is unreadable in a video, above the ceiling a headline breaks
# mid-word — and they are all that survives of the old per-template type system.
#
# The blueprint used to derive a narrow per-template band from a base size and a
# scale ratio; the design docs describe typography in prose instead, so only
# these fixed guard rails remain. They are used to SCORE, not to gate.
_TYPE_CEILING = {
    "headline_landscape": 88,
    "headline_portrait": 60,
    "body_landscape": 44,
    "body_portrait": 38,
    "prop_landscape": 44,
    "prop_portrait": 38,
    "micro_landscape": 28,
    "micro_portrait": 28,
}
_TYPE_FLOOR = {
    "headline_landscape": 48,
    "headline_portrait": 36,
    "body_landscape": 28,
    "body_portrait": 26,
    "prop_landscape": 22,
    "prop_portrait": 20,
    "micro_landscape": 16,
    "micro_portrait": 16,
}


def _score_valid_scene(code: str, args) -> float:
    """Soft quality score for code that ALREADY passed validation.

    Split out of _scene_reward so the informed-retry loop can score an attempt
    it has already validated, without validating twice.

    `args` may be a plain kwargs dict (informed-retry path) or a DSPy Example
    (legacy reward path), so field access goes through _arg() rather than
    getattr alone.
    """
    def _arg(name: str, default=""):
        if isinstance(args, dict):
            return args.get(name, default)
        return getattr(args, name, default)

    scene_type = _arg("scene_type", "content")
    score = 1.0

    # Bug: hardcoded sample data arrays (fake content in components)
    #
    # The array must contain a QUOTED STRING for one of these keys — invented
    # copy is the defect, not the key name. Two false positives measured on real
    # scenes before this was tightened, both costing a -0.3 and a repair rollout
    # on correct code:
    #   * `fallbackItems.push({value: segments[i] || displayText, label: ''})`
    #     — built FROM props, and `label: ''` is empty, not fake copy;
    #   * `const nodePositions = [18, 38, 58, 78]` followed by `labelSize: 16`
    #     — layout coordinates, matched only because "label" appears nearby.
    hardcoded_array = re.search(
        r'(?:const|let|var)\s+\w+\s*=\s*\[[\s\S]{20,}?'
        r'(?:text|icon|label|description|name|desc|title|heading)\s*:\s*'
        r'[\'"][^\'"]{3,}[\'"]',
        code,
    )
    if hardcoded_array and not re.search(
        r'=\s*props\.', code[hardcoded_array.start() : hardcoded_array.start() + 100]
    ):
        score -= 0.3
        print("[F7-DEBUG] [REFINE] -0.3: hardcoded sample data")

    # Bug: fallback hardcoded arrays — props.x || [{...}] or props.x ?? [{...}]
    if re.search(r'props\.\w+\s*(?:\|\||\?\?)\s*\[', code):
        score -= 0.3
        print(f"[F7-DEBUG] [REFINE] -0.3: hardcoded fallback array (props.x || [...])")

    # Bug: contentType rendered as visible text
    if re.search(r'>\s*\{[^}]*contentType[^}]*\}', code):
        score -= 0.2
        print(f"[F7-DEBUG] [REFINE] -0.2: contentType visible as text")

    # Bug: sceneIndex/totalScenes shown as visible counters
    if re.search(r'sceneIndex\s*\+\s*1.*totalScenes|of.*totalScenes|\$\{.*sceneIndex', code):
        score -= 0.2
        print(f"[F7-DEBUG] [REFINE] -0.2: scene counter visible")

    # A scene handed list data must actually render it as a list, not fold it
    # into a paragraph. Keyed off the PROPS the scene reads rather than off a
    # content-type label, because scenes no longer carry one.
    _doc = _arg("scene_doc", "") or ""
    for _prop in ("steps", "bullets"):
        if re.search(rf"props\.{_prop}\b", code) and not re.search(r"\.map\(", code):
            score -= 0.4
            print(f"[F7-DEBUG] [REFINE] -0.4: reads props.{_prop} but never maps it")

    # ── Design-doc adherence ─────────────────────────────────────────────────
    # This replaces the blueprint's structural-element and artifact checks, which
    # scored a scene on whether it rendered named kit components. Those
    # components are no longer available and naming them was itself a source of
    # sameness. What remains is the part that is genuinely checkable from the
    # doc: did the scene honour its IMAGE contract?
    if "IMAGE — BACKGROUND MODE" in _doc:
        if not re.search(r"data-content-img", code):
            score -= 0.2
            print("[F7-DEBUG] [REFINE] -0.2: background-image scene has no image slot")
        # A background image with nothing over it buries the copy. The validator
        # gates this; the score nudges the model before it gets there.
        elif not re.search(r"(withAlpha|linear-gradient|rgba)", code):
            score -= 0.15
            print("[F7-DEBUG] [REFINE] -0.15: background image with no scrim over it")
    elif "IMAGE — HALF MODE" in _doc:
        if not re.search(r"data-content-img", code):
            score -= 0.2
            print("[F7-DEBUG] [REFINE] -0.2: half-image scene has no image slot")
    elif "IMAGE — NONE" in _doc:
        # An image-less scene that reserves a slot leaves a hole in the frame.
        if re.search(r"data-content-img", code):
            score -= 0.2
            print("[F7-DEBUG] [REFINE] -0.2: image-less scene reserves an image slot")

    # The ending must host the real CTA/socials rather than leaving room for an
    # overlay that no longer exists.
    if (_arg("scene_type", "") or "") == "outro":
        if not re.search(r"props\.ctaProps", code):
            score -= 0.25
            print("[F7-DEBUG] [REFINE] -0.25: outro never reads props.ctaProps")
        if not re.search(r"<SocialIcons\b", code):
            score -= 0.2
            print("[F7-DEBUG] [REFINE] -0.2: outro does not render <SocialIcons>")


    # Typography binding used to be a -0.25 nudge here. It is now a HARD GATE in
    # code_validator (a scene that reads neither font prop is rejected), so the
    # penalty would only double-punish something already impossible to reach.

    # ── The no-image branch must RECLAIM the space ────────────────────────────
    #
    # Content scenes very often render without an image — always in the preview,
    # and whenever the pipeline assigns none. A scene that reserves 35% for an
    # image and then widens to only 70% without one leaves 30% of the frame bare.
    # That is the "large amount of empty space" defect, and it is invisible to
    # every other check here: the scene has a hasImage branch, has the image
    # slot, and scores 1.00 while a third of the canvas renders empty.
    _reclaim = re.findall(
        r"(?:showVisualSlot|hasImage|showImageContent)\s*\?\s*'(\d+)%'\s*:\s*'(\d+)%'", code
    )
    _short = [(int(a), int(b)) for a, b in _reclaim if int(b) > int(a) and int(b) < 90]
    if _short:
        score -= 0.15
        _w, _n = _short[0]
        print(
            f"[F7-DEBUG] [REFINE] -0.15: no-image branch widens {_w}% -> {_n}% only, "
            f"leaving {100 - _n}% of the frame bare"
        )

    # ── Inert-scene floor (content) ───────────────────────────────────────────
    # The only survivor of the old richness nudges, and softened: it guards
    # against a genuinely lifeless scene rather than enforcing a look. Largely
    # redundant (validate_component_code already requires >= 2 animation calls),
    # so it is a small backstop, not a style mandate.
    if scene_type == "content":
        # Only spring/interpolate are checked. The list used to also count
        # RevealText, staggerEntrance, headlinePop, CountUpValue, the artifact
        # components and <Decor> — every one of them now FORBIDDEN, so they could
        # never contribute a signal and only made this look more permissive than
        # it was. A scene animates with real interpolate()/spring() calls now.
        _anim_signals = sum(
            bool(re.search(_p, code))
            for _p in (r'\bspring\s*\(', r'\binterpolate\s*\(')
        )
        if _anim_signals < 1:
            score -= 0.15
            print("[F7-DEBUG] [REFINE] -0.15: content scene has no motion at all")

    # ── Portrait quality nudge (CONTENT scenes only) ──────────────────────────
    # The same component renders into a 1920×1080 landscape AND a 1080×1920
    # portrait canvas. A content scene that declares isPortrait but never *branches*
    # on it is really a landscape-only layout that can look squished/overshooting in
    # portrait. Scoped to content (intro/outro are often a centred brand reveal that
    # reads fine both ways — don't make them burn retries). Small penalty so a single
    # miss alone won't drop a scene below threshold; it only bites when stacked with
    # another real issue. Best attempt is always returned regardless.
    if scene_type == "content":
        _declares_portrait = bool(re.search(r'\bisPortrait\b', code))
        # "Used" = appears in a ternary or an if/&& guard, not just the declaration line.
        _branches_portrait = bool(
            re.search(r'isPortrait\s*\?', code)               # ternary
            or re.search(r'(?:if\s*\(|&&|\|\|)\s*[^)\n]*\bisPortrait\b', code)  # guard
            or re.search(r'!\s*isPortrait\b', code)           # negated guard
        )
        if not _declares_portrait or not _branches_portrait:
            score -= 0.15
            print(f"[F7-DEBUG] [REFINE] -0.15: content scene does not branch layout on isPortrait (portrait may look off)")

    # ── Vertical budget nudge ────────────────────────────────────────────────
    # A wrappable <FitText> with no maxHeight has no height to shrink against,
    # so long copy can still run downward off the frame. This is a NUDGE, not a
    # gate: containerWidth (which IS gated) is what fixes the ~2x width
    # overestimate, and the kit now falls back to a canvas-relative height
    # budget, so a missing maxHeight degrades rather than disabling the fit.
    from app.services.code_validator import _missing_fit_block, _missing_fit_max_height

    if _missing_fit_max_height(code):
        score -= 0.1
        print(
            "[F7-DEBUG] [REFINE] -0.1: a wrappable <FitText> has no maxHeight "
            "(no vertical budget; long copy can overflow downward)"
        )

    if _missing_fit_block(code):
        score -= 0.15
        print(
            "[F7-DEBUG] [REFINE] -0.15: several <FitText> and no <FitBlock> — each "
            "fits its own box while the group overflows the column as a pair"
        )

    # ── Overflow-safety nudge (ALL scene types) ───────────────────────────────
    # overflow:'hidden' on the root only CLIPS spill — it doesn't make content fit.
    # Metrics/steps/long headers overshoot the frame in BOTH orientations unless the
    # scene uses the same structural guards the built-in templates use:
    #   • minWidth:0 on flex children  (flex defaults to min-width:auto → children
    #     overflow instead of wrapping — the #1 cause of text spilling)
    #   • overflowWrap/wordBreak on text  (long words break instead of pushing out)
    #   • FitText for headlines/numerals  (auto-shrinks to fit, never overshoots)
    # Small penalty so it nudges without forcing a retry on its own — kit-built scenes
    # (StatGrid/MetricRow/FitText) already satisfy this; only a fully hand-rolled scene
    # with zero guards is flagged.
    _has_overflow_guard = bool(
        re.search(r'minWidth\s*:\s*0\b', code)
        or re.search(r'overflowWrap', code)
        or re.search(r'wordBreak', code)
        or re.search(r'<FitText\b', code)
    )
    if not _has_overflow_guard:
        score -= 0.15
        print(f"[F7-DEBUG] [REFINE] -0.15: no overflow guard (minWidth:0 / overflowWrap / FitText) — text may overshoot")

    # ── Depth (ALL scene types) ───────────────────────────────────────────────
    #
    # THE CAMERA PENALTY IS GONE, AND ITS REMOVAL IS THE POINT.
    #
    # It docked 0.2 from any scene that did not call cameraStage / cameraPush /
    # parallaxLayer / panelTilt. The kit-narrowing refactor removed those from the
    # AI's scope, and the validator now REJECTS them outright — so every scene
    # lost 0.2 it could not win back, however good it was.
    #
    # That was not cosmetic. Measured over 35 stored scenes, it dragged 17 of them
    # below CODE_CRITIC_THRESHOLD, buying each an extra LLM call it did not need,
    # and it is the single largest contributor to the ~690s generation times.
    #
    # THE CLASS OF BUG MATTERS MORE THAN THE INSTANCE: a scorer that rewards an
    # identifier the validator forbids is unwinnable by construction. Any penalty
    # added here must be checkable against ALLOWED_KIT_NAMES — see
    # test_scorer_has_no_unwinnable_penalties, which asserts exactly that.

    # Tonal depth: a gradient, scrim or wash somewhere. A scene painted on one
    # flat fill is the other half of the "everything looks the same" report.
    # `withAlpha` is the one kit helper still in scope for this; <Decor> was
    # dropped from the pattern for the same reason as the camera helpers above.
    _has_depth = bool(
        re.search(r'linear-gradient|radial-gradient|withAlpha\s*\(|rgba\s*\(', code)
    )
    if not _has_depth:
        score -= 0.1
        print("[F7-DEBUG] [REFINE] -0.1: no tonal depth (gradient / scrim / withAlpha)")

    # ── Canvas identity (ALL scene types) ─────────────────────────────────────
    # The scene's outermost fill must be the BRAND canvas. A scene that repaints
    # the whole frame in palette.text/accent or a hardcoded hex is a different
    # theme from its siblings, which is what made one template's scenes look
    # like several templates. Scored here as well as checked across scenes, so
    # the defect is visible on the FIRST attempt rather than only after every
    # scene has been generated.
    _canvas = scene_canvas_token(code)
    if _canvas is not None and _canvas != "palette.bg":
        score -= 0.2
        print(
            f"[F7-DEBUG] [REFINE] -0.2: canvas is {_canvas!r}, not the brand background "
            "(set the root AbsoluteFill's background to props.brandColors.background)"
        )

    # ── Contrast (ALL scene types) ────────────────────────────────────────────
    # Nothing checked colour relationships at all, so a scene rendering its text
    # in the same colour as its own background scored identically to a correct
    # one. -0.25 lands a valid scene at 0.75 — inside the visual-check band, so
    # a screenshot confirms or denies it rather than forcing a blind re-roll.
    for _defect in _detect_contrast_defects(code, _arg("_theme") or None):
        score -= 0.25
        print(f"[F7-DEBUG] [REFINE] -0.25: contrast — {_defect}")
        break  # one hit is enough; stacking would double-punish one mistake

    # ── Font-size sanity (ALL scene types) ────────────────────────────────────
    # Nothing here inspected a font size at all, so a scene with a 240px headline
    # and a 14px caption scored identically to a correct one — which is how the
    # observed "body tiny, headline overflowing" output kept passing. Checks
    # hardcoded numeric fontSize values against the art direction's own bands.
    _bands = _arg("_type_bands") or {}
    _sizes = [int(m) for m in re.findall(r'fontSize\s*:\s*(\d{1,3})\b', code)]
    if _sizes:
        _ceiling = max(
            _bands.get("headline_landscape", (0, _TYPE_CEILING["headline_landscape"]))[1],
            _TYPE_CEILING["headline_landscape"],
        )
        _oversize = [s for s in _sizes if s > _ceiling]
        if _oversize:
            # Decisive on its own: a headline past the ceiling breaks the frame,
            # and no amount of camera work or decoration should let that ship.
            # At -0.45 it clears the threshold from a perfect 1.0 in one hit.
            score -= 0.45
            print(
                f"[F7-DEBUG] [REFINE] -0.45: hardcoded fontSize above the {_ceiling}px ceiling "
                f"{sorted(set(_oversize))} — will overflow the frame"
            )
        # 14px, not 20px.
        #
        # 20 punished the eyebrows, kickers, captions and panel numbers that the
        # art direction ITSELF asks for at 18-22px — so nearly every scene took a
        # -0.15 for following instructions, and the repair loop was sent to fix
        # correct code. Only sizes that are genuinely illegible on a 1080p frame
        # should score here; small print is a real typographic tool.
        #
        # Raised 12 -> 14 now that the `micro` tier bottoms out at 16px: nothing
        # the kit or the art direction asks for lands below 14 any more, so the
        # gap between 12 and 14 was scoring nothing but genuine mistakes.
        _tiny = [s for s in _sizes if s < 14]
        if _tiny:
            score -= 0.15
            print(
                f"[F7-DEBUG] [REFINE] -0.15: hardcoded fontSize below 14px {sorted(set(_tiny))} "
                "— illegible at 1080p"
            )

        # The 12-47px band was entirely unscored, which is exactly the "fonts are
        # very small" complaint: legible, but far below the type system the
        # blueprint authored, leaving tiny type marooned in a large empty frame.
        #
        # Proportional and capped, because 18-22px eyebrows and captions ARE
        # requested by the art direction — that is why the hard floor sits at 12.
        # Two undersized values are free (eyebrow + caption is a correct pattern);
        # a pile of them is a scene with no typographic hierarchy.
        _body_floor = (_bands.get("body_landscape") or (_TYPE_FLOOR["body_landscape"], 0))[0]
        _under = sorted({s for s in _sizes if 14 <= s < _body_floor})
        if len(_under) > 2:
            # Steeper past 3. A scene with FOUR or more distinct undersized
            # values has no type at body scale at all — the reported case sized
            # everything at 14/18/20/22 on a 1080p frame, took only -0.16, and
            # shipped. Measured over 207 stored scenes: 9% have >2 such values
            # but only 5% have >=4, so the penalty is weighted toward the tail
            # rather than made a hard gate, which at these rates would reject a
            # large slice of the corpus.
            _pen = min(0.45, 0.08 * (len(_under) - 2) + (0.2 if len(_under) >= 4 else 0.0))
            score -= _pen
            print(
                f"[F7-DEBUG] [REFINE] -{_pen:.2f}: {len(_under)} distinct fontSizes below the "
                f"{_body_floor}px body floor {_under} — only 2 (eyebrow + caption) are expected"
            )

        # Body copy that ignores props.descriptionFontSize.
        #
        # code_validator has a HARD gate for the egregious version (2+ distinct
        # body-tier literals and no mention of the prop at all). This scores the
        # near-misses the gate deliberately lets through — one literal, or a
        # scene that reads the prop once and then hardcodes the rest — so they
        # get a critic pass rather than shipping silently.
        if not re.search(r"props\.descriptionFontSize", code) and re.search(
            r"props\.(?:bullets|steps|quote|comparison\w*|timelineItems|metrics)"
            r"|<(?:Caption|BulletList|StatGrid|MetricRow|CodeBlock)\b",
            code,
        ):
            _body_tier = sorted({s for s in _sizes if 20 <= s <= 60})
            if _body_tier:
                score -= 0.2
                print(
                    f"[F7-DEBUG] [REFINE] -0.20: body-tier fontSizes {_body_tier} are hardcoded "
                    "and props.descriptionFontSize is never read — the body slider does nothing"
                )

        # Edge-packed rows: content that does not compose from the centre.
        #
        # A multi-item row left at flex-start reads as a left-aligned list with
        # dead space beside it at every count below the maximum. Small, because
        # a deliberately asymmetric layout is a legitimate choice — this nudges
        # toward the centre-out default rather than forbidding the alternative.
        _packed = re.findall(r"justifyContent:\s*['\"]flex-start['\"]", code)
        if _packed and re.search(r"\.map\s*\(", code):
            score -= 0.1
            print(
                f"[F7-DEBUG] [REFINE] -0.10: {len(_packed)} justifyContent:'flex-start' on a "
                "scene that maps a list — items pack against an edge instead of composing "
                "outward from the centre"
            )

        # No type at headline scale at all — the scene has no focal element, which
        # is the other half of the "small text in an empty frame" report.
        #
        # `_sizes` only captures the style-object form (`fontSize: 70`), so a
        # headline sized through the JSX prop form (`<FitText fontSize={70}>`) —
        # which is the form the art direction actually mandates — must be counted
        # too, or this false-positives on every correctly built scene.
        # Matches both the bare form and the prop-with-fallback form the
        # titleFontSize gate now REQUIRES:
        #     fontSize={70}
        #     fontSize={props.titleFontSize ?? 70}
        #     fontSize={props.titleFontSize ?? (isPortrait ? 52 : 70)}
        # Without the second form this reported "largest is 12px" on scenes whose
        # headline was correctly bound to the prop, costing 0.2 for compliance.
        # The LAST number in the expression is the landscape fallback.
        _prop_sizes: list[int] = []
        for _expr in re.findall(r"fontSize=\{([^{}]{1,80})\}", code):
            _nums = re.findall(r"\b(\d{1,3})\b", _expr)
            if _nums:
                _prop_sizes.append(int(_nums[-1]))
        _all_sizes = _sizes + _prop_sizes
        # The absolute floor, not a per-template band. `_bands` came from the
        # blueprint's type_system and is permanently {} since that stage was
        # removed, so reading it here was dead code that always fell through to
        # this same constant. Kept as a real check — it is what caught a scene
        # whose largest type was 18px on a 1920px canvas.
        _head_floor = _TYPE_FLOOR["headline_landscape"]
        # A FitText headline with no explicit size resolves from the kit's type
        # scale at render time, so it is headline-scale by construction.
        # Headline-scale by construction, so the size check cannot apply:
        #   * <FitText> with no fontSize    — resolves from the kit type scale
        #   * fontSize={props.titleFontSize} — resolves from the user's slider
        _implicit_headline = bool(
            re.search(r"<FitText(?![^>]*fontSize)", code)
            or re.search(r"fontSize=\{props\.titleFontSize\s*\}", code)
        )
        if _all_sizes and not _implicit_headline and max(_all_sizes) < _head_floor:
            score -= 0.2
            print(
                f"[F7-DEBUG] [REFINE] -0.2: no type at headline scale (largest is "
                f"{max(_all_sizes)}px, headline floor is {_head_floor}px) — no focal element"
            )

    # NOTE: the headline/<FitText> requirement is now a HARD gate in
    # validate_component_code — a -0.15 nudge let scenes ship at 0.70-0.85 with
    # an unwrapped headline, and that is precisely the text that ends up too
    # small or overflowing. Scoring it twice would double-punish, so it is not
    # repeated here.

    # ── Image slot ignores props.hasVideo (SOFT) ─────────────────────────────
    # A scene that gates its visual slot on `hasImage` alone has NOWHERE to put
    # a stock clip: props.imageUrl is undefined in the clip state (the render
    # path must not hand a video URL to <Img>, which cancelRender()s), so
    # hasImage is false and the scene takes its no-image branch. That branch
    # typically paints an opaque full-bleed gradient — or just as often an
    # opaque placeholder tint (e.g. backgroundColor on the data-content-img
    # element itself, meant to hold the slot's shape before an <Img> loads) —
    # either of which covers the clip completely: the video plays, invisible,
    # underneath.
    #
    # Observed on template 196 (bare gradient) and again on custom_201's
    # content_1 "Detail" layout (opaque tint + gradient painted directly
    # inside data-content-img). The contract already states this rule ("never
    # render the hasImage-false full-width branch, which has nowhere for the
    # clip") but nothing enforced it, so the violation shipped both times.
    #
    # SOFT for the same reason as the eyebrow rule below — a hard gate here
    # would stub scenes whose repair the model may not find. The render path
    # now also defends itself for real: VideoPreview.tsx/GeneratedVideo.tsx's
    # data-has-clip neutraliser strips ANY background painted on
    # data-content-img (and its descendants) whenever a clip is active, not
    # just fills on OTHER layers — so a scene that still ships this pattern no
    # longer blanks the clip, it just wastes the dead branch. This nudge is
    # about generating RIGHT (a clean component, a smaller regeneration diff
    # later), not about preventing breakage — that backstop is now the
    # render-time neutraliser, not this score.
    if re.search(r"\bhasImage\b", code) and not re.search(r"props\.hasVideo", code):
        score -= 0.1
        print(
            "[F7-DEBUG] [REFINE] -0.1: gates its image slot on hasImage but never "
            "reads props.hasVideo — a stock clip would have nowhere to render"
        )

    # ── The scene must show its title (SOFT, but heavy) ──────────────────────
    # Every scene renders props.sceneTitle: it is the scene's main label, the
    # largest type on the frame, and the only thing props.titleFontSize sizes. A
    # scene that omits it drops the field the title slider drives, and the user
    # sees a Typography control with nothing on the frame responding to it.
    #
    # SOFT rather than a validator gate, for the reason recorded in
    # code_validator above _renders_headline: the model cannot add a title to a
    # design with no place for one, so a hard gate exhausts three repairs and
    # stubs the scene. -0.3 is heavy enough to sink an otherwise-average attempt
    # below the 0.6 acceptance bar while still letting an excellent scene
    # through, which is what makes the refine loop prefer a compliant attempt.
    #
    # Detection mirrors _renders_headline in the validator: fire only when
    # sceneTitle is NOT interpolated into the tree. A data-only read
    # (`const label = props.sceneTitle || props.displayText`) does not count as
    # rendering it.
    #
    # THE ALIAS PATTERN MUST TOLERATE A WRAPPED INITIALISER. This matched only
    # `= props.sceneTitle` with the prop immediately after the `=`, which the
    # bookend contracts' own prescribed idiom does not satisfy:
    #
    #     const title = (props.sceneTitle || '').trim();
    #
    # The leading paren defeated the match, so the alias went undetected and a
    # scene that followed the contract exactly was charged -0.3 for "never
    # renders props.sceneTitle" — a false positive on the very code this prompt
    # asks for, costing real rollouts. Scan the whole initialiser instead, and
    # collect EVERY alias rather than the first: a scene routinely declares the
    # title and the display text together, and the title is not always first.
    #
    # An alias counts only when sceneTitle is the SUBJECT of the initialiser —
    # the first prop it reads. That distinction is the whole point:
    #
    #     const title   = (props.sceneTitle || '').trim();          <- the title
    #     const heading = props.displayText || props.sceneTitle;    <- NOT
    #
    # The second renders the display text and merely falls back to the title, so
    # the frame has no title element. Matching it would let a scene satisfy this
    # by naming the prop in a fallback chain, which is precisely the defect.
    _st_render_names = ["props\\.sceneTitle"]
    for _m in re.finditer(
        r"const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*props\.sceneTitle[^;\n]*)", code
    ):
        _first_prop = re.search(r"props\.([A-Za-z_$][\w$]*)", _m.group(2))
        if _first_prop and _first_prop.group(1) == "sceneTitle":
            _st_render_names.append(re.escape(_m.group(1)))
    if not any(
        re.search(rf">\s*\{{\s*{n}\s*(?:\|\||\?\?|\}})", code)
        or re.search(rf"\{{\s*{n}\s*\}}\s*<", code)
        for n in _st_render_names
    ):
        score -= 0.3
        print(
            "[F7-DEBUG] [REFINE] -0.3: never renders props.sceneTitle — the scene "
            "has no title, and the editor's Title slider drives nothing"
        )

    # ── The title's box is smaller than the body's (SOFT) ────────────────────
    #
    # THE ONE GEOMETRY DEFECT THAT IS STATICALLY VISIBLE.
    #
    # FitText shrinks text to fit its maxHeight budget, so the element with the
    # SMALLER box renders smaller — regardless of the fontSize it was handed. A
    # title given `maxHeight={height*0.26}` beside a body given `0.30` therefore
    # inverts the hierarchy while every other check passes: _font_default_defects
    # compares the `?? 68` / `?? 34` source literals, which are correctly
    # ordered, and nothing in the pipeline measures what actually renders.
    #
    # Rendered size cannot be seen from here, but the RELATIVE BOX GEOMETRY can,
    # and it is what causes the inversion. Read the two height fractions off the
    # FitText tags and compare them.
    #
    # There is a read-time floor for this in kit/FitText.tsx (a title is never
    # painted below the body it sits with), so this nudge is about generating
    # scenes that do not need repairing rather than about preventing a broken
    # frame. Hence SOFT.
    _fit_heights = re.findall(
        r"<FitText\b[^>]{0,400}?fontSize=\{(titleSize|bodySize)\}[^>]{0,400}?"
        r"maxHeight=\{[^}]*?height\s*\*\s*([0-9.]+)",
        code,
        re.DOTALL,
    )
    _title_h = [float(v) for k, v in _fit_heights if k == "titleSize"]
    _body_h = [float(v) for k, v in _fit_heights if k == "bodySize"]
    if _title_h and _body_h and max(_title_h) < max(_body_h):
        score -= 0.15
        print(
            f"[F7-DEBUG] [REFINE] -0.15: the title's height budget "
            f"({max(_title_h)}) is smaller than the body's ({max(_body_h)}) — "
            f"FitText shrinks to the box, so the hierarchy inverts"
        )

    # ── No editable props declared (SOFT) ────────────────────────────────────
    #
    # A scene may expose its own editable fields by reading
    # `props.layoutProps?.<key> ?? "<default>"`. Those become real inputs in the
    # scene editor, and they are the only way a user can change a string the
    # scene invents — a kicker, a panel label, a caption.
    #
    # Almost no scene declared any. In a real 9-scene template, 8 scenes had
    # ZERO `props.layoutProps` reads and the whole template offered exactly one
    # editable field. The contract asked for "2-5 per scene" in a single line of
    # the props list, and nothing enforced it, so hardcoding every string passed
    # at full score.
    #
    # SOFT, and only for CONTENT scenes. A bookend legitimately has nothing
    # beyond its title and CTA, and a hard gate here is the unsatisfiable-rule
    # failure mode recorded above _renders_headline in code_validator: the model
    # cannot invent an editable field for a scene that genuinely has none, so it
    # would burn every rollout and ship a stub.
    if _arg("scene_type", "content") == "content" and not re.search(
        r"props\.layoutProps\s*(?:\?\.|\[)", code
    ):
        score -= 0.15
        print(
            "[F7-DEBUG] [REFINE] -0.15: declares no editable props — every string "
            "on this frame is hardcoded and the editor can change none of them"
        )

    # ── A third type tier (SOFT) ─────────────────────────────────────────────
    # v3 has exactly TWO sizes: titleSize (props.sceneTitle) and bodySize
    # (everything else). A scene that invents a third independent constant —
    # `const labelSize = 24`, a kicker at a literal size — creates a size the
    # editor has no slider for, so the user cannot move it and the template
    # cannot be resized coherently. Labels are written as ratios of bodySize.
    #
    # This replaces the inverse nudge, which penalised a scene for NOT reading
    # props.sceneTitleFontSize. That prop no longer exists in the contract, so
    # the old check now punishes correct code.
    #
    # SOFT, deliberately. The comment in code_validator.py above _renders_headline
    # records what the premature hard gate on the headline cost: template 177,
    # five of nine scenes stubbed, ~1400s on an unsatisfiable rule. This nudge
    # can be promoted once real generations show compliant scenes clear it.
    if re.search(r"props\.sceneTitleFontSize", code):
        score -= 0.1
        print(
            "[F7-DEBUG] [REFINE] -0.1: reads props.sceneTitleFontSize, which no "
            "longer exists — labels take a ratio of bodySize"
        )
    # A `const labelSize = 16` heuristic was tried here and removed. It fires on
    # any local whose name ends in "Size", which in a diagram scene is routinely
    # a node radius or a glyph box rather than a type size — a false positive
    # that charges a correct scene for nothing. The prop read above is the
    # precise signal, and the prompt states the ratio rule in rule 7; a fuzzy
    # name match buys little on top of that and costs real scenes.

    # ── Uncapped list nudge (content scenes) ──────────────────────────────────
    # Mapping straight over props.metrics/steps/bullets/timelineItems with no
    # .slice(N) cap lets a long array push rows off the frame. The kit components
    # cap internally, but hand-rolled maps don't — require an explicit cap, mirroring
    # the built-ins (teasers.slice(0,5), keyPoints.slice(0,4), table rows capped).
    if scene_type == "content":
        _maps_list_prop = re.search(
            r'props\.(metrics|steps|bullets|timelineItems)\b[\s\S]{0,160}?\.map\(', code
        )
        _has_slice = bool(re.search(r'\.slice\s*\(\s*0\s*,', code))
        if _maps_list_prop and not _has_slice:
            score -= 0.1
            print(f"[F7-DEBUG] [REFINE] -0.1: list prop mapped without a .slice(0,N) cap (rows may overshoot)")

    line_count = code.count("\n") + 1
    print(f"[F7-DEBUG] [REFINE] Validation PASSED — score={score:.2f} | {line_count}L")
    return max(score, 0.0)


def _scene_reward(args, pred) -> float:
    """`dspy.Refine`'s reward function: validate + score one scene as a float.

    Also the seam that makes Refine usable here at all. Refine's contract gives
    the reward function no way to return a MESSAGE — only a number — so the
    validator's diagnostic would be discarded and then re-inferred by an extra
    LLM call. Instead this writes the real error into `args["previous_failure"]`
    (see below): Refine re-splats that same dict into the module on every
    rollout, so the next attempt is TOLD what broke rather than guessing.
    """
    code = clean_code(pred.code or "")

    # An EMPTY code field means the response was truncated, not that the scene was
    # bad. Return the neutral threshold so the caller stops re-rolling and the
    # repair loop — which sends a real "you were cut off, be compact" instruction
    # — gets the attempt instead.
    if not code.strip():
        print("[F7-DEBUG] [REFINE] empty code (response truncated) — deferring to repair loop")
        return REFINE_THRESHOLD

    # Refine passes the kwargs dict; tests and older callers may pass an object.
    def _arg(name: str, default: str = "") -> str:
        if isinstance(args, dict):
            return args.get(name, default)
        return getattr(args, name, default)

    scene_type = _arg("scene_type", "content")
    scene_doc = _arg("scene_doc")
    # theme= and collect_all= must match the real checkpoint below (and the
    # generation-path call), or this scorer accepts a scene that generation then
    # rejects. Without the theme the palette/contrast gates cannot resolve
    # palette.<slot> to real hex and silently pass here; without collect_all the
    # score reflects only the FIRST defect, so a repair fixes one contract while
    # breaking another and the loop cannot converge.
    _brand_context = _arg("brand_context")
    valid, err = validate_component_code(
        code,
        scene_type=scene_type,
        collect_all=True,
        theme=_theme_from_brand_context(_brand_context or ""),
        scene_doc=scene_doc or "",
    )
    if not valid:
        # Name the SCENE and say plainly that a retry follows.
        #
        # This used to print a bare "FAILED: <error>" with no scene index and no
        # indication of what happened next, so a log full of failures read as a
        # broken run even when every one of them was about to be retried and
        # fixed. The rollout budget is REFINE_N + 1; a scene that exhausts it
        # goes to the repair loop, which logs its own attempts.
        _idx = _arg("scene_index", "?")
        _first = (err or "").strip().splitlines()[0] if err else "unknown"
        print(
            f"[F7-DEBUG] [REFINE] scene {_idx} rejected — RETRYING with the error fed back "
            f"(up to {REFINE_N + 1} rollouts): {_first}"
        )
        print(f"[F7-DEBUG] [REFINE] FAILED: {err}")
        # Hand the REAL diagnostic to the next rollout.
        #
        # dspy.Refine's reward_fn returns a bare float, so the validator message
        # would otherwise be discarded and then re-inferred by its OfferFeedback
        # call. But Refine.forward re-splats `mod(**kwargs)` on every iteration
        # and passes us that same dict — so mutating it here IS visible to the
        # next attempt. `previous_failure` is a documented InputField on
        # GenerateSceneCode, which is what makes this land in the prompt.
        if isinstance(args, dict):
            args["previous_failure"] = _format_scene_failure(
                code, err, scene_type=scene_type, scene_doc=scene_doc or ""
            )
        return 0.0

    score = _score_valid_scene(code, args)

    # A valid-but-weak scene gets the checklist rather than an error, so the
    # retry knows it must IMPROVE rather than fix a break.
    if isinstance(args, dict) and score < REFINE_THRESHOLD:
        args["previous_failure"] = (
            f"ERROR: your previous attempt scored {score:.2f}, below the "
            f"{REFINE_THRESHOLD} bar. It was VALID but had quality problems — see the "
            "checklist below and fix them while keeping everything that already works.\n\n"
            + build_repair_checklist(scene_type, scene_doc or "")
        )

    return score


# ─── Brand context builder ─────────────────────────────────────


# ── Art direction (the composition rules that used to live in the prompt) ──
#
# The GenerateSceneCode docstring used to carry a full house style: a
# MANDATORY ~6-8% safe area, a mandate to centre every content group, the
# five named compositions, a STRONGLY PREFER <IntroStage> scaffold and a
# "calm closing recap" outro. Those are DESIGN DECISIONS, and stating them in
# the system prompt applied one art director's taste to every brand.
#
# Worse, they beat the blueprint. The blueprint arrives as an input VALUE
# while the house style sat in the docstring above it, written in
# MANDATORY/STRONGLY-PREFER language with copy-pasteable numbers and code.
# Given a concrete instruction and an abstract "the blueprint overrides this",
# models follow the concrete one — so blueprints generated fine and changed
# nothing about the output.
#
# Both paths now render into the SAME field at the SAME specificity, so
# exactly one art direction reaches the model. Flag off reproduces the old
# text verbatim.
_V1_SAFE_AREA = (
    "SAFE AREA (MANDATORY — content stays inside the frame, visually balanced):\n"
    "- The whole composition MUST sit inside a CENTERED safe area with balanced margins. Give\n"
    "  the outermost content container a symmetric inset of ~6-8% of the frame on every side\n"
    "  (e.g. padding: isPortrait ? '8% 6%' : '6% 8%') so nothing hugs or spills off the edges.\n"
    "- The scene's content group should read as centered/balanced within that safe area —\n"
    "  center the flex container (justifyContent/alignItems: 'center') even when the internal\n"
    "  layout is asymmetric. Asymmetry is EXPRESSED WITHIN the centered safe area (columns\n"
    "  weighted 60/40, offset stacks, side rails), NOT by pushing content past the frame edges.\n"
    "- Full-bleed image backdrops may reach the edges, but the TEXT/focal blocks on top MUST\n"
    "  stay inside the safe-area inset. Nothing readable ever touches the outer 6% of the frame.\n"
    "- This is about placement only — it does NOT force every scene to a single dead-center\n"
    "  card; keep the layout VARIETY fully intact, just centered in-frame."
)

# The v1 type scale, moved out of the docstring alongside the safe area so the
# flag-off path keeps its exact previous behaviour. (The blueprint path gets
# _bp_type_directive instead, which states a min AND a max per role.)
_V1_TYPE_SCALE = (
    "TYPE SCALE:\n"
    "- Main title / displayText: fontSize: (props.titleFontSize ?? 75), scaled proportionally in\n"
    "  nested layouts, never below 48 for the primary headline.\n"
    "- Subtitle / narration / body: fontSize: (props.descriptionFontSize ?? 37); supporting\n"
    "  lines at least 28px.\n"
    "- Bullet lists, card body, quote body, metric labels: size these as a FRACTION of the\n"
    "  body size — fontSize: (props.descriptionFontSize ?? 37) * 0.9 — not as a fixed\n"
    "  number, so the editor's body slider moves them too. Keep the result at least 30px\n"
    "  so previews stay legible when scaled down in the UI."
)

def _hex_luminance(hex_str: str) -> float | None:
    """Perceived luminance 0..1, mirroring kit/theme.ts's `luminance`.

    Returns None for anything that is not a plain 3/6-digit hex, so callers skip
    computed values rather than guessing at them.
    """
    h = (hex_str or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None
    # Rec. 601, same coefficients as the TS helper.
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0


def _hex_rgb(hex_str: str) -> tuple[int, int, int] | None:
    """(r, g, b) for a plain 3/6-digit hex, else None."""
    h = (hex_str or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return None


def _relative_luminance(hex_str: str) -> float | None:
    """WCAG 2.x relative luminance — mirrors kit/theme.ts `relativeLuminance`."""
    rgb = _hex_rgb(hex_str)
    if rgb is None:
        return None

    def lin(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast_ratio(a: str, b: str) -> float | None:
    """WCAG contrast ratio 1..21, or None if either colour is not a plain hex.

    Mirrors kit/theme.ts `contrastRatio` so the gate and the renderer agree on
    what "readable" means — a validator using different math from the component
    it guards would reject scenes that actually render fine, and vice versa.
    """
    la, lb = _relative_luminance(a), _relative_luminance(b)
    if la is None or lb is None:
        return None
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


#: WCAG AA for body text.
AA_CONTRAST = 4.5


# One style object's worth of source, e.g. `{background: '#111', color: '#111'}`.
_STYLE_OBJ_RE = re.compile(r"\{[^{}]{0,400}\}")
_BG_LITERAL_RE = re.compile(r"background(?:Color)?\s*:\s*['\"](#[0-9a-fA-F]{3,8})['\"]")
_FG_LITERAL_RE = re.compile(r"\bcolor\s*:\s*['\"](#[0-9a-fA-F]{3,8})['\"]")


_BRAND_COLORS_RE = re.compile(r"^Colors:\s*(\{.*\})\s*$", re.MULTILINE)


def _theme_from_brand_context(brand_context: str) -> dict:
    """Recover `{"colors": {...}}` from the brand-context string.

    `_build_brand_context` embeds the palette as a JSON line ("Colors: {...}"),
    and brand_context is already threaded everywhere the scene is generated —
    so reading it back is what lets the contrast gate resolve palette slots
    without adding a `theme` parameter to four call layers.

    Note the key rename `_build_brand_context` performs: it writes `background`
    and `primary`, not `bg` and `accent`.
    """
    m = _BRAND_COLORS_RE.search(brand_context or "")
    if not m:
        return {}
    try:
        raw = json.loads(m.group(1))
    except (ValueError, TypeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    return {
        "colors": {
            "bg": raw.get("background"),
            "text": raw.get("text"),
            "accent": raw.get("accent") or raw.get("primary"),
        }
    }


def _palette_slots(theme: dict | None) -> dict[str, str]:
    """Resolve `palette.<slot>` names to concrete hex for THIS brand.

    Mirrors the subset of kit/theme.ts `derivePalette` that produces colours a
    scene can put text in. Only the slots we can resolve exactly are returned —
    an unresolvable slot is simply absent, and the caller skips it rather than
    guessing.
    """
    colors = (theme or {}).get("colors") or {}
    bg = colors.get("bg")
    text = colors.get("text")
    accent = colors.get("accent")
    out: dict[str, str] = {}
    if isinstance(bg, str) and _hex_rgb(bg):
        out["bg"] = bg
    if isinstance(text, str) and _hex_rgb(text):
        out["text"] = text
    if isinstance(accent, str) and _hex_rgb(accent):
        out["accent"] = accent
    # `muted` — the 50/50 bg->text blend, THEN walked toward `text` until it
    # clears AA, exactly as kit/theme.ts does.
    #
    # Modelling only the un-walked blend was supposed to be "conservative", on
    # the theory that it could under-report but never fail a correct scene. It
    # did the opposite. For a light brand the raw blend lands below AA
    # (#F4F8FB/#111827 -> #828891, 3.34:1) while the kit RENDERS #6b6f76 at
    # 4.73:1 — so the contrast gate rejected `color: palette.muted`, a usage the
    # prompt explicitly documents as "secondary copy, labels, eyebrows.
    # Contrast-corrected." The model had no way to satisfy both, and the scene
    # was stubbed after three repairs.
    if "bg" in out and "text" in out:
        br, bgc, bb = _hex_rgb(out["bg"])  # type: ignore[misc]
        tr, tg, tb = _hex_rgb(out["text"])  # type: ignore[misc]

        def _blend(t: float) -> str:
            return "#%02X%02X%02X" % (
                round(br + (tr - br) * t),
                round(bgc + (tg - bgc) * t),
                round(bb + (tb - bb) * t),
            )

        _muted = _blend(0.5)
        # Walk toward `text` in the same 5% steps the kit uses, stopping at the
        # first value that clears AA against the canvas.
        if (contrast_ratio(_muted, out["bg"]) or 0) < AA_CONTRAST:
            for _i in range(11, 21):
                _cand = _blend(_i / 20)
                if (contrast_ratio(_cand, out["bg"]) or 0) >= AA_CONTRAST:
                    _muted = _cand
                    break
            else:
                _muted = out["text"]
        out["muted"] = _muted

    # `accentText` — the accent, darkened until it is READABLE on the canvas.
    #
    # Without this the two colour gates contradicted each other for any brand
    # whose accent is light. Observed: accent #00eb79 on canvas #f4f8fb is
    # 1.49:1, far below AA, so the contrast gate rejects accent-coloured text;
    # the model then invents a darker green (#00C965) and the OFF-PALETTE gate
    # rejects that instead. There was no legal colour to write, so the attempt
    # was unwinnable.
    #
    # The kit already derives exactly this slot (theme.ts `ensureContrast`), and
    # the prompt already documents it — only the gates could not see its value.
    # Mirrors the kit's 5%-step blend toward the readable pole.
    if "accent" in out and "bg" in out:
        _bg = out["bg"]
        _accent = out["accent"]
        if (contrast_ratio(_accent, _bg) or 0) >= AA_CONTRAST:
            out["accentText"] = _accent
        else:
            _pole = "#FFFFFF" if (_relative_luminance(_bg) or 0) < 0.5 else "#000000"
            ar, ag, ab = _hex_rgb(_accent)  # type: ignore[misc]
            pr, pg, pb = _hex_rgb(_pole)  # type: ignore[misc]
            _best, _best_score = _accent, contrast_ratio(_accent, _bg) or 0
            for _i in range(1, 21):
                _t = _i / 20
                _cand = "#%02X%02X%02X" % (
                    round(ar + (pr - ar) * _t),
                    round(ag + (pg - ag) * _t),
                    round(ab + (pb - ab) * _t),
                )
                _score = contrast_ratio(_cand, _bg) or 0
                if _score > _best_score:
                    _best, _best_score = _cand, _score
                if _score >= AA_CONTRAST:
                    _best = _cand
                    break
            out["accentText"] = _best
    return out


_SYMBOLIC_FG_RE = re.compile(r"\bcolor\s*:\s*palette\.([a-zA-Z]+)\b")
_SYMBOLIC_BG_RE = re.compile(
    r"background(?:Color)?\s*:\s*palette\.([a-zA-Z]+)\b"
)


# ─── Canvas identity (one background per TEMPLATE) ───────────────────────────
#
# The scene prompt used to instruct per-scene backdrop variation outright ("Some
# scenes SHOULD go DARK / INVERTED"), and nothing anywhere required a scene to
# use the brand canvas — `code_validator` has no reference to SceneFrame or
# palette.bg at all. The result was templates whose scenes each had a different
# background, which reads as several themes rather than one.
#
# These two helpers are deliberately CONSERVATIVE in the same spirit as
# `_detect_contrast_defects`: a canvas that cannot be resolved to a concrete
# token is reported as UNKNOWN and skipped, never guessed at. A false positive
# costs a full LLM rollout.

# The ROOT element of the returned JSX — the first tag after `return (`. Only
# its own opening tag is inspected: an inner panel that happens to carry a
# background is a PANEL, not the canvas, and reading one as the canvas is a
# false positive that costs a full rollout.
_ROOT_TAG_RE = re.compile(r"return\s*\(?\s*(<(?:AbsoluteFill|div)\b[^>]*>)", re.DOTALL)
_BG_IN_TAG_RE = re.compile(r"background(?:Color)?\s*:\s*([^,;}\n]+)")


# A full-bleed AbsoluteFill carrying its own background — a backdrop LAYER.
# `inset: 0` / `position: absolute` variants are not matched on purpose: those
# are usually sized panels, and only an AbsoluteFill is unambiguously full-bleed.
_LAYER_FILL_RE = re.compile(
    r"<AbsoluteFill[^>]{0,300}?background(?:Color)?\s*:\s*[^,;}\n]+", re.DOTALL
)


def _fill_token(value: str) -> str | None:
    """Normalise one `background:` VALUE (already captured) to a comparable token."""
    val = value.strip().rstrip("'\"`")
    if "backgroundCss" in val or "palette.bg" in val:
        return "palette.bg"
    if "brandColors.background" in val or "palette.background" in val:
        return "palette.bg"
    if "palette.text" in val:
        return "palette.text"        # a fully inverted frame
    if "palette.accent" in val:
        return "palette.accent"
    if "palette.panel" in val or "palette.header" in val:
        return "palette.panel"
    lit = re.match(r"^['\"`]?(#[0-9a-fA-F]{3,8})", val)
    if lit:
        return lit.group(1).lower()
    if "transparent" in val:
        return "palette.bg"          # transparent shows whatever is behind it
    return None                      # computed / gradient / unknown — skip


def scene_canvas_token(code: str) -> str | None:
    """A normalised token for the scene's CANVAS, or None when unresolvable.

    Equal tokens mean two scenes share a background. `None` means "cannot tell"
    — the caller must treat that as a pass, not a mismatch.
    """
    if not code:
        return None
    # A SceneFrame at the ROOT paints the canvas from the palette, so the scene
    # is on-brand by construction. Scoped to the root: this used to be a
    # file-wide substring test, so a scene mentioning <SceneFrame anywhere — in a
    # nested branch, or wrapping only part of the tree under an AbsoluteFill that
    # painted its own red background — was declared on-brand without the root
    # ever being looked at.
    if re.search(r"return\s*\(?\s*<\s*SceneFrame\b", code):
        return "palette.bg"

    root = _ROOT_TAG_RE.search(code)
    if not root:
        return None  # cannot find the root element — do not guess
    tag = root.group(1)
    m = _BG_IN_TAG_RE.search(tag)
    if not m:
        # Distinguish "sets no fill" from "sets a fill we cannot read".
        #
        # Returning palette.bg for BOTH was the bug that let this whole mechanism
        # pass a broken template: a root of `style={rootStyle}` or
        # `style={{...bgStyle}}` DOES set a fill, the regex just cannot see it,
        # and the scene was reported on-brand. Three scenes painting three
        # different colours through variables all resolved to palette.bg, so the
        # drift detector saw unanimous agreement.
        if re.search(r"style\s*=\s*\{(?!\{)", tag) or "..." in tag:
            return None  # a style we cannot resolve — unknown, never assumed
        # Root genuinely sets no fill: it inherits the wrapper's canvas.
        return "palette.bg"

    root_token = _fill_token(m.group(1))

    # A full-bleed backdrop LAYER inside the root repaints the canvas just as
    # effectively as the root itself, and that is the shape that shipped the
    # near-black scene in a cream template:
    #
    #     <AbsoluteFill style={{ background: palette.background }}>   // root, fine
    #       <AbsoluteFill style={{ background: '#0a0a0a' }} />        // covers it
    #
    # Reading only the root reported that scene on-brand — a silent pass.
    #
    # A layer that merely repeats the root's own colour is not drift, so only a
    # token that DISAGREES with the root counts.
    for _lm in _LAYER_FILL_RE.finditer(code[root.end():]):
        _bg = _BG_IN_TAG_RE.search(_lm.group(0))
        layer_token = _fill_token(_bg.group(1)) if _bg else None
        if layer_token and layer_token != root_token:
            return layer_token

    return root_token


def detect_canvas_drift(codes: list[str]) -> list[int]:
    """Indices of scenes whose canvas disagrees with the template's majority.

    Returns [] when every resolvable scene agrees, when fewer than three scenes
    resolve (too little evidence to call an outlier), or when no single canvas
    holds a majority — in that case the template has no consensus to enforce and
    flagging half of it would be noise rather than a repair.
    """
    resolved = [(i, t) for i, t in enumerate(scene_canvas_token(c) for c in codes) if t]
    if len(resolved) < 3:
        return []
    counts: dict[str, int] = {}
    for _, t in resolved:
        counts[t] = counts.get(t, 0) + 1
    canon, n = max(counts.items(), key=lambda kv: kv[1])
    if n * 2 <= len(resolved):
        # No majority: the template has fractured completely rather than drifted.
        # Returning [] here meant the WORST case went unreported — a template
        # with a black, a cream and a red scene has counts of 1/1/1 and produced
        # zero outliers, which is exactly the failure this function exists for.
        # There is still a correct answer when the scenes do not agree on one:
        # the brand canvas.
        return [i for i, t in resolved if t != "palette.bg"]
    return [i for i, t in resolved if t != canon]


# Fonts overridden on a kit component — `<SceneFrame fonts={{heading: "..."}}>`
# is the worst case, because KitProvider then applies that face to the scene's
# ENTIRE subtree, silently defeating the per-element fontFamily checks.
_KIT_FONT_OVERRIDE_RE = re.compile(
    r"<\s*(?:SceneFrame|KitProvider)\b[^>]{0,400}?\bfonts\s*=", re.DOTALL
)


def detect_font_drift(codes: list[str]) -> list[int]:
    """Indices of scenes whose typography does not match the template.

    A scene is an outlier when it overrides the kit's fonts wholesale, or when it
    renders a headline / body copy without binding the corresponding font prop
    while its siblings do. The per-scene validator already rejects the outright
    cases; this catches the ones that only show up as DIFFERENCE — one scene in
    the brand's face and the next in the system sans.
    """
    def _token(code: str) -> str | None:
        """What typeface this scene resolves to, as a comparable token."""
        if not code:
            return None
        if _KIT_FONT_OVERRIDE_RE.search(code):
            return "kit-override"  # sets the face for its whole subtree
        # Any NAMED family beside the font prop pins this scene to that face.
        named = sorted(
            {
                m.group(2).strip().lower()
                for m in re.finditer(
                    r"""props\.(?:headingFont|bodyFont)\s*(?:\|\||\?\?)\s*(['"`])([^'"`]+)\1""",
                    code,
                )
                if m.group(2).strip().lower() not in ("inherit", "initial", "unset")
            }
        )
        if named:
            return "named:" + ",".join(named)
        if re.search(r"props\.(?:displayText|sceneTitle)", code) and not re.search(
            r"props\.headingFont", code
        ):
            return "unbound"
        return "brand"

    tokens = [(i, _token(c)) for i, c in enumerate(codes)]
    resolved = [(i, t) for i, t in tokens if t]
    if not resolved:
        return []

    # A scene is an outlier when it does not resolve to the brand face — either
    # because it names its own, overrides the kit's, or binds nothing at all.
    #
    # This is a genuine CROSS-SCENE comparison now. It used to be a per-scene
    # predicate in a loop, which could not detect "scene 1 falls back to Playfair,
    # scene 2 to Inter" by construction — the exact drift class its own docstring
    # named — because each scene passed on its own terms.
    return [i for i, t in resolved if t != "brand"]


def _detect_contrast_defects(code: str, theme: dict | None = None) -> list[str]:
    """Find text that is invisible against its own background.

    DELIBERATELY CONSERVATIVE — a false positive costs a full LLM rollout, so
    computed values, withAlpha(...), gradients and CSS variables are all skipped
    rather than guessed at. Only pairs that resolve to two concrete colours are
    judged.

    Two classes are caught:
      1. Literal hex pairs inside one style object.
      2. SYMBOLIC pairs (`color: palette.muted` on `palette.bg`) resolved against
         this brand's real theme. This is the class that actually ships — real
         scenes almost never hardcode hex, so a literal-only detector saw
         nothing, and `palette.muted` on `palette.bg` was measured at 1.75:1 on
         a red brand.

    Contrast is a WCAG ratio, not a luminance delta. The old `abs(lb-lf) < 0.25`
    heuristic passed #FFFFFF on #B4B4B4 (delta 0.29) which is 1.9:1 — badly
    unreadable.
    """
    hits: list[str] = []
    slots = _palette_slots(theme)

    # The palette.text-on-palette.text case, which the old BACKDROP fragment
    # actively encouraged by supplying a background and no foreground.
    if re.search(r"background(?:Color)?\s*:\s*palette\.text\b", code) and re.search(
        r"\bcolor\s*:\s*palette\.text\b", code
    ):
        hits.append(
            "palette.text is used as BOTH a background and a text colour — that text is "
            "invisible. Derive the foreground: const fg = readableOn(palette.text)."
        )

    # Literal hex collisions, scoped to a single style object so unrelated
    # declarations elsewhere in the file are never paired up.
    for obj in _STYLE_OBJ_RE.findall(code):
        bg = _BG_LITERAL_RE.search(obj)
        fg = _FG_LITERAL_RE.search(obj)
        if not bg or not fg:
            continue
        bg_hex, fg_hex = bg.group(1), fg.group(1)
        if bg_hex.lower() == fg_hex.lower():
            hits.append(f"text and background are the same colour ({bg_hex}) in one style object")
            continue
        ratio = contrast_ratio(fg_hex, bg_hex)
        if ratio is not None and ratio < AA_CONTRAST:
            hits.append(
                f"text {fg_hex} on background {bg_hex} is too low-contrast to read "
                f"({ratio:.1f}:1, needs {AA_CONTRAST}:1); use readableOn({bg_hex})"
            )

    # ── Symbolic palette pairs, against the CANVAS only ───────────
    #
    # Judged against palette.bg and nothing else. An earlier version paired every
    # foreground in the file against every background in the file, which has no
    # notion of which element sits on which — so a CORRECT scene (an accent panel
    # whose text is `readableOn(palette.accent)`, plus ordinary body copy on the
    # canvas) was reported as "palette.text on palette.accent" and failed all
    # three repair attempts, because there was nothing to fix. That cost a whole
    # scene per occurrence.
    #
    # Nesting is not recoverable by regex, so the only pairing that can be
    # asserted is text against the canvas: a scene's root fill applies to
    # everything not explicitly placed on something else. Text inside a panel may
    # be a false NEGATIVE here; that is the correct direction to be wrong in.
    bg_hex = slots.get("bg")
    if bg_hex:
        for fg_slot in sorted(set(_SYMBOLIC_FG_RE.findall(code))):
            fg_hex = slots.get(fg_slot)
            if not fg_hex or fg_slot == "bg":
                continue
            # Skip the whole check when the scene paints a KNOWN non-canvas root:
            # the canvas is then not what this text sits on. An UNKNOWN canvas
            # (None — a computed fill, or a fragment with no root element) still
            # counts as the brand canvas, because that is what the wrapper
            # supplies when the scene does not override it.
            if scene_canvas_token(code) not in (None, "palette.bg"):
                break
            ratio = contrast_ratio(fg_hex, bg_hex)
            if ratio is not None and ratio < AA_CONTRAST:
                hits.append(
                    f"palette.{fg_slot} ({fg_hex}) as text on the canvas palette.bg "
                    f"({bg_hex}) is {ratio:.1f}:1 — below the {AA_CONTRAST}:1 needed "
                    f"to read. Use palette.text for body copy, or palette.accentText "
                    f"for accent-coloured type."
                )

    # ── Unpaired LITERAL foregrounds, also against the canvas ────────────────
    #
    # The literal pass above needs a background in the SAME style object, so
    # `color: '#FFFFFF'` on its own was never measured — and that is exactly how
    # white body copy shipped onto a cream canvas, invisible. A bare foreground
    # sits on whatever is behind it, which (per the reasoning above) is the
    # brand canvas unless the scene paints a known non-canvas root.
    if bg_hex and scene_canvas_token(code) in (None, "palette.bg"):
        for obj in _STYLE_OBJ_RE.findall(code):
            if _BG_LITERAL_RE.search(obj):
                continue                     # already judged as a pair above
            fg = _FG_LITERAL_RE.search(obj)
            if not fg:
                continue
            ratio = contrast_ratio(fg.group(1), bg_hex)
            if ratio is not None and ratio < AA_CONTRAST:
                hits.append(
                    f"text {fg.group(1)} on the canvas ({bg_hex}) is {ratio:.1f}:1 — "
                    f"below the {AA_CONTRAST}:1 needed to read. Do not hardcode a "
                    f"text colour; use palette.text (or readableOn(bg))."
                )
    return hits


# Colour slots a scene is allowed to draw from. Anything else is off-brand.
_ANY_HEX_RE = re.compile(r"['\"](#[0-9a-fA-F]{3,8})['\"]")
# Bare hex in CSS, where values are unquoted.
_CSS_HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
# A hex in FALLBACK position — `props.brandColors?.accent || '#7C3AED'` — is not
# a drawn colour, it is the value used when brand data is missing entirely. The
# scene still renders the brand hue whenever one exists, so flagging these would
# fail correct code (5 of 9 scaffold scenes) and burn repair attempts on nothing.
_FALLBACK_HEX_RE = re.compile(r"(?:\|\||\?\?)\s*['\"](#[0-9a-fA-F]{3,8})['\"]")
# Greys are exempt: pure neutrals read as shadow/scrim/hairline rather than as a
# competing hue, and scenes legitimately use them for depth.
_NEUTRAL_TOLERANCE = 12


def _is_neutral(hex_str: str) -> bool:
    """True for greys/near-greys (R≈G≈B), which carry no hue of their own."""
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) < 6:
        return False
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return max(r, g, b) - min(r, g, b) <= _NEUTRAL_TOLERANCE


def _is_plausible_default(hex_str: str) -> bool:
    """True for a colour that reads as a no-data DEFAULT rather than a design choice.

    Near-black and near-white qualify; a saturated mid-tone (#7C3AED, #6366F1)
    does not. Used to bound the fallback-position exemption in
    detect_offpalette_colors.
    """
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) < 6:
        return False
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lightness = (max(r, g, b) + min(r, g, b)) / 2
    return lightness < 0.22 or lightness > 0.90


def detect_offpalette_colors(code: str, theme: dict | None = None) -> list[str]:
    """Find hard-coded hues that are not in this brand's palette.

    This is a DIFFERENT failure from contrast: a scene drew an indigo rule and an
    indigo label into a cream/black/red template. Nothing caught it, because
    indigo-on-cream passes contrast comfortably — it is simply not a brand
    colour. The contrast gate can only ever ask "can I read this", never "does
    this belong here".

    Greys are allowed (scrims, hairlines, shadows). Colours already in the
    palette are allowed however they are written.
    """
    slots = _palette_slots(theme)
    if not slots:
        return []
    allowed = {v.lower() for v in slots.values() if v}
    fallbacks = {h.lower() for h in _FALLBACK_HEX_RE.findall(code)}
    seen: set[str] = set()
    hits: list[str] = []
    for lit in _ANY_HEX_RE.findall(code):
        # A hex in FALLBACK position (`props.brandColors?.accent || '#XXX'`) is
        # not a drawn colour — it is the value used when brand data is missing —
        # so it is exempt. But the exemption was total, which let a saturated
        # off-brand hue live in the source: `|| '#7C3AED'` is exactly how the
        # app's purple travelled into templates.
        #
        # A legitimate last-resort default is a near-black or near-white, not a
        # mid-tone brand colour. Judge on LIGHTNESS rather than the hue-spread
        # neutrality test, because the scaffolds' own default (#1a1a2e) carries a
        # slight blue cast and is plainly fine.
        if lit.lower() in fallbacks and _is_plausible_default(lit):
            continue
        low = lit.lower()
        # Normalise #RGB → #RRGGBB so shorthand cannot slip past the set test.
        if len(low) == 4:
            low = "#" + "".join(c * 2 for c in low[1:])
        if low in seen or low in allowed or _is_neutral(low):
            continue
        seen.add(low)
        # Name palette.accentText explicitly. A hand-picked hue is almost
        # always an attempt to darken a light accent enough to READ — which is
        # what that slot already is. Without naming it the model retries with
        # another invented shade and fails the same two gates again.
        hits.append(
            f"{lit} is not one of this template's colours "
            f"({', '.join(sorted(allowed))}). Every colour must come from the "
            f"palette — use palette.accent (fills/rules), palette.accentText "
            f"(accent-coloured TEXT, already darkened to stay readable on this "
            f"canvas), palette.text or palette.bg. Never hand-pick a shade."
        )
    return hits


def _build_brand_context(
    theme: dict,
    brand_kit_data: dict | None,
    name: str,
    category: str = "",
    video_style: str = "",
    personality: str = "",
    source_url: str = "",
) -> str:
    """Build brand context string — raw data only, no instructions."""
    colors = theme.get("colors", {})
    fonts = theme.get("fonts", {})
    style = theme.get("style")
    animation = theme.get("animationPreset")
    patterns = theme.get("patterns", {})

    # EXACTLY the three brand colours. `secondary` (theme.colors.surface) used to
    # be listed here, which told the model a fourth colour was available to draw
    # with — while nothing downstream ever rendered it, and the off-palette gate
    # would reject it. Panels, borders and muted text are DERIVED by the kit.
    brand_colors = {
        "primary": colors.get("accent"),
        "accent": colors.get("accent"),
        "background": colors.get("bg"),
        "text": colors.get("text"),
    }
    # Remove None values
    brand_colors = {k: v for k, v in brand_colors.items() if v}

    ctx = f"Brand: {name}\n"
    if brand_colors:
        ctx += f"Colors: {json.dumps(brand_colors)}\n"
    if fonts.get("heading") or fonts.get("body"):
        parts = []
        if fonts.get("heading"):
            parts.append(f"Heading: {fonts['heading']}")
        if fonts.get("body"):
            parts.append(f"Body: {fonts['body']}")
        ctx += f"Fonts: {', '.join(parts)}\n"
    if style:
        ctx += f"Design style: {style}\n"
    if animation:
        ctx += f"Animation preset: {animation}\n"

    if patterns:
        ctx += "\nVisual patterns from website:\n"
        cards = patterns.get("cards", {})
        if cards:
            ctx += f"  Cards: corners={cards.get('corners')}, shadow={cards.get('shadowDepth')}, border={cards.get('borderStyle')}\n"
        spacing = patterns.get("spacing", {})
        if spacing:
            ctx += f"  Spacing: density={spacing.get('density')}, gridGap={spacing.get('gridGap')}px\n"
        images = patterns.get("images", {})
        if images:
            ctx += f"  Images: treatment={images.get('treatment')}, overlay={images.get('overlay')}\n"
        layout = patterns.get("layout", {})
        if layout:
            ctx += f"  Layout: direction={layout.get('direction')}\n"
            decorative = layout.get("decorativeElements", [])
            if decorative:
                ctx += f"  Decorative elements: {', '.join(decorative)}\n"

    if brand_kit_data:
        if brand_kit_data.get("logos"):
            # props.logoUrl is undefined on EVERY scene — the render path blanks
            # it and composites one corner watermark over the finished frame
            # instead (see LogoOverlay in GeneratedVideo.tsx). Saying so stops
            # the model spending composition on a mark that will never appear,
            # and tells it to keep the corner clear for the one that will.
            ctx += (
                "The brand has a logo, but it is a CORNER WATERMARK composited over the "
                "finished frame by the render path — props.logoUrl is undefined in every "
                "scene, so nothing you draw for it will appear. Keep rule 4's guarded "
                "block, design as though the logo were absent, and leave the bottom-right "
                "corner (about 12% of the width) clear of anything it would cover.\n"
            )
        if brand_kit_data.get("images"):
            ctx += f"{len(brand_kit_data['images'])} brand image(s) available via props.brandImages\n"
        dl = brand_kit_data.get("design_language", {})
        if dl:
            for key in ("vibe", "density", "shapes"):
                if dl.get(key):
                    ctx += f"{key.title()}: {dl[key]}\n"

    # The gradient rule governs the BASE CANVAS only.
    #
    # It used to read "use SOLID backgrounds only, NO gradients", which the model
    # correctly applied to everything — so scenes for the (many) brands without a
    # bg2 had no tonal depth anywhere: no scrims over images, no vignettes, no
    # washes behind a panel. That flatness is a large part of why templates looked
    # alike. What the brand evidence actually constrains is the page background,
    # not every decorative surface in a video.
    use_gradient = colors.get("bg2") is not None
    if use_gradient:
        ctx += (
            f"Background: gradient from {colors.get('bg')} to {colors.get('bg2')} — the base "
            "canvas may be a gradient, and decorative surfaces may be too\n"
        )
    else:
        ctx += (
            f"Background: solid {colors.get('bg')} — the BASE CANVAS is a solid fill (this brand's "
            "own site is solid, so a gradient page background would misrepresent it). This governs "
            "the canvas ONLY: image scrims, vignettes, radial accent washes behind a panel, and "
            "tonal depth on a decorative surface are all still encouraged — they are lighting, not "
            "a brand background.\n"
        )

    # Craft-kit decor system. Prefer the explicit theme.decor field (set by the
    # theme extractor); fall back to deriving from decorative elements.
    decor = theme.get("decor") or {}
    if decor.get("system"):
        _decor = decor["system"]
        _intensity = decor.get("intensity", 0.45)
    else:
        _decor_map = {
            "gradients": "orbs",
            "background-shapes": "orbs",
            "dots": "dots",
            "accent-lines": "rules",
        }
        _decoratives = (patterns.get("layout", {}) or {}).get("decorativeElements", []) or []
        _decor = next((_decor_map[d] for d in _decoratives if d in _decor_map), "none")
        _intensity = 0.45

    # ── Brand design context — the narrative brief the design docs are built on.
    #
    # This replaced a "BRAND IDENTITY KIT" block that named a surface variant, a
    # type treatment and a signature artifact family, all picked deterministically
    # from fixed enum pools by a hash of the brand's category. That block was a
    # primary cause of template convergence: two brands hashing into the same
    # bucket were handed the same persona and produced the same template with
    # different colours.
    #
    # The extractor now writes a real design brief in prose, and the design doc
    # stage designs from it. Nothing here names a component or a menu value.
    brand_description = (theme.get("brand_description") or "").strip()
    if brand_description:
        ctx += f"BRAND DESIGN CONTEXT (design FROM this, not from the colour values):\n  {brand_description}\n"
    else:
        ctx += f"Suggested decor system (optional): {_decor} at intensity {_intensity}\n"

    # Motion energy: prefer explicit theme.motion.energy, else the free-form preset.
    motion = theme.get("motion") or {}
    if motion.get("energy"):
        ctx += (
            f"Motion energy: {motion['energy']} (easing {motion.get('easing', 'easeOutQuint')}) — "
            "keep ONE signature beat per scene; stagger entrances; never animate everything at once.\n"
        )
    elif animation:
        ctx += (
            f"Motion energy: interpret '{animation}' — keep ONE signature beat per "
            "scene; stagger entrances; do not animate everything at once.\n"
        )

    # Preferred content archetypes for this brand (scene-type variety hint).
    scene_bias = theme.get("sceneBias")
    if isinstance(scene_bias, list) and scene_bias:
        ctx += f"Preferred scene types for this brand: {', '.join(str(s) for s in scene_bias)}\n"

    if source_url:
        ctx += f"Website: {source_url}\n"
    if category:
        ctx += f"Category: {category}\n"
    if video_style:
        ctx += f"Video style: {video_style}\n"
    if personality:
        ctx += f"Brand personality: {personality}\n"

    return ctx


# ─── JSON parsing helpers ───────────────────────────────────────


def _extract_json_array(raw: str):
    """Parse a JSON array from an LLM string, tolerating common slop.

    Handles: ```json fences, prose before/after the array, and trailing text
    after the closing bracket (the `Extra data: line N` failure). Strategy:
    strip fences, then if a plain json.loads fails, slice from the first '[' to
    its matching ']' (bracket-depth aware, skipping brackets inside strings) and
    parse that. Raises json.JSONDecodeError if no valid array is found.
    """
    s = (raw or "").strip()
    # Strip a leading ```/```json fence and a trailing ``` fence.
    if s.startswith("```"):
        nl = s.find("\n")
        if nl != -1:
            s = s[nl + 1 :]
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
    s = s.strip()

    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # Find the first top-level [...] block, ignoring brackets inside strings.
    start = s.find("[")
    if start == -1:
        raise json.JSONDecodeError("no JSON array found", s, 0)
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return json.loads(s[start : i + 1])
    raise json.JSONDecodeError("unterminated JSON array", s, start)


def _generate_design_system(brand_context: str) -> str:
    """Generate a concise visual design system for cross-scene consistency."""
    ensure_dspy_configured()

    module = dspy.ChainOfThought(
        GenerateDesignSystem,
        rationale_field=dspy.OutputField(
            prefix="Analysis:",
            desc="Brief: brand personality → 3 key CSS decisions",
        ),
    )

    t0 = time.time()
    codegen_lm = get_custom_lm()
    with dspy.context(lm=codegen_lm):
        result = module(brand_context=brand_context)

    design_system = _strip_offpalette_css(result.design_system or "", brand_context)
    elapsed = time.time() - t0
    print(f"[F7-DEBUG] [DESIGN-SYSTEM] Generated in {elapsed:.1f}s ({len(design_system)} chars)")
    return design_system


def _strip_offpalette_css(css: str, brand_context: str) -> str:
    """Replace invented hexes in the design system with palette slot names.

    The design system is handed to every scene as authoritative CSS, so a colour
    invented HERE propagates into scene after scene — and each one is then
    rejected by the palette gate. Observed on a real run: the design system
    declared `--color-text-muted: #6B7280` and `--color-bg-end: #c7dbea`, the
    model used both as instructed, and two scenes were stubbed after burning
    three repair attempts each.

    Asking the model not to invent colours (see the signature) is necessary but
    not sufficient — this is the deterministic half. Brand colours and neutrals
    are left alone; anything else becomes a slot NAME, which is both correct and
    a standing instruction to the scene model.
    """
    theme = _theme_from_brand_context(brand_context)
    slots = _palette_slots(theme)
    if not slots:
        return css
    allowed = {v.lower() for v in slots.values() if v}

    def _sub(m: re.Match) -> str:
        lit = m.group(0)
        low = lit.lower()
        if len(low) == 4:  # #RGB
            low = "#" + "".join(c * 2 for c in low[1:])
        if low in allowed or _is_neutral(low):
            return lit
        # Name the slot whose ROLE this colour was filling, judged by contrast:
        # something readable on the canvas was meant as text, otherwise it was a
        # surface tint.
        bg = slots.get("bg")
        if bg and (contrast_ratio(lit, bg) or 0) >= AA_CONTRAST:
            return "var(--palette-muted)"
        return "var(--palette-panel)"

    # NOT _ANY_HEX_RE — that requires surrounding quotes (JS string literals).
    # CSS writes bare hexes: `--color-bg-end: #c7dbea;`.
    return _CSS_HEX_RE.sub(_sub, css) if "#" in css else css


# ─── Per-scene generation with informed retries ─────────────────


class _SalvagedPrediction:
    """A stand-in for a dspy.Prediction recovered from a parse failure.

    Carries the scene code plus default image-box fractions, so downstream code
    that reads `result.code` / `getattr(result, "image_box_*", None)` works
    unchanged.
    """

    def __init__(self, code: str) -> None:
        self.code = code
        self.image_box_width_fraction_landscape = 1.0
        self.image_box_height_fraction_landscape = 1.0
        self.image_box_width_fraction_portrait = 1.0
        self.image_box_height_fraction_portrait = 1.0


def _salvage_scene_from_parse_error(err: Exception) -> _SalvagedPrediction | None:
    """Pull scene code out of a DSPy AdapterParseError, if it is in there.

    DSPy embeds the raw LM response in the exception message. When the only
    problem is missing trailing fields, the `code` value is intact and can be
    recovered — far better than failing the whole template for metadata that
    nothing renders.

    Returns None when there is no usable code, so the caller re-raises.
    """
    text = str(err or "")
    if "code" not in text:
        return None
    # The response is JSON-ish; find the "code" member and decode just that
    # string, tolerating the truncation that broke the whole-object parse.
    m = re.search(r'"code"\s*:\s*"', text)
    if not m:
        return None
    start = m.end()
    buf: list[str] = []
    i = start
    while i < len(text):
        ch = text[i]
        if ch == "\\" and i + 1 < len(text):
            buf.append(text[i : i + 2])
            i += 2
            continue
        if ch == '"':
            break
        buf.append(ch)
        i += 1
    try:
        code = json.loads(f'"{"".join(buf)}"')
    except (json.JSONDecodeError, ValueError):
        return None
    if len(code.strip()) < 200 or "SceneComponent" not in code:
        return None
    return _SalvagedPrediction(code)


@contextlib.contextmanager
def _suppress_offer_feedback():
    """Stop `dspy.Refine` spending an LLM call to GUESS at an error we already have.

    Between every pair of rollouts Refine calls
    `dspy.Predict(OfferFeedback)(...)` — handing the model the program source
    and the full trajectory so it can *infer* why the last attempt scored
    badly. The call is inline in `Refine.forward` with no flag and no
    overridable method, so this patch is the only seam.

    Here that inference is pure waste: `_scene_reward` has already written the
    REAL validator output (every failed contract, numbered, with an annotated
    source window) into `previous_failure`, which the next rollout reads
    directly. Refine would spend a call rediscovering a diagnostic we are
    holding — which is exactly what made the earlier hand-rolled loop faster.
    Suppressing it is what lets REFINE_N rise to 5 attempts at the same cost 3
    attempts used to carry: 5 LLM calls per failing scene, not 9.

    HOW: Refine consumes the result as `if not advice:` and takes the plain
    (unwrapped) path when it is falsy — so a stub whose `.advice` is None makes
    the next rollout run normally with no `hint_` field appended. The stub must
    RETURN falsy rather than raise: an exception here is swallowed by Refine's
    own `except`, which decrements `fail_count` and burns a rollout (measured:
    4 generations instead of 5).

    SAFETY: the patch is process-wide while active and scenes run
    concurrently, so it must never intercept a sibling's real predictor. The
    `sig is refine_mod.OfferFeedback` identity check is what guarantees that —
    every other signature is delegated to the real `dspy.Predict`.
    """
    import dspy.predict.refine as refine_mod

    _real_predict = refine_mod.dspy.Predict

    class _NullAdvice:
        """Falsy advice — Refine falls back to its plain, unwrapped path."""

        def __call__(self, **_kwargs):
            return dspy.Prediction(advice=None)

    def _predict_or_null(signature, *args, **kwargs):
        if signature is refine_mod.OfferFeedback:
            return _NullAdvice()
        return _real_predict(signature, *args, **kwargs)

    with patch.object(refine_mod.dspy, "Predict", _predict_or_null):
        yield


class NonRaisingRefine(dspy.Refine):
    """`dspy.Refine`, minus the one behaviour that can kill a whole batch.

    Refine re-raises once `fail_count` (default N) is exhausted. That is wrong
    here: scenes are generated concurrently, and letting one scene's exception
    propagate previously discarded the ~6 minutes of compute spent on its
    siblings. The pipeline already has a better answer for a scene that cannot
    be generated — the caller substitutes a deterministic stub and records a
    warning — so this returns the best prediction seen instead of raising, and
    lets that path handle it.

    Everything else is stock Refine: N rollouts at temperature 1.0 with varying
    rollout_id, best-of-N selection, early exit once the threshold is met, and
    the OfferFeedback call between rollouts.

    The exact validator error still reaches each retry: `_scene_reward` writes
    it into the kwargs dict Refine re-splats on every iteration (see the note
    there), so `previous_failure` carries the real diagnostic rather than an
    inferred one.
    """

    def forward(self, **kwargs):
        try:
            with _suppress_offer_feedback():
                return super().forward(**kwargs)
        except Exception as e:  # noqa: BLE001
            print(f"[F7-DEBUG] [REFINE] all rollouts failed ({type(e).__name__}: {e})")
            # Refine tracks its best prediction in a local, so it is gone once
            # forward() raises. One clean rollout at default settings is a far
            # better hand-off to the repair loop than nothing at all.
            #
            # Deliberately OUTSIDE the suppression context: this is a single
            # plain call with no rollout loop, so no advice is involved.
            try:
                return self.module(**kwargs)
            except Exception:  # noqa: BLE001
                raise e


def _generate_single_scene_sync(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    general_doc: str = "",
    scene_doc: str = "",
    built_so_far: str = "",
    previous_failure: str = "",
    use_refine: bool = True,
    current_code: str = "",
    edit_instruction: str = "",
    lm: "dspy.LM | None" = None,
) -> tuple[str, dict[str, str], list[dict]]:
    """Generate a single scene using DSPy ChainOfThought (+ Refine) (sync).
    Returns (code, {"landscape": "W / H", "portrait": "W / H"}).

    `lm` overrides the model for this call. Generation leaves it None and gets
    the codegen LM; editing an existing scene passes get_scene_edit_lm(), which
    is a cheaper line for the narrower task. Kept as a parameter rather than a
    branch inside so this function has exactly one reason to pick a model.

    use_refine=False (§R Layer 2) runs the base module ONCE instead of wrapping
    it in dspy.Refine. Repair attempts pass False: Refine costs up to REFINE_N+1
    rollouts and, because it returns its best-scoring attempt even when every
    attempt scored 0.0 (it never raises), a "retry" could burn 3 calls and still
    hand back invalid code. One informed call per repair attempt makes the
    worst-case cost per scene predictable instead of opaque.
    """
    ensure_dspy_configured()

    base_module = dspy.ChainOfThought(
        GenerateSceneCode,
        rationale_field=dspy.OutputField(
            prefix="Plan:",
            desc="3 bullet points: (1) layout approach, (2) animation strategy, (3) content rendering",
        ),
    )

    t0 = time.time()

    # Font-size sanity bounds only. The per-template numeric band came from the
    # blueprint's type_system, which no longer exists: the design docs describe
    # typography in prose, so there is nothing numeric to enforce against.
    _bands: dict = {}

    _base_kwargs = dict(
        brand_context=brand_context,
        design_system=design_system,
        general_doc=general_doc,
        scene_doc=scene_doc,
        built_so_far=built_so_far,
        scene_type=scene_type,
        scene_index=scene_index,
        total_scenes=total_scenes,
        current_code=current_code,
        edit_instruction=edit_instruction,
    )

    codegen_lm = lm or get_custom_lm()
    with dspy.context(lm=codegen_lm):
        if use_refine:
            # `_theme` / `_type_bands` are scorer-only inputs and must NOT ride
            # in the kwargs dict — Refine splats that straight into the module,
            # and an unknown key there goes to the LLM signature. A closure
            # keeps them out of the prompt while still reaching the scorer.
            _scene_theme = _theme_from_brand_context(brand_context)

            def _reward(args, pred, _t=_scene_theme, _b=_bands):
                if isinstance(args, dict):
                    args.setdefault("_theme", _t)
                    args.setdefault("_type_bands", _b)
                return _scene_reward(args, pred)

            refiner = NonRaisingRefine(
                module=base_module,
                N=REFINE_N + 1,  # same rollout budget as the loop it replaces
                reward_fn=_reward,
                threshold=REFINE_THRESHOLD,
            )
            result = refiner(previous_failure=previous_failure, **_base_kwargs)
        else:
            result = base_module(previous_failure=previous_failure, **_base_kwargs)

    elapsed = time.time() - t0
    # dspy.Refine returns its best prediction, but that is None when EVERY
    # rollout raised (the hand-rolled loop it replaced always had something to
    # hand back). Treat it as empty code: the caller's repair/stub path already
    # handles a scene that produced nothing, and reaching `.code` on None here
    # would turn one bad scene into an AttributeError that kills the batch.
    code = clean_code(getattr(result, "code", "") or "") if result is not None else ""

    # Derive image-box aspect ratios for both orientations from the fractions the AI reported.
    # Landscape canvas: 1920x1080. Portrait canvas: 1080x1920.
    def _safe_frac(v: float | None) -> float:
        try:
            f = float(v) if v is not None else 1.0
        except (TypeError, ValueError):
            return 1.0
        return min(1.0, max(0.05, f))

    lw = _safe_frac(getattr(result, "image_box_width_fraction_landscape", None))
    lh = _safe_frac(getattr(result, "image_box_height_fraction_landscape", None))
    pw = _safe_frac(getattr(result, "image_box_width_fraction_portrait", None))
    ph = _safe_frac(getattr(result, "image_box_height_fraction_portrait", None))

    landscape_ar = f"{max(1, int(round(1920 * lw)))} / {max(1, int(round(1080 * lh)))}"
    portrait_ar = f"{max(1, int(round(1080 * pw)))} / {max(1, int(round(1920 * ph)))}"
    aspect_ratios = {"landscape": landscape_ar, "portrait": portrait_ar}

    line_count = code.count("\n") + 1

    print(
        f"[F7-DEBUG] [REFINE] Scene {scene_index} ({scene_type}) done: "
        f"{line_count} lines in {elapsed:.1f}s, "
        f"landscape_ar={landscape_ar!r} (w={lw:.2f}, h={lh:.2f}), "
        f"portrait_ar={portrait_ar!r} (w={pw:.2f}, h={ph:.2f})"
    )
    # Separate cheap pass — see DescribeSceneProps for why this is not another
    # output field on GenerateSceneCode.
    prop_schema = _describe_scene_props(code)
    if prop_schema:
        print(
            f"[F7-DEBUG] [PROP-SCHEMA] scene {scene_index} declares "
            f"{[f['key'] for f in prop_schema]}"
        )

    return code, aspect_ratios, prop_schema


# How many scenes may be in flight AT ONCE — a ROLLING window, not a wave.
#
# Scenes are fully independent (each has its own design doc and prompt, and
# nothing about one depends on another finishing), so this cap is about the
# PROVIDER, not correctness.
#
# THE WINDOW SLIDES. Every scene's task is created upfront and blocks on the
# semaphore; the instant one finishes it releases its slot and the next waiting
# scene starts. An 11-scene template at 8 does NOT run "8 then 3" — it keeps 8
# in flight until fewer than 8 remain. Both stages that fan out work this way:
# generation (as_completed over pre-created tasks) and the verify/repair pass
# (asyncio.gather over all scenes, same semaphore size). Sizing this to
# MAX_SCENES therefore buys nothing over a smaller window except a bigger
# opening burst, which is exactly what throttles.
#
# Why not larger: 429s appeared at 11 on Z.AI's glm-5.3, and a rate-limited
# rollout is charged to dspy.Refine as a FAILED ATTEMPT — so a throttled burst
# can silently eat a scene's whole rollout budget and push it into the repair
# loop for reasons unrelated to its code.
#
# Why this is no longer the real ceiling: a scene is not one request. Each also
# runs _describe_scene_props on a second LM, and repairs add more. The hard
# bound on simultaneous provider calls is _PROVIDER_MAX_INFLIGHT in
# app.dspy_modules, enforced on the LM itself so every caller queues against
# one gate. THAT is the knob to turn if 429s persist — not this one, which now
# governs how many scenes are queued rather than how much load is applied.
SCENE_CONCURRENCY = 8

# One worker per in-flight scene. These threads are blocked on a network call,
# not on CPU, so sizing them to the concurrency window is exact — any more would
# sit idle, any fewer would throttle below the window.
_SCENE_EXECUTOR = ThreadPoolExecutor(
    max_workers=SCENE_CONCURRENCY, thread_name_prefix="scene-gen"
)


async def _generate_single_scene(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    general_doc: str = "",
    scene_doc: str = "",
    built_so_far: str = "",
    previous_failure: str = "",
    use_refine: bool = True,
    current_code: str = "",
    edit_instruction: str = "",
    lm: "dspy.LM | None" = None,
) -> tuple[str, dict[str, str], list[dict]]:
    """Async wrapper — runs the sync generation call in a dedicated thread pool.
    Returns (code, {"landscape": "W / H", "portrait": "W / H"}).

    Uses functools.partial rather than run_in_executor's positional *args so
    adding a parameter can never silently shift argument order.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _SCENE_EXECUTOR,
        partial(
            _generate_single_scene_sync,
            brand_context=brand_context,
            design_system=design_system,
            general_doc=general_doc,
            scene_doc=scene_doc,
            built_so_far=built_so_far,
            scene_type=scene_type,
            scene_index=scene_index,
            total_scenes=total_scenes,
            previous_failure=previous_failure,
            use_refine=use_refine,
            current_code=current_code,
            edit_instruction=edit_instruction,
            lm=lm,
        ),
    )


# ─── Failure diagnostics (§R Layer 1) ───────────────────────────


def _format_scene_failure(
    code: str, error: str, *, scene_type: str = "content", scene_doc: str = ""
) -> str:
    """Format a validation failure into a diagnostic the MODEL can act on.

    The retry loop used to send a hardcoded "the previous attempt had a syntax
    error, double-check every React.createElement(...) call" hint. That claim is
    wrong for ~14 of the ~15 failures validate_component_code() can return
    (missing logoUrl conditional, non-monotonic interpolate, string in
    outputRange, TDZ destructure, dangerous API, unbalanced parens, ...), so on
    a non-syntax failure the model was actively MISDIRECTED toward the wrong fix
    while the real error sat unused in `err`.

    This returns the real error plus, when the error carries an esbuild
    "<stdin>:LINE:COL" position, an annotated source window so the model can see
    the offending token in context.
    """
    error = (error or "").strip() or "(no error message)"
    parts = [f"ERROR: {error}"]

    m = re.search(r"<stdin>:(\d+):(\d+)", error)
    if m and code:
        line_no = int(m.group(1))
        lines = code.split("\n")
        lo, hi = max(0, line_no - 4), min(len(lines), line_no + 3)
        snippet = "\n".join(
            f"{'>>> ' if j + 1 == line_no else '    '}{j + 1:4d} | {lines[j]}"
            for j in range(lo, hi)
        )
        parts.append(f"SOURCE (>>> marks the reported line):\n{snippet}")

        # esbuild reports where parsing BROKE, which for JSX is often one line
        # PAST the actual mistake. The dominant case: an opening tag whose
        # attribute list is never closed with `>`, so the next child expression
        # is misread as another attribute:
        #
        #     <div style={{ color: 'red' }}      <- missing '>'
        #       {props.displayText}              <- reported here
        #
        # Point at the real line, otherwise the model "fixes" the wrong one.
        if 'Expected "..." but found' in error and line_no >= 2:
            preceding = "\n".join(lines[max(0, line_no - 6) : line_no - 1])
            if "}}" in preceding and not re.search(r"}}\s*>\s*$", preceding.rstrip()):
                parts.append(
                    "LIKELY CAUSE: the JSX tag opened ABOVE line "
                    f"{line_no} was never closed with '>'. Its attribute list ends with "
                    "'}}' and the next line starts a child expression, so the parser is "
                    "still reading attributes. Add the missing '>' at the end of the "
                    "opening tag — do NOT change the child expression itself."
                )
    elif code:
        # No position info (e.g. "Code is empty", a regex-based structural
        # failure). Show the head of the output, truncated so the prompt — and
        # the logs — stay a sane size.
        preview = code[:1000] + ("..." if len(code) > 1000 else "")
        parts.append(f"YOUR PREVIOUS OUTPUT ({len(code)} chars):\n{preview}")
    else:
        # An empty `code` field almost always means the response was TRUNCATED
        # (the model spent its budget on reasoning and never reached the field),
        # not that it chose to emit nothing. Saying "your previous output was
        # empty" gives it nothing to act on and burns identical retries, so name
        # the real cause and ask for a shorter answer.
        parts.append(
            "YOUR PREVIOUS OUTPUT: (empty — the response was cut off before the code "
            "field was written)\n"
            "Your previous attempt ran out of output budget. Keep your reasoning to a "
            "few short bullets and write the component immediately. Prefer a compact, "
            "correct scene over an elaborate one: fewer nested wrappers, fewer inline "
            "style objects, no long comments."
        )

    # validate_component_code() returns on its FIRST failure, so a repair prompt
    # names one broken contract and says nothing about the dozen the scene
    # currently satisfies. Observed consequence: a scene told "missing logoUrl"
    # came back with the logo and ZERO animations; told "insufficient
    # animations" it came back animated and without the logo — ping-ponging
    # between two contracts, shrinking 279 -> 154 lines, and burning every
    # repair attempt without converging.
    #
    # Restating the full contract on every repair costs a few hundred tokens and
    # removes the trade-off the model was implicitly making.
    parts.append(build_repair_checklist(scene_type, scene_doc))

    return "\n\n".join(parts)


# Every hard requirement validate_component_code() enforces, as a checklist.
# Attached to EVERY repair prompt — see _format_scene_failure().
#
# BUILT PER SCENE, not frozen. The image item in particular must follow the
# scene's own design: a fixed "declare hasImage and render the image" line would
# order an image slot into a scene the design deliberately made image-less,
# which is a hole in the frame rather than a fix.
_CHECKLIST_HEAD = (
    "KEEP EVERY OTHER CONTRACT INTACT. Fixing the error above must not break a rule the "
    "scene already satisfies — that is the single most common way a repair fails. Before "
    "you answer, verify ALL of these are still true:\n"
    "  1. LOGO: `{props.logoUrl && typeof props.logoUrl === 'string' && (<Img "
    "src={props.logoUrl} data-logo=\"1\" style={{width: .., height: 'auto', maxHeight: ..}} "
    "/>)}` is present. Width plus `height: 'auto'` — never a fixed width AND a fixed "
    "height, which letterboxes a wordmark.\n"
)

_CHECKLIST_IMAGE = {
    "background": (
        "  2. IMAGE (this scene's design says BACKGROUND): a full-bleed container carrying "
        "data-content-img=\"1\" renders FIRST at zIndex 0 with the content layer above it at "
        "zIndex 1, and a SCRIM sits between them so the copy stays readable.\n"
    ),
    "half": (
        "  2. IMAGE (this scene's design says HALF): a BOUNDED container carrying "
        "data-content-img=\"1\" occupies one half — 50% width x 100% height in landscape, "
        "100% width x 50% height in portrait — never full-bleed, and the content fills the "
        "other half.\n"
    ),
    None: (
        "  2. IMAGE: this scene is deliberately IMAGE-LESS. It must NOT declare hasImage, "
        "render props.imageUrl, or reserve a data-content-img slot — the composition fills "
        "the whole frame on its own.\n"
    ),
}

_CHECKLIST_TAIL = (
    "  3. ANIMATION: at least TWO interpolate() or spring() calls drive visible motion.\n"
    "  4. OVERFLOW: the outermost container sets overflow:'hidden'.\n"
    "  5. TEXT FROM PROPS: every visible string comes from props — no invented sample "
    "copy, no hardcoded headlines, and never the raw contentType value as text.\n"
    "  6. NO IMPORTS, and no process.env or runtime APIs. The ONLY pre-injected names you "
    "may use are FitText, FitBlock, readableOn, ensureContrast, withAlpha (and SocialIcons "
    "in the ending) — build everything else yourself, and never redeclare an injected "
    "name.\n"
    "  7. PORTRAIT: the isPortrait branch is genuinely different from the landscape one.\n"
    "  8. TYPE SIZE: the TITLE is `<FitText fontSize={props.titleFontSize ?? <your size>} "
    "...>{props.sceneTitle}</FitText>` — inside FitText AND reading the prop. The display "
    "text and EVERY content prop, label and caption read `props.descriptionFontSize ?? "
    "<your size>` or a ratio of it. There is no third size and no "
    "`props.sceneTitleFontSize`.\n"
    "  9. NO NARRATION ON SCREEN: `props.narrationText` appears NOWHERE in the JSX. It is "
    "the voiceover. `props.sceneTitle` is the scene's title; `props.displayText` is its "
    "supporting copy.\n"
)

_CHECKLIST_OUTRO = (
    " 10. ENDING: props.ctaProps is read and guarded, <SocialIcons> is rendered when "
    "socials are present, and props.ctaProps?.ctas is mapped into buttons — all placed "
    "inside this scene's own composition.\n"
)

_CHECKLIST_FOOT = (
    "Keep the layout, geometry and motion of your previous attempt — change only what the "
    "error requires."
)


def build_repair_checklist(scene_type: str = "content", scene_doc: str = "") -> str:
    """The contract checklist for THIS scene, keyed off its design document."""
    if "IMAGE — BACKGROUND MODE" in scene_doc:
        image_item = _CHECKLIST_IMAGE["background"]
    elif "IMAGE — HALF MODE" in scene_doc:
        image_item = _CHECKLIST_IMAGE["half"]
    elif "IMAGE — NONE" in scene_doc:
        image_item = _CHECKLIST_IMAGE[None]
    else:
        # No doc (a stored scene being re-validated, or a v1 template): fall back
        # to the generic wording rather than asserting a mode the scene may not have.
        image_item = (
            "  2. IMAGE: if this scene carries an image, it is rendered when present on an "
            "element carrying data-content-img=\"1\".\n"
        )
    parts = [_CHECKLIST_HEAD, image_item, _CHECKLIST_TAIL]
    if scene_type == "outro":
        parts.append(_CHECKLIST_OUTRO)
    parts.append(_CHECKLIST_FOOT)
    return "".join(parts)


# The generic form, for callers with no scene context.
REPAIR_CHECKLIST = build_repair_checklist()


def _format_code_critique(critique: str) -> str:
    """Turn a code critique into a repair instruction.

    Framed like _format_visual_failure and for the same reason: the code
    compiled and passed every static check, so the repair must be an EDIT. The
    defect here is that the scene built something other than the layout it was
    given, so the instruction points back at that layout rather than inviting a
    fresh design — a rewrite is exactly the non-convergence _REPAIR_STRATEGIES
    documents.
    """
    return (
        "ERROR: your previous attempt compiled and passed every static check, but it did "
        "not build the layout it was given. A reviewer compared your code against this "
        "scene's assigned geometry:\n\n"
        f"{critique}\n\n"
        "Fix EXACTLY these points by EDITING your previous code. The scene already "
        "satisfies every contract, so keep its motion, its props and its structure — "
        "change only what is needed to match the assigned layout. Do NOT redesign the "
        "scene and do NOT strip existing detail.\n\n"
        + REPAIR_CHECKLIST
    )


def _format_visual_failure(critique: str) -> str:
    """Turn a vision-model critique into a repair instruction.

    Framed carefully: the code COMPILED and passed every static check, so the
    model must not go rewriting structure. Only the rendered result is wrong.
    """
    return (
        "ERROR: your previous attempt compiled and passed every static check, but a "
        "SCREENSHOT of the rendered frame shows real visual defects. This is not a style "
        "opinion — a vision model looked at the actual pixels:\n\n"
        f"{critique}\n\n"
        "Fix EXACTLY these defects. The code is structurally correct, so keep the layout, "
        "the motion, and every contract the scene already satisfies — change only what is "
        "visually wrong. If a defect is invisible or low-contrast text, derive the "
        "foreground from its own background: const fg = readableOn(<that background>).\n\n"
        + REPAIR_CHECKLIST
    )


# ─── Per-layout prop schema (P3) ────────────────────────────────


class DescribeSceneProps(dspy.Signature):
    """List the extra editable props a generated scene reads.

    Runs as a SEPARATE, cheap pass over finished code rather than as another
    output field on GenerateSceneCode. That signature already carries a very
    large docstring plus 11 inputs and 5 outputs; adding a sixth output pushed
    responses past max_tokens and the model returned an EMPTY `code` field after
    burning ~145s — a total loss, because `code` is emitted before the later
    fields. Reading the finished code costs a fraction of that and cannot
    corrupt the scene.

    Report ONLY props read via `props.layoutProps?.<key>`. Ignore every standard
    prop (displayText, narrationText, imageUrl, bullets, metrics, quote, ...) —
    those are already editable elsewhere.

    Output a JSON array, or [] when the scene reads none:
      [{"key":"chapterNumber","label":"Chapter Number","type":"string","default":"01"}]

    type must be one of: string | text | color | number | select | string_array
    | object_array. object_array needs "subFields":[{"key":..,"label":..}];
    select needs "options":[{"value":..,"label":..}].
    """

    scene_code: str = dspy.InputField(desc="The generated scene component code.")
    prop_schema_json: str = dspy.OutputField(desc="JSON array of extra editable props, or [].")


class GenerateSceneSampleContent(dspy.Signature):
    """Write the on-screen copy a scene shows in the template's PREVIEW.

    This is showcase copy, not real article content: it is what a prospective
    user sees in the template gallery and the scene editor. Its job is to make
    the layout legible and to look like it belongs to THIS brand — so write in
    the brand's register and about the brand's actual subject matter, never
    "Lorem ipsum", "Scene 2", or "Your Headline Here".

    THE TITLE LEADS AND THE COPY SUPPORTS IT. `sceneTitle` is the scene's
    title — the largest type on the frame and the thing a viewer reads first.
    `displayText` is the shorter line beneath it. Write the title so it can
    carry the scene on its own, and keep the copy tight: a frame crowded with
    text reads as a wall, and the layout was designed around a title with room
    to breathe.

    Match the scene's content_type EXACTLY — it says which fields the layout
    actually renders, and a field the layout does not read is wasted:
      plain       displayText only
      bullets     bullets: 3-4 short phrases
      steps       steps: 3-4 ordered actions
      metrics     metrics: 2-4 {"value","label"}; values are short ("3x", "92%")
      quote       quote + quoteAuthor
      comparison  comparisonLeft + comparisonRight, each {"label","description"}
      timeline    timelineItems: 3-4 {"label","description"}
      code        codeLines: 4-6 lines + codeLanguage

    Output ONE JSON object with EXACTLY TWO text fields:
      sceneTitle     THE SCENE'S TITLE — EXACTLY 5 TO 7 WORDS. Count them. A
                     real title naming what this scene is about ("Rides that
                     show up in minutes"), never a bare category word
                     ("Benefits", "Overview") and never a full sentence.
      displayText    the supporting copy beneath it — ONE OR TWO SHORT
                     SENTENCES, roughly 90 to 160 characters. It adds something
                     the title does not already say, and is never the same text
                     as sceneTitle.
    plus exactly the extra fields the content_type above calls for. Do NOT emit
    a narration or voiceover field: the voiceover is a separate part of the
    product and anything you write for it here is discarded. No prose outside
    the JSON, no markdown fence.
    """

    brand_context: str = dspy.InputField(desc="The brand's identity, category and subject matter.")
    scene_doc: str = dspy.InputField(desc="This scene's design document — what it is FOR and how it is laid out.")
    content_type: str = dspy.InputField(desc="plain|bullets|steps|metrics|code|quote|comparison|timeline")
    sample_json: str = dspy.OutputField(desc="One JSON object of on-screen copy for this scene.")


# The per-type key map and the shape coercion moved to
# services/scene_content_schema.py, so the project-content path
# (content_classifier) is held to the SAME contract this path always was. That
# asymmetry is what let a comparison scene ship `left`/`right` while the
# component read `comparisonLeft`/`comparisonRight`.
#
# Kept under the old private names so the call sites below are unchanged.
_SAMPLE_FIELDS_BY_TYPE = FIELDS_BY_TYPE
_coerce_sample_field = coerce_field

_SAMPLE_BASE_FIELDS = frozenset({"sceneTitle", "displayText"})


def _parse_sample_content(raw: str, content_type: str) -> dict:
    """Validate one scene's generated sample copy.

    Drops anything unusable rather than raising — sample copy is a nicety, and a
    malformed one must never cost an otherwise-good scene. Returns {} when
    nothing usable survives, which the caller treats as "use the deterministic
    fallback".
    """
    data = _extract_json_array(raw) if raw.strip().startswith("[") else None
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        try:
            text = (raw or "").strip()
            fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
            if fence:
                text = fence.group(1).strip()
            start, end = text.find("{"), text.rfind("}")
            if start < 0 or end <= start:
                return {}
            data = json.loads(text[start : end + 1])
        except (ValueError, TypeError):
            return {}
    if not isinstance(data, dict):
        return {}

    allowed = _SAMPLE_BASE_FIELDS | _SAMPLE_FIELDS_BY_TYPE.get(content_type, frozenset())
    out: dict = {}
    for key, value in data.items():
        if key not in allowed or value in (None, "", [], {}):
            continue
        # Key-name filtering is not enough: the VALUE must match the shape
        # GeneratedSceneProps declares, or the scene crashes at render with a
        # `.trim is not a function` / "Objects are not valid as a React child".
        coerced = _coerce_sample_field(key, value)
        if coerced is None:
            continue
        out[key] = coerced

    # The TITLE is the one field every layout renders — it is the scene's main
    # label and the largest type on the frame. Without it there is nothing to
    # lead the frame and the deterministic fallback is strictly better.
    #
    # This used to require displayText instead, back when displayText was the
    # headline and the title was an optional eyebrow. Both are now required, and
    # which one is load-bearing has swapped.
    if not isinstance(out.get("sceneTitle"), str) or not out["sceneTitle"].strip():
        return {}
    if not isinstance(out.get("displayText"), str) or not out["displayText"].strip():
        return {}
    # Copy that merely repeats the title paints the same sentence twice — the
    # render path guards this too, but storing it is still wrong. The TITLE is
    # what survives now; the display text is what drops.
    if out["displayText"].strip().lower() == out["sceneTitle"].strip().lower():
        out.pop("displayText", None)
    return out


# The bands rule 7d enforces on every generated scene. Kept here so the computed
# defaults and the validator can never disagree about what is renderable.
#
# PORTRAIT IS SMALLER THAN LANDSCAPE. That is the opposite of the usual
# convention and the single most common reason a scene is rejected: the portrait
# canvas is 1080 wide against landscape's 1920, so the same point size eats
# nearly twice the line.
# DERIVED from _TYPE_FLOOR/_TYPE_CEILING above rather than restated.
#
# These were two hand-maintained copies of the same numbers — the validator
# gates on the FLOOR/CEILING pair while the size computation used this one — and
# nothing enforced that they agreed. They happened to match, which is exactly
# how a silent drift starts. One authority, two views of it.
#
# PORTRAIT IS SMALLER THAN LANDSCAPE. That is the opposite of the usual
# convention and the single most common reason a scene is rejected: the portrait
# canvas is 1080 wide against landscape's 1920, so the same point size eats
# nearly twice the line.
#
# `title` maps to the HEADLINE tier because props.titleFontSize sizes
# props.displayText — see rule 1. `eyebrow` is the prop tier, which is what
# sizes props.sceneTitle.
_TYPE_BANDS = {
    "title": {
        "landscape": (_TYPE_FLOOR["headline_landscape"], _TYPE_CEILING["headline_landscape"]),
        "portrait": (_TYPE_FLOOR["headline_portrait"], _TYPE_CEILING["headline_portrait"]),
    },
    "description": {
        "landscape": (_TYPE_FLOOR["body_landscape"], _TYPE_CEILING["body_landscape"]),
        "portrait": (_TYPE_FLOOR["body_portrait"], _TYPE_CEILING["body_portrait"]),
    },
    "eyebrow": {
        "landscape": (_TYPE_FLOOR["prop_landscape"], _TYPE_CEILING["prop_landscape"]),
        "portrait": (_TYPE_FLOOR["prop_portrait"], _TYPE_CEILING["prop_portrait"]),
    },
}

# What a PERSON may set, via the editor's sliders — as opposed to _TYPE_BANDS
# above, which bounds what the GENERATOR may produce.
#
# These were one map, and that was the bug: the read-time clamp used the
# generation ceiling, so a user dragging the title slider past 88 had the value
# silently reset on the way back out. The slider looked dead above the
# generator's own comfort zone, which is the opposite of what a manual override
# is for. A generated default still has to be defensible with no human in the
# loop (narrow); a size a person chose while looking at the frame does not
# (wide). Orientation-independent for the same reason.
#
# Mirrored in TypeScript as USER_BANDS in kit/typeBands.ts; the parity test
# checks both maps.
_USER_BANDS: dict[str, dict[str, tuple[int, int]]] = {
    "title": {"landscape": (10, 200), "portrait": (10, 200)},
    "description": {"landscape": (10, 100), "portrait": (10, 100)},
}

# Copy length, in characters, at which body type sits at the TOP of its band and
# at the BOTTOM. Between them the size falls linearly; outside, it clamps.
#
# Retuned for v3's shorter sample copy: `displayText` is now one to two short
# sentences (~90-160 chars), not the one-to-three-sentence paragraph v2 asked
# for, so a 320-char "long" anchor put almost every real scene at the top of the
# band and the interpolation never engaged.
_COPY_SHORT = 60
_COPY_LONG = 200

# How many props a layout can show before its copy has to give up room. A
# metrics scene with six figures is carrying far more on-screen text than the
# `displayText` length alone suggests.
_PROPS_FREE = 3
_PROPS_PENALTY_PER_ITEM = 1.5

# Title length, in WORDS, at which the title sits at the TOP of its band and at
# its midpoint. The sample contract asks for 5-7 words; the range runs a little
# past both ends so a model that overshoots still lands somewhere sensible.
_TITLE_WORDS_SHORT = 4
_TITLE_WORDS_LONG = 9


def _count_sample_props(sample: dict, content_type: str) -> int:
    """How many discrete items this scene renders besides its copy."""
    for key in ("bullets", "steps", "metrics", "timelineItems", "codeLines"):
        value = sample.get(key)
        if isinstance(value, list):
            return len(value)
    if content_type == "comparison":
        return 2
    return 0


def _compute_scene_font_defaults(sample: dict, content_type: str) -> dict:
    """Default type sizes for one scene, from the copy it actually holds.

    Returns {"title": {"landscape": N, "portrait": N},
             "description": {"landscape": N, "portrait": N}}.

    Deterministic and clamped to the bands rule 7d already enforces, so the
    numbers are reproducible, unit-testable, and always renderable — no LLM call
    and nothing to re-clamp downstream.

    The shape of the rule, in v3 terms: the two sizes are driven by the two
    DIFFERENT strings they actually size.

      description  from len(displayText) plus the prop count — long copy and a
                   crowded layout both need smaller type to fit the block the
                   scene was designed around.
      title        from the WORD COUNT of sceneTitle. The title is the scene's
                   main label and should be large, so it starts at the top of
                   its band for a tight 5-word title and eases toward the middle
                   as the title runs longer.

    This replaces a formula that derived the title from the description by a
    length-interpolated 2.2x→1.15x ratio. That existed only because
    `titleFontSize` used to size `displayText` — a paragraph — where a large
    stored number was fiction: FitText treats the size as a MAXIMUM, so the text
    painted at the floor regardless and the slider appeared dead. In v3
    `titleFontSize` sizes a 5-7 word title, which genuinely renders at the size
    it is given, so the honest answer is to size it directly and let the 1.15x
    floor go — that floor is what made titles small.
    """
    copy_len = len(str(sample.get("displayText") or ""))
    # 0.0 at short copy (biggest type) → 1.0 at long copy (smallest).
    span = max(1, _COPY_LONG - _COPY_SHORT)
    t = min(1.0, max(0.0, (copy_len - _COPY_SHORT) / span))

    # Props push further toward the small end, capped so a long list cannot
    # drive type below the band floor on its own.
    extra = max(0, _count_sample_props(sample, content_type) - _PROPS_FREE)
    t = min(1.0, t + (extra * _PROPS_PENALTY_PER_ITEM) / 100.0 * 6)

    # The title's own crowding, measured in WORDS rather than characters: the
    # contract asks for 5-7, and it is the count of words — not their letters —
    # that decides whether a line fits at display scale. 0.0 at or below
    # _TITLE_WORDS_SHORT (largest), 1.0 at or above _TITLE_WORDS_LONG.
    title_words = len(str(sample.get("sceneTitle") or "").split())
    t_span = max(1, _TITLE_WORDS_LONG - _TITLE_WORDS_SHORT)
    tt = min(1.0, max(0.0, (title_words - _TITLE_WORDS_SHORT) / t_span))

    out: dict[str, dict[str, int]] = {"title": {}, "description": {}}
    for orientation in ("landscape", "portrait"):
        d_lo, d_hi = _TYPE_BANDS["description"][orientation]
        description = round(d_hi - (d_hi - d_lo) * t)

        # Top of the band for a tight title, easing DOWN TO THE MIDPOINT — not
        # to the floor — for a long one. A title is the scene's focal element
        # even when it runs to nine words; dropping it to 48 would make it
        # compete with the body rather than lead it.
        t_lo, t_hi = _TYPE_BANDS["title"][orientation]
        t_mid = t_lo + (t_hi - t_lo) * 0.5
        title = round(t_hi - (t_hi - t_mid) * tt)

        # The hierarchy is non-negotiable: an inverted or equal pair is a defect
        # the validator rejects at generation time, and nothing downstream
        # re-checks these stored numbers. A short body on a long title is the
        # case that can collide.
        if title <= description:
            title = min(t_hi, description + max(2, round(description * 0.25)))

        out["title"][orientation] = min(t_hi, max(t_lo, title))
        out["description"][orientation] = description
    return out


def _fallback_sample_content(brand_name: str, content_type: str, index: int = 0) -> dict:
    """Deterministic showcase copy, when the model gives nothing usable.

    A Python port of CustomPreview's client-side generator, kept so that EVERY
    scene has sample copy even if the LLM pass fails wholesale. Without it a
    failed pass would store NULL and the preview would silently fall back to the
    old generic copy — the exact thing this feature removes.
    """
    n = (brand_name or "").strip() or "Our Brand"
    base: dict = {}

    if content_type == "metrics":
        base = {
            "sceneTitle": f"The numbers behind {n} today",
            "displayText": "Measured across every region we operate in.",
            "metrics": [
                {"value": "3.2M", "label": "Active Users"},
                {"value": "99.9%", "label": "Uptime SLA"},
                {"value": "150+", "label": "Countries"},
            ],
        }
    elif content_type == "bullets":
        base = {
            "sceneTitle": f"What sets {n} apart",
            "displayText": "Built for teams that cannot afford to slow down.",
            "bullets": [
                "Enterprise-grade security and compliance built in",
                "Real-time collaboration across distributed teams",
                "AI-powered insights and automated workflows",
                "24/7 dedicated customer success support",
            ],
        }
    elif content_type == "steps":
        base = {
            "sceneTitle": f"Getting started with {n} is simple",
            "displayText": "Four steps from first login to first result.",
            "steps": [
                "Connect your existing tools and data sources",
                "Configure your workspace and invite your team",
                "Let AI analyze patterns and surface insights",
                "Take action on recommendations and track results",
            ],
        }
    elif content_type == "quote":
        base = {
            "sceneTitle": f"What teams say about {n}",
            "displayText": "From the people who use it every day.",
            # Deliberately short: a quote renders at headline scale, and a long
            # one runs past the bottom of the frame.
            "quote": f"{n} changed how our whole team works.",
            "quoteAuthor": "Industry Leader",
        }
    elif content_type == "comparison":
        base = {
            "sceneTitle": "The old way and the new",
            "displayText": f"How {n} compares with the traditional approach.",
            "comparisonLeft": {
                "label": "Traditional",
                "description": "Manual processes, slow iteration, limited visibility",
            },
            "comparisonRight": {
                "label": n,
                "description": "Automated workflows, real-time insights, full transparency",
            },
        }
    elif content_type == "timeline":
        base = {
            "sceneTitle": f"How {n} got here",
            "displayText": "From a first prototype to a global platform.",
            "timelineItems": [
                {"label": "Founded", "description": "Started with a vision to transform the industry"},
                {"label": "First Launch", "description": "Released our flagship product to early adopters"},
                {"label": "Scale", "description": "Expanded to serve enterprise customers globally"},
                {"label": "Today", "description": "Industry-leading platform trusted by millions"},
            ],
        }
    elif content_type == "code":
        _slug = re.sub(r"\s+", "", n)
        base = {
            "sceneTitle": f"Integrate {n} in minutes",
            "displayText": "A few lines is the whole integration.",
            "codeLines": [
                f"import {{ {_slug} }} from '{re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')}';",
                "",
                f"const client = new {_slug}({{ apiKey: \"...\" }});",
                "const result = await client.analyze(data);",
                "console.log(result.insights);",
            ],
            "codeLanguage": "typescript",
        }
    else:
        # "plain" is the most common type. Rotate by position so a template with
        # several plain layouts does not render the same slide repeatedly.
        # (title, copy) — a 5-7 word title becomes sceneTitle and the copy is
        # the shorter supporting line beneath it, matching the two-field shape.
        _plain = [
            (
                "The thinking behind the product",
                f"What makes {n} different once you use it daily.",
            ),
            (
                "Why we build the way we do",
                "Start from the problem, ship the smallest thing that helps.",
            ),
            (
                f"{n} is built for what's next",
                "The workflows you have now, and the scale you are heading toward.",
            ),
            (
                "Where the product goes from here",
                "Deeper integrations, faster answers, a quieter interface.",
            ),
        ]
        _kicker, _copy = _plain[index % len(_plain)]
        base = {
            "sceneTitle": _kicker,
            "displayText": _copy,
        }

    return base


def _generate_sample_content(brand_context: str, scene_doc: str, content_type: str) -> dict:
    """Showcase copy for one scene, from its design doc. {} on any failure."""
    try:
        ensure_dspy_configured()
        with dspy.context(lm=get_scene_type_lm()):
            result = dspy.Predict(GenerateSceneSampleContent)(
                brand_context=brand_context[:4000],
                scene_doc=scene_doc[:4000],
                content_type=content_type or "plain",
            )
        return _parse_sample_content(getattr(result, "sample_json", "") or "", content_type or "plain")
    except Exception as e:  # noqa: BLE001 - never fail a good scene over preview copy
        print(f"[F7-DEBUG] [SAMPLE] generation failed ({type(e).__name__}); skipping: {e}")
        return {}


def _describe_scene_props(code: str) -> list[dict]:
    """Extract the per-layout prop schema from finished scene code.

    Skips the LLM entirely when the code contains no `props.layoutProps` read —
    the common case, and it makes this free for most scenes.
    """
    if not code or "layoutProps" not in code:
        return []
    try:
        ensure_dspy_configured()
        with dspy.context(lm=get_scene_type_lm()):
            result = dspy.Predict(DescribeSceneProps)(scene_code=code)
        return _parse_prop_schema(getattr(result, "prop_schema_json", "") or "", code)
    except Exception as e:  # noqa: BLE001 - never fail a good scene over metadata
        print(f"[F7-DEBUG] [PROP-SCHEMA] describe failed ({type(e).__name__}); skipping: {e}")
        return []

# The scene editor's generic renderer maps exactly these schema types
# (SceneEditModal.schemaLayoutPropTypeToFieldType). Anything else renders
# nothing, so an unknown type is dropped rather than stored as a dead field.
_ALLOWED_PROP_TYPES = frozenset({
    "string", "text", "color", "number", "select", "string_array", "object_array",
})

# Keys owned by the standard scene contract (GeneratedSceneProps / SceneProps).
# A layout prop that shadows one of these would create two editor fields writing
# to different places, so collisions are rejected.
_RESERVED_PROP_KEYS = frozenset({
    "displayText", "narrationText", "imageUrl", "imageObjectPosition", "imageZoom",
    "hasVideo", "sceneIndex", "totalScenes", "logoUrl", "brandImages", "brandColors",
    "aspectRatio", "contentType", "bullets", "metrics", "codeLines", "codeLanguage",
    "quote", "quoteAuthor", "comparisonLeft", "comparisonRight", "timelineItems",
    "steps", "chartTable", "chartType", "chartSummary", "titleFontSize",
    "descriptionFontSize", "headingFont", "bodyFont", "layoutProps",
    "imageBoxAspectRatio",
})

MAX_LAYOUT_PROPS = 12


def _parse_prop_schema(raw: str, code: str) -> list[dict]:
    """Validate the model's declared per-layout props.

    Drops anything unusable rather than raising — a bad schema must never fail a
    scene that otherwise renders fine. Two rules do real work:

      * a prop the CODE never reads is dropped, because it would show up as an
        editor field that changes nothing;
      * a key colliding with the standard scene contract is dropped, because two
        fields would write to different places.
    """
    if not raw or not raw.strip():
        return []
    try:
        parsed = _extract_json_array(raw)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []

    out: list[dict] = []
    seen: set[str] = set()
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        key = str(entry.get("key") or "").strip()
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", key):
            continue
        if key in _RESERVED_PROP_KEYS or key in seen:
            continue
        ftype = str(entry.get("type") or "string").strip()
        if ftype not in _ALLOWED_PROP_TYPES:
            continue
        # Declared but never read -> a dead editor field.
        if not re.search(rf"layoutProps\s*(?:\?\.|\[\s*['\"]){re.escape(key)}", code):
            print(f"[F7-DEBUG] [PROP-SCHEMA] dropped {key!r}: declared but not read in code")
            continue

        field: dict = {
            "key": key,
            "label": str(entry.get("label") or key)[:60],
            "type": ftype,
        }
        if entry.get("placeholder"):
            field["placeholder"] = str(entry["placeholder"])[:120]
        if ftype == "select":
            options = [
                {"value": str(o.get("value")), "label": str(o.get("label") or o.get("value"))}
                for o in (entry.get("options") or [])
                if isinstance(o, dict) and o.get("value") is not None
            ]
            if not options:
                continue  # a select with no options is unusable
            field["options"] = options[:12]
        if ftype == "object_array":
            subs = [
                {"key": str(sf.get("key")), "label": str(sf.get("label") or sf.get("key"))}
                for sf in (entry.get("subFields") or [])
                if isinstance(sf, dict) and sf.get("key")
            ]
            if not subs:
                continue  # without subFields the editor cannot render rows
            field["subFields"] = subs[:6]
        if ftype == "number":
            for bound in ("min", "max", "step"):
                if isinstance(entry.get(bound), (int, float)):
                    field[bound] = entry[bound]
        if ftype in ("string_array", "object_array"):
            if isinstance(entry.get("maxItems"), int):
                field["maxItems"] = max(1, min(12, entry["maxItems"]))

        default = entry.get("default")
        if default is not None:
            field["default"] = default

        out.append(field)
        seen.add(key)
        if len(out) >= MAX_LAYOUT_PROPS:
            break

    return out


def build_layout_prop_schema(fields: list[dict], label: str) -> dict:
    """Shape a validated field list into a meta.json `layout_prop_schema` entry.

    Matches what SceneEditModal.layoutPropSchemaToFieldDefs consumes for
    built-in and crafted templates, so custom templates light up the SAME
    generic renderer with no frontend changes.
    """
    defaults = {f["key"]: f["default"] for f in fields if "default" in f}
    entry: dict = {
        "label": label,
        "fields": [{k: v for k, v in f.items() if k != "default"} for f in fields],
    }
    if defaults:
        entry["defaults"] = defaults
    return entry


# ─── Deterministic stub scene (§R Layer 3) ──────────────────────


def _build_stub_scene_code(scene_type: str, theme: dict | None = None) -> str:
    """Build a valid, on-brand fallback scene WITHOUT calling an LLM.

    Used when a scene fails validation after every repair attempt. Because it is
    hand-written it cannot fail, which is the whole point: it converts "one bad
    scene kills the batch" into "one scene looks simpler than the rest".

    MUST satisfy every hard gate in validate_component_code():
      - `const SceneComponent` declaration
      - >= 2 interpolate/spring calls
      - >= 500 chars
      - overflow:'hidden'
      - a conditional props.logoUrl render
      - a `hasImage` declaration (image conditional)
      - balanced braces/parens/brackets, no dangerous APIs
      - monotonic numeric interpolate ranges
    It also renders the data-content-img CONTAINER whenever a visual slot is
    needed, so the stock-footage clip path (ClipSlotOverlay) still aligns.

    Covered by test_stub_scene_validates so a regression in the validator or in
    this string is caught in CI rather than at generation time.
    """
    colors = ((theme or {}).get("colors") or {}) if isinstance(theme, dict) else {}
    # Fall back to the props-provided brand colors at runtime; these literals are
    # only the last resort if props.brandColors is somehow absent.
    bg = colors.get("bg") or "#0F172A"
    text = colors.get("text") or "#F8FAFC"
    accent = colors.get("accent") or "#38BDF8"

    return f"""const SceneComponent = (props) => {{
  const frame = useCurrentFrame();
  const {{ fps, durationInFrames, width, height }} = useVideoConfig();

  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
  const hasVideo = !!props.hasVideo;
  const showVisualSlot = hasImage || hasVideo;
  const showImageContent = hasImage && !hasVideo;
  const isPortrait = props.aspectRatio === 'portrait';

  // The real box the headline sits in, so <FitText> sizes against IT and not
  // against 86% of the whole canvas. Mirrors the layout below: the visual slot
  // takes 45% in the cross-axis when present, and the text column takes the
  // rest, less the 7% padding either side.
  const textColW = showVisualSlot
    ? (isPortrait ? width * 0.86 : width * 0.55 * 0.86)
    : width * 0.86;
  const textColH = showVisualSlot && isPortrait ? height * 0.4 : height * 0.55;

  const colors = props.brandColors || {{}};
  const bg = colors.background || '{bg}';
  const fg = colors.text || '{text}';
  const accent = colors.accent || '{accent}';

  // The two type sizes (contract rule 7). titleSize sizes props.sceneTitle and
  // nothing else; bodySize sizes everything else.
  const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68);
  const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);

  // The title always survives; the supporting line drops when it merely repeats
  // it. The render path falls back displayText -> title for a scene with no
  // display text, so both props routinely hold the same string.
  const _n = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const showSub = !!_n(props.displayText) && !_n(props.displayText).startsWith(_n(props.sceneTitle));

  const enter = spring({{ frame, fps, config: {{ damping: 20, stiffness: 90 }} }});
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 20), durationInFrames],
    [1, 0],
    {{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}
  );
  const rule = interpolate(frame, [6, 30], [0, 100], {{
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }});

  return (
    <AbsoluteFill
      style={{{{
        background: hasVideo ? 'transparent' : bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: isPortrait ? 'column' : 'row',
        alignItems: 'stretch',
        opacity: exit,
      }}}}
    >
      {{showVisualSlot && (
        <div
          data-content-img="1"
          style={{{{
            position: 'relative',
            overflow: 'hidden',
            background: 'transparent',
            width: isPortrait ? '100%' : '45%',
            height: isPortrait ? '45%' : '100%',
            flexShrink: 0,
          }}}}
        >
          {{showImageContent && (
            <Img
              src={{props.imageUrl}}
              style={{{{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: props.imageObjectPosition || '50% 50%',
                transform: `scale(${{props.imageZoom ?? 1}})`,
                transformOrigin: props.imageObjectPosition || '50% 50%',
              }}}}
            />
          )}}
        </div>
      )}}

      <div
        style={{{{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isPortrait ? '8% 7%' : '7% 6%',
          transform: `translateY(${{(1 - enter) * 24}}px)`,
          opacity: enter,
        }}}}
      >
        {{props.logoUrl && typeof props.logoUrl === 'string' && (
          <Img
            src={{props.logoUrl}}
            data-logo="1"
            style={{{{
              width: 190,
              height: 'auto',
              maxHeight: 190,
              objectFit: 'contain',
              marginBottom: 24,
              flexShrink: 0,
            }}}}
          />
        )}}

        <div
          style={{{{
            width: `${{rule}}%`,
            maxWidth: 120,
            height: 4,
            background: accent,
            marginBottom: 28,
            flexShrink: 0,
          }}}}
        />

        <FitText
          fontSize={{titleSize}}
          maxLines={{2}}
          containerWidth={{textColW}}
          maxHeight={{textColH * 0.5}}
          style={{{{
            color: fg,
            fontFamily: props.headingFont || 'inherit',
            fontWeight: 700,
          }}}}
        >
          {{props.sceneTitle}}
        </FitText>

        {{showSub && (
          <FitText
            fontSize={{bodySize}}
            maxLines={{4}}
            containerWidth={{textColW}}
            maxHeight={{textColH * 0.45}}
            style={{{{
              color: fg,
              fontFamily: props.bodyFont || 'inherit',
              fontWeight: 400,
              marginTop: 20,
              opacity: 0.88,
            }}}}
          >
            {{props.displayText}}
          </FitText>
        )}}
      </div>
    </AbsoluteFill>
  );
}};"""


# ─── Per-scene brief hints ──────────────────────────────────────


# ─── Image contract ─────────────────────────────────────────────
#
# A scene carries an image in exactly ONE of two forms. Both are here rather
# than left to the model because they are the only two that stay readable at
# every copy length: an inset or a collage looks fine against the sample text
# and breaks on a real headline, and a background with no scrim buries the copy
# under the photo.
_IMAGE_CONTRACT = {
    "background": (
        "IMAGE — BACKGROUND MODE (this scene's design calls for a full-frame image):\n"
        "  • The image fills the whole frame BEHIND the content. Render its container\n"
        "    FIRST in JSX with zIndex: 0, and give the content layer position:'relative'\n"
        "    and zIndex: 1 — two siblings with no zIndex paint in DOM order, so an image\n"
        "    written after the content hides the entire layout behind a bare photo.\n"
        "  • A SCRIM IS MANDATORY between the image and the content: a wash or gradient\n"
        "    (e.g. withAlpha(<canvas colour>, 0.6)) covering the area the type sits on.\n"
        "    Without it the copy is unreadable over a real photograph. The scrim is what\n"
        "    makes the text legible — do NOT instead fade the image itself.\n"
        "  • The <Img> stays fully opaque: objectFit:'cover', no opacity reduction.\n"
        "  • Put data-content-img=\"1\" on the image's CONTAINER div, not the <Img>.\n"
    ),
    "half": (
        "IMAGE — HALF MODE (this scene's design gives the image exactly one half):\n"
        "  • LANDSCAPE: the image occupies the {side_landscape} half — 50% width, 100%\n"
        "    height. The content fills the other 50% and must genuinely fill it.\n"
        "  • PORTRAIT: the image occupies the {side_portrait} half — 100% width, 50%\n"
        "    height, stacked. The content takes the other half.\n"
        "  • The image slot is a BOUNDED box. Never absolute/inset:0, never full-bleed.\n"
        "  • Put data-content-img=\"1\" on the slot's CONTAINER div, not the <Img>.\n"
    ),
    None: (
        "IMAGE — NONE. This scene is deliberately image-less: its design is carried by\n"
        "type, space and geometry alone. Do NOT declare hasImage, do NOT render\n"
        "props.imageUrl, and do NOT reserve an empty visual slot. Compose the FULL frame\n"
        "as a finished design in its own right.\n"
    ),
}

# Landscape side -> the portrait side that reads as its equivalent.
_PORTRAIT_SIDE = {"left": "top", "right": "bottom", "top": "top", "bottom": "bottom"}
_LANDSCAPE_SIDE = {"top": "left", "bottom": "right", "left": "left", "right": "right"}


# The structured prop the render path fills for each content type.
#
# GeneratedVideo.tsx passes exactly one of these per scene, chosen by the scene's
# content_type. A scene that reads a DIFFERENT prop renders an empty frame in
# production while passing every static check — measured on template 179, whose
# `steps` scene read props.bullets and shipped 7,782 characters of valid code
# that drew nothing. Naming the prop in the doc is the fix; _content_prop_defect
# in the validator is the gate.
# Each entry is (prop name, shape). The SHAPE matters as much as the name: the
# advice below is fed back verbatim in repair prompts, and array-shaped advice
# for a string prop is actively harmful. Told to write
# `(props.quote ?? []).slice(...)` for a `quote` scene, the model produced
# `Array.isArray(props.quote) ? props.quote : []` — always empty for a string —
# so the scene rendered blank AND still failed the gate. Shapes are per
# remotion-video/src/templates/generated/types.ts.
_CONTENT_PROP = {
    "bullets": ("bullets", "array"),          # string[]
    "steps": ("steps", "array"),              # string[]
    "code": ("codeLines", "array"),           # string[]
    # OBJECT arrays. Calling them "array" and showing a {item} example was wrong
    # and shipped a defect: template 181's metrics scene rendered
    # `{String(item)}` and painted "[object Object]" four times across the frame.
    # The field lists below are from types.ts and must stay in step with it.
    "metrics": ("metrics", "objects"),        # {value, label, suffix?}[]
    "timeline": ("timelineItems", "objects"), # {label, description}[]
    "quote": ("quote", "string"),             # string
    "comparison": ("comparisonLeft", "pair"), # {label, description} x2
}

# The fields each object-shaped prop actually carries, per
# remotion-video/src/templates/generated/types.ts. Used both to write the
# contract and to tell a scene what to read when it gets this wrong.
_OBJECT_FIELDS = {
    "metrics": "{ value, label, suffix? }",
    "timelineItems": "{ label, description }",
    "comparisonLeft": "{ label, description }",
    "comparisonRight": "{ label, description }",
}

_CONTENT_HEAD = (
    "THIS SCENE'S DATA — props.{prop}\n"
    "  This scene's content_type is `{ctype}`, so the render path fills\n"
    "  {filled} and NOTHING ELSE. Reading a different structured prop\n"
    "  (props.bullets on a `steps` scene, say) yields an EMPTY FRAME in production.\n"
)

_CONTENT_BODY = {
    "array": (
        "  props.{prop} is an ARRAY OF PLAIN STRINGS. Each item IS the text — it\n"
        "  has NO fields. `item.label`, `item.description` and `item.value` are\n"
        "  all undefined on a string and render blank, which is checked.\n"
        "  Cap it, map it, and fit each item:\n"
        "    {{(props.{prop} ?? []).slice(0, isPortrait ? 3 : 4).map((item, i) => (\n"
        "      <FitText key={{i}} fontSize={{bodySize}}>{{item}}</FitText>\n"
        "    ))}}\n"
        "  Need a label AND a description per row? Use props.timelineItems or\n"
        "  props.metrics — not a field on this one.\n"
        "  If it is empty the scene must STILL look finished — fall back to\n"
        "  props.displayText rather than rendering nothing.\n"
    ),
    "string": (
        "  props.{prop} is a STRING, not an array. Do NOT call Array.isArray on it\n"
        "  and do NOT call .slice() expecting items — read it directly and fit it.\n"
        "  It is a CONTENT PROP, so it takes bodySize — titleSize belongs to\n"
        "  props.sceneTitle alone. A pull quote may be set large by scaling the\n"
        "  BODY size (bodySize * 1.6), so the body slider still moves it:\n"
        "    const text = props.{prop} || props.displayText;\n"
        "    <FitText fontSize={{bodySize * 1.6}} maxLines={{4}}>{{text}}</FitText>\n"
    ),
    "objects": (
        "  props.{prop} is an array of OBJECTS shaped {fields} — NOT strings.\n"
        "  Rendering an item directly paints the literal text \"[object Object]\"\n"
        "  across the frame, so never write {{item}}, {{String(item)}} or\n"
        "  ${{item}} — always read a FIELD:\n"
        "    {{(props.{prop} ?? []).slice(0, isPortrait ? 3 : 4).map((item, i) => (\n"
        "      <FitText key={{i}} fontSize={{bodySize}}>{{item.{first_field}}}</FitText>\n"
        "    ))}}\n"
        "  If it is empty the scene must STILL look finished — fall back to\n"
        "  props.displayText rather than rendering nothing.\n"
    ),
    "pair": (
        "  props.comparisonLeft and props.comparisonRight are OBJECTS, not arrays —\n"
        "  each is {fields}. Rendering one directly paints \"[object Object]\", so\n"
        "  always read a FIELD. Read the two sides directly:\n"
        "    const left = props.comparisonLeft;  const right = props.comparisonRight;\n"
        "    <FitText fontSize={{bodySize}}>{{left?.label}}</FitText>\n"
        "  Fall back to props.displayText when either side is missing.\n"
    ),
}


# ─── Bookend contracts ──────────────────────────────────────────
#
# The intro had NO role contract at all — the only scene role without one. Its
# content_type is "plain", which is not in _CONTENT_PROP, so its entire
# specification was the design stage's prose. Three defects followed from that
# and are each addressed below: the eyebrow and the headline rendered at the
# same size, the two fields were painted twice when they carried the same
# string, and the type was sized like a content scene rather than a title card.
_INTRO_CONTRACT = (
    "THIS IS THE OPENING SCENE — IT IS THE VIDEO'S TITLE CARD.\n"
    "  • props.sceneTitle IS THE VIDEO'S TITLE. It is the single largest thing on\n"
    "    this frame and the only focal element. Size it with `titleSize`, and set\n"
    "    that default at the TOP of the band rule 7 gives you (landscape 48-88 →\n"
    "    aim 76-88; portrait 36-60 → aim 52-60), not the middle. A title card that\n"
    "    reads at content-scene size has no focal point and looks like a slide\n"
    "    that failed to load.\n"
    "  • props.displayText IS THE SUBTITLE — one or two sentences BELOW the title,\n"
    "    at `bodySize`. It supports the title; it does not compete with it. Never\n"
    "    size it with titleSize.\n"
    "  • AN OPENING CARRIES NO CONTENT PROPS. No bullets, no metric grid, no\n"
    "    timeline, no step list. A title card that arrives already full of data is\n"
    "    not an opening, it is a content slide in the wrong position.\n"
    "  • THE TWO FIELDS CAN CARRY THE SAME STRING. When a scene has no separate\n"
    "    display text the render path falls back to the title, so both props hold\n"
    "    it. Rendering both then paints the same line twice — once large, once\n"
    "    small. GUARD IT EXACTLY LIKE THIS, and render the subtitle only when the\n"
    "    guard passes:\n"
    "        const title = (props.sceneTitle || '').trim();\n"
    "        const sub = (props.displayText || '').trim();\n"
    "        const _n = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();\n"
    "        const showSub = sub && !_n(sub).startsWith(_n(title));\n"
    "    PREFIX, not equality — the title is often the copy's opening clause.\n"
    "    THE TITLE IS THE ONE THAT ALWAYS SURVIVES; the subtitle is what drops.\n"
    "  • DO NOT compose around a logo. props.logoUrl is undefined on every scene,\n"
    "    this one included — the brand mark is a corner watermark the render path\n"
    "    composites over the finished frame, at a size and position you do not\n"
    "    control. Keep rule 4's guarded block (it is checked), but design the\n"
    "    title card as though the logo were not there, and leave the bottom-right\n"
    "    corner clear of anything the watermark would sit on top of.\n"
)


def _archetype_entry(scene_doc: dict, index: int) -> dict:
    """One content scene's routing metadata, from its design document.

    `best_for` is A SENTENCE saying what this layout is for, in the same voice a
    built-in template's layout_prompt.md uses:

        - `mosaic_stream`
          - Best for: Ordered or grouped lists.

    It used to be a list of taxonomy values (`["bullets", "steps"]`), and that
    was too coarse to choose with. Eight layouts in one template routinely share
    a content type — three of them can hold a list — so the taxonomy could say
    only "any of these three", and the tie was broken positionally. A sentence
    can distinguish "a dense scannable list" from "three items given equal
    weight", which is the distinction that actually decides which layout suits a
    given scene.

    `content_type` is kept alongside it as the machine-readable fallback: the
    render's archetype matcher still needs a key it can look up without an LLM,
    and older templates stored only that.

    `description` is the scene's own design prose, trimmed to a sentence — what
    the editor shows so a user can tell the content styles apart.
    """
    primary = scene_doc.get("content_type") or "plain"

    doc = (scene_doc.get("doc") or "").strip()
    # First sentence, bounded — the full doc is several hundred words of design
    # prose and would swamp a dropdown.
    description = ""
    if doc:
        description = re.split(r"(?<=[.!?])\s", doc)[0].strip()[:200]

    entry = {
        "id": scene_doc.get("id") or f"content_{index}",
        # The prose the layout picker reads.
        "best_for": (scene_doc.get("best_for") or "").strip() or _fallback_best_for(primary),
        # The taxonomy key the render's matcher falls back to.
        "content_type": primary,
    }
    if description:
        entry["description"] = description
    return entry


# What each content kind is for, in one line. Used when the design stage did not
# write a `best_for` sentence — an older template, or a doc that came back
# without one. Deliberately generic: a real per-layout sentence describes THIS
# layout's treatment, which is the whole point of asking the designer for one.
_GENERIC_BEST_FOR: dict[str, str] = {
    "bullets": "A list of named items, features or services.",
    "steps": "An ordered process or sequence of instructions.",
    "metrics": "Figures, statistics and KPIs.",
    "timeline": "Events in chronological order.",
    "comparison": "Two things set against each other.",
    "quote": "A direct quote or testimonial.",
    "code": "A code sample or technical syntax.",
    "plain": "Narrative prose with no extractable items.",
}


def _fallback_best_for(content_type: str) -> str:
    return _GENERIC_BEST_FOR.get(content_type, _GENERIC_BEST_FOR["plain"])


def _format_scene_doc(scene: dict) -> str:
    """Render one scene's design document into the text the generator receives.

    The doc itself is prose written by the design stage — it is the design, and
    it is passed through verbatim. What is appended is the machine-checkable part
    of the contract: which of the two image forms this scene uses, and (for the
    ending) that it must host the real CTA and socials. Those are appended rather
    than left in the prose because the validator gates on them.
    """
    doc = (scene.get("doc") or "").strip()
    parts = [f"THIS SCENE'S DESIGN ({scene.get('id') or 'scene'}):\n{doc}"]

    mode = scene.get("image_mode") if scene.get("supports_image") else None
    tmpl = _IMAGE_CONTRACT.get(mode, _IMAGE_CONTRACT[None])
    if mode == "half":
        side = (scene.get("image_side") or "left").lower()
        tmpl = tmpl.format(
            side_landscape=_LANDSCAPE_SIDE.get(side, "left"),
            side_portrait=_PORTRAIT_SIDE.get(side, "top"),
        )
    parts.append(tmpl)

    _entry = _CONTENT_PROP.get(scene.get("content_type") or "")
    if _entry:
        _prop, _shape = _entry
        _filled = (
            "props.comparisonLeft / props.comparisonRight"
            if _shape == "pair"
            else f"props.{_prop}"
        )
        # Object-shaped props need their real field list, so the contract can
        # show a field read rather than a bare item (which paints
        # "[object Object]"). Unused by the string/array bodies.
        _fields = _OBJECT_FIELDS.get(_prop, "")
        _first_field = _fields.strip("{} ").split(",")[0].strip() if _fields else ""
        parts.append(
            _CONTENT_HEAD.format(
                prop=_prop, ctype=scene.get("content_type"), filled=_filled
            )
            + _CONTENT_BODY[_shape].format(
                prop=_prop, fields=_fields, first_field=_first_field
            )
        )

    if scene.get("role") == "intro":
        parts.append(_INTRO_CONTRACT)

    if scene.get("role") == "outro":
        parts.append(
            "THIS IS THE CLOSING SCENE — IT MUST READ AS AN ENDING, and it hosts\n"
            "the closing CTA and social handles.\n"
            "  • props.sceneTitle IS THE SIGN-OFF — the largest type on the frame,\n"
            "    sized with `titleSize`. props.displayText is one supporting line\n"
            "    beneath it at `bodySize`. An ending carries NO content props: no\n"
            "    bullets, no metrics, no timeline. It is a close, not another beat.\n"
            "  • THE TWO FIELDS HAVE DIFFERENT SHAPES — read this before writing either:\n"
            "      – props.ctaProps?.socials is an OBJECT MAP keyed by platform:\n"
            "        { linkedin: { enabled, label }, instagram: { enabled, label }, … }.\n"
            "        It is NOT an array. Never call .map/.filter/.slice on it —\n"
            "        `(socials ?? []).map(...)` throws \"socials.map is not a function\"\n"
            "        at render as soon as a project has handles configured.\n"
            "      – props.ctaProps?.ctas IS an array, and is the only one you may map.\n"
            "  • Socials: pass the map straight through, never iterate it yourself —\n"
            "    <SocialIcons socials={props.ctaProps?.socials}\n"
            "    accentColor={<accent>} textColor={<text>} fontFamily={props.bodyFont}\n"
            "    aspectRatio={props.aspectRatio} />. This shared component normalises the\n"
            "    shape and supplies the brand glyphs; NEVER hand-roll social icons. Its\n"
            "    arrangement within your layout is yours to choose.\n"
            "  • CTAs: map (props.ctaProps?.ctas ?? []) — an array, unlike socials above —\n"
            "    and render each one as a real button-like element, styled to THIS\n"
            "    template's design. Fall back to the single ctaButtonText /\n"
            "    websiteLink pair when `ctas` is absent. EACH ENTRY'S KEYS ARE EXACTLY\n"
            "    `ctaButtonText` and `websiteLink` — never `label`/`text`/`link`, which\n"
            "    do not exist on it and read as undefined (an unlabeled button).\n"
            "    SKIP any entry whose `showWebsiteButton` is false — that is the user\n"
            "    switching this CTA off, and rendering it anyway ignores the toggle.\n"
            "    RENDER BOTH FIELDS, not just the label. `ctaButtonText` is the button\n"
            "    ITSELF; `websiteLink` goes BENEATH it as visible text at about\n"
            "    bodySize * 0.8, in the muted treatment your design uses for a caption.\n"
            "    A video has no clickable surface — a link the frame never draws is a\n"
            "    link the viewer can never follow, so a button reading \"Get started\"\n"
            "    over nothing tells them nowhere to go. Guard it: render the line only\n"
            "    when the entry HAS a websiteLink, and keep the button looking\n"
            "    deliberate when it does not.\n"
            "    THE BUTTON LABEL IS BODY COPY: wrap it in <FitText fontSize={bodySize}\n"
            "    maxLines={1} containerWidth={…}> like every other string on the frame.\n"
            "    A raw `fontSize: bodySize` on the pill is the one element that scales\n"
            "    linearly and without limit while every fitted element around it is\n"
            "    bounded by its box — so dragging the body slider appeared to move ONLY\n"
            "    the CTA button, which is the reported defect.\n"
            "  • GUARD EVERYTHING: props.ctaProps is undefined in template previews and\n"
            "    in projects with no CTA configured, and the scene must still look\n"
            "    finished and deliberate with none of it present.\n"
            "  • TITLE vs DISPLAY TEXT: props.sceneTitle and props.displayText can\n"
            "    carry the SAME string here too (the render path falls back to the\n"
            "    title when a scene has no display text). Render the supporting line\n"
            "    only when it differs, and keep the TITLE as the one that survives:\n"
            "        const title = (props.sceneTitle || '').trim();\n"
            "        const sub = (props.displayText || '').trim();\n"
            "        const _n = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();\n"
            "        const showSub = sub && !_n(sub).startsWith(_n(title));\n"
            "  • Place them INSIDE your own composition — this is your layout, not a\n"
            "    generic centred card bolted onto the bottom.\n"
        )

    return "\n".join(parts)



# ─── Staged generation ──────────────────────────────────────────
#
# generate_component_code used to run planning, scene generation and repair in
# one ~370s call whose result was persisted only at the very end, so a crash at
# scene 7 of 9 discarded all nine. These three stages are the same work, split
# so a caller can persist between them and resume into the middle of one:
#
#   plan_generation      -> the blueprint, design system and scene manifest
#   generate_scene_batch -> the scenes, reporting each one AS IT LANDS
#   examine_scenes       -> validation, repair and the stub floor
#
# generate_component_code below is now just their composition and returns the
# identical dict, so every existing caller is unaffected.


@dataclass
class GenPlan:
    """Everything decided before a single scene is generated (stage A).

    The scene manifest comes straight from the design docs: the doc stage decides
    how many scenes there are and what each one is, so the manifest cannot be
    built before it.
    """

    brand_context: str
    # The design docs (v2). Named `blueprint` because it is persisted to the
    # `design_blueprint` column and every downstream reader still calls it that.
    blueprint: dict | None
    design_system: str
    scene_kwargs: list[dict]
    scene_labels: list[str]
    scene_types_simple: list[str]
    archetype_ids: list[dict]
    theme: dict
    # The per-scene design documents, index-aligned with scene_kwargs. Used to
    # build the running "already built" summary that keeps layouts apart.
    scene_docs: list[dict] = field(default_factory=list)


@dataclass
class SceneResult:
    """One scene's output slot, whatever became of it.

    `code == ""` with `error` set is a scene that failed outright — held rather
    than dropped so the index alignment every downstream consumer relies on
    (aspect ratios, prop schemas, content_codes) survives a partial batch.
    """

    index: int
    code: str
    aspect_ratios: dict[str, str]
    prop_schema: list[dict]
    error: str | None = None
    attempts: int = 1


async def generate_scene_batch(
    plan: GenPlan,
    *,
    generate=None,
    on_scene_done=None,
    existing: dict[int, SceneResult] | None = None,
) -> list[SceneResult]:
    """Generate every scene in PARALLEL, reporting each one as it lands.

    DIVERGENCE DOES NOT REQUIRE SEQUENCING. An earlier version of this ran
    strictly in order so each scene could be told what had already been built —
    but that context is derived from `plan.scene_docs`, which the design stage
    produced BEFORE any code generation starts. Every scene can therefore be told
    about its peers up front, and none of them has to wait.

    The sequential version cost N x ~35s of wall clock (roughly 5 minutes for a
    9-scene template) and bought nothing the docs did not already provide.

    `on_scene_done` fires per scene AS IT COMPLETES (via as_completed, not
    gather), which is what lets a caller persist partial progress rather than
    losing a whole run to a crash near the end.

    `existing` carries scenes a previous run already produced; those indices are
    not regenerated. That is the resume path.

    A scene that raises is recorded as a failed slot instead of aborting the
    batch: one bad scene must not cost the other eight.
    """
    gen = generate or _generate_single_scene
    existing = existing or {}
    results: list[SceneResult | None] = [None] * len(plan.scene_kwargs)

    for idx, done in existing.items():
        if 0 <= idx < len(results):
            results[idx] = done

    def _summarise(idx: int) -> str:
        """One line describing scene `idx`'s assigned layout.

        Read from the DESIGN DOC, not from generated code — which is what makes
        this available before anything has been generated.
        """
        sd = plan.scene_docs[idx] if idx < len(plan.scene_docs) else {}
        role = sd.get("role") or (
            plan.scene_types_simple[idx] if idx < len(plan.scene_types_simple) else "content"
        )
        # The first sentence of the doc is the layout in one line — that is how
        # the design stage is asked to write them.
        doc = (sd.get("doc") or "").strip().replace("\n", " ")
        first = re.split(r"(?<=[.!?])\s+", doc)[0] if doc else ""
        img = sd.get("image_mode")
        img_note = f" [image: {img}{'/' + sd['image_side'] if sd.get('image_side') else ''}]" if img else " [no image]"
        return f"  scene {idx + 1} ({role}) — {first[:160]}{img_note}"

    def _peers_for(i: int) -> str:
        """The OTHER scenes in this template, as told to scene `i`.

        Every peer, not just the earlier ones: with no ordering constraint there
        is no reason to hide half the template from a scene, and seeing all of
        them is a stronger signal to differ than seeing a prefix.
        """
        others = [_summarise(j) for j in range(len(plan.scene_kwargs)) if j != i]
        if not others:
            return ""
        return (
            "THE OTHER SCENES IN THIS TEMPLATE:\n"
            + "\n".join(others)
            + "\n\nYours must be a DIFFERENT COMPOSITION from every one of these — not a "
            "variation of one, not the same skeleton with other content. Share the "
            "template's identity (palette, type, motion character); do not share its "
            "geometry."
        )

    # At most SCENE_CONCURRENCY scenes in flight at once, as a ROLLING window.
    #
    # Every scene's task is created below and immediately blocks on this
    # semaphore, so the window refills the moment a slot frees rather than
    # draining and restarting: with 11 scenes and a window of 8, scene 9 starts
    # as soon as the first of the 8 completes, not after all 8 do.
    #
    # Unbounded fan-out put all 8-11 scenes on the provider simultaneously, each
    # asking for thousands of tokens of code. That is where the slowdown came
    # from: the provider queues and throttles the burst, so the tail scenes
    # finish no sooner than they would have in a smaller window, and rate-limit
    # errors land as failed slots that then cost a repair round.
    #
    # If 429s appear, narrow _PROVIDER_MAX_INFLIGHT (app.dspy_modules) rather
    # than this — that is the gate that actually bounds simultaneous requests,
    # because one scene issues more than one call. Never narrow the retry
    # budget, which is what rescues a failing scene.
    sem = asyncio.Semaphore(SCENE_CONCURRENCY)

    async def _one(idx: int, kw: dict) -> SceneResult:
        async with sem:
            try:
                code, aspect, schema = await gen(**{**kw, "built_so_far": _peers_for(idx)})
                return SceneResult(index=idx, code=code, aspect_ratios=aspect, prop_schema=schema)
            except Exception as e:  # noqa: BLE001
                print(f"[F7-DEBUG] [CODEGEN] scene {idx} failed: {type(e).__name__}: {e}")
                return SceneResult(
                    index=idx, code="", aspect_ratios={}, prop_schema=[],
                    error=f"{type(e).__name__}: {e}",
                )

    pending = [
        asyncio.ensure_future(_one(i, kw))
        for i, kw in enumerate(plan.scene_kwargs)
        if results[i] is None
    ]
    for fut in asyncio.as_completed(pending):
        res = await fut
        results[res.index] = res
        if on_scene_done:
            try:
                on_scene_done(res)
            except Exception as e:  # noqa: BLE001
                # Persistence must never be able to kill a generation.
                print(f"[F7-DEBUG] [CODEGEN] on_scene_done failed for {res.index}: {e}")

    return [
        r or SceneResult(index=i, code="", aspect_ratios={}, prop_schema=[], error="not generated")
        for i, r in enumerate(results)
    ]


def assemble_result(
    plan: GenPlan, results: list[SceneResult], *, warnings: list[str]
) -> dict:
    """Fold the per-scene results back into the caller-facing dict.

    Kept separate from the stages so the return shape has exactly one
    definition — it drifted between the initial-generation and regeneration
    paths once already.
    """
    scenes = [r.code for r in results]
    aspects = [r.aspect_ratios for r in results]
    schemas = [r.prop_schema for r in results]
    return {
        "intro_code": scenes[0],
        "outro_code": scenes[-1],
        "content_codes": list(scenes[1:-1]),
        "archetype_ids": plan.archetype_ids,
        "intro_aspect_ratio": aspects[0],
        "outro_aspect_ratio": aspects[-1],
        "content_aspect_ratios": aspects[1:-1],
        "generation_warnings": warnings,
        "design_blueprint": plan.blueprint,
        "design_system": plan.design_system,
        "layout_prop_schemas": {
            "intro": schemas[0],
            "content": schemas[1:-1],
            "outro": schemas[-1],
        },
    }


# ─── Main generation entry point ────────────────────────────────


async def generate_component_code(
    template: CustomTemplate,
    *,
    on_scene_done=None,
    on_plan_ready=None,
    on_scene_count=None,
    on_verify_start=None,
    resume_scenes: dict[int, SceneResult] | None = None,
) -> dict[str, str | list[str]]:
    """Generate scene variant code for a custom template using DSPy Refine.

    1. Build brand context (raw data)
    2. Ask AI to decide brand-specific scene types
    3. Generate design system
    4. Generate all scenes in parallel (1 intro + N content + 1 outro)

    Returns dict with keys:
      - intro_code: str
      - outro_code: str
      - content_codes: list[str]
      - archetype_ids: list[dict] — full metadata for content-aware matching
    Raises RuntimeError if generation fails.
    """
    theme = json.loads(template.theme) if isinstance(template.theme, str) else template.theme

    brand_kit_data = None
    if template.brand_kit:
        bk = template.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if isinstance(bk.colors, str) else bk.colors,
            "fonts": json.loads(bk.fonts) if isinstance(bk.fonts, str) else bk.fonts,
            "logos": json.loads(bk.logos) if isinstance(bk.logos, str) else bk.logos,
            "design_language": json.loads(bk.design_language) if isinstance(bk.design_language, str) else bk.design_language,
        }

    personality = ""
    if brand_kit_data and brand_kit_data.get("design_language"):
        personality = brand_kit_data["design_language"].get("personality", "")

    brand_context = _build_brand_context(
        theme,
        brand_kit_data,
        template.name,
        category=template.category or "",
        video_style="",
        personality=personality,
        source_url=template.source_url or "",
    )

    t_start = time.time()

    codegen_lm = get_custom_lm()
    _tok = (getattr(codegen_lm, "kwargs", None) or {}).get("max_tokens")
    print(
        f"[F7-DEBUG] [CODEGEN] LLM model={codegen_lm.model!r} max_tokens={_tok}"
    )

    # ── Stage A: design documents ────────────────────────────────────────────
    # The raw brief (prompt / doc text, empty for URL-scraped templates) lets the
    # user request specific scenes.
    user_brief = (theme.get("brief") or "").strip() if isinstance(theme, dict) else ""
    if user_brief:
        print(f"[F7-DEBUG] [BRIEF] honoring user brief ({len(user_brief)} chars)")
    brand_description = (
        (theme.get("brand_description") or "").strip() if isinstance(theme, dict) else ""
    )
    loop = asyncio.get_event_loop()

    # The design system depends ONLY on brand_context, which is already built, so
    # start it now and let its ~23s run concurrently with the design docs rather
    # than strictly after them. Pure latency off every generation.
    _design_system_task = asyncio.ensure_future(
        loop.run_in_executor(None, _generate_design_system, brand_context)
    )

    # This stage must NEVER be able to fail template generation. generate_design_docs
    # catches the model failures it anticipates, but an unanticipated one (an
    # AttributeError from a malformed field, as seen on template 135 in the
    # blueprint era) would otherwise kill the whole run. A template built on the
    # fallback docs is a far better outcome than no template at all.
    docs: dict | None = None
    try:
        docs, _doc_repairs = await loop.run_in_executor(
            None,
            partial(
                generate_design_docs,
                brand_context,
                brand_description,
                user_brief,
                # Needed only to graft a missing REQUIRED scene type from the
                # deterministic fallback when two samples both omit one.
                theme=theme,
                name=template.name,
            ),
        )
    except Exception as _dd_err:  # noqa: BLE001
        print(f"[F7-DEBUG] [DESIGN-DOC] stage raised {type(_dd_err).__name__}: {_dd_err}")
    if docs is None:
        docs = fallback_design_docs(theme, template.name)
        print("[F7-DEBUG] [DESIGN-DOC] using deterministic fallback docs")

    scene_docs: list[dict] = list(docs.get("scenes") or [])
    total_scenes = len(scene_docs)
    general_doc = docs.get("general_doc") or ""

    # The scene count is known the moment the docs land, so report it now — the
    # UI would otherwise show "Scenes" with no counter for the whole run.
    if on_scene_count:
        try:
            on_scene_count(total_scenes)
        except Exception as e:  # noqa: BLE001
            # Progress reporting must never be able to kill a generation.
            print(f"[F7-DEBUG] [CODEGEN] on_scene_count failed: {e}")

    design_system = await _design_system_task

    num_content = sum(1 for s in scene_docs if s.get("role") == "content")
    print(
        f"[F7-DEBUG] [CODEGEN] Generating {total_scenes} scenes for '{template.name}': "
        f"1 intro + {num_content} content + 1 outro"
    )

    # ── Stage B: one kwargs set per scene ────────────────────────────────────
    #
    # Note what is NOT here any more: no composition rotation, no artifact
    # rotation, no blueprint/layout_spec/art_direction. Those existed to inject
    # variety that the scene docs now carry themselves. Each scene gets the
    # SHARED identity (general_doc, which keeps the template coherent) and its
    # OWN design (scene_doc, which makes it different) — plus, at generation
    # time, a summary of the layouts already built so it can avoid repeating one.
    scene_kwargs: list[dict] = []
    for i, sd in enumerate(scene_docs):
        scene_kwargs.append(
            dict(
                brand_context=brand_context,
                design_system=design_system,
                general_doc=general_doc,
                scene_doc=_format_scene_doc(sd),
                built_so_far="",  # filled in per scene by generate_scene_batch
                scene_type=sd.get("role") or "content",
                scene_index=i,
                total_scenes=total_scenes,
            )
        )

    # ── Per-generation cache-buster ──────────────────────────────────────────
    # DSPy's LM caches on the request signature. Every call builds byte-identical
    # kwargs for the same template, so a *regenerate* produces the identical cache
    # key and replays the cached completion verbatim — including a scene that
    # renders blank at runtime (a crash the static validator cannot catch, so it
    # passes validation, gets stored, and can never be regenerated away).
    # Confirmed in the wild: three back-to-back regenerates wrote byte-identical
    # scene files.
    _gen_nonce = time.time_ns()
    for _kw in scene_kwargs:
        _kw["scene_doc"] = f"{_kw['scene_doc']}\n\n[gen {_gen_nonce}]"

    # Stage A is done. Hand the caller the docs and design system NOW so they can
    # be persisted before the scene work begins — a crash during scenes then costs
    # the scenes, not the design call too.
    if on_plan_ready:
        try:
            on_plan_ready(
                {
                    "blueprint": docs,
                    "design_system": design_system,
                    "scene_labels": [s.get("id") or f"scene_{i}" for i, s in enumerate(scene_docs)],
                    "total_scenes": total_scenes,
                }
            )
        except Exception as e:  # noqa: BLE001
            # Persistence must never be able to kill a generation.
            print(f"[F7-DEBUG] [CODEGEN] on_plan_ready failed: {e}")

    # Scene generation runs through generate_scene_batch so a caller can observe
    # (and persist) each scene as it lands rather than only after the last one
    # finishes.

    scene_types_simple = [sd.get("role") or "content" for sd in scene_docs]
    scene_labels = [s.get("id") or f"scene_{i}" for i, s in enumerate(scene_docs)]
    _plan = GenPlan(
        brand_context=brand_context,
        blueprint=docs,
        design_system=design_system,
        scene_kwargs=scene_kwargs,
        scene_labels=list(scene_labels),
        scene_types_simple=list(scene_types_simple),
        archetype_ids=[],
        theme=theme,
        scene_docs=list(scene_docs),
    )
    _batch = await generate_scene_batch(
        _plan, on_scene_done=on_scene_done, existing=resume_scenes
    )
    # Retry ONLY the scenes that failed, not the whole batch.
    #
    # A single scene raising used to abort the run, and the caller's recovery was
    # to regenerate all nine — paying for eight healthy scenes again to rescue
    # one, and usually for a transient LLM flake. Re-running just the broken
    # indices costs one call each, and `existing` carries the healthy results
    # through untouched.
    _broken = [r for r in _batch if r.error]
    if _broken:
        print(
            f"[F7-DEBUG] [CODEGEN] {len(_broken)} scene(s) failed "
            f"({[r.index for r in _broken]}) — retrying just those"
        )
        _keep = {r.index: r for r in _batch if not r.error}
        for _kw in scene_kwargs:
            # Bust the DSPy cache so the retry cannot replay the same failure.
            _kw["scene_doc"] = f"{_kw['scene_doc']}\n[scene-retry {time.time_ns()}]"
        _batch = await generate_scene_batch(
            _plan, on_scene_done=on_scene_done, existing=_keep
        )
        _broken = [r for r in _batch if r.error]

    if _broken:
        # Still broken after a dedicated retry. The repair loop below cannot
        # repair a scene that was never generated, so this is a real failure.
        raise RuntimeError(
            f"scene generation failed for {len(_broken)} scene(s): {_broken[0].error}"
        )
    scenes = [r.code for r in _batch]
    # Each entry is a dict {"landscape": "W / H", "portrait": "W / H"}
    scene_aspect_ratios: list[dict[str, str]] = [r.aspect_ratios for r in _batch]
    # Per-layout editable props each scene declared (P3), index-aligned with scenes.
    scene_prop_schemas: list[list[dict]] = [r.prop_schema for r in _batch]

    # Log what was generated
    for i, (label, code) in enumerate(zip(scene_labels, scenes)):
        line_count = code.count("\n") + 1
        print(f"[F7-DEBUG] [CODEGEN] Scene {i} ({label}): {line_count} lines")

    # Final validation pass. dspy.Refine (inside _generate_single_scene) always
    # returns its best-scoring attempt even when every attempt scored 0.0 — it
    # never raises on a failing scene, so a syntactically-broken scene can come
    # back here despite Refine "succeeding". Rather than failing the ENTIRE
    # 9-scene batch (which burns the user's quota + discards 8 good scenes) over
    # one bad scene, regenerate just the failing scene(s) a few more times —
    # each retry uses a fresh temperature=1.0 rollout, so it isn't the same
    # deterministic failure repeating.
    # NOTE the parameter name. It is deliberately NOT `wrapped_err`: this helper
    # is nested inside generate_component_code, so an inner parameter sharing a
    # name with an outer local trips the use-before-assignment audit in
    # test_staged_codegen — which walks the whole function body and cannot tell
    # a nested scope from the enclosing one. That audit exists because a real
    # read-before-assignment here costs ~150s and a paid blueprint before it
    # surfaces, so it is worth keeping blunt.
    def _wrapped_repair_instruction(_collision_err: str) -> str:
        """Turn a wrapper-collision error into an instruction that names the fix.

        The validator's message is accurate but reads as a structural problem
        ("redeclares an injected import ... use them directly, never redeclare
        them"), which invites a rewrite. The actual fix is a one-word rename,
        and a scene that rewrites instead loses contracts it already satisfied.

        This path had NO repair at all before — a collision stubbed the scene
        outright — so the model has never once been asked to make this edit.
        """
        _m = re.search(r"Top-level '([A-Za-z_$][\w$]*)'", _collision_err or "")
        _name = _m.group(1) if _m else None
        if not _name:
            return _collision_err
        return (
            f"{_collision_err}\n\n"
            f"THE FIX IS A RENAME. `{_name}` is already provided to your scene, so "
            f"declaring it again is a module-evaluation SyntaxError. Rename YOUR "
            f"declaration and every reference to it — for example `{_name}` -> "
            f"`scene{_name[0].upper()}{_name[1:]}` — and change absolutely nothing "
            f"else. Do not restructure the scene, do not drop elements, and do not "
            f"remove the declaration: it is the NAME that is reserved, not what you "
            f"built with it."
        )

    def _log_failed_scene(scene_idx: int, label: str, code: str, error: str, attempt_label: str) -> str:
        """Print the validator error AND the actual LLM output around the
        failure point, so a broken generation is diagnosable from server logs
        alone instead of having to query the DB for what the model wrote.

        Returns the formatted diagnostic so the RETRY can feed the model the
        real error (see _format_scene_failure) instead of a generic hint."""
        print(f"[F7-DEBUG] [CODEGEN] Scene {scene_idx} ({label}) {attempt_label}: {error}")
        diagnostic = _format_scene_failure(
            code,
            error,
            scene_type=scene_types_simple[scene_idx],
            scene_doc=str(scene_kwargs[scene_idx].get("scene_doc") or ""),
        )
        print(f"[F7-DEBUG] [CODEGEN] Failure context (scene {scene_idx}):\n{diagnostic}")
        return diagnostic

    # scene_types_simple is built above, before the scene batch, because the
    # batch's GenPlan carries it.
    MAX_SCENE_RETRIES = 3
    # Escalating repair strategies (§R Layer 2). Each attempt DIFFERS rather than
    # repeating the same request: targeted repair, then simplify, then strip the
    # scene back to its essentials. Appended to scene_purpose alongside a nonce
    # (DSPy caches on the whole prompt; previous_failure already busts the key,
    # but the nonce covers the identical-error case).
    # Repair strategies escalate in FOCUS, not in destruction.
    #
    # The previous repair 3 said "Produce the SIMPLEST scene ... Drop all other
    # decoration", and repair 2 said "drop non-essential decoration". Combined
    # with a validator that reported one error at a time, that instruction is
    # what drove the observed collapse: a scene told "missing logoUrl" rewrote
    # itself smaller, lost its animations, was told "insufficient animations",
    # rewrote again and lost the logo — shrinking 279 -> 279 -> 154 lines across
    # three repairs without ever converging.
    #
    # Every repair now says the same thing in stronger terms: change ONLY what
    # the listed errors require, and keep everything else exactly as it is.
    _REPAIR_STRATEGIES = (
        "",
        (
            " | [repair 2: your previous attempt still failed. Fix ONLY the listed errors. "
            "Keep the layout geometry, the motion, and every contract the scene already "
            "satisfies — a repair that fixes one error by breaking another cannot converge.]"
        ),
        (
            " | [repair 3: FINAL attempt. Work through the numbered error list and satisfy "
            "EVERY item simultaneously — they are all required at once, not in turn. Start "
            "from your previous code and make the minimum edit that clears the whole list; "
            "do NOT rewrite the scene from scratch and do NOT strip existing detail.]"
        ),
    )
    generation_warnings: list[str] = []

    # Every scene has been generated; what follows is the validation + repair pass
    # over the finished set. It is a distinct wait from scene generation — a scene
    # that fails can be re-generated up to MAX_SCENE_RETRIES times here — so the
    # progress UI gets its own step for it rather than appearing stalled on
    # "Scenes" with the counter already at N/N.
    if on_verify_start:
        try:
            on_verify_start()
        except Exception as e:  # noqa: BLE001
            # Progress reporting must never be able to kill a generation.
            print(f"[F7-DEBUG] [CODEGEN] on_verify_start failed: {e}")

    # ── Cross-scene consistency ───────────────────────────────────────────────
    # The FIRST check in this pipeline that can see more than one scene at once.
    # Both validate_component_code and _score_valid_scene take a single `code`
    # string, so "these scenes disagree with each other" was structurally
    # unrepresentable — which is how a template shipped with a different
    # background on every scene.
    #
    # Only the OUTLIERS are marked, never the whole run: the majority canvas is
    # taken as the template's intent and the minority is repaired toward it. A
    # template with no majority, or too few resolvable scenes, is left alone.
    _canvas_outliers = set(detect_canvas_drift(scenes))
    _font_outliers = set(detect_font_drift(scenes))
    # The value the outliers must be repaired TOWARD. Naming it in the error is
    # what turns "your canvas is wrong" into an instruction the model can act on.
    _canvas_majority: str | None = None
    if _canvas_outliers:
        _tokens: list[str] = []
        for _i, _code in enumerate(scenes):
            if _i in _canvas_outliers:
                continue
            _tok = scene_canvas_token(_code)
            if _tok:
                _tokens.append(_tok)
        if _tokens:
            _canvas_majority = max(set(_tokens), key=_tokens.count)
    if _canvas_outliers or _font_outliers:
        print(
            f"[F7-DEBUG] [CROSS-SCENE] canvas outliers={sorted(_canvas_outliers)} "
            f"font outliers={sorted(_font_outliers)}"
        )

    # Repair every failing scene CONCURRENTLY.
    #
    # This loop used to be strictly sequential: each scene ran up to
    # MAX_SCENE_RETRIES repairs, one LLM call apiece, before the next scene was
    # even looked at. With 7 of 9 scenes failing (measured on template 177) that
    # is up to 21 calls end to end — which is why the "Verifying" step, not scene
    # generation, was where a ~800s run spent its time.
    #
    # Repairs are independent: each rewrites one scene against its own errors and
    # its own doc. Only the cross-scene verdicts (canvas/font drift) are shared,
    # and those are computed BEFORE this point. So the whole pass can fan out
    # under the same window scene generation uses.
    _repair_sem = asyncio.Semaphore(SCENE_CONCURRENCY)

    async def _verify_and_repair(i: int) -> None:
        # collect_all: report EVERY broken contract, not just the first. Fixing one
        # at a time is what made a scene restore its logo while dropping its
        # animations, then restore animations and drop the logo again.
        valid, err = validate_component_code(
            scenes[i],
            scene_type=scene_types_simple[i],
            collect_all=True,
            theme=theme,
            scene_doc=str(scene_kwargs[i].get("scene_doc") or ""),
        )
        # Fold the cross-scene verdict into this scene's error list so the
        # existing repair loop below drives the fix — no parallel machinery.
        _cross: list[str] = []
        # These messages name the MAJORITY value alongside this scene's, and ask
        # for a swap and nothing else. A bare "canvas drift" reads as a design
        # complaint and invites a rewrite, which is how a repair loses its
        # layout while fixing a colour.
        if i in _canvas_outliers:
            _majority = _canvas_majority or "the template's canvas colour"
            _cross.append(
                f"Every other scene in this template renders on {_majority!r}; this one uses "
                f"{scene_canvas_token(scenes[i])!r}. A viewer scrubbing the video would see the "
                f"background change. Set this scene's outermost fill to "
                f"props.brandColors.background and move the colour you wanted onto a PANEL "
                f"inside the scene. Change ONLY the root background — keep the layout, the "
                f"motion and every other colour exactly as they are."
            )
        if i in _font_outliers:
            _cross.append(
                "This scene's typography does not match the rest of the template, so the video "
                "changes typeface mid-way. Bind headings to props.headingFont and body copy to "
                'props.bodyFont (fontFamily: props.headingFont || "inherit") — the fallback '
                'must be "inherit", never a named family. Change ONLY the fontFamily values.'
            )
        if _cross:
            valid = False
            err = "\n".join([*( [err] if err else [] ), *_cross])

        if valid:
            return  # this scene is fine — nothing to repair
        diagnostic = _log_failed_scene(
            i, scene_labels[i], scenes[i], err, "failed final validation (initial attempt)"
        )
        for retry in range(1, MAX_SCENE_RETRIES + 1):
            # Say which scene is being repaired and why, before the call rather
            # than after it — a silent 30-100s gap in the log reads as a hang.
            _why = (err or "").strip().splitlines()[0] if err else "failed validation"
            print(
                f"[F7-DEBUG] [CODEGEN] repairing scene {i} ({scene_labels[i]}) — "
                f"attempt {retry}/{MAX_SCENE_RETRIES}: {_why}"
            )
            strategy = _REPAIR_STRATEGIES[min(retry - 1, len(_REPAIR_STRATEGIES) - 1)]
            retry_kwargs = {
                **scene_kwargs[i],
                # The scene's own design doc rides along on every repair.
                #
                # A scene can now fail SEMANTICALLY — it built a composition its
                # doc did not describe — so a repair that only sees the generic
                # contract drifts further from the assigned design with each
                # attempt. Keeping the doc in front of the model is what makes a
                # semantic repair converge on the right layout instead of a
                # merely valid one.
                "scene_doc": (
                    f"{scene_kwargs[i]['scene_doc']}{strategy}"
                    f"\n[repair {retry} {time.time_ns()}]"
                ),
                # The REAL error, not a hardcoded "syntax error" guess (§R Layer 1).
                "previous_failure": diagnostic,
                # One informed call per repair instead of Refine's rollouts (§R Layer 2).
                "use_refine": False,
            }
            # First repair is an EDIT of the broken code, not a fresh generation.
            #
            # Every repair used to regenerate the scene from scratch, which is
            # precisely the non-convergence _REPAIR_STRATEGIES documents above:
            # a scene told "missing logoUrl" rewrote itself smaller, lost its
            # animations, was told "insufficient animations", rewrote again and
            # lost the logo — 279 -> 279 -> 154 lines, never converging. Handing
            # back the previous code with the error list gives the model
            # something to edit, which converges far more often. The later
            # attempts still regenerate, so a scene that is genuinely
            # unsalvageable is not locked into its own bad structure.
            if retry == 1 and scenes[i] and len(scenes[i].strip()) > 200:
                retry_kwargs["current_code"] = scenes[i]
                retry_kwargs["edit_instruction"] = (
                    "Fix ONLY the listed errors. Keep the layout geometry, the motion, and "
                    "every contract the scene already satisfies — make the minimum edit that "
                    "clears the whole list."
                )
            # Bounded like scene generation — an unbounded burst of repairs would
            # hit the same provider throttling.
            async with _repair_sem:
                code, ar, ps = await _generate_single_scene(**retry_kwargs)
            valid, err = validate_component_code(
                code,
                scene_type=scene_types_simple[i],
                collect_all=True,
                theme=theme,
                # Same doc the first pass used. Without it a repaired scene is
                # judged by DIFFERENT rules than the one that rejected it — an
                # image-less scene would be told to add an image it was designed
                # without, and could never converge.
                scene_doc=str(scene_kwargs[i].get("scene_doc") or ""),
            )
            scenes[i] = code
            scene_aspect_ratios[i] = ar
            scene_prop_schemas[i] = ps
            if valid:
                print(f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) recovered on repair {retry}")
                break
            diagnostic = _log_failed_scene(
                i, scene_labels[i], code, err, f"failed final validation (repair {retry}/{MAX_SCENE_RETRIES})"
            )
        if not valid:
            # §R Layer 3 — substitute a deterministic, non-LLM stub rather than
            # raising. Raising here killed the WHOLE batch (and ~6 minutes of
            # compute across the other scenes) over one bad scene. A template
            # with N-1 real scenes plus one on-brand stub is far more useful
            # than a refunded slot and nothing — and P4's per-scene AI edit is
            # the natural repair path for the stubbed scene.
            print(
                f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) STUBBED after "
                f"{MAX_SCENE_RETRIES} repairs — last error: {err}"
            )
            scenes[i] = _build_stub_scene_code(scene_types_simple[i], theme)
            scene_aspect_ratios[i] = {"landscape": "16 / 9", "portrait": "9 / 16"}
            scene_prop_schemas[i] = []
            generation_warnings.append(
                f"Scene {i} ({scene_labels[i]}) could not be generated after "
                f"{MAX_SCENE_RETRIES} attempts and uses a simplified fallback design. "
                f"Last error: {err}"
            )

    await asyncio.gather(*(_verify_and_repair(i) for i in range(len(scenes))))


    # Total failure (every scene stubbed) is a real outage — surface it rather
    # than storing an all-placeholder template.
    #
    # `err` used to be read here directly; it was the loop variable of a
    # sequential pass, so it happened to hold the last scene's error. Now that
    # repairs run concurrently there is no "last" error, so the warning list —
    # which every stubbed scene appends to — is the honest source.
    if generation_warnings and len(generation_warnings) == len(scenes):
        raise RuntimeError(
            f"All {len(scenes)} scenes failed validation. "
            f"First failure: {generation_warnings[0]}"
        )

    # §R Layer 5 — validate the WRAPPED output, not just the raw snippet.
    # validate_component_code() parses the raw scene code, but what actually gets
    # bundled is _wrap_generated_code(raw): raw plus ~45 kit imports, the remotion
    # imports and a shadowing `interpolate`. A raw snippet can parse cleanly yet
    # break once wrapped — most commonly when the generated code declares a name
    # that collides with an injected import (the same TDZ class the validator
    # already special-cases). Catching it here keeps a whole-video bundle failure
    # out of the database.
    #
    # ONE REPAIR BEFORE STUBBING. This used to stub outright, with no attempt —
    # the only path in the pipeline that discards a scene without spending any
    # of its retry budget, which is why a whole run could come back with several
    # byte-identical stubs while the logs showed no repair loop at all.
    #
    # The fix is nearly always a one-word rename, and the model is never given
    # the chance to make it. `_wrapped_repair_instruction` states it explicitly,
    # because "collides with an injected import" reads as a structural problem
    # and invites a rewrite that changes everything except the name.
    for i in range(len(scenes)):
        wrapped_ok, _wrapped_first_err = validate_wrapped_component_code(scenes[i])
        if wrapped_ok:
            continue
        # The error reported to the user. Reassigned only if the repair below
        # produces a DIFFERENT one, so it is never read before it is bound.
        wrapped_err = _wrapped_first_err

        print(
            f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) failed WRAPPED "
            f"validation — repairing: {wrapped_err}"
        )
        try:
            _wrapped_kwargs = {
                **scene_kwargs[i],
                "scene_doc": (
                    f"{scene_kwargs[i]['scene_doc']}"
                    f"\n[wrapped-name repair {time.time_ns()}]"
                ),
                "previous_failure": _wrapped_repair_instruction(_wrapped_first_err),
                "use_refine": False,
                "current_code": scenes[i],
                "edit_instruction": (
                    "RENAME the colliding identifier and change NOTHING else. Every "
                    "declaration, style, animation and element stays exactly as it is — "
                    "only the name and its references move."
                ),
            }
            async with _repair_sem:
                _code, _ar, _ps = await _generate_single_scene(**_wrapped_kwargs)
            _w_ok, _w_err = validate_wrapped_component_code(_code)
            _v_ok, _ = validate_component_code(
                _code,
                scene_type=scene_types_simple[i],
                collect_all=True,
                theme=theme,
                scene_doc=str(scene_kwargs[i].get("scene_doc") or ""),
            )
            # Both must hold: a rename that clears the collision but breaks a
            # contract the scene already satisfied is not a repair.
            if _w_ok and _v_ok:
                print(
                    f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) recovered "
                    f"from the wrapper collision"
                )
                scenes[i] = _code
                scene_aspect_ratios[i] = _ar
                scene_prop_schemas[i] = _ps
                continue
            wrapped_err = _w_err or _wrapped_first_err
        except Exception as e:  # noqa: BLE001
            # The stub below is the floor; a failed repair must never be able to
            # take the run down with it.
            print(f"[F7-DEBUG] [CODEGEN] wrapped-name repair for scene {i} failed: {e}")

        print(
            f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) failed WRAPPED "
            f"validation after 1 repair — stubbing: {wrapped_err}"
        )
        scenes[i] = _build_stub_scene_code(scene_types_simple[i], theme)
        scene_aspect_ratios[i] = {"landscape": "16 / 9", "portrait": "9 / 16"}
        scene_prop_schemas[i] = []
        generation_warnings.append(
            f"Scene {i} ({scene_labels[i]}) conflicted with the render wrapper and "
            f"uses a simplified fallback design. Error: {wrapped_err}"
        )

    # ── Final cross-scene audit (post-repair, post-stub) ──────────────────────
    #
    # The check above ran on the PRE-repair codes and its verdict was a frozen
    # set of indices. Everything after it mutates `scenes`: repairs replace a
    # scene wholesale, and the two stub paths substitute
    # _build_stub_scene_code(), whose background is a hardcoded slate — so a
    # stubbed scene in a cream template was a guaranteed, undetected outlier.
    #
    # Nothing can be repaired at this point (the rollout budget is spent), so
    # this reports rather than fixes. The render wrapper paints the brand canvas
    # regardless, so a survivor here is cosmetic in the stored code rather than
    # visible in the video — but it must not pass silently, because the stored
    # code is what a later per-scene edit starts from.
    _final_canvas = detect_canvas_drift(scenes)
    _final_font = detect_font_drift(scenes)
    for _i in sorted(set(_final_canvas) | set(_final_font)):
        _why = []
        if _i in _final_canvas:
            _why.append(f"canvas={scene_canvas_token(scenes[_i])!r}")
        if _i in _final_font:
            _why.append("typography")
        generation_warnings.append(
            f"Scene {_i} ({scene_labels[_i]}) still differs from the rest of the "
            f"template after repair ({', '.join(_why)}). The renderer pins the brand "
            "canvas and typeface, so the video is consistent, but this scene's stored "
            "code is not."
        )
        print(
            f"[F7-DEBUG] [CROSS-SCENE] scene {_i} unresolved after repair: {', '.join(_why)}"
        )

    intro_code = scenes[0]
    outro_code = scenes[-1]
    content_codes = list(scenes[1:-1])

    t_total = time.time() - t_start

    scene_summary = ", ".join(
        f"{label}:{code.count(chr(10)) + 1}L"
        for label, code in zip(scene_labels, scenes)
    )
    print(
        f"[F7-DEBUG] [CODEGEN] '{template.name}' done in {t_total:.1f}s — "
        f"{len(scenes)} scenes ({scene_summary})"
    )

    # ── Sample copy for the template preview ────────────────────────────────
    #
    # Generated per scene from its OWN design doc, so the gallery and the editor
    # show copy that belongs to this template instead of the generic strings the
    # browser used to synthesise. Runs concurrently — each call is independent
    # and on the cheap scene-type LM, so the whole stage costs roughly one call's
    # wall-clock rather than N.
    #
    # Never fatal: every scene falls back to deterministic copy, so a failed or
    # slow pass degrades to what the preview showed before rather than storing a
    # blank scene.
    _sample_sem = asyncio.Semaphore(SCENE_CONCURRENCY)

    async def _sample_for(idx: int, sd: dict) -> dict:
        _ctype = sd.get("content_type") or "plain"
        # Bookends are not content-routed: the intro carries the title and the
        # outro the CTA, so neither takes a structured content payload.
        if sd.get("role") in ("intro", "outro"):
            _ctype = "plain"
        async with _sample_sem:
            try:
                out = await asyncio.to_thread(
                    _generate_sample_content,
                    brand_context,
                    sd.get("doc") or "",
                    _ctype,
                )
            except Exception:  # noqa: BLE001
                out = {}
        if not out:
            out = _fallback_sample_content(template.name or "", _ctype, idx)
        # contentType tells the scene component which branch to render; it is
        # derived from the doc, never from the model's reply.
        out["contentType"] = _ctype
        return out

    try:
        _samples = await asyncio.gather(
            *[_sample_for(i, sd) for i, sd in enumerate(scene_docs)]
        )
    except Exception as e:  # noqa: BLE001
        print(f"[F7-DEBUG] [SAMPLE] stage failed ({type(e).__name__}); using fallbacks: {e}")
        _samples = [
            _fallback_sample_content(
                template.name or "",
                "plain" if sd.get("role") in ("intro", "outro")
                else (sd.get("content_type") or "plain"),
                i,
            )
            for i, sd in enumerate(scene_docs)
        ]

    _samples = list(_samples)
    scene_sample_content = {
        "intro": _samples[0] if _samples else {},
        "content": _samples[1:-1] if len(_samples) > 2 else [],
        "outro": _samples[-1] if len(_samples) > 1 else {},
    }
    # Type sizes, derived from the SAME list and sliced identically — computing
    # them here rather than in a second pass is what makes the two arrays
    # index-aligned by construction instead of by convention.
    _fonts = [
        _compute_scene_font_defaults(s, s.get("contentType") or "plain")
        for s in _samples
    ]
    scene_font_defaults = {
        "intro": _fonts[0] if _fonts else {},
        "content": _fonts[1:-1] if len(_fonts) > 2 else [],
        "outro": _fonts[-1] if len(_fonts) > 1 else {},
    }
    print(
        f"[F7-DEBUG] [SAMPLE] built sample copy for {len(_samples)} scenes "
        f"({sum(1 for s in _samples if s.get('displayText'))} with headlines)"
    )

    return {
        "intro_code": intro_code,
        "outro_code": outro_code,
        "content_codes": content_codes,
        # Per-scene showcase copy, indexed exactly like image_box_aspect_ratios.
        "scene_sample_content": scene_sample_content,
        # Default type sizes for that copy, indexed the same way.
        "scene_font_defaults": scene_font_defaults,
        # Per-content-scene metadata for content-aware matching at video time.
        #
        # `best_for` IS LOAD-BEARING and must be a LIST of real taxonomy values.
        # An earlier revision set it to "" on the reasoning that the taxonomy was
        # part of the design vocabulary being removed. It is not — it is the
        # content ROUTING key, and match_scenes_to_archetypes iterates it: an
        # empty string yields no entries, so `type_to_archetype` came out empty
        # and every scene silently fell through to round-robin. A metrics-heavy
        # article never reached the metrics layout even when the template had one.
        # `best_for` is RANKED: element 0 is the kind this layout was designed
        # for, the rest are acceptable second choices. match_scenes_to_archetypes
        # claims every primary before considering any secondary, so widening the
        # list can only fill layouts that would otherwise have gone unused — it
        # never displaces a real match. Without the secondaries an article whose
        # sections cluster on one content kind sent every scene to a single
        # layout and left the other six unused.
        "archetype_ids": [
            _archetype_entry(s, i)
            for i, s in enumerate(sd for sd in scene_docs if sd.get("role") == "content")
        ],
        # Image box aspect ratios per scene type — used to configure the image adjustment modal
        "intro_aspect_ratio": scene_aspect_ratios[0],
        "outro_aspect_ratio": scene_aspect_ratios[-1],
        "content_aspect_ratios": scene_aspect_ratios[1:-1],
        # §R — scenes that fell back to the deterministic stub. Persisted and
        # surfaced in the UI so a stubbed scene is visible, not silent.
        "generation_warnings": generation_warnings,
        # The design documents this template was built from (stored in the
        # `design_blueprint` column, whose v1 `identity` + `transition_family`
        # shape these deliberately preserve so the render path is unchanged).
        # Persisted so a per-scene AI edit can regenerate ONE scene against the
        # same design, and so the editor knows each scene's image capability.
        "design_blueprint": docs,
        # P3 — per-layout editable props, mirroring image_box_aspect_ratios'
        # {intro, content[], outro} shape so the indexing convention matches.
        # Cached so a single-scene AI edit reuses the same shared styling.
        "design_system": design_system,
        "layout_prop_schemas": {
            "intro": scene_prop_schemas[0],
            "content": scene_prop_schemas[1:-1],
            "outro": scene_prop_schemas[-1],
        },
    }


# ─── Single-scene AI edit (P4) ──────────────────────────────────


SCENE_KEY_RE = re.compile(r"^(intro|outro|content_(\d+))$")


def parse_scene_key(scene_key: str, num_content: int) -> tuple[str, int]:
    """Resolve a scene key into (role, content index). Raises ValueError."""
    m = SCENE_KEY_RE.match((scene_key or "").strip())
    if not m:
        raise ValueError(f"invalid scene key {scene_key!r}")
    if m.group(1) in ("intro", "outro"):
        return m.group(1), -1
    idx = int(m.group(2))
    if idx < 0 or idx >= num_content:
        raise ValueError(f"content index {idx} out of range (0..{num_content - 1})")
    return "content", idx


async def regenerate_single_scene(
    template: CustomTemplate,
    scene_key: str,
    user_prompt: str,
    keep_geometry: bool = False,
    from_blueprint: bool = False,
) -> dict:
    """Regenerate ONE scene from a user's prompt.

    A thin sibling of generate_component_code: same validation, same repair
    ladder, but scoped to a single scene and driven by an edit instruction.

    `from_blueprint` rebuilds the scene from its stored blueprint layout instead
    of editing the current code. That distinction matters for a STUBBED scene:
    its stored code is a generic placeholder the generator fell back to, so
    seeding an edit from it would carry the placeholder's shape forward — the
    scene would keep looking like a stub. Passing no current_code and no
    edit_instruction is the same state a first-time generation runs in, which is
    exactly what the signature's "empty when generating fresh" contract expects.

    Deliberately does NOT fall back to the stub. Everywhere else a stub is the
    right answer — a degraded scene beats a dead batch. Here it would silently
    replace the user's scene with a generic one after they asked for a specific
    change, so a failed edit is reported as a failure and the published scene is
    left untouched.
    """
    theme = json.loads(template.theme) if isinstance(template.theme, str) else template.theme
    content_codes = json.loads(template.content_codes) if template.content_codes else []
    role, content_index = parse_scene_key(scene_key, len(content_codes))

    if role == "intro":
        current = template.intro_code or ""
        scene_index = 0
    elif role == "outro":
        current = template.outro_code or ""
        scene_index = len(content_codes) + 1
    else:
        current = content_codes[content_index]
        scene_index = content_index + 1
    # A blueprint rebuild does not read the current code, so it is the one path
    # that can run on a scene with none.
    if not current and not from_blueprint:
        raise RuntimeError(f"scene {scene_key!r} has no existing code to edit")

    total_scenes = len(content_codes) + 2

    brand_kit_data = None
    if template.brand_kit:
        bk = template.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if isinstance(bk.colors, str) else bk.colors,
            "fonts": json.loads(bk.fonts) if isinstance(bk.fonts, str) else bk.fonts,
            "logos": json.loads(bk.logos) if isinstance(bk.logos, str) else bk.logos,
            "design_language": (
                json.loads(bk.design_language)
                if isinstance(bk.design_language, str)
                else bk.design_language
            ),
        }
    personality = ""
    if brand_kit_data and brand_kit_data.get("design_language"):
        personality = brand_kit_data["design_language"].get("personality", "")

    brand_context = _build_brand_context(
        theme,
        brand_kit_data,
        template.name,
        category=template.category or "",
        video_style="",
        personality=personality,
        source_url=template.source_url or "",
    )

    # Reuse the STORED design system rather than regenerating it. Regenerating
    # would drift the shared styling and leave the edited scene subtly out of
    # step with its siblings — the opposite of what an edit should do.
    design_system = ""
    if getattr(template, "design_system", None):
        design_system = template.design_system or ""
    if not design_system:
        loop = asyncio.get_event_loop()
        design_system = await loop.run_in_executor(None, _generate_design_system, brand_context)

    # The stored design docs. An edit must be made against the SAME design the
    # scene was built from, or it silently re-composes the scene against a
    # different brief and drifts out of step with its siblings.
    docs = (
        json.loads(template.design_blueprint) if template.design_blueprint else None
    )
    general_doc = ""
    scene_doc_text = ""
    scene_doc_raw: dict = {}
    if isinstance(docs, dict):
        general_doc = docs.get("general_doc") or ""
        # v2 stores per-scene docs; a v1 template (blueprint-era) has `layouts`
        # instead and simply gets no scene doc — the edit then runs on the
        # general contract alone, which is the best available for a template
        # generated before the doc stage existed.
        _scenes = docs.get("scenes")
        if isinstance(_scenes, list) and 0 <= scene_index < len(_scenes):
            _sd = _scenes[scene_index]
            if isinstance(_sd, dict):
                scene_doc_raw = _sd
                scene_doc_text = _format_scene_doc(_sd)

    instruction = (user_prompt or "").strip()
    if keep_geometry:
        instruction += (
            " | KEEP THE EXISTING LAYOUT GEOMETRY unchanged — apply only the change "
            "described above, leaving the overall composition where it is."
        )

    kwargs = dict(
        brand_context=brand_context,
        design_system=design_system,
        general_doc=general_doc,
        scene_doc=(
            f"{scene_doc_text}\n\n[{'rebuild' if from_blueprint else 'edit'} {time.time_ns()}]"
        ),
        built_so_far="",
        scene_type=role,
        scene_index=scene_index,
        total_scenes=total_scenes,
        # Both empty on a rebuild — that is the "generating fresh" state, and it
        # is what stops a stub's placeholder shape being carried forward.
        current_code="" if from_blueprint else current,
        edit_instruction="" if from_blueprint else instruction,
        # Editing runs on its own (cheaper, faster) model line — see
        # get_scene_edit_lm. In kwargs so the repair attempts below inherit it:
        # a repair is part of the same edit and must not silently change model.
        lm=get_scene_edit_lm(),
    )

    code, aspect_ratio, prop_schema = await _generate_single_scene(**kwargs)
    # theme= and collect_all= were both omitted here, so a scene EDITED after
    # generation got weaker checks than a generated one: the symbolic contrast
    # gate needs the theme to resolve palette.<slot> to real hex, and without
    # collect_all a repair fixes one contract and breaks another.
    valid, err = validate_component_code(
        code,
        scene_type=role,
        collect_all=True,
        theme=theme,
        scene_doc=scene_doc_text,
    )

    for retry in range(1, MAX_SCENE_EDIT_RETRIES + 1):
        if valid:
            break
        diagnostic = _format_scene_failure(
            code, err, scene_type=role, scene_doc=scene_doc_text
        )
        print(f"[F7-DEBUG] [SCENE-EDIT] {scene_key} attempt {retry} invalid: {err}")
        code, aspect_ratio, prop_schema = await _generate_single_scene(
            **{
                **kwargs,
                # The scene doc rides along on the repair, so a semantic failure
                # converges on the assigned design rather than on any valid one.
                "scene_doc": (
                    f"{scene_doc_text}\n\n"
                    f"[{'rebuild' if from_blueprint else 'edit'} retry {retry} {time.time_ns()}]"
                ),
                "previous_failure": diagnostic,
                "use_refine": False,
            }
        )
        # RE-VALIDATE INSIDE THE LOOP.
        #
        # This call was dedented to the function body, outside the `for`, so
        # `valid`/`err` were never refreshed between iterations. Two consequences,
        # both observed: `if valid: break` could never fire after the first
        # entry, so every edit burned all MAX_SCENE_EDIT_RETRIES calls even when
        # attempt 1 already produced valid code; and each repair prompt was fed
        # the SAME stale error, so the model got no new information and the
        # retries could not converge.
        #
        # theme= and collect_all= matter here: the symbolic contrast gate needs
        # the theme to resolve palette.<slot> to real hex, and without
        # collect_all a repair fixes one contract while breaking another.
        # scene_doc matters for the same reason: the initial check above passes
        # it, so omitting it here re-judged the repaired scene by a DIFFERENT
        # set of rules — the doc-gated contracts (image mode, content prop,
        # outro CTA) were skipped on the recheck and resurfaced later.
        valid, err = validate_component_code(
            code,
            scene_type=role,
            collect_all=True,
            theme=theme,
            scene_doc=scene_doc_text,
        )

    # Exhausted. The validator's text is a pipeline diagnostic ("palette.text is
    # used as BOTH a background and a text colour") — it tells the user nothing
    # they can act on, and it was being rendered to them verbatim. Log it for
    # support and raise a marked exception the API layer can translate into
    # plain language.
    if not valid:
        print(f"[F7-DEBUG] [SCENE-EDIT] {scene_key} EXHAUSTED after "
              f"{MAX_SCENE_EDIT_RETRIES} attempts — last error: {err}")
        raise SceneEditExhausted(f"edited scene failed validation: {err}")

    wrapped_ok, wrapped_err = validate_wrapped_component_code(code)
    if not wrapped_ok:
        print(f"[F7-DEBUG] [SCENE-EDIT] {scene_key} EXHAUSTED (wrapper) — {wrapped_err}")
        raise SceneEditExhausted(
            f"edited scene conflicts with the render wrapper: {wrapped_err}"
        )

    print(f"[F7-DEBUG] [SCENE-EDIT] {scene_key} edited OK ({code.count(chr(10)) + 1} lines)")

    # Refresh this scene's showcase copy alongside its code.
    #
    # The edit can change what the scene renders — a plain narrative beat asked
    # to "show our three pillars" now needs bullets — so keeping the old sample
    # would leave the preview showing copy the new layout does not lay out.
    # Only THIS scene's entry is regenerated; the siblings are untouched.
    _sample_ctype = "plain" if role in ("intro", "outro") else (
        scene_doc_raw.get("content_type") or "plain"
    )
    sample_content = await asyncio.to_thread(
        _generate_sample_content, brand_context, scene_doc_raw.get("doc") or "", _sample_ctype
    )
    if not sample_content:
        sample_content = _fallback_sample_content(
            getattr(template, "name", "") or "", _sample_ctype, max(0, content_index)
        )
    sample_content["contentType"] = _sample_ctype

    return {
        "scene_key": scene_key,
        "role": role,
        "content_index": content_index,
        "code": code,
        "aspect_ratio": aspect_ratio,
        "prop_schema": prop_schema,
        "sample_content": sample_content,
        # Sized from the copy just written, so a rewrite that lengthens the copy
        # gets type that still fits its block.
        "font_defaults": _compute_scene_font_defaults(sample_content, _sample_ctype),
    }
