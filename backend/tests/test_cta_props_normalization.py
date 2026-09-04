"""A generated outro scene is free-text JS an LLM wrote from the ending-scene
contract, which documents `ctaButtonText` + `websiteLink` as each `ctas[]`
entry's fields. custom_201's outro (project 1211 scene 9, the DAWN template)
instead read `c.label ?? c.text` / `c.link ?? c.websiteLink` — neither `label`
nor `text` exists on the real objects, so every CTA button rendered with an
empty title while its correctly-read `websiteLink` line stayed visible
beneath the unlabeled box: an empty outline with orphaned URL-looking text
beside it, and three overflowing fixed-width buttons compressing into each
other.

`_normalize_cta_props` closes this at the one place every already-generated
template's ctaProps passes through on the way to a render, by adding
`label`/`text`/`link` as read-aliases alongside the canonical keys — additive,
so a component that already reads the canonical names is unaffected.
"""
from __future__ import annotations

from app.services.remotion import _normalize_cta_props


def test_adds_label_text_link_aliases_without_removing_canonical_keys() -> None:
    cta_props = {
        "socials": {"facebook": {"enabled": True, "label": "Facebook"}},
        "ctas": [
            {"ctaButtonText": "Read More", "websiteLink": "https://example.com", "showWebsiteButton": True},
        ],
    }
    out = _normalize_cta_props(cta_props)
    entry = out["ctas"][0]
    assert entry["ctaButtonText"] == "Read More"
    assert entry["websiteLink"] == "https://example.com"
    assert entry["label"] == "Read More"
    assert entry["text"] == "Read More"
    assert entry["link"] == "https://example.com"
    # socials untouched
    assert out["socials"] == cta_props["socials"]


def test_never_overwrites_an_entry_that_already_sets_the_alias_keys() -> None:
    cta_props = {
        "ctas": [
            {"ctaButtonText": "Read More", "websiteLink": "https://example.com", "label": "Custom Label"},
        ],
    }
    out = _normalize_cta_props(cta_props)
    assert out["ctas"][0]["label"] == "Custom Label"


def test_missing_or_empty_ctas_pass_through_unchanged() -> None:
    assert _normalize_cta_props({"socials": {}}) == {"socials": {}}
    assert _normalize_cta_props({"ctas": []}) == {"ctas": []}
    assert _normalize_cta_props({"ctas": None}) == {"ctas": None}


def test_non_dict_cta_entries_are_left_as_is() -> None:
    cta_props = {"ctas": ["not-a-dict", 42, None]}
    out = _normalize_cta_props(cta_props)
    assert out["ctas"] == ["not-a-dict", 42, None]


def test_a_disabled_cta_is_dropped() -> None:
    """The toggle in the editor writes showWebsiteButton=False, but NO generated
    outro reads that flag — every one does `(props.ctaProps?.ctas ?? []).map(...)`
    and paints the entry anyway, so switching a CTA off did nothing on v2/v3
    templates. (v1 is unaffected: GeneratedCtaOverlay filters on this same flag.)
    """
    out = _normalize_cta_props({
        "ctas": [
            {"ctaButtonText": "Get started", "websiteLink": "https://x", "showWebsiteButton": False},
            {"ctaButtonText": "Read more", "websiteLink": "https://y", "showWebsiteButton": True},
        ],
    })
    assert [c["ctaButtonText"] for c in out["ctas"]] == ["Read more"]


def test_disabling_the_only_cta_also_clears_the_legacy_mirror() -> None:
    """Filtering the array alone is not enough.

    The editor mirrors ctas[0] onto ctaProps.ctaButtonText/websiteLink, and a
    generated outro falls back to it:
        ctas.length === 0 && props.ctaProps?.ctaButtonText ? [{...}] : ctas
    So emptying the array would make the scene resurrect the CTA the user just
    switched off. The mirror has to go too.
    """
    out = _normalize_cta_props({
        "showWebsiteButton": True,
        "ctaButtonText": "Get started",
        "websiteLink": "https://x",
        "ctas": [{"ctaButtonText": "Get started", "websiteLink": "https://x", "showWebsiteButton": False}],
    })
    assert out["ctas"] == []
    assert "ctaButtonText" not in out
    assert "websiteLink" not in out
    assert out["showWebsiteButton"] is False


def test_an_enabled_cta_keeps_the_legacy_mirror() -> None:
    out = _normalize_cta_props({
        "showWebsiteButton": True,
        "ctaButtonText": "Get started",
        "websiteLink": "https://x",
        "ctas": [{"ctaButtonText": "Get started", "websiteLink": "https://x", "showWebsiteButton": True}],
    })
    assert out["ctaButtonText"] == "Get started"
    assert out["showWebsiteButton"] is True
