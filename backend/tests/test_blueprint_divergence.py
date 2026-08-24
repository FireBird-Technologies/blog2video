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
