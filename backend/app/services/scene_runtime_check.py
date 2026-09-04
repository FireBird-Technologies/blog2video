"""Level-2 validation: does a generated scene component actually RUN?

The pipeline had two static levels and no dynamic one:

  1. `_parse_check` — esbuild parses the snippet. Proves it is valid JSX.
  2. `validate_component_code` — regex contracts (fit, palette, props, …).

Neither executes the code, and that gap shipped a real defect. Template 179's
`sequence` scene held 7,782 characters that parsed, wrapped, and passed every
gate, then rendered a BLANK FRAME in production: it read `props.bullets` on a
scene the render path fills via `props.steps`, so its list was always empty and
the component returned an empty tree. A component that draws nothing is not a
syntax error and not a contract violation — it is only visible by running it.

This module compiles the scene the way the preview does (Babel, react preset),
injects the same free variables the runtime injects (KIT_EXPORT_NAMES — the
manifest shared by the preview compiler and the render wrapper), calls the
component with REALISTIC props, and reports whether anything was drawn.

Fails OPEN throughout: a missing node/babel toolchain returns "passed" rather
than blocking generation, matching `_parse_check` and
`validate_wrapped_component_code`.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile

# Prop SHAPES, per remotion-video/src/templates/generated/types.ts.
#
# Getting these right is what makes the check trustworthy rather than
# decorative: stub `quote` as a list and this harness happily passes code that
# renders blank in production, because the scene's `Array.isArray(props.quote)`
# branch would be satisfied by the stub and empty in reality. That exact
# mismatch is what made the quote scene blank in the first place.
_SAMPLE_BULLETS = [
    "Throughput scales linearly across nodes",
    "Latency stays under four milliseconds",
    "Cost per token falls by half",
    "Deployments roll out with zero downtime",
    "Observability is built in from day one",
]
_SAMPLE_PAIRS = [
    {"label": "2019", "description": "First silicon taped out"},
    {"label": "2021", "description": "Cluster reaches ten thousand nodes"},
    {"label": "2023", "description": "Inference cost halved"},
    {"label": "2025", "description": "Deployed across four continents"},
    {"label": "2026", "description": "Open sourced the toolchain"},
]
_SAMPLE_METRICS = [
    {"value": "4.2x", "label": "FASTER", "description": "End-to-end throughput"},
    {"value": "68%", "label": "CHEAPER", "description": "Cost per million tokens"},
    {"value": "12ms", "label": "LATENCY", "description": "Median response"},
    {"value": "99.99%", "label": "UPTIME", "description": "Rolling twelve months"},
]


# The CTA payload the render path hands the ENDING scene. Shape matters as much
# here as it does for the content props above: `socials` is an object MAP keyed
# by platform (SocialsMap in SocialIcons.tsx), not an array. Stubbing it as a
# list — or omitting it, as this harness did — lets `(props.ctaProps?.socials ??
# []).map(...)` pass, because the `?? []` fallback swallows the undefined. That
# exact scene then throws "(socials ?? []).map is not a function" in the browser
# the moment a real project supplies its socials.
_SAMPLE_CTA_PROPS = {
    "socials": {
        "linkedin": {"enabled": True, "label": "LinkedIn"},
        "instagram": {"enabled": True, "label": "Instagram"},
        "youtube": {"enabled": True, "label": "YouTube"},
    },
    "ctas": [
        {"ctaButtonText": "Get started", "websiteLink": "yourbrand.com"},
    ],
    "showWebsiteButton": True,
    "websiteLink": "yourbrand.com",
    "ctaButtonText": "Get started",
}


def _sample_props(
    content_type: str = "plain",
    aspect_ratio: str = "landscape",
    role: str = "content",
    with_cta: bool = True,
) -> dict:
    """Realistic props for one scene, matching what GeneratedVideo.tsx passes."""
    props: dict = {
        # The two on-screen text fields, in their v3 roles: sceneTitle is the
        # scene's TITLE (5-7 words, the largest type on the frame, sized by
        # titleFontSize) and displayText is the shorter supporting copy at
        # descriptionFontSize. They were the other way round — a paragraph in
        # displayText under a two-word "THE ESSENTIALS" kicker — which is not
        # the shape a generated scene now receives, so a geometry defect in the
        # title would not have shown up here.
        "sceneTitle": "Engineered for the next decade",
        "displayText": "Built for workloads that did not exist when the last generation shipped.",
        "narrationText": "This is the voiceover script and must never be rendered.",
        "aspectRatio": aspect_ratio,
        "sceneIndex": 1,
        "totalScenes": 9,
        "brandColors": {
            "background": "#0B0B0B",
            "text": "#FFFFFF",
            "accent": "#76B900",
            "primary": "#76B900",
        },
        "headingFont": "Inter",
        "bodyFont": "Inter",
        # In-band for the title (48-88 landscape) rather than the old 96, which
        # sized a paragraph and could not be reached by a real scene.
        "titleFontSize": 68,
        "descriptionFontSize": 34,
        "layoutProps": {},
        "logoUrl": "https://example.invalid/logo.png",
        "imageUrl": "https://example.invalid/image.jpg",
    }
    # Exactly ONE structured prop is filled per scene, chosen by content_type —
    # mirroring GeneratedVideo.tsx. Filling them all would hide precisely the
    # wrong-prop defect this check exists to catch.
    if content_type == "bullets":
        props["bullets"] = list(_SAMPLE_BULLETS)
    elif content_type == "steps":
        props["steps"] = list(_SAMPLE_BULLETS)
    elif content_type == "code":
        props["codeLines"] = ["const x = 1;", "return x * 2;"]
        props["codeLanguage"] = "ts"
    elif content_type == "metrics":
        props["metrics"] = list(_SAMPLE_METRICS)
    elif content_type == "timeline":
        props["timelineItems"] = list(_SAMPLE_PAIRS)
    elif content_type == "quote":
        props["quote"] = "The best way to predict the future is to invent it."
        props["quoteAuthor"] = "Alan Kay"
    elif content_type == "comparison":
        props["comparisonLeft"] = {"label": "Before", "description": "Manual, slow, brittle"}
        props["comparisonRight"] = {"label": "After", "description": "Automated and observable"}

    # Only the ending scene receives a CTA payload, mirroring the render path.
    # `with_cta=False` covers the other half of the contract the outro prompt
    # demands: template previews and CTA-less projects pass nothing, and the
    # scene must still render a finished frame rather than an empty one.
    if role == "outro" and with_cta:
        props["ctaProps"] = json.loads(json.dumps(_SAMPLE_CTA_PROPS))
    return props


def _repo_root() -> str:
    # backend/app/services/… -> repo root
    return os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )


def _kit_names() -> list[str]:
    """Read the shared export manifest — the same list the preview compiler and
    the render wrapper use, so this harness can never drift from either."""
    manifest = os.path.join(
        _repo_root(),
        "frontend", "src", "components", "remotion", "generated", "kit",
        "exportManifest.generated.ts",
    )
    try:
        with open(manifest, "r", encoding="utf-8") as fh:
            body = fh.read()
    except OSError:
        return []
    block = re.search(r"KIT_EXPORT_NAMES\s*=\s*\[(.*?)\]", body, re.DOTALL)
    if not block:
        return []
    return re.findall(r'"([A-Za-z_$][\w$]*)"', block.group(1))


def _babel_path() -> str | None:
    p = os.path.join(_repo_root(), "frontend", "node_modules", "@babel", "standalone", "babel.min.js")
    if os.path.exists(p):
        return p
    p2 = os.path.join(_repo_root(), "frontend", "node_modules", "@babel", "standalone", "babel.js")
    return p2 if os.path.exists(p2) else None


def runtime_check_scene(
    code: str,
    *,
    content_type: str = "plain",
    aspect_ratio: str | None = None,
    role: str = "content",
    timeout: int = 20,
) -> tuple[bool, str | None]:
    """Compile and RUN the scene. Returns (ok, error_message).

    Fails open — a missing toolchain, a timeout or any harness problem returns
    (True, None). This is defence in depth, never the only gate.

    Runs BOTH orientations by default (`aspect_ratio=None`). Almost every scene
    branches on `props.aspectRatio === 'portrait'`, and the two branches are
    often laid out independently — so checking one proves nothing about the
    other. Template 192's metrics_ledger shipped a stray `{ 1: 1 }` style key in
    its portrait branch alone: it crashed only in portrait while landscape was
    fine, and this gate passed it because it only ever ran landscape. Pass an
    explicit "landscape"/"portrait" to check just one.

    An outro scene is additionally run with a real CTA payload and with none.
    The prompt requires it to survive both, and each state exercises code the
    other never reaches — the with-CTA pass is what catches array operations on
    the `socials` object map, while the without-CTA pass catches a scene that
    renders an empty frame when nothing is configured.
    """
    if not code or not code.strip():
        return False, "Code is empty"

    babel = _babel_path()
    if not babel:
        return True, None

    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scene_runtime_harness.mjs")
    if not os.path.exists(harness):
        return True, None

    ratios = (aspect_ratio,) if aspect_ratio else ("landscape", "portrait")
    cta_states = (True, False) if role == "outro" else (True,)
    for ratio in ratios:
        for with_cta in cta_states:
            ok, err = _run_once(
                code,
                harness=harness,
                babel=babel,
                content_type=content_type,
                aspect_ratio=ratio,
                role=role,
                with_cta=with_cta,
                timeout=timeout,
            )
            if not ok:
                if role == "outro" and not with_cta:
                    err = (
                        f"{err}\n\nThis failure is from rendering the ending scene with NO CTA "
                        "configured (props.ctaProps is undefined) — the state every template "
                        "preview and every CTA-less project uses. The scene must still look "
                        "finished and deliberate with none of it present."
                    )
                if len(ratios) > 1:
                    err = (
                        f"{err}\n\nThis failure is from the {ratio.upper()} rendering "
                        f"(props.aspectRatio === '{ratio}'). Both orientations must work: "
                        "fix this branch without changing the one that already renders."
                    )
                return False, err
    return True, None


def _run_once(
    code: str,
    *,
    harness: str,
    babel: str,
    content_type: str,
    aspect_ratio: str,
    role: str,
    with_cta: bool,
    timeout: int,
) -> tuple[bool, str | None]:
    """One harness invocation against a single set of props. See runtime_check_scene."""
    payload = {
        "code": code,
        "props": _sample_props(content_type, aspect_ratio, role=role, with_cta=with_cta),
        "kitNames": _kit_names(),
        "babelPath": babel,
        "frame": 30,
    }

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
            json.dump(payload, fh)
            tmp_path = fh.name
        proc = subprocess.run(
            ["node", harness, tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (subprocess.TimeoutExpired, OSError):
        return True, None
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    if proc.returncode != 0 and not proc.stdout.strip():
        return True, None  # harness itself failed — fail open

    try:
        result = json.loads(proc.stdout.strip() or "{}")
    except json.JSONDecodeError:
        return True, None

    if result.get("skipped"):
        return True, None
    if result.get("ok"):
        # Ran without throwing — but "drew nothing" is the defect that shipped,
        # and it is not an exception. Assert on the OUTPUT.
        if result.get("empty") or int(result.get("nodes") or 0) == 0:
            return False, (
                "This scene compiles and runs but renders an EMPTY FRAME — the component "
                "returned no elements. The usual cause is reading a structured prop the "
                "render path does not fill for this scene (e.g. props.bullets on a "
                f"`{content_type}` scene), so every list is empty and nothing is drawn. "
                "Read this scene's own content prop, and make sure the layout still "
                "renders its headline when that prop is absent."
            )
        # Geometry findings are STATIC overflow — a box the scene itself sized
        # off the canvas, or fixed-size nowrap copy that cannot fit its box.
        # These are real defects rather than heuristics (see the harness), but
        # they are also the newest check here, so they are reported with the
        # measurement attached so a repair can be judged rather than guessed.
        geometry = result.get("geometry") or []
        if geometry:
            _items = "\n".join(f"  • {g}" for g in geometry)
            return False, (
                "This scene runs, but it places content OUTSIDE the frame or in a box "
                f"too small for the text it holds:\n{_items}\n"
                "Derive every box from useVideoConfig() rather than writing absolute "
                "pixel numbers, and wrap variable-length copy in <FitText> with a real "
                "containerWidth so it can size itself to the space it actually has."
            )
        return True, None

    err = str(result.get("error") or "unknown runtime failure")
    return False, (
        f"This scene fails at RUNTIME (it parses, but crashes when rendered): {err}. "
        "Fix the crash while keeping the layout, geometry and motion unchanged."
    )
