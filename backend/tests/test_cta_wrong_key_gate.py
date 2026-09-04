"""custom_201's outro (project 1211 scene 9, the DAWN template) mapped
`props.ctaProps.ctas` but read `c.label ?? c.text` for the button label and
`c.link ?? c.websiteLink` for the URL line. Neither `label` nor `text` exists
on a real ctas entry — only `ctaButtonText` and `websiteLink` do — so every
button rendered with an empty label while its correctly-read websiteLink line
stayed visible beneath the unlabeled box.

`_design_doc_defects`'s outro branch already checked that `ctaProps`/`ctas`/
`ctaButtonText` are referenced SOMEWHERE in the code (existence-only), which
this exact scene would have passed — `ctaButtonText` appears in its fallback
branch. This test pins the narrower check: reading `.label`/`.text`/`.link`
off the variable a `ctas.map(...)` callback binds is flagged, regardless of
what else the scene also does correctly.
"""
from __future__ import annotations

from app.services.code_validator import _design_doc_defects

_DOC = "The closing scene.\n"


def test_reading_dot_label_off_the_mapped_cta_is_flagged() -> None:
    code = (
        "const ctas = props.ctaProps?.ctas ?? [];\n"
        "ctas.map((c, i) => (\n"
        "  <CtaButton key={i} label={c.label ?? c.text ?? ''} link={c.link ?? c.websiteLink ?? null} />\n"
        "))"
    )
    defects = _design_doc_defects(code, "outro", _DOC)
    assert any("does not exist on it" in d and ".label" in d for d in defects)


def test_reading_dot_link_off_the_mapped_cta_is_flagged() -> None:
    code = (
        "ctas.map((entry) => (\n"
        "  <div>{entry.ctaButtonText}<span>{entry.link}</span></div>\n"
        "))"
    )
    defects = _design_doc_defects(code, "outro", _DOC)
    assert any("does not exist on it" in d and ".link" in d for d in defects)


def test_reading_the_real_keys_is_not_flagged() -> None:
    code = (
        "props.ctaProps?.ctas ?? [];\n"
        "(props.ctaProps?.ctas ?? []).map((c, i) => (\n"
        "  <CtaButton key={i} label={c.ctaButtonText} link={c.websiteLink} />\n"
        "))\n"
        "<SocialIcons socials={props.ctaProps?.socials} accentColor={a} textColor={t} "
        "fontFamily={props.bodyFont} aspectRatio={props.aspectRatio} />"
    )
    defects = _design_doc_defects(code, "outro", _DOC)
    assert not any("does not exist on it" in d for d in defects)


def test_content_scenes_are_not_checked_for_this() -> None:
    # The rule only applies to the outro's ctas.map — a content scene mapping
    # some unrelated `items` array with a `.label` field must not be flagged.
    code = "items.map((c) => <div>{c.label}</div>)"
    defects = _design_doc_defects(code, "content", _DOC)
    assert not any("does not exist on it" in d for d in defects)
