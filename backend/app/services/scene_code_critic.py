"""Semantic critique of a generated scene's CODE, before it is rendered.

The pipeline's other gates cover different ground:

  * `code_validator` is deterministic and cheap. It catches broken contracts —
    a missing logo conditional, no animations, a hardcoded font. It cannot ask
    whether the scene BUILT WHAT IT WAS ASKED TO BUILD.
  * `scene_runtime_check` actually RUNS the component. It catches a scene that
    throws, draws nothing, or places a box off the canvas — but it judges the
    element tree, not the design.

This is the semantic one: a single text call against the code and the layout it
was supposed to implement. It catches the defect neither of the others can — a
scene that ignored its design doc and rendered a generic centered card instead.

A vision check that rendered each scene to a PNG and critiqued the PIXELS used
to sit alongside this. It answered the same question more directly and cost a
browser round trip plus a vision call per scene; it shipped dark, was never
enabled, and has been removed. So nothing in the pipeline looks at pixels any
more — whatever this and the runtime check cannot see in code now ships unseen.

That defect matters more than it sounds. The blueprints are measurably
brand-specific — NASA gets a concentric starfield, NVIDIA a dark glass panel
with a masthead, Microsoft a full-bleed white canvas. If the scene generator
quietly flattens all of them into the same composition, every bit of that
divergence is discarded at the very last step, and the templates look alike no
matter how well the design stage did its job.

CONTRACT — this returns None for "no defect found" AND for every failure mode
(flag off, LM error, malformed output, empty output). A quality gate that can
raise is a quality gate that can fail a generation, which is strictly worse than
not running it. Never let an exception out of here.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# A model asked to "review this code" will always find something, and every
# finding costs a full regeneration. So — a closed question set, explicit
# non-defects, PASS default.
_CODE_CRITIQUE_PROMPT = """You are reviewing ONE React component that renders a single 1920x1080 video scene. Your job is to catch a scene that did not build what it was asked to build. Judge only the code you are given.

Work through each check and answer it explicitly before giving a verdict.

1. LAYOUT FIDELITY — The scene was given a specific geometry to implement (below). Did it? Report a defect ONLY when the code builds something structurally different: a centered stack where a side rail was specified, a single column where a split was specified, no masthead where persistent chrome was specified. Different padding, different gap sizes, or a different order of minor elements are NOT defects.
2. TYPOGRAPHY BINDING — The template was designed in a specific pair of typefaces, and they reach the scene as props.headingFont (display/headline type) and props.bodyFont (body copy, labels, captions). Check they are bound to the RIGHT elements. Report a defect when: the headline is set in props.bodyFont, body copy is set in props.headingFont, or ONE prop is used for everything so the pair collapses to a single face. Do NOT report which face the template chose — that is the blueprint's decision, not the scene's.
3. PROP USAGE — props.displayText is the on-screen headline, props.sceneTitle a short label. Report ONLY if a declared prop is never rendered at all, or if props.narrationText (the voiceover script) is painted on screen.
4. STRUCTURE DIRECTIVES — If the direction below asks for a specific structural element (a masthead, a panel number, an editorial rule, a drop cap), report ONLY if it is entirely absent.
5. SURFACE + ATMOSPHERE — The scene builds its own panels and atmosphere with plain divs, inline styles and withAlpha() for tinted fills; there are no pre-built surface or decor components available to it. Report ONLY when a panel is unreadable against the background it sits on. Do NOT report that a panel was hand-rolled, and do NOT ask for cardStyle(), <Decor> or any other pre-built component — a scene that references one FAILS validation.
6. TYPE SCALE BINDING — Supporting text (card body, bullet body, list items, captions, table cells) must scale with the body size, so the editor's body font-size slider moves it. Report a defect when body-tier text is set at a fixed number instead of a fraction of props.descriptionFontSize. Do NOT report which ratio the scene chose, and do NOT report a fixed size on an eyebrow or a display numeral — those are legitimately fixed.
7. CENTRE-OUT COMPOSITION — A row or stack that maps over a variable-length list must be centred in its container (justifyContent: 'center') and let its items size to their content (flex: '0 1 auto', minWidth: 0). Report a defect when such a group is packed to an edge with justifyContent 'flex-start', or when items use `flex: 1` together with a `minWidth` large enough that the full set cannot fit the frame. Do NOT report a deliberately asymmetric layout that the direction below actually asked for.

8. SHARED TYPE BUDGET — A headline and its body copy stacked in one column must sit inside a <FitBlock>, which gives the group ONE shared scale. Each <FitText> only ever fits its own box, so a title and a paragraph can each fit individually while the two of them together overflow the column that holds them — nothing else in the kit can see that. Report a defect when two or more text elements are stacked in the same column with no <FitBlock> around them. Do NOT report text blocks that live in genuinely separate regions of the layout (the two sides of a split, a caption under an image), where independent fitting is correct.
9. VERTICAL RHYTHM — Report a defect when a column uses justifyContent 'space-between' with only two children and no cap on the space between them, which strands a dead band in the middle of the frame while the content at either end stays cramped. A fixed gap, a centred stack, or space-between across three or more evenly weighted rows is CORRECT. Do NOT report a deliberate asymmetry the direction below asked for.

Rules:
- Do NOT comment on code style, naming, formatting, or how the animation is implemented.
- Do NOT suggest refactors, extra components, or performance improvements.
- Do NOT report a missing feature that the direction below never asked for.
- Do NOT second-guess the DESIGN ITSELF — which colour, which typeface, which decor system the template chose is settled, and is not yours to review. Check only that the scene USES what it was given.
- Report a defect ONLY if you can point at the specific line or element and say concretely what to change.

THE LAYOUT THIS SCENE WAS ASKED TO BUILD:
{layout}

ART DIRECTION FOR THIS SCENE:
{direction}

THE CODE:
{code}

Output format — exactly one of:
PASS
or
FAIL
<one line per defect: what is wrong, and the concrete change that fixes it>

Most scenes are fine. Answer PASS unless the scene genuinely built something other than what it was asked for."""

# Below this the code is a stub or a truncation; there is nothing to critique
# and the model will invent something. Mirrors the visual check's own floor.
_MIN_CODE_CHARS = 200
_MAX_CODE_CHARS = 14000


def critique_scene_code(
    code: str,
    *,
    scene_type: str = "content",
    scene_doc: str = "",
    general_doc: str = "",
) -> str | None:
    """Return a critique of what the scene got structurally wrong, or None.

    None means "no defect found" AND every failure mode — see the module
    docstring for why that conflation is deliberate.
    """
    if not code or len(code.strip()) < _MIN_CODE_CHARS:
        return None
    # With no layout to compare against, check 1 — the only one worth paying for
    # — cannot be answered, and the rest are already covered by the validator.
    if not scene_doc.strip() and not general_doc.strip():
        return None

    try:
        import dspy

        from app.dspy_modules import ensure_dspy_configured, get_scene_type_lm

        ensure_dspy_configured()
        prompt = _CODE_CRITIQUE_PROMPT.format(
            layout=scene_doc.strip() or "(none specified)",
            direction=(general_doc or "").strip()[:2000] or "(none specified)",
            code=code.strip()[:_MAX_CODE_CHARS],
        )
        with dspy.context(lm=get_scene_type_lm()):
            raw = dspy.Predict("critique_request -> verdict")(critique_request=prompt).verdict
    except Exception as e:  # noqa: BLE001
        logger.info("[CODE-CRITIC] check unavailable (%s: %s)", type(e).__name__, e)
        return None

    return _parse_verdict(raw, scene_type=scene_type)


def _parse_verdict(raw: str | None, *, scene_type: str) -> str | None:
    """PASS / empty / unparseable -> None. FAIL -> the defect lines."""
    text = (raw or "").strip()
    if not text:
        return None
    head = text.splitlines()[0].strip().upper()
    if head.startswith("PASS"):
        return None
    if not head.startswith("FAIL"):
        # The model ignored the output format. Treating that as a failure would
        # regenerate a scene on the strength of an answer we cannot read.
        return None
    defects = "\n".join(
        line.strip() for line in text.splitlines()[1:] if line.strip()
    ).strip()
    if not defects:
        # "FAIL" with nothing after it says nothing actionable, and a repair
        # prompt with no instruction in it cannot converge.
        return None
    logger.info("[CODE-CRITIC] %s scene FAILED code critique: %s", scene_type, defects[:200])
    return defects
