"""Contrast: the maths, the palette it implies, and the gate that enforces it.

Unreadable text is the one defect a viewer cannot work around, and it shipped
for a long time because every layer was permissive:

  * `derivePalette` defined `muted` as a flat 50/50 blend of bg and text, whose
    contrast is roughly the square root of the brand's own bg/text ratio — so it
    degraded fastest on exactly the brands that could least afford it (measured
    1.75:1 on a red brand). `muted` is BODY TEXT, not decoration.
  * `readableOn` thresholded Rec-601 luminance at 0.45 instead of measuring, and
    picked the wrong pole on mid-tone saturated hues.
  * Nothing enforced any of it: the only check was a -0.25 scoring nudge that
    was skipped entirely on the final refine attempt.

These tests pin the Python half — the contrast maths and the gate. The TS half
(`kit/theme.ts`) mirrors the same formulas; `test_kit_contrast_math_matches`
guards the two from drifting apart, since a validator that judges by different
maths than the renderer would reject scenes that actually look fine.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.code_generator import (
    AA_CONTRAST,
    _detect_contrast_defects,
    _theme_from_brand_context,
    contrast_ratio,
    detect_offpalette_colors,
)
from app.services.code_validator import validate_component_code

# A brand whose derived `muted` is unreadable: bg #F40009 + text #FFFFFF gives a
# 50/50 blend of #FA8084, which sits at 1.75:1 against its own background.
RED_BRAND = {"colors": {"bg": "#F40009", "text": "#FFFFFF", "accent": "#F40009"}}
# A brand with plenty of headroom — the same code must NOT be flagged here.
DARK_BRAND = {"colors": {"bg": "#0A0A0A", "text": "#EDEDED", "accent": "#76B900"}}


# ── the maths ────────────────────────────────────────────────────────────────


def test_contrast_ratio_matches_wcag_reference_values() -> None:
    """Known pairs from the WCAG definition, to catch a broken formula."""
    assert contrast_ratio("#FFFFFF", "#000000") == pytest.approx(21.0, abs=0.01)
    assert contrast_ratio("#000000", "#000000") == pytest.approx(1.0, abs=0.01)
    # Order must not matter.
    assert contrast_ratio("#FFFFFF", "#777777") == pytest.approx(
        contrast_ratio("#777777", "#FFFFFF")
    )


def test_contrast_ratio_returns_none_for_unresolvable_colours() -> None:
    """Anything not a plain hex is skipped rather than guessed at — that is what
    keeps the gate from failing scenes it cannot actually judge."""
    assert contrast_ratio("var(--brand)", "#000000") is None
    assert contrast_ratio("rgba(0,0,0,0.5)", "#000000") is None
    assert contrast_ratio("", "#000000") is None


def test_a_luminance_delta_is_not_a_contrast_ratio() -> None:
    """Pins the specific heuristic that was replaced.

    The old gate passed a pair when `abs(luminance delta) >= 0.25`. #FFFFFF on
    #B4B4B4 has a Rec-601 delta of ~0.29 — so it passed — while its real
    contrast is ~2.1:1, less than half of what AA requires.
    """
    from app.services.code_generator import _hex_luminance

    delta = abs(_hex_luminance("#FFFFFF") - _hex_luminance("#B4B4B4"))
    assert delta >= 0.25, "this pair must be one the OLD heuristic let through"

    ratio = contrast_ratio("#FFFFFF", "#B4B4B4")
    assert ratio is not None
    assert ratio < AA_CONTRAST / 2


# ── the gate ─────────────────────────────────────────────────────────────────


def test_muted_body_text_is_flagged_on_a_low_contrast_brand() -> None:
    """The failure that actually shipped: symbolic, not hardcoded hex.

    Real scenes write `color: palette.muted`, never a literal, so a detector
    that only understood literal hex pairs saw nothing at all.
    """
    code = "const S = () => <div style={{ color: palette.muted }}>hi</div>;"
    hits = _detect_contrast_defects(code, RED_BRAND)
    assert hits, "muted-on-bg at 1.7:1 must be reported"
    assert "palette.muted" in hits[0]


def test_the_same_code_is_clean_on_a_high_contrast_brand() -> None:
    """The gate judges the BRAND, not the code — otherwise it would ban a
    perfectly good pattern outright."""
    code = "const S = () => <div style={{ color: palette.muted }}>hi</div>;"
    assert _detect_contrast_defects(code, DARK_BRAND) == []


def test_text_used_as_both_background_and_foreground_is_flagged() -> None:
    code = (
        "<div style={{ background: palette.text }}>"
        "<p style={{ color: palette.text }}>x</p></div>"
    )
    assert _detect_contrast_defects(code, RED_BRAND)


def test_literal_hex_pairs_are_judged_by_ratio() -> None:
    assert _detect_contrast_defects(
        "<div style={{ background: '#222222', color: '#252525' }}>x</div>", None
    )
    assert (
        _detect_contrast_defects(
            "<div style={{ background: '#000000', color: '#FFFFFF' }}>x</div>", None
        )
        == []
    )


@pytest.mark.parametrize(
    "code",
    [
        # A gradient has no single resolvable background.
        "<div style={{ background: 'linear-gradient(#000,#fff)', color: palette.muted }}>x</div>",
        # An alpha blend depends on whatever is behind it.
        "<div style={{ background: withAlpha(palette.text, 0.5), color: palette.text }}>x</div>",
        # A CSS variable is opaque to static analysis.
        "<div style={{ background: 'var(--x)', color: 'var(--y)' }}>x</div>",
    ],
)
def test_unresolvable_backgrounds_are_skipped_not_guessed(code: str) -> None:
    """A false positive costs a full LLM rollout, so anything that cannot be
    resolved to two concrete colours must pass rather than be assumed bad."""
    assert _detect_contrast_defects(code, DARK_BRAND) == []


def test_no_theme_means_symbolic_pairs_are_skipped() -> None:
    """Callers without a theme still get the literal check, and nothing more."""
    code = "const S = () => <div style={{ color: palette.muted }}>hi</div>;"
    assert _detect_contrast_defects(code, None) == []


# ── the brand-context bridge ─────────────────────────────────────────────────


def test_theme_is_recovered_from_the_brand_context_string() -> None:
    """The scene pipeline threads `brand_context` everywhere but not `theme`, so
    the gate reads the palette back out of it. Note the key rename that
    `_build_brand_context` performs: `background`, not `bg`."""
    ctx = (
        'Brand: Acme\n'
        'Colors: {"primary": "#F40009", "accent": "#F40009", '
        '"background": "#F40009", "text": "#FFFFFF"}\n'
        'Fonts: Heading: Inter\n'
    )
    assert _theme_from_brand_context(ctx) == {
        "colors": {"bg": "#F40009", "text": "#FFFFFF", "accent": "#F40009"}
    }


@pytest.mark.parametrize("ctx", ["", "Brand: Acme\n", "Colors: not json\n"])
def test_a_missing_or_broken_colours_line_yields_no_theme(ctx: str) -> None:
    """Degrades to "skip the symbolic check", never to an exception."""
    assert _theme_from_brand_context(ctx) == {}


# ── the validator wiring ─────────────────────────────────────────────────────


def _scene(body: str) -> str:
    """Minimal scene that clears the OTHER hard gates, so a failure is
    attributable to contrast alone."""
    return f"""
const SceneComponent = (props) => {{
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 20], [0, 1], {{ extrapolateRight: 'clamp' }});
  const y = interpolate(frame, [0, 20], [20, 0], {{ extrapolateRight: 'clamp' }});
  return (
    <AbsoluteFill style={{{{ overflow: 'hidden', fontFamily: props.headingFont }}}}>
      {{props.logoUrl && <Img src={{props.logoUrl}} />}}
      {{props.imageUrl && <Img src={{props.imageUrl}} data-content-img />}}
      <FitText fontSize={{props.titleFontSize ?? 68}} maxLines={{2}} containerWidth={{800}} maxHeight={{300}}>{{props.sceneTitle}}</FitText>
      <FitText fontSize={{props.descriptionFontSize ?? 34}} maxLines={{4}} containerWidth={{800}} maxHeight={{300}} style={{{{fontFamily: props.bodyFont}}}}>{{props.displayText}}</FitText>
      {body}
    </AbsoluteFill>
  );
}};
"""


def test_validator_rejects_unreadable_text_when_given_a_theme() -> None:
    """The gate is HARD now. It used to be a -0.25 score nudge that the final
    refine attempt skipped entirely, so a 1.7:1 scene shipped."""
    valid, err = validate_component_code(
        _scene("<p style={{ color: palette.muted }}>body</p>"),
        scene_type="content",
        collect_all=True,
        theme=RED_BRAND,
    )
    assert not valid
    assert err and "Unreadable text" in err


def test_validator_accepts_the_same_scene_on_a_readable_brand() -> None:
    valid, err = validate_component_code(
        _scene("<p style={{ color: palette.muted }}>body</p>"),
        scene_type="content",
        collect_all=True,
        theme=DARK_BRAND,
    )
    assert valid, err


def test_validator_without_a_theme_does_not_gate_on_symbolic_pairs() -> None:
    """Back-compat: every existing caller omits `theme` and must be unaffected."""
    valid, err = validate_component_code(
        _scene("<p style={{ color: palette.muted }}>body</p>"),
        scene_type="content",
        collect_all=True,
    )
    assert valid, err


# ── TS/Python parity ─────────────────────────────────────────────────────────


def test_kit_contrast_math_matches() -> None:
    """`kit/theme.ts` must use the same WCAG constants this module does.

    The gate and the renderer have to agree on what "readable" means. If the TS
    drifted to different coefficients or a different AA threshold, the validator
    would start rejecting scenes that render fine (or passing ones that do not).
    """
    theme_ts = (
        Path(__file__).resolve().parents[2]
        / "remotion-video/src/templates/generated/kit/theme.ts"
    )
    if not theme_ts.exists():  # backend checked out without the render tree
        pytest.skip(f"kit/theme.ts not present at {theme_ts}")
    src = theme_ts.read_text()

    assert "0.2126" in src and "0.7152" in src and "0.0722" in src, (
        "kit/theme.ts is not using WCAG relative-luminance coefficients"
    )
    assert "0.03928" in src and "1.055" in src, (
        "kit/theme.ts is missing the sRGB linearization step"
    )
    m = re.search(r"AA_CONTRAST\s*=\s*([\d.]+)", src)
    assert m, "kit/theme.ts does not define AA_CONTRAST"
    assert float(m.group(1)) == AA_CONTRAST

    # muted must be contrast-corrected, not a flat 50/50 blend.
    assert "ensureContrast(" in src, "kit/theme.ts no longer clamps derived colours"
    assert re.search(r"const\s+muted\s*=\s*ensureContrast\(", src), (
        "muted is not going through ensureContrast — it is body text, and a raw "
        "50/50 blend is unreadable on low-contrast brands"
    )


# ── kit structural variants ──────────────────────────────────────────────────


def _fnv1a(s: str) -> int:
    """Mirror of kit/variants.ts `hashString` (FNV-1a, 32-bit)."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) & 0xFFFFFFFF
    return h


def test_variant_seed_is_built_from_the_template_id_not_its_name() -> None:
    """Preview and render must land on the SAME arrangement.

    remotion.py writes `kitVariantSeed`; VideoPreview.tsx recomputes it. The
    preview has the template ID but not its name, so both sides seed from
    category|style|template_id. Seeding from the name would silently give the
    preview a different structure than the video.
    """
    src = (
        Path(__file__).resolve().parents[1] / "app/services/remotion.py"
    ).read_text()
    block = src[src.index('data["kitVariantSeed"]') : src.index('data["kitVariantSeed"]') + 400]
    assert "template_id" in block, "the seed must use the template id"
    assert "get(\"name\")" not in block, (
        "seeding from the template NAME diverges from the preview, which only "
        "has the id"
    )


def test_variant_hash_distributes_across_every_arrangement() -> None:
    """A hash that clumps would defeat the point — brands must actually spread.

    Mirrors kit/variants.ts's derivation (independent slices of one hash) so a
    change to the divisors that collapsed the distribution fails here.
    """
    stats = ["row", "stacked-rule", "ledger", "hero-rail", "quadrant", "ticker"]
    brands = [
        "NVIDIA", "Coca-Cola", "Dawn", "Stripe", "Airbnb", "Notion", "Figma",
        "Linear", "Vercel", "Shopify", "Netflix", "Spotify", "Duolingo",
        "Monzo", "Revolut", "Patagonia", "IKEA", "Tesla", "OpenAI", "Anthropic",
    ]
    picked = {stats[(_fnv1a(f"blog|editorial|{b}") // 1) % len(stats)] for b in brands}
    assert len(picked) >= 4, (
        f"only {len(picked)} of {len(stats)} stat arrangements used across "
        f"{len(brands)} brands — the seed is clumping"
    )


def test_variant_pick_is_stable_for_a_given_seed() -> None:
    """Regenerating a template must not reshuffle its structure."""
    assert _fnv1a("blog|editorial|custom_155") == _fnv1a("blog|editorial|custom_155")
    assert _fnv1a("blog|editorial|custom_155") != _fnv1a("blog|editorial|custom_156")


# ── full-bleed image slot ────────────────────────────────────────────────────


def test_a_fullbleed_slot_rendered_after_the_content_is_rejected() -> None:
    """Observed on a real Coca-Cola intro: the scene rendered as a bare photo.

    The data-content-img slot was position:'absolute' at 100%x100% with
    objectFit:'cover', written AFTER the content and carrying the only zIndex in
    the file. Two siblings with no zIndex paint in DOM order, so the image
    covered every layout element.
    """
    code = _scene(
        "<div data-content-img=\"1\" style={{ position: 'absolute', width: '100%', "
        "height: '100%', top: 0, left: 0, zIndex: 0 }}>"
        "<Img src={props.imageUrl} style={{ objectFit: 'cover' }} /></div>"
    )
    valid, err = validate_component_code(code, scene_type="intro", collect_all=True)
    assert not valid
    assert err and "full-bleed" in err


def test_a_bounded_slot_is_accepted() -> None:
    """The normal shape — a column/card/panel — must never be flagged."""
    code = _scene(
        "<div data-content-img=\"1\" style={{ width: '42%', height: '70%', "
        "position: 'relative', overflow: 'hidden' }}>"
        "<Img src={props.imageUrl} style={{ objectFit: 'cover' }} /></div>"
    )
    valid, err = validate_component_code(code, scene_type="intro", collect_all=True)
    assert valid, err


def test_a_fullbleed_backdrop_rendered_first_is_accepted() -> None:
    """A deliberate backdrop is a legitimate design and is what the prompt asks
    for — it is only a defect when it paints OVER the content."""
    code = """
const SceneComponent = (props) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 20], [20, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', fontFamily: props.headingFont }}>
      <div data-content-img="1" style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 0 }}>
        {props.imageUrl && <Img src={props.imageUrl} style={{ objectFit: 'cover' }} />}
      </div>
      {props.logoUrl && <Img src={props.logoUrl} />}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <FitText fontSize={props.titleFontSize ?? 68} maxLines={2} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>
        <FitText fontSize={props.descriptionFontSize ?? 34} maxLines={4} containerWidth={800} maxHeight={300} style={{fontFamily: props.bodyFont}}>{props.displayText}</FitText>
      </div>
    </AbsoluteFill>
  );
};
"""
    valid, err = validate_component_code(code, scene_type="intro", collect_all=True)
    assert valid, err


# ── scene order is 1-based ───────────────────────────────────────────────────


def test_scene_order_is_one_based_in_the_pipeline() -> None:
    """Pins the convention the frontend's positional layout fallback depends on.

    `customSceneLayoutId` takes a ZERO-based index and matches the intro with
    `sceneIndex === 0`. SceneEditModal feeds it `scene.order`, which the pipeline
    creates as `order=i + 1` — so it must subtract one. Passing it raw made every
    intro miss the rule and resolve to a placeholder layout name.
    """
    src = (
        Path(__file__).resolve().parents[1] / "app/routers/pipeline.py"
    ).read_text()
    assert "order=i + 1" in src, (
        "scene order is no longer 1-based; SceneEditModal's `scene.order - 1` "
        "conversion must be revisited"
    )


# ── the panel/canvas confusion ───────────────────────────────────────────────


def test_a_correctly_derived_accent_panel_is_not_flagged() -> None:
    """The gate must not fail a scene that has nothing wrong with it.

    Observed on template 159, scene 7 (comparison_split): the scene painted an
    accent panel and correctly coloured its text `readableOn(palette.accent)`,
    while ordinary body copy sat on the canvas as `palette.text`. The detector
    paired EVERY foreground in the file against EVERY background in the file —
    it has no notion of which element sits on which — and reported
    "palette.text on palette.accent is 2.3:1".

    Because the scene was already correct, all three repair attempts failed and
    the scene was lost. A false positive here is more expensive than a miss.
    """
    brand = {"colors": {"bg": "#FAF8F5", "text": "#1A1A1A", "accent": "#A6192E"}}
    code = """
const SceneComponent = (props) => {
  const palette = React.useMemo(() => {
    const c = props.brandColors || {};
    return { bg: c.background, text: c.text, accent: c.accent };
  }, [props.brandColors]);
  const onAccent = readableOn(palette.accent);
  return (
    <AbsoluteFill style={{overflow:'hidden', background: palette.bg}}>
      <div style={{background: palette.accent, width:'48%'}}>
        <span style={{color: onAccent}}>{props.comparisonLeft.label}</span>
      </div>
      <p style={{color: palette.text}}>{props.comparisonLeft.description}</p>
    </AbsoluteFill>);
};
"""
    assert _detect_contrast_defects(code, brand) == []


def test_text_on_a_non_canvas_root_is_not_judged_against_the_canvas() -> None:
    """A scene that deliberately paints its root something else is not sitting
    on palette.bg, so pairing its text against palette.bg would be wrong."""
    brand = {"colors": {"bg": "#FAF8F5", "text": "#1A1A1A", "accent": "#A6192E"}}
    code = (
        "const S = (p) => { return <AbsoluteFill style={{overflow:'hidden', "
        "background: palette.accent}}><p style={{color: palette.muted}}>x</p>"
        "</AbsoluteFill>; };"
    )
    assert _detect_contrast_defects(code, brand) == []


def test_low_contrast_text_on_the_canvas_is_still_caught() -> None:
    """Narrowing the check must not disarm it — this is the real defect.

    Uses palette.accent, not palette.muted. `muted` is contrast-CORRECTED by the
    kit (walked toward `text` until it clears AA), so flagging it was a false
    positive: the gate modelled the raw 50/50 blend while the kit rendered a
    readable colour, and scenes using the slot exactly as the prompt documents
    were stubbed after three repairs. The raw accent gets no such correction —
    that is what must still be caught.
    """
    brand = {"colors": {"bg": "#FAF8F5", "text": "#1A1A1A", "accent": "#F5D5DA"}}
    code = (
        "const S = (p) => { return <AbsoluteFill style={{overflow:'hidden', "
        "background: palette.bg}}><p style={{color: palette.accent}}>x</p>"
        "</AbsoluteFill>; };"
    )
    hits = _detect_contrast_defects(code, brand)
    assert hits and "palette.accent" in hits[0]


def test_palette_muted_is_usable_as_secondary_text() -> None:
    """The prompt documents muted as "secondary copy, labels, eyebrows.
    Contrast-corrected." The gate must agree, or the model is told to use a slot
    it will then be rejected for using — which stubbed two scenes on a real run.
    """
    from app.services.code_generator import AA_CONTRAST, _palette_slots, contrast_ratio

    for bg, text in (("#F4F8FB", "#111827"), ("#FAF8F5", "#1A1A1A"), ("#0B0B0F", "#FFFFFF")):
        brand = {"colors": {"bg": bg, "text": text, "accent": "#00EB79"}}
        muted = _palette_slots(brand)["muted"]
        assert (contrast_ratio(muted, bg) or 0) >= AA_CONTRAST, (bg, muted)

        code = (
            "const S = (p) => { return <AbsoluteFill style={{overflow:'hidden', "
            "background: palette.bg}}><p style={{color: palette.muted}}>x</p>"
            "</AbsoluteFill>; };"
        )
        assert _detect_contrast_defects(code, brand) == [], bg


# ── the two holes that shipped white-on-cream and an indigo rule ─────────────

_CREAM = {"colors": {"bg": "#FAF3E3", "text": "#0A0A0A", "accent": "#B3121B",
                     "surface": "#F5EFE0", "primary": "#B3121B"}}


def test_an_unpaired_literal_foreground_is_judged_against_the_canvas() -> None:
    """The literal pass required a background in the SAME style object, so a bare
    `color: '#FFFFFF'` was never measured — which is exactly how white body copy
    shipped onto a cream canvas, invisible."""
    hits = _detect_contrast_defects(
        "<p style={{ color: '#FFFFFF', fontSize: 42 }}>Manual processes</p>", _CREAM
    )
    assert hits and "#FFFFFF" in hits[0]


def test_readable_literal_text_on_the_canvas_passes() -> None:
    assert _detect_contrast_defects("<p style={{ color: '#0A0A0A' }}>x</p>", _CREAM) == []


def test_an_offpalette_hue_is_rejected_even_though_it_reads() -> None:
    """Indigo on cream passes contrast comfortably and is still wrong: it is not
    a brand colour. Contrast can only ask 'can I read this', never 'does this
    belong here', which is why this is a separate check."""
    assert contrast_ratio("#6366F1", "#FAF3E3") > 3.0      # legible...
    hits = detect_offpalette_colors("<div style={{ background: '#6366F1' }} />", _CREAM)
    assert hits and "#6366F1" in hits[0]


def test_brand_colours_and_greys_are_allowed() -> None:
    """Greys are scrims, hairlines and shadows — they carry no competing hue.
    Flagging them would fail correct code everywhere."""
    for code in (
        "<div style={{ background: '#B3121B' }} />",   # the brand accent
        "<div style={{ background: '#faf3e3' }} />",   # brand bg, lowercased
        "<div style={{ background: '#E2E2E2' }} />",   # a grey hairline
        "<div style={{ background: '#0A0A0A' }} />",   # brand text
    ):
        assert detect_offpalette_colors(code, _CREAM) == [], code


def test_a_hex_in_FALLBACK_position_is_not_a_drawn_colour() -> None:
    """`props.brandColors?.text || '#1a1a2e'` renders the BRAND hue whenever one
    exists — the literal is the no-data default. Flagging these failed 5 of the 9
    scaffold scenes and would burn repair attempts on nothing.

    The exemption is bounded by LIGHTNESS (see the next test): a near-black or
    near-white reads as a default; a saturated mid-tone does not."""
    assert detect_offpalette_colors(
        "<div style={{ color: props.brandColors?.text || '#1a1a2e' }} />", _CREAM
    ) == []
    assert detect_offpalette_colors(
        "<div style={{ background: p.bg ?? '#FFFFFF' }} />", _CREAM
    ) == []


def test_a_SATURATED_hex_in_fallback_position_is_still_rejected() -> None:
    """The exemption used to be total, so `|| '#7C3AED'` passed — which is
    exactly how the app's own purple travelled into a Careem template. A
    mid-tone brand colour is a design choice, not a no-data default."""
    for code in (
        "<div style={{ background: props.brandColors?.accent || '#7C3AED' }} />",
        "<div style={{ background: p.accent ?? '#6366F1' }} />",
    ):
        assert detect_offpalette_colors(code, _CREAM), code


def test_offpalette_check_is_inert_without_a_theme() -> None:
    """No theme means no way to know what is on-brand; guessing would be worse
    than skipping."""
    assert detect_offpalette_colors("<div style={{ background: '#6366F1' }} />", None) == []


# ── translucent panels: the invisible-text defect ────────────────────────────


def test_a_translucent_panel_composites_rather_than_reading_as_opaque() -> None:
    """`enforceTheme` read a card's background as opaque, discarding alpha.

    A card painted rgba(255,255,255,0.04) — a 4% white wash over a #0B0B0B
    canvas — was reported as solid WHITE. The corrector then concluded the
    card's white text could not be read and rewrote it to near-black, onto a
    card that is in fact almost black. Two of one template's six scenes rendered
    invisible.

    The TypeScript is the implementation; this pins the maths it must follow, so
    a future edit that drops the compositing has something to fail against.
    """
    from app.services.code_generator import AA_CONTRAST, contrast_ratio

    def composite(fg: tuple[int, int, int], bg: tuple[int, int, int], a: float) -> str:
        return "#%02X%02X%02X" % tuple(
            round(f * a + b * (1 - a)) for f, b in zip(fg, bg)
        )

    canvas = (0x0B, 0x0B, 0x0B)
    card = composite((255, 255, 255), canvas, 0.04)

    # Read as opaque white, white text looks unreadable — the bug.
    assert (contrast_ratio("#FFFFFF", "#FFFFFF") or 0) < AA_CONTRAST
    # Composited correctly, it is plainly readable and must be left alone.
    assert (contrast_ratio("#FFFFFF", card) or 0) >= AA_CONTRAST
    # And the composite really is near-black, not near-white.
    assert int(card[1:3], 16) < 0x30, card


def test_the_kit_and_the_gate_agree_on_a_dark_brand_panel() -> None:
    """The NVIDIA case end to end: white text on the derived panel of a black
    canvas must read, so nothing downstream has cause to 'correct' it."""
    from app.services.code_generator import AA_CONTRAST, _palette_slots, contrast_ratio

    theme = {"colors": {"bg": "#0B0B0B", "text": "#FFFFFF", "accent": "#76B900"}}
    slots = _palette_slots(theme)
    assert (contrast_ratio("#FFFFFF", slots["bg"]) or 0) >= AA_CONTRAST
    assert (contrast_ratio(slots["text"], slots["bg"]) or 0) >= AA_CONTRAST
