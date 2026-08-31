"""Two brands must not get the same template.

Covers the two independent ways that could break, which were BOTH live at once:

  1. The blueprint diverges per brand but the scene generator ignores it,
     because the house style sat in the GenerateSceneCode docstring (above the
     blueprint input, in MANDATORY language with copy-pasteable numbers) and
     therefore outranked it. Guarded by the art-direction tests.
  2. The scene generator honours the blueprint faithfully but every blueprint is
     the same, because a high temperature varies WORDING and not DESIGN — an LLM
     asked to design a video template returns to one prior. Guarded by the
     divergence tests.
"""
from __future__ import annotations

from app.dspy_modules.blueprint import (
    HOUSE_STYLE_REJECT_AT,
    _brand_constraint,
    _house_style_score,
    blueprint_fingerprint,
    enforce_brand_constraints,
    validate_blueprint,
)
from app.services.code_generator import GenerateSceneCode, build_art_direction


def _generic_blueprint(name: str) -> dict:
    """The design GLM 5.2 actually returned, twice, for template 132.

    Reconstructed from the logged fingerprint:
      edge=inset|chrome=False|num=False|band=mid|decor=rules|surface=panel
      |img=4/6|open=logo_settle|close=recap_card|arc=measured>quiet
    """
    return {
        "identity": {
            "name": name,
            "decor_system": "rules",
            "surface_default": "panel",
            "artifact_set": ["drift"],
        },
        "structure": {
            "edge_policy": "inset",
            "chrome": {"enabled": False},
            "panel_numbering": {"enabled": False},
            "safe_area": {
                "landscape": {"top": 7, "right": 7, "bottom": 7, "left": 7},
                "portrait": {"top": 7, "right": 7, "bottom": 7, "left": 7},
            },
        },
        "type_system": {},
        "bookends": {
            "intro": {"opening_move": "logo_settle", "energy": "measured"},
            "outro": {"closing_move": "recap_card", "energy": "quiet"},
        },
        "layouts": [
            {
                "id": "intro",
                "role": "intro",
                "geometry": "A centred brand lockup with the mark above the headline and generous space on every side.",
                "geometry_portrait": "The same lockup stacked tighter for the narrow frame.",
                "supports_image": True,
                "image_treatment": "full_bleed",
                "surface": "panel",
                "artifact": "drift",
            }
        ]
        + [
            {
                "id": f"c{i}",
                "role": "content",
                "geometry": f"Body copy fills a wide left column with a supporting visual to the right, variant {i} of the grid.",
                "geometry_portrait": "Stacked vertically, visual above copy beneath.",
                "best_for": ["plain"],
                "supports_image": i < 4,
                "image_treatment": "split" if i < 4 else "none",
                "surface": "panel",
                "artifact": "drift",
            }
            for i in range(6)
        ]
        + [
            {
                "id": "outro",
                "role": "outro",
                "geometry": "A calm recap with the brand mark low in the frame leaving room for the CTA overlay.",
                "geometry_portrait": "Recap centred and stacked below the CTA area.",
                "supports_image": False,
                "image_treatment": "none",
                "surface": "panel",
                "artifact": "drift",
            }
        ],
    }


def _enforced(seed: str) -> dict:
    bp, _ = validate_blueprint(_generic_blueprint(seed.split("|")[-1]), seed=seed)
    enforce_brand_constraints(bp, seed)
    bp, _ = validate_blueprint(bp, seed=seed)
    return bp

# The design an LLM returns when it does NOT design for the brand: the generic
# prior that made every custom template look alike.
GENERIC = {
    "identity": {"decor_system": "rules", "surface_default": "panel"},
    "structure": {
        "edge_policy": "inset",
        "chrome": {"enabled": False},
        "panel_numbering": {"enabled": False},
        "safe_area": {"landscape": {"top": 6, "right": 8, "bottom": 6, "left": 8}},
    },
    "bookends": {
        "intro": {"energy": "loud", "opening_move": "logo_settle"},
        "outro": {"energy": "quiet", "closing_move": "recap_card"},
    },
    "layouts": [
        {"role": "content", "supports_image": True, "image_treatment": "split", "surface": "panel"}
        for _ in range(6)
    ],
}

DISTINCT = {
    "identity": {"decor_system": "halftone", "surface_default": "cutout"},
    "structure": {
        "edge_policy": "edge_to_edge",
        "chrome": {"enabled": True},
        "panel_numbering": {"enabled": True},
        "safe_area": {
            "landscape": {"top": 3, "right": 3, "bottom": 3, "left": 3},
            "portrait": {"top": 4, "right": 3, "bottom": 4, "left": 3},
        },
    },
    "type_system": {
        "heading_case": "upper",
        "heading_tracking_em": 0.08,
        "label_case": "upper",
        "label_tracking_em": 0.2,
        "base_body_px_landscape": 44,
        "base_body_px_portrait": 40,
        "scale_ratio": 1.6,
        "numeral_style": "tabular",
    },
    "bookends": {
        "intro": {
            "energy": "quiet",
            "opening_move": "cold_open_statement",
            "logo_treatment": "none",
            "title_reveal": "mask_up",
        },
        "outro": {"energy": "loud", "closing_move": "full_bleed_sign_off", "echoes_intro": False},
    },
    "layouts": [
        {
            "id": f"l{i}",
            "role": "content",
            "geometry": (
                "Full-bleed accent field with the headline set flush to the left edge and "
                "the supporting copy running off-frame right."
            ),
            "geometry_portrait": "Headline stacked flush left with an image band bleeding to both edges.",
            "supports_image": i % 2 == 0,
            "image_treatment": "full_bleed" if i % 2 == 0 else "none",
            "surface": "cutout" if i < 3 else "tape",
            "artifact": "slam",
            "artifact_intensity": 0.8,
            "motion_beat": "One hard slam on the headline.",
        }
        for i in range(6)
    ],
}


# ─── The blueprint must actually reach the scene generator ───────────────────


def test_art_direction_is_a_scene_input_field() -> None:
    """The composition rules must arrive as an input, not sit in the docstring.

    This is the whole fix for failure mode 1: as a docstring the house style
    outranked the blueprint, because a concrete instruction in the system prompt
    beats an abstract "the blueprint overrides this" on an input field.
    """
    assert "art_direction" in GenerateSceneCode.input_fields


def test_docstring_no_longer_dictates_composition() -> None:
    """The generic house style must be gone from the shared prompt."""
    doc = GenerateSceneCode.__doc__ or ""
    # The v1 mandates that overrode every blueprint.
    assert "~6-8%" not in doc
    assert "STRONGLY PREFER the <IntroStage>" not in doc
    assert "a calm closing recap" not in doc
    # The five fixed compositions must not be offered as a menu.
    for comp in ("centered focal", "asymmetric split", "offset card stack", "side rail"):
        assert f'"{comp}"' not in doc, f"{comp!r} still listed as a composition option"


def test_logo_contract_is_not_scoped_to_the_intro() -> None:
    """The logo conditional applies to EVERY scene, and the prompt must say so.

    Regression: splitting the house style out of the docstring left a new
    "Scene-type technical contracts" section whose first bullet mentioned the
    logo conditional under `INTRO (scene_type == "intro")`. That re-scoped an
    all-scenes render-safety rule to one scene type, and the model followed the
    narrower framing — every content and outro scene came back without the
    conditional and was rejected by validate_component_code(), burning all three
    Refine attempts per scene.
    """
    doc = GenerateSceneCode.__doc__ or ""
    contracts = doc.split("Scene-type technical contracts")[1]
    intro_bullet = contracts.split('- INTRO (scene_type == "intro")')[1]
    # The logo rule must be stated for every scene, ahead of the INTRO bullet.
    preamble = contracts.split('- INTRO (scene_type == "intro")')[0]
    assert "logoUrl" in preamble, "logo contract is not stated for all scenes"
    assert "EVERY SCENE" in preamble
    # And must NOT be presented as an intro-only concern.
    assert "logoUrl" not in intro_bullet.split("- OUTRO")[0], (
        "logo conditional is scoped under the INTRO bullet — it applies to every scene"
    )


def test_repair_prompt_restates_every_contract() -> None:
    """A repair must not fix one contract by breaking another.

    validate_component_code() returns on its FIRST failure, so the repair prompt
    names one broken rule and says nothing about the rest. Observed: a scene told
    "missing logoUrl" returned with the logo and zero animations; told
    "insufficient animations" it returned animated and without the logo — two
    contracts ping-ponging across three repair attempts while the scene shrank
    from 279 to 154 lines, never converging.
    """
    from app.services.code_generator import _format_scene_failure

    out = _format_scene_failure(
        "const SceneComponent = (props) => { return <div/>; };",
        "Missing conditional logoUrl rendering",
    )
    # The reported error, plus every OTHER contract it must not sacrifice.
    assert "logoUrl" in out
    for contract in ("LOGO", "IMAGE", "ANIMATION", "OVERFLOW", "PORTRAIT"):
        assert contract in out, f"repair prompt does not restate the {contract} contract"
    assert "must not break a rule the scene already satisfies" in out


def test_art_direction_differs_between_two_blueprints() -> None:
    """Two designs must produce two different briefs."""
    a = build_art_direction(DISTINCT, "content", 0)
    b = build_art_direction(GENERIC, "content", 0)
    assert a != b


def test_art_direction_carries_the_blueprints_own_numbers() -> None:
    """The brief must state THIS template's insets, not a generic default."""
    out = build_art_direction(DISTINCT, "content", 0)
    assert "3% 3% 3% 3%" in out
    assert "edge_to_edge" in out
    # And its type system, concretely enough to apply.
    assert "44px" in out
    assert "0.08em" in out


def test_edge_to_edge_is_not_overridden_by_a_centering_mandate() -> None:
    """A bleed-to-edge template must not be told to centre everything."""
    out = build_art_direction(DISTINCT, "content", 0)
    assert "DELIBERATELY runs elements to the frame" in out
    assert "force the content group to dead centre" not in out.split("EDGE POLICY")[0]


def test_blueprint_intro_does_not_mandate_introstage() -> None:
    """IntroStage made every brand's opening identical; it must not be the default."""
    out = build_art_direction(DISTINCT, "intro")
    assert "cold_open_statement" in out
    assert "STRONGLY PREFER the <IntroStage>" not in out


def test_blueprint_outro_is_not_forced_quiet() -> None:
    """An emphatic close must survive; v1 hardcoded 'calm closing recap'."""
    out = build_art_direction(DISTINCT, "outro")
    assert "'loud'" in out
    assert "need NOT be quieter" in out


def test_flag_off_reproduces_the_v1_house_style() -> None:
    """With no blueprint, output must be byte-for-byte the old behaviour."""
    intro = build_art_direction(None, "intro")
    content = build_art_direction(None, "content", 0, composition="side rail")
    outro = build_art_direction(None, "outro")
    assert "~6-8%" in intro
    assert "STRONGLY PREFER the <IntroStage>" in intro
    assert "'side rail' composition" in content
    assert "calm closing recap" in outro


def test_regenerate_without_composition_keeps_existing_geometry() -> None:
    """regenerate_single_scene passes no composition; it must not read as a None."""
    out = build_art_direction(None, "content", 0)
    assert "None" not in out
    assert "Keep this scene's existing composition." in out


# ─── The blueprint itself must diverge per brand ─────────────────────────────


def test_generic_prior_is_rejected() -> None:
    """The design that made every template look alike must not pass."""
    score, hits = _house_style_score(GENERIC)
    assert score >= HOUSE_STYLE_REJECT_AT, f"generic design scored only {score}: {hits}"


def test_a_real_design_is_accepted() -> None:
    """A brand-specific design must not be rejected as generic."""
    score, _ = _house_style_score(DISTINCT)
    assert score < HOUSE_STYLE_REJECT_AT


def test_fingerprints_distinguish_designs() -> None:
    assert blueprint_fingerprint(GENERIC) != blueprint_fingerprint(DISTINCT)


def test_brand_constraints_are_deterministic() -> None:
    """The same brand must regenerate to the same character."""
    seed = "fintech|dense|Acme Capital"
    assert _brand_constraint(seed) == _brand_constraint(seed)


def test_brand_constraints_differ_across_brands() -> None:
    """Different brands must be pushed off the prior in different directions."""
    seeds = [
        "fintech|dense|Acme Capital",
        "food|warm|Nonna's Kitchen",
        "saas|minimal|Linear",
        "news|editorial|The Ledger",
        "fitness|bold|IronWorks",
    ]
    pairs = {_brand_constraint(s) for s in seeds}
    # Collisions are acceptable at this sample size; total convergence is not.
    assert len(pairs) >= 4, f"only {len(pairs)} distinct constraint pairs for {len(seeds)} brands"


def test_brand_constraints_spread_across_many_brands() -> None:
    """No single constraint pair may dominate the population."""
    from collections import Counter

    seeds = [f"cat{i % 10}|style{i % 6}|Brand {i}" for i in range(120)]
    counts = Counter(_brand_constraint(s) for s in seeds)
    most_common = counts.most_common(1)[0][1]
    assert most_common / len(seeds) < 0.15, f"one constraint pair covers {most_common}/{len(seeds)} brands"
    assert len(counts) >= 20


def test_empty_seed_yields_no_constraint() -> None:
    """No seed means no fabricated constraint."""
    assert _brand_constraint("") == ""


# ─── Output budget: no unbounded rationale before the JSON ───────────────────


def test_blueprint_plans_in_a_bounded_field_not_free_form_reasoning() -> None:
    """The design note must come BEFORE the JSON, and be capped.

    The stage ran on dspy.ChainOfThought, which prepends an unbounded `reasoning`
    field. At temperature 0.9 a low-effort model filled it and was cut off before
    writing blueprint_json — on template 134 that happened on BOTH attempts and
    the template silently fell back to the deterministic blueprint.
    """
    from app.dspy_modules.blueprint import GenerateDesignBlueprint

    fields = list(GenerateDesignBlueprint.output_fields)
    assert fields == ["design_note", "blueprint_json"], fields

    desc = GenerateDesignBlueprint.output_fields["design_note"].json_schema_extra["desc"]
    assert "3 SHORT LINES" in desc
    assert "do not think out loud" in desc.lower()


def test_blueprint_uses_predict_not_chain_of_thought() -> None:
    """Guard the swap: ChainOfThought would reintroduce the `reasoning` field."""
    import dspy

    from app.dspy_modules.blueprint import GenerateDesignBlueprint

    predict_fields = set(dspy.Predict(GenerateDesignBlueprint).signature.output_fields)
    cot_fields = set(dspy.ChainOfThought(GenerateDesignBlueprint).predict.signature.output_fields)

    assert "reasoning" not in predict_fields
    assert "reasoning" in cot_fields, "dspy changed; revisit why this stage avoids CoT"

    import inspect

    from app.dspy_modules import blueprint as blueprint_mod

    src = inspect.getsource(blueprint_mod.generate_blueprint)
    assert "dspy.Predict(GenerateDesignBlueprint)" in src
    assert "dspy.ChainOfThought(GenerateDesignBlueprint)" not in src


# ─── The deterministic fallback must not produce identical scenes ────────────


def test_fallback_varies_surfaces_and_image_treatments() -> None:
    """A fallback cannot design, but it must not make six identical scenes.

    Every content layout used to get the same surface and image_treatment
    ("split"). Observed on template 134, whose blueprint truncated twice and fell
    back: all six content layouts logged surface='glass' img='split' — the exact
    repetition the blueprint stage exists to prevent.
    """
    from app.dspy_modules.blueprint import fallback_blueprint

    theme = {
        "signature": {
            "artifactSet": ["spin", "shards", "slam"],
            "surfaceStyle": "glass",
            "decorSystem": "rules",
        }
    }
    archetypes = [{"id": f"a{i}", "best_for": ["plain"]} for i in range(6)]
    bp = fallback_blueprint(theme, archetypes, "OHR Energy")
    content = [layout for layout in bp["layouts"] if layout["role"] == "content"]

    assert len({layout["surface"] for layout in content}) >= 3
    assert len({layout["image_treatment"] for layout in content}) >= 3
    assert len({layout["artifact_intensity"] for layout in content}) >= 2


def test_fallback_stays_inside_the_renderable_vocabulary() -> None:
    """Varying the fallback must not invent values the kit cannot draw."""
    from app.dspy_modules.blueprint import fallback_blueprint
    from app.services.kit_vocabulary import IMAGE_TREATMENTS, SURFACE_VARIANTS

    archetypes = [{"id": f"a{i}", "best_for": ["plain"]} for i in range(8)]
    bp = fallback_blueprint({"signature": {}}, archetypes, "Brand")
    for layout in bp["layouts"]:
        assert layout["surface"] in SURFACE_VARIANTS
        assert layout["image_treatment"] in IMAGE_TREATMENTS


# ─── Constraints must be ENFORCED, not merely requested ──────────────────────
#
# The regression these guard: GLM 5.2 was given two NON-NEGOTIABLE constraints
# and returned num=False / open=logo_settle on two consecutive attempts with an
# identical fingerprint and an identical score of 7. Asking does not work on a
# weak model, so the constraints are applied to the output.


def test_the_real_generic_blueprint_is_rejected_before_enforcement() -> None:
    """The design that actually shipped from template 132 must score as generic."""
    bp, _ = validate_blueprint(_generic_blueprint("Custom Template"), seed="s")
    score, _ = _house_style_score(bp)
    assert score >= HOUSE_STYLE_REJECT_AT


def test_enforcement_rescues_the_real_generic_blueprint() -> None:
    """After enforcement that same design must no longer read as house style."""
    score, hits = _house_style_score(_enforced("encyclopedia|editorial|Custom Template"))
    assert score < HOUSE_STYLE_REJECT_AT, f"still generic: {hits}"


def test_enforcement_never_leaves_a_generic_design() -> None:
    """Across many brands, no enforced blueprint may remain house style."""
    seeds = [f"cat{i % 10}|style{i % 6}|Brand {i}" for i in range(60)]
    bad = [s for s in seeds if _house_style_score(_enforced(s))[0] >= HOUSE_STYLE_REJECT_AT]
    assert not bad, f"{len(bad)} brands still generic after enforcement"


def test_identical_model_output_still_diverges_per_brand() -> None:
    """The worst case: the model returns the SAME design for every brand.

    Enforcement alone must still pull them apart, because this is precisely
    what was observed — an identical fingerprint across attempts.
    """
    seeds = [f"cat{i % 10}|style{i % 6}|Brand {i}" for i in range(60)]
    fps = {blueprint_fingerprint(_enforced(s)) for s in seeds}
    assert len(fps) / len(seeds) > 0.5, f"only {len(fps)} distinct designs from {len(seeds)} brands"


def test_enforcement_is_deterministic() -> None:
    """A brand must regenerate to the same enforced design."""
    seed = "fintech|dense|Acme Capital"
    assert blueprint_fingerprint(_enforced(seed)) == blueprint_fingerprint(_enforced(seed))


def test_enforcement_respects_the_image_floor() -> None:
    """Forcing text-only layouts must not starve the pipeline of image slots."""
    from app.dspy_modules.blueprint import MIN_IMAGE_CAPABLE_FRACTION

    for i in range(30):
        bp = _enforced(f"cat{i}|style{i}|Brand {i}")
        content = [l for l in bp["layouts"] if l["role"] == "content"]
        capable = [l for l in content if l["supports_image"]]
        assert len(capable) >= int(len(content) * MIN_IMAGE_CAPABLE_FRACTION), (
            f"brand {i}: only {len(capable)}/{len(content)} image-capable"
        )


def test_enforcement_stays_inside_the_renderable_vocabulary() -> None:
    """An enforced value must still be something the kit can draw."""
    from app.services.kit_vocabulary import (
        DECOR_SYSTEMS,
        EDGE_POLICIES,
        IMAGE_TREATMENTS,
        OPENING_MOVES,
        SURFACE_VARIANTS,
    )

    for i in range(30):
        bp = _enforced(f"cat{i}|style{i}|Brand {i}")
        assert bp["identity"]["decor_system"] in DECOR_SYSTEMS
        assert bp["structure"]["edge_policy"] in EDGE_POLICIES
        assert bp["bookends"]["intro"]["opening_move"] in OPENING_MOVES
        for lay in bp["layouts"]:
            assert lay["surface"] in SURFACE_VARIANTS
            assert lay["image_treatment"] in IMAGE_TREATMENTS


def test_enforcement_keeps_safe_areas_in_range() -> None:
    """A forced tight/airy safe area must stay within the clamped band."""
    for i in range(30):
        bp = _enforced(f"cat{i}|style{i}|Brand {i}")
        for orient in ("landscape", "portrait"):
            for side, val in bp["structure"]["safe_area"][orient].items():
                assert 2.0 <= val <= 14.0, f"{orient}.{side} = {val}"


# ── transition families ──────────────────────────────────────────────────────
#
# The gallery symptom these guard: every custom template preview showed the same
# handoffs as every other one. The pool top-up read DEFAULT_TRANSITION_FAMILY
# from the front, so any blueprint supplying no legal names — the common case
# once validation started dropping hallucinated ones — got byte-identical
# ["parallax_push", "accent_bar", "page_fold", "rule_sweep"].


def _transition_family(name: str, raw: list[str] | None = None) -> list[str]:
    # validate_blueprint raises on a layout-less blueprint, so build on the
    # generic one this module already uses and vary only the transitions.
    src = {**_generic_blueprint(name), "transition_family": raw or []}
    bp, _ = validate_blueprint(src, seed=name)
    return bp["transition_family"]


def test_transition_family_diverges_across_brands() -> None:
    """Brands supplying no legal names must not all get the same pool."""
    pools = {tuple(_transition_family(f"Brand {i}")) for i in range(12)}
    assert len(pools) > 1, f"every brand got the same transition pool: {pools}"


def test_transition_family_is_reproducible_per_brand() -> None:
    """The renderer's selection contract requires a stable pool per brand."""
    for name in ("NVIDIA", "SpaceX", "Shell Pakistan"):
        assert _transition_family(name) == _transition_family(name)


def test_transition_family_keeps_the_models_own_picks_first() -> None:
    """A brand-seeded top-up must extend the model's choices, not replace them."""
    fam = _transition_family("NVIDIA", ["ink_wash", "whip_blur"])
    assert fam[:2] == ["ink_wash", "whip_blur"]


def test_transition_family_stays_renderable_and_varied() -> None:
    """Every emitted name must be drawable, with enough of them to rotate."""
    from app.services.kit_vocabulary import TRANSITION_FAMILIES

    for i in range(30):
        fam = _transition_family(f"Brand {i}")
        assert len(fam) >= 3, f"pool too short to vary cuts: {fam}"
        assert len(set(fam)) == len(fam), f"duplicate entries: {fam}"
        for t in fam:
            assert t in TRANSITION_FAMILIES, f"unrenderable transition {t!r}"


# ── bookend moves + era (Stage 0) ────────────────────────────────────────────
#
# Measured on the 7 stored blueprints before this landed: opening_move was
# logo_settle and closing_move was recap_card on 7 of 7 — a 100% collapse on the
# first and last thing a viewer sees. It survived because _house_style_score
# counted the loud/quiet ENERGY arc but never the moves themselves, so
# enforce_brand_constraints never fired on this axis.


def _enforced_bookends(seed: str) -> dict:
    bp, _ = validate_blueprint(_generic_blueprint(seed), seed=seed)
    enforce_brand_constraints(bp, seed)
    bp, _ = validate_blueprint(bp, seed=seed)
    return bp


def test_house_style_score_counts_default_bookend_moves() -> None:
    """The 7-of-7 blind spot: default moves must register as generic traits."""
    bp, _ = validate_blueprint(_generic_blueprint("Brand"), seed="Brand")
    bp["bookends"]["intro"]["opening_move"] = "logo_settle"
    bp["bookends"]["outro"]["closing_move"] = "recap_card"
    _score, hits = _house_style_score(bp)
    assert any("logo_settle" in h for h in hits)
    assert any("recap_card" in h for h in hits)


def test_bookend_moves_diverge_across_brands() -> None:
    """Across many brands the moves must spread, not collapse onto one value."""
    opens, closes = set(), set()
    for i in range(60):
        bp = _enforced_bookends(f"cat{i}|style{i}|Brand {i}")
        opens.add(bp["bookends"]["intro"]["opening_move"])
        closes.add(bp["bookends"]["outro"]["closing_move"])
    assert len(opens) >= 3, f"opening_move collapsed: {opens}"
    assert len(closes) >= 3, f"closing_move collapsed: {closes}"


def test_default_bookend_moves_never_survive_enforcement() -> None:
    """The two overused defaults are what the collapse was made of."""
    for i in range(60):
        bp = _enforced_bookends(f"cat{i}|style{i}|Brand {i}")
        assert bp["bookends"]["intro"]["opening_move"] != "logo_settle"
        assert bp["bookends"]["outro"]["closing_move"] != "recap_card"


def test_bookend_moves_stay_in_vocabulary_and_are_reproducible() -> None:
    from app.services.kit_vocabulary import CLOSING_MOVES, OPENING_MOVES

    for i in range(30):
        seed = f"cat{i}|style{i}|Brand {i}"
        bp = _enforced_bookends(seed)
        assert bp["bookends"]["intro"]["opening_move"] in OPENING_MOVES
        assert bp["bookends"]["outro"]["closing_move"] in CLOSING_MOVES
        again = _enforced_bookends(seed)
        assert again["bookends"] == bp["bookends"]


def test_a_deliberate_bookend_choice_is_not_overridden() -> None:
    """_c_bookend_moves only replaces the defaults, never a real decision."""
    seed = "cat|style|Brand"
    raw = _generic_blueprint(seed)
    raw["bookends"] = {
        "intro": {"opening_move": "photo_push", "title_reveal": "word", "energy": "measured"},
        "outro": {"closing_move": "rule_close", "energy": "quiet"},
    }
    bp, _ = validate_blueprint(raw, seed=seed)
    enforce_brand_constraints(bp, seed)
    assert bp["bookends"]["intro"]["opening_move"] == "photo_push"
    assert bp["bookends"]["outro"]["closing_move"] == "rule_close"


def test_era_diverges_and_carries_the_typeface_with_it() -> None:
    """era drives fonts_for_era, so an era collapse is a typography collapse."""
    eras, heads = set(), set()
    for i in range(60):
        bp = _enforced_bookends(f"cat{i}|style{i}|Brand {i}")
        eras.add(bp["identity"]["era"])
        heads.add(bp["identity"]["heading_font"])
    assert len(eras) >= 3, f"era collapsed: {eras}"
    assert len(heads) >= 4, f"typeface collapsed: {heads}"


def test_era_enforcement_keeps_fonts_renderable() -> None:
    """_c_era re-derives the pair; both must stay bundled ids."""
    from app.services.kit_vocabulary import ERAS, FONT_IDS

    for i in range(30):
        bp = _enforced_bookends(f"cat{i}|style{i}|Brand {i}")
        assert bp["identity"]["era"] in ERAS
        assert bp["identity"]["heading_font"] in FONT_IDS
        assert bp["identity"]["body_font"] in FONT_IDS


# ── layouts key aliasing (Stage 0.5) ─────────────────────────────────────────


def test_layouts_resolve_under_alias_key_names() -> None:
    """A good design named 'scenes' must not be thrown away for naming."""
    for alias in ("scenes", "layout", "scene_layouts", "template_layouts"):
        raw = _generic_blueprint("Brand")
        raw[alias] = raw.pop("layouts")
        bp, repairs = validate_blueprint(raw, seed="Brand")
        assert len(bp["layouts"]) > 0
        assert any(alias in r for r in repairs), repairs


def test_bare_top_level_layout_array_is_wrapped() -> None:
    raw = _generic_blueprint("Brand")
    bp, repairs = validate_blueprint(raw["layouts"], seed="Brand")
    assert len(bp["layouts"]) > 0
    assert any("wrapped" in r for r in repairs), repairs


def test_stringified_layout_entries_are_recovered() -> None:
    import json as _json

    raw = _generic_blueprint("Brand")
    raw["layouts"] = [_json.dumps(l) for l in raw["layouts"]]
    bp, _ = validate_blueprint(raw, seed="Brand")
    assert len(bp["layouts"]) > 0


def test_non_dict_layout_entry_is_reported_by_type() -> None:
    """The old silent drop made 'model returned too few' a lie."""
    raw = _generic_blueprint("Brand")
    raw["layouts"] = raw["layouts"] + [42]
    _bp, repairs = validate_blueprint(raw, seed="Brand")
    assert any("not an object" in r and "int" in r for r in repairs), repairs


def test_alias_resolution_is_idempotent() -> None:
    """enforce_brand_constraints re-validates; repairs must not double-log."""
    raw = _generic_blueprint("Brand")
    raw["scenes"] = raw.pop("layouts")
    bp, first = validate_blueprint(raw, seed="Brand")
    _bp2, second = validate_blueprint(bp, seed="Brand")
    assert any("scenes" in r for r in first)
    assert not any("scenes" in r for r in second), second


def test_constraints_are_seeded_on_the_brand_not_on_identity_name() -> None:
    """identity.name is not the brand — it is usually "Custom Template".

    The brand-seeded constraints hashed identity.name, which the extractor
    leaves as that literal on most blueprints. Every brand therefore hashed to
    the same number and every "brand-seeded" pick returned the same answer:
    measured as photo_push/rule_close on 6 of 7 real templates, and 'rules'
    decor on 5 of 7, while the code looked like it was diversifying them.
    """
    opens, closes, decors = set(), set(), set()
    for i in range(20):
        raw = _generic_blueprint("Brand")
        # Exactly what the real blueprints carry.
        raw["identity"]["name"] = "Custom Template"
        seed = f"cat{i}|style{i}|Brand {i}"
        bp, _ = validate_blueprint(raw, seed=seed)
        enforce_brand_constraints(bp, seed)
        bp, _ = validate_blueprint(bp, seed=seed)
        opens.add(bp["bookends"]["intro"]["opening_move"])
        closes.add(bp["bookends"]["outro"]["closing_move"])
        decors.add(bp["identity"]["decor_system"])

    assert len(opens) >= 3, f"identical identity.name collapsed opening_move: {opens}"
    assert len(closes) >= 3, f"identical identity.name collapsed closing_move: {closes}"
    assert len(decors) >= 2, f"identical identity.name collapsed decor: {decors}"


def test_the_constraint_seed_does_not_leak_between_runs() -> None:
    """A ContextVar set per run must be reset even when a constraint raises."""
    from app.dspy_modules.blueprint import _CONSTRAINT_SEED

    assert _CONSTRAINT_SEED.get() == ""
    bp, _ = validate_blueprint(_generic_blueprint("Brand"), seed="cat|style|Brand")
    enforce_brand_constraints(bp, "cat|style|Brand")
    assert _CONSTRAINT_SEED.get() == "", "seed leaked past enforcement"


def test_transition_top_up_shuffles_rather_than_rotates() -> None:
    """A rotation has only len(pool) outcomes, so brands collide by modulo.

    Observed: Yango ('ride-hailing / mobility|bold mobility brand|Yango') and
    LaDucTrading ('finance/trading advisory|authoritative trading terminal|
    LaDucTrading') share nothing, both hashed to offset 5, and both received
    clock_sweep/whip_pan/page_flip/fade — an identical rhythm on every cut.
    """
    yango = "ride-hailing / mobility|bold mobility brand|Yango"
    laduc = "finance/trading advisory|authoritative trading terminal|LaDucTrading"

    def _family(seed: str) -> list[str]:
        raw = {**_generic_blueprint(seed.split("|")[-1]), "transition_family": []}
        bp, _ = validate_blueprint(raw, seed=seed)
        return bp["transition_family"]

    assert _family(yango) != _family(laduc)

    # And across many brands the outcome space must be far wider than the
    # 9 rotations the pool length allows.
    pools = {
        tuple(_family(f"cat{i}|style{i}|Brand {i}")) for i in range(120)
    }
    assert len(pools) > 40, f"top-up is still effectively a rotation: {len(pools)} pools"


def test_transition_top_up_is_still_reproducible() -> None:
    """A shuffle must stay deterministic — the renderer's whole contract."""
    seed = "cat|style|Brand"
    raw = {**_generic_blueprint("Brand"), "transition_family": []}
    first, _ = validate_blueprint(raw, seed=seed)
    second, _ = validate_blueprint({**raw}, seed=seed)
    assert first["transition_family"] == second["transition_family"]


# ── scene-set divergence ─────────────────────────────────────────────────────
#
# Everything above this line asserts on the template's SKIN — constraint pairs,
# fingerprints, bookend moves, eras, transitions. Not one assertion covered the
# scene set, which is why templates could keep shipping the same layouts while
# every divergence test passed.


def _content(bp: dict) -> list[dict]:
    return [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]


def test_layout_count_varies_across_brands() -> None:
    """Every template landing on the same number of scenes is the collapse.

    Nothing moved this before: all 13 original constraints touched chrome,
    decor, safe area, bookends or era.
    """
    seeds = [f"cat{i % 10}|style{i % 6}|Brand {i}" for i in range(60)]
    counts = {len(_content(_enforced(sd))) for sd in seeds}
    assert len(counts) >= 2, f"content-layout count never varies: {counts}"


def test_role_composition_is_not_uniformly_content() -> None:
    """SCENE_ROLES has 7 members and 4 were used by no blueprint at all.

    A template where every non-bookend layout is a plain content scene has no
    change of pace — nine equal-weight scenes in a row.
    """
    seeds = [f"cat{i % 10}|style{i % 6}|Brand {i}" for i in range(60)]
    seen: set[str] = set()
    for sd in seeds:
        bp = _enforced(sd)
        seen |= {str(l.get("role")) for l in (bp.get("layouts") or [])}
    extra = seen - {"intro", "content", "outro"}
    assert extra, f"no template ever carries a non-content role; roles seen: {seen}"


def test_the_fingerprint_can_see_the_scene_set() -> None:
    """The measurement instrument was blind to the reported problem.

    blueprint_fingerprint covered only skin axes, so two templates with an
    IDENTICAL scene set but different chrome reported as fully distinct — which
    is how a scene-level collapse stayed invisible while these tests passed.
    """
    from app.dspy_modules.blueprint import blueprint_fingerprint

    base = _enforced("blog|editorial|Acme")
    fp = blueprint_fingerprint(base)
    assert "n=" in fp, "fingerprint does not record the layout count"
    assert "bf=" in fp, "fingerprint does not record the best_for mix"
    assert "roles=" in fp, "fingerprint does not record the role mix"


def test_a_generic_scene_set_is_scored_as_generic() -> None:
    """A blueprint could score ZERO generic traits while shipping the default
    scene set: six content layouts, all plain, all role=content."""
    from app.dspy_modules.blueprint import _house_style_score

    plain_six = {
        "identity": {"name": "X", "decor_system": "mesh", "surface_default": "paper"},
        "structure": {
            "edge_policy": "edge_to_edge",
            "chrome": {"enabled": True},
            "panel_numbering": {"enabled": True},
            "safe_area": {"landscape": {"top": 3, "right": 3, "bottom": 3, "left": 3}},
        },
        "bookends": {
            "intro": {"opening_move": "cold_open_statement", "energy": "quiet"},
            "outro": {"closing_move": "rule_close", "energy": "loud"},
        },
        "layouts": [
            {
                "id": f"l{i}",
                "role": "content",
                "best_for": ["plain"],
                "surface": "paper" if i < 3 else "outline",
                "image_treatment": "full_bleed" if i % 2 else "masked",
                "supports_image": i % 2 == 0,
            }
            for i in range(6)
        ],
    }
    _, hits = _house_style_score(plain_six)
    joined = " ".join(hits)
    assert "six content layouts" in joined, hits
    assert "best_for" in joined, hits
    assert "punctuation" in joined, hits


# ── layout identity: type:variant ────────────────────────────────────────────
#
# `best_for` is the content-MATCHING key, not a style label. With 8 types and 6+
# layouts required, two templates MUST share >=4 of 6 types — arithmetic, not a
# model failure. Forcing disjoint type sets would cost coverage: a template with
# no "metrics" layout sends every statistics scene to the round-robin fallback,
# which is the original "every video looks the same" bug.
#
# So identity was split: the TYPE stays the matching key, the VARIANT says how
# this template draws it. `metrics:ledger` and `metrics:hero-rail` serve the same
# content and look nothing alike.


def _identities(seed: str) -> set[str]:
    """This brand's layout identities, as the renderer would see them."""
    from app.services.kit_vocabulary import layout_variants_for_brand

    v = layout_variants_for_brand(seed)
    return {f"{t}:{v[t]}" for t in ("plain", "metrics", "bullets", "quote", "timeline", "comparison")}


def test_two_templates_rarely_share_a_layout_identity() -> None:
    """Before the split the type WAS the identity, so any two templates shared
    every layout they had in common — 6.00 of 6, guaranteed."""
    brands = [f"Brand {i}" for i in range(20)]
    ids = {b: _identities(f"blog|editorial|{b}") for b in brands}
    pairs = [(a, c) for i, a in enumerate(brands) for c in brands[i + 1 :]]
    shared = [len(ids[a] & ids[c]) for a, c in pairs]
    mean = sum(shared) / len(shared)
    assert mean < 3.0, f"layout identities still collapse: mean {mean:.2f} of 6 shared"


def test_coverage_is_preserved() -> None:
    """The property literal disjointness would have broken.

    Every template must still declare a layout for every content type its
    articles can produce — especially `plain`, which is the classifier's fallback
    for any narration it cannot structure.
    """
    for i in range(20):
        types = {ident.split(":")[0] for ident in _identities(f"blog|editorial|Brand {i}")}
        assert "plain" in types, "a template without a plain layout mis-renders the common case"
        assert len(types) == 6, f"lost content coverage: {sorted(types)}"


def test_every_variant_is_renderable() -> None:
    """A variant the kit cannot draw is worse than no variant: it degrades
    silently. `mask_up` was selectable for months while rendering as a plain word
    reveal, which is the failure this guards."""
    from app.services.code_generator import _VARIANT_DIRECTION
    from app.services.kit_vocabulary import CONTENT_TYPE_VARIANTS

    every = {v for vs in CONTENT_TYPE_VARIANTS.values() for v in vs}
    missing = sorted(every - set(_VARIANT_DIRECTION))
    assert not missing, f"variants with no direction prose (model gets a bare name): {missing}"


def test_the_blueprint_prompt_no_longer_names_the_layouts() -> None:
    """The prompt used to hand every brand the same worked examples —
    "metrics_row", "quote_center", "timeline_horizontal" — immediately after
    demanding 6-8 layouts. The model was asked to fill six slots and shown six
    names."""
    from app.dspy_modules import blueprint as B

    doc = B.GenerateDesignBlueprint.__doc__ or ""
    for anchor in ("metrics_row", "quote_center", "timeline_horizontal"):
        assert anchor not in doc, f"the prompt still supplies the answer: {anchor!r}"


def test_each_brand_gets_its_own_variant_assignment() -> None:
    """Deterministic per brand, and decorrelated across types — two brands
    colliding on one type must not collide on all of them."""
    from app.services.kit_vocabulary import layout_variants_for_brand as pick

    a = pick("blog|editorial|Acme")
    assert a == pick("blog|editorial|Acme"), "assignment is not deterministic"
    assert a != pick("blog|editorial|Zeta"), "two brands got identical assignments"


# ── template LENGTH ──────────────────────────────────────────────────────────
#
# The prompt used to demand "SIX to EIGHT content layouts... fewer than six is a
# REJECTED answer", which reads as "six is safe" — so every template shipped
# exactly six and two templates always had the same length as well as the same
# shapes. The count is now seeded per brand and named in the prompt.


def _body(bp: dict) -> list[dict]:
    return [l for l in (bp.get("layouts") or []) if str(l.get("role")) not in ("intro", "outro")]


def _built(seed: str, gave: int = 8) -> dict:
    from app.dspy_modules.blueprint import validate_blueprint

    raw = {
        "identity": {"name": "X"},
        "layouts": [{"id": "i", "role": "intro", "geometry": "x" * 70, "best_for": []}]
        + [
            {
                "id": f"c{k}",
                "role": "content",
                "best_for": [
                    ["metrics", "quote", "bullets", "timeline", "comparison", "plain", "steps", "code"][k % 8]
                ],
                "geometry": f"a distinct arrangement {k} with columns weighted {k + 2}0/{8 - k}0 and a rule",
            }
            for k in range(gave)
        ]
        + [{"id": "o", "role": "outro", "geometry": "y" * 70, "best_for": []}],
    }
    bp, _ = validate_blueprint(raw, seed=seed)
    enforce_brand_constraints(bp, seed)
    return bp


def test_template_length_varies_between_brands() -> None:
    seeds = [f"cat{i % 10}|style{i % 6}|Brand {i}" for i in range(40)]
    lengths = {len(_built(sd)["layouts"]) for sd in seeds}
    assert len(lengths) >= 2, f"every template is the same length: {lengths}"


def test_the_shipped_count_matches_the_count_the_prompt_NAMED() -> None:
    """The instruction and the enforcement read the same function, so a template
    cannot be told one number and built to another."""
    from app.dspy_modules.blueprint import content_layout_target

    for i in range(40):
        sd = f"cat{i % 10}|style{i % 6}|Brand {i}"
        assert len(_body(_built(sd))) == content_layout_target(sd), sd


def test_a_punctuation_role_does_not_shrink_the_template() -> None:
    """_c_role_composition retags a body layout rather than removing one.

    The trim used to filter on `role == "content"`, so a retagged layout slipped
    through uncounted and the template shipped target+1 while the repair line
    claimed it had trimmed to target.
    """
    from app.dspy_modules.blueprint import content_layout_target

    sd = "cat0|style0|Brand 0"
    bp = _built(sd)
    roles = [str(l.get("role")) for l in _body(bp)]
    assert len(roles) == content_layout_target(sd)


def test_every_body_layout_carries_a_renderable_variant() -> None:
    """The count change must not drop the variant assignment."""
    from app.services.kit_vocabulary import CONTENT_TYPE_VARIANTS

    for i in range(20):
        sd = f"cat{i % 10}|style{i % 6}|Brand {i}"
        for lay in _body(_built(sd)):
            v = lay.get("variant")
            assert v, f"{sd}: layout {lay.get('id')} has no variant"
            btype = (lay.get("best_for") or ["plain"])[0]
            assert v in CONTENT_TYPE_VARIANTS.get(btype, ()), (
                f"{sd}: {btype} variant {v!r} is not renderable"
            )
