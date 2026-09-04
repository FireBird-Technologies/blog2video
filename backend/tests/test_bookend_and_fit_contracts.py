"""The bookend (intro/outro) contracts, and the shared-type-budget gate.

Four reported defects on the custom-template flow are covered here:

  1. The intro painted the SAME STRING TWICE — an eyebrow reading "FIREBIRD
     TECHNOLOGIES" above a headline reading "FireBird Technologies". The two
     props carry the same value whenever a scene has no separate display text,
     and nothing told the scene to notice.
  2. NO LOGO anywhere. Every scene was handed `logoUrl: undefined` by the
     render path, so the mandated logo block never had a URL to draw, and the
     template preview had no corner watermark either — so a brand video showed
     no brand mark at all in the editor. Resolved by making the corner
     watermark universal (every scene, every preview surface) rather than by
     letting scenes draw their own: one logo treatment, sized as a fraction of
     the canvas. The contracts here assert scenes are told NOT to compose
     around a logo.
  3. The intro's eyebrow and headline rendered at the SAME SIZE, so the title
     card had no focal element.
  4. Text still overflowed: <FitBlock> was taught in the prompt and gated
     nowhere, so a title and a body could each fit their own box while the pair
     overflowed the column holding them.

(1)-(3) are addressed by a per-role contract appended to the scene doc, which is
what these tests assert. (4) is `_missing_fit_block`.
"""
from __future__ import annotations

import pytest

from app.services.code_generator import _format_scene_doc
from app.services.code_validator import _missing_fit_block


def _scene(role: str, **over) -> dict:
    scene = {
        "id": f"{role}_scene",
        "role": role,
        "doc": "A title card: the mark, then the name, then a rule.",
        "content_type": "plain",
        "supports_image": False,
    }
    scene.update(over)
    return scene


# ─── The intro contract ──────────────────────────────────────────────────────


def test_the_intro_gets_a_role_contract_at_all():
    """The intro was the ONLY role with no contract — the outro had one and
    content scenes get their content-prop block. Its whole specification was the
    design stage's prose, which is why nothing constrained its type hierarchy."""
    doc = _format_scene_doc(_scene("intro"))
    assert "OPENING SCENE" in doc
    assert "TITLE CARD" in doc


def test_the_intro_is_told_the_title_leads_and_the_copy_follows():
    """Defect 3: no size difference between the two text fields.

    Which field leads flipped with the two-tier contract. props.sceneTitle is
    now the video's title and the frame's focal element at `titleSize`;
    props.displayText is a subtitle at `bodySize`. Under the previous contract
    it was the other way round, with the title demoted to a small eyebrow.
    """
    doc = _format_scene_doc(_scene("intro"))
    assert "props.sceneTitle IS THE VIDEO'S TITLE" in doc
    assert "props.displayText IS THE SUBTITLE" in doc
    assert "does not compete with it" in doc
    # An opening is a title card, not a content slide that happens to be first.
    assert "AN OPENING CARRIES NO CONTENT PROPS" in doc


def test_the_intro_carries_the_duplicate_text_guard():
    """Defect 1. The guard must be given as copyable code, not described — the
    other contracts in this file work that way for the same reason."""
    doc = _format_scene_doc(_scene("intro"))
    assert "showSub" in doc
    # PREFIX, not equality. Real titles are the opening clause of the display
    # text, so an equality test passes and the sentence is painted twice.
    assert "startsWith(_n(title))" in doc
    assert "PREFIX, not equality" in doc
    # The TITLE is what survives a collision now — it is the scene's main label.
    assert "THE TITLE IS THE ONE THAT ALWAYS SURVIVES" in doc


def test_the_intro_headline_is_pushed_to_the_top_of_the_band():
    doc = _format_scene_doc(_scene("intro"))
    assert "76-88" in doc and "52-60" in doc


# ─── The logo is a watermark, not a scene element ────────────────────────────


def test_the_intro_is_told_not_to_compose_around_a_logo():
    """Defect 2, resolved the other way round.

    The intro briefly drew its own hero logo. That was replaced by a single
    corner watermark the render path composites over EVERY frame, so no scene
    receives a real props.logoUrl any more. The intro therefore has to be told
    not to spend composition on a mark that will never appear — and to keep the
    corner clear of the one that will.
    """
    doc = _format_scene_doc(_scene("intro"))
    assert "DO NOT compose around a logo" in doc
    assert "corner watermark" in doc
    assert "bottom-right" in doc


@pytest.mark.parametrize("role", ["intro", "outro", "content"])
def test_no_scene_is_told_it_owns_the_logo(role):
    """No role gets a hero-logo contract — there is exactly one logo treatment
    in the video and the scene does not control it."""
    doc = _format_scene_doc(_scene(role, content_type="bullets" if role == "content" else "plain"))
    assert "OWNS THE LOGO" not in doc
    assert "BOOKEND SCENE" not in doc


def test_a_content_scene_gets_no_title_card_contract():
    doc = _format_scene_doc(_scene("content", content_type="bullets"))
    assert "TITLE CARD" not in doc


def test_the_outro_keeps_its_cta_contract():
    """The bookend and intro blocks are ADDED alongside the existing outro
    contract, never in place of it."""
    doc = _format_scene_doc(_scene("outro"))
    assert "CLOSING SCENE" in doc
    assert "SocialIcons" in doc
    assert "props.ctaProps?.ctas" in doc


def test_the_outro_also_guards_the_duplicate_text():
    """The outro preview feeds sceneTitle and displayText the same brand name
    too, so it needs the same guard the intro has."""
    doc = _format_scene_doc(_scene("outro"))
    assert "showSub" in doc


# ─── The shared type budget (FitBlock) ───────────────────────────────────────


_TWO_FITS = (
    "<FitText fontSize={titleSize} containerWidth={w}>{props.displayText}</FitText>"
    "<FitText fontSize={bodySize} containerWidth={w}>{props.sceneTitle}</FitText>"
)


def test_two_stacked_fittexts_without_a_fitblock_are_flagged():
    """Each fits its own box; only FitBlock can see the pair overflow together."""
    assert _missing_fit_block(f"const S = () => <div>{_TWO_FITS}</div>;") is True


def test_wrapping_them_in_a_fitblock_clears_it():
    code = f"const S = () => <div><FitBlock>{_TWO_FITS}</FitBlock></div>;"
    assert _missing_fit_block(code) is False


def test_a_lone_fittext_is_not_flagged():
    """A single headline has nothing to share a budget WITH — FitText fitting
    its own box is exactly right there."""
    code = (
        "const S = () => <div><FitText fontSize={titleSize} containerWidth={w}>"
        "{props.displayText}</FitText></div>;"
    )
    assert _missing_fit_block(code) is False


def test_a_fitblock_written_in_a_comment_does_not_count():
    """Mirrors the comment-stripping the other fit gates do: a line like
    `// wrap this in <FitBlock>` is documentation, not an element."""
    code = f"const S = () => <div>{{/* TODO: <FitBlock> */}}{_TWO_FITS}</div>;"
    assert _missing_fit_block(code) is True


def test_scenes_with_no_fittext_at_all_are_not_flagged():
    assert _missing_fit_block("const S = () => <div>static</div>;") is False
