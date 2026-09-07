"""
Validates AI-generated Remotion component code before storing in DB.

Cleans common AI artifacts (markdown fences, import lines) then checks
for dangerous APIs and required structure.
"""

import re
import shutil
import subprocess

from app.config import settings

# ─── Real parser gate ───────────────────────────────────────
# The regex checks below (brace/paren balance etc.) are heuristics — they can't
# catch a syntactically-invalid stray token that doesn't unbalance anything,
# e.g. a stray `n` glued onto the front of a line right before `React.createElement(`.
# That kind of corruption compiles clean past every regex check here yet fails
# esbuild/Babel at bundle time with "Expected X but found Y" — a class of failure
# SceneErrorBoundary explicitly can't catch (the module never finishes compiling).
# Feed the code through the SAME esbuild binary the render pipeline bundles with
# (remotion-video/node_modules/.bin/esbuild) in `transform` mode (no bundling, no
# resolving imports — just parse + JSX transform) so this check catches exactly
# what would otherwise blank the scene at render/preview time.
_ESBUILD_PATH_CACHE: str | None | bool = False  # False = not looked up yet


def _find_esbuild() -> str | None:
    global _ESBUILD_PATH_CACHE
    if _ESBUILD_PATH_CACHE is not False:
        return _ESBUILD_PATH_CACHE  # type: ignore[return-value]

    import os

    candidates = [
        os.path.join(settings.REMOTION_PROJECT_PATH, "node_modules", ".bin", "esbuild"),
        shutil.which("esbuild"),
    ]
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            _ESBUILD_PATH_CACHE = c
            return c
    _ESBUILD_PATH_CACHE = None
    return None


def _parse_check(code: str) -> tuple[bool, str | None]:
    """Run the code through esbuild's parser (transform, no bundling) to catch
    real syntax errors the regex heuristics below miss. Returns (True, None) if
    esbuild isn't available (fails open — this is a defense-in-depth extra, not
    the only gate) or if the code parses cleanly; (False, message) on a genuine
    syntax error.
    """
    esbuild = _find_esbuild()
    if not esbuild:
        return True, None
    try:
        proc = subprocess.run(
            [esbuild, "--loader=jsx", "--format=esm"],
            input=code,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (subprocess.TimeoutExpired, OSError):
        return True, None  # fail open — don't block generation on a tooling hiccup
    if proc.returncode != 0:
        # esbuild's stderr is human-readable and already includes the offending
        # line/column — surface it directly so a failed generation is diagnosable.
        return False, f"Syntax error (esbuild): {proc.stderr.strip()[:500]}"
    return True, None

# ─── Dangerous APIs that must never appear ───────────────────
# Only block things that are genuinely dangerous in a sandboxed
# Remotion component.  Keep this list tight to avoid false positives.
DANGEROUS_REGEX = [
    (re.compile(r"\beval\s*\("), "eval()"),
    (re.compile(r"\bnew\s+Function\s*\("), "new Function()"),
    (re.compile(r"\bfetch\s*\("), "fetch()"),
    (re.compile(r"\bdocument\."), "document.*"),
    (re.compile(r"\bwindow\."), "window.*"),
    (re.compile(r"\bprocess\.env\b"), "process.env"),
    (re.compile(r"\bprocess\.exit\b"), "process.exit"),
    (re.compile(r"\bglobalThis\b"), "globalThis"),
    (re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest"),
    (re.compile(r"\bWebSocket\b"), "WebSocket"),
    (re.compile(r"\blocalStorage\b"), "localStorage"),
    (re.compile(r"\bsessionStorage\b"), "sessionStorage"),
    (re.compile(r"\bimport\s*\("), "dynamic import()"),
    (re.compile(r"\.constructor\b"), ".constructor access"),
    (re.compile(r"\bFunction\b(?!\s*\()"), "Function reference"),
    (re.compile(r"\bProxy\s*\("), "Proxy()"),
    (re.compile(r"\bReflect\."), "Reflect.*"),
    (re.compile(r"__proto__"), "__proto__ access"),
]

MAX_NESTING_DEPTH = 20


def _unescape_if_it_fixes_parsing(code: str) -> str:
    """Repair source whose newlines arrived JSON-ESCAPED.

    The model occasionally emits a whole scene with literal backslash-n instead
    of real line breaks:

        const kickerEnter = spring({\\n    frame: frame - 8,\\n  });

    esbuild then reports `Syntax error "n"` and the attempt is thrown away —
    burning a full generation rollout on a serialization artifact rather than a
    modelling mistake. One observed retry lost its first of three attempts to
    exactly this.

    Fixing it blindly would be dangerous: `"a\\nb"` inside a string literal and
    `/\\n/` in a regex are legitimate and must survive. So the repair is applied
    ONLY when the code does not parse as-is AND unescaping makes it parse. That
    makes a false positive structurally impossible — valid code is never
    touched, because valid code never enters this branch.
    """
    if "\\n" not in code:
        return code
    ok, _ = _parse_check(code)
    if ok:
        return code  # parses already — whatever \n it contains is intentional
    repaired = code.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\t", "\t")
    ok_after, _ = _parse_check(repaired)
    return repaired if ok_after else code


def clean_code(raw: str) -> str:
    """Clean common AI artifacts from generated code.

    - Strips markdown fences (```tsx ... ```)
    - Removes import/export lines (globals are pre-injected)
    - Repairs JSON-escaped newlines when that is what broke parsing
    - Trims whitespace
    """
    code = raw.strip()

    # Strip markdown fences
    code = re.sub(r"^```(?:tsx|jsx|javascript|js|typescript|ts)?\s*\n?", "", code)
    code = re.sub(r"\n?```\s*$", "", code)

    # Before the import/export stripping below: those are line-anchored regexes
    # (re.MULTILINE), and with escaped newlines the whole file is ONE line, so
    # they would silently fail to match.
    code = _unescape_if_it_fixes_parsing(code)

    # Remove ES import STATEMENTS the AI sometimes adds despite instructions
    # (globals are pre-injected). Only match true top-level import statements —
    # `import x from "..."`, `import { a } from "..."`, `import "..."`, or a
    # bare `import Name;`. Crucially this must NOT eat a dynamic `import(...)`
    # call, nor a wrapped expression continuation line that merely begins with
    # the token `import` (e.g. `React` on its own line after a `(`), which the
    # old `^import\s+.*?[;\n]` deleted — corrupting balanced parens and yielding
    # esbuild "Expected ")" but found ...".
    code = re.sub(
        r'^[ \t]*import\b(?![ \t]*\()[^\n;]*?(?:from[ \t]+[\'"][^\'"]+[\'"])?[ \t]*;?[ \t]*(?:\n|$)',
        "",
        code,
        flags=re.MULTILINE,
    )

    # Remove export lines
    code = re.sub(r"^export\s+(?:default\s+)?", "", code, flags=re.MULTILINE)

    return code.strip()


def validate_wrapped_component_code(code: str) -> tuple[bool, str | None]:
    """Parse-check the code AS IT WILL ACTUALLY BE BUNDLED.

    validate_component_code() checks the raw scene snippet, but the render
    pipeline bundles `_wrap_generated_code(raw)` — the snippet plus the remotion
    imports, ~45 named kit imports and a shadowing `interpolate` wrapper. A raw
    snippet can therefore parse cleanly on its own yet fail once wrapped, most
    commonly when the generated code declares a top-level name that collides
    with one of the injected imports:

        const Decor = ...;   // -> "Decor has already been declared"

    That is a bundle-time failure, which no React error boundary can contain —
    it blanks the WHOLE video (see SceneErrorBoundary's own note). Catching it
    before the code is stored is the point.

    NOTE ON DETECTION METHOD: esbuild does NOT catch this. Verified directly —
    both `transform` mode and file mode happily accept a module that imports
    `Decor` and then declares `const Decor = 1`, because esbuild does not
    resolve import bindings without a full bundle. The JS engine, however,
    rejects it as a SyntaxError at module-evaluation time ("Identifier 'Decor'
    has already been declared"), which means the module never evaluates and no
    React error boundary can contain it. So this check is a targeted static
    scan for top-level redeclarations of injected names rather than a parse.

    Returns (True, None) when the wrapper cannot be inspected (fails open).
    """
    if not code or not code.strip():
        return False, "Code is empty"

    # Lazy import: app.services.remotion pulls in models/r2_storage/email, so a
    # module-level import here would create a cycle (remotion -> ... -> validator).
    try:
        from app.services.remotion import _wrap_generated_code
    except Exception:  # noqa: BLE001 - degrade to a no-op rather than block generation
        return True, None

    try:
        wrapped = _wrap_generated_code(code)
    except Exception as e:  # noqa: BLE001
        return False, f"Failed to wrap generated code: {e}"

    # Collect every name the wrapper injects: the remotion imports, the kit
    # imports, React, and the local `interpolate` shim. Parsed out of the
    # wrapper's own output so this can never drift from the real import list.
    injected: set[str] = set()
    for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s+from", wrapped):
        for raw in m.group(1).split(","):
            name = raw.strip()
            if not name:
                continue
            # `interpolate as _interpolate` binds the ALIAS, not the original.
            if " as " in name:
                name = name.split(" as ", 1)[1].strip()
            if re.match(r"^[A-Za-z_$][\w$]*$", name):
                injected.add(name)
    for m in re.finditer(r"import\s+([A-Za-z_$][\w$]*)\s+from", wrapped):
        injected.add(m.group(1))
    # The wrapper also declares `const interpolate = ...` itself.
    injected.add("interpolate")

    # Any TOP-LEVEL declaration in the generated snippet that reuses one of
    # those names is a hard module-evaluation failure. Only scan column-0
    # declarations — a nested `const Decor` inside a function body is legal
    # shadowing, not a redeclaration.
    for m in re.finditer(
        r"^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)", code, flags=re.MULTILINE
    ):
        name = m.group(1)
        if name in injected:
            return False, (
                f"Top-level '{name}' redeclares an injected import — this is a "
                "module-evaluation SyntaxError that blanks the whole video and "
                "cannot be caught by an error boundary. Kit helpers and remotion "
                "APIs are already in scope; use them directly, never redeclare them."
            )

    return True, None


# Kit helpers that ARE animation. A scene built entirely from these has zero raw
# `interpolate(`/`spring(` calls yet is fully animated — counting only the raw
# calls rejected such scenes and sent the model into a repair loop that stripped
# working code to satisfy a substring count. Mirrors the _anim_signals list in
# code_generator._scene_reward.
_ANIM_HELPER_REGEX = re.compile(
    r'\b(?:staggerEntrance|headlinePop|panelRise|countUpString|CountUpValue'
    r'|RevealText|HighlightPhrase|KenBurnsImage|SignatureArtifact|IntroStage'
    r'|CornerFrame|StreakField|KineticTicker|BigGlyphBackdrop|PulseRing|AccentSweep)\b'
)

# A data-content-img slot that fills the whole frame.
#
# Matches the marker plus a style block within ~400 chars that is BOTH absolutely
# positioned AND full-size (either 100%/100% or an inset:0 / AbsoluteFill form).
# A bounded slot — a column, card or panel — never matches, which is the normal
# and correct shape.
_FULLBLEED_SLOT_RE = re.compile(
    r"data-content-img[^>]{0,400}?"
    r"(?=[^>]{0,400}?position\s*:\s*['\"]absolute)"
    r"(?=[^>]{0,400}?(?:width\s*:\s*['\"]100%|inset\s*:\s*0))"
    r"(?=[^>]{0,400}?(?:height\s*:\s*['\"]100%|inset\s*:\s*0))",
    re.DOTALL,
)

# The scene's RENDERED text/content layers. Used only to establish DOM ORDER
# relative to the image slot — a full-bleed slot before them is a backdrop,
# after them it is a cover.
#
# MUST MATCH JSX, NOT IDENTIFIERS. A bare `displayText` also matches the variable
# declaration at the top of the file:
#
#     const quoteText = props.displayText || "";     <- line 15
#     ...
#     <div data-content-img="1" style={{inset: 0}}>  <- line 90, a backdrop
#     ...
#     <FitText>{quoteText}</FitText>                 <- invisible to a `displayText` match
#
# The last "content" then sat at line 15, every backdrop looked like it came
# after the content, and correct scenes were rejected — measured on template 173,
# where a quote scene aliased displayText and had exactly ONE match, in its
# declarations. So: match opening JSX TAGS (`<FitText`, `<h1`, `<p`, `<span`…)
# and JSX text interpolations (`>{`), both of which only occur in the tree.
_CONTENT_LAYER_RE = re.compile(
    # A component or intrinsic element that carries copy. Deliberately NOT a
    # bare `>{` interpolation: the image slot's own `>{hasImage && <Img …>}`
    # would match, making the slot count as content that comes after itself and
    # letting a genuine cover-bug through.
    r"<\s*(?:FitText|RevealText|HighlightPhrase|StatGrid|MetricRow|StatCard"
    r"|CodeBlock|CountUpValue|SocialIcons"
    r"|h[1-6]|p|span|strong|em|li|blockquote|figcaption)\b"
    # ...or a text prop interpolated INTO the tree (`>{headline}`, `{title}<`),
    # which is how a hand-rolled headline renders. Restricted to a bare
    # identifier or member expression so JSX logic (`{hasImage && …}`) is not
    # mistaken for rendered copy.
    r"|>\s*\{\s*[A-Za-z_$][\w$.]*\s*\}"
)

# The logo conditional, in every form a competent author might write it.
#
# The old pattern only accepted `props.logoUrl &&` / `logoUrl &&` / `hasLogo` /
# `!!props.logoUrl` / `logoUrl ?`. It REJECTED these perfectly valid forms:
#     const logo = props.logoUrl;          {logo && <Img src={logo} />}
#     const { logoUrl } = props;           {logoUrl ? <Img/> : null}
#     {Boolean(props.logoUrl) && <Img/>}
# so the model was told to fix code that was already correct, "fixed" it by
# restructuring, and lost another contract in the process.
_LOGO_CONDITIONAL_REGEX = re.compile(
    r'(?:'
    r'props\.logoUrl\s*(?:&&|\?)'          # props.logoUrl && / ?
    r'|!!\s*props\.logoUrl'                # !!props.logoUrl
    r'|Boolean\s*\(\s*props\.logoUrl'      # Boolean(props.logoUrl)
    r'|\blogoUrl\s*(?:&&|\?)'              # destructured logoUrl && / ?
    r'|\bhasLogo\w*\b'                     # hasLogo / hasLogoAsset / ...
    r'|\b\w*[Ll]ogo\w*\s*&&\s*<'           # const logo = ...; {logo && <Img/>}
    r'|\blogoUrl\s*!==?\s*(?:null|undefined)'  # explicit null check
    r')'
)

# Same widening for the image conditional.
_IMAGE_CONDITIONAL_REGEX = re.compile(
    r'(?:'
    r'\bhasImage\w*\b'
    r'|props\.imageUrl\s*(?:&&|\?)'
    r'|!!\s*props\.imageUrl'
    r'|Boolean\s*\(\s*props\.imageUrl'
    r'|\bimageUrl\s*(?:&&|\?)'
    r'|\bimageUrl\s*!==?\s*(?:null|undefined)'
    r')'
)


# The ONLY pre-injected names a newly generated scene may reference.
#
# The runtime still injects ~86 (see exportManifest.generated.ts) and that is
# deliberate: stored scenes call StatGrid, SceneFrame, RevealText and must keep
# rendering. But a NEW scene composing from that catalog is how every template
# ended up sharing a look, so the vocabulary is narrowed here instead of in the
# injection set — which would break every existing template.
#
# Each of these does something a scene cannot correctly reimplement inline.
# The smallest type that survives a 1920x1080 frame after H.264. Mirrors
# design_doc.MIN_ON_SCREEN_PX — the doc stage and the code stage must agree, or
# one tells the model 22px while the other accepts 13px.
MIN_ON_SCREEN_PX = 22

ALLOWED_KIT_NAMES = frozenset({
    "FitText",        # measures the DOM + holds delayRender so export == preview
    "FitBlock",       # shared type budget: title + body shrink together, not apart
    "readableOn",     # measured light/dark decision behind the contrast gate
    "ensureContrast", # nudges a pairing until it clears AA
    "withAlpha",      # same hue at partial alpha, without minting a fourth colour
    "SocialIcons",    # shared glyph set + handle resolution for the ending
})

# Names that are injected but off-limits to new scenes. Listed explicitly (rather
# than "anything not allowed") so the error can name what was used and the model
# is not left guessing which identifier tripped the gate.
#
# SPLIT INTO TWO PATTERNS, AND THAT SPLIT IS LOad-BEARING.
#
# The lowercase entries below are ordinary identifiers — `cardStyle`, `typeScale`,
# `panelTilt`, `backgroundCss` are exactly what a person names a local style
# object or a derived size. Matched with a bare word boundary anywhere in the
# file, a completely correct line:
#
#     const cardStyle = { padding: 40, borderRadius: 24, background: panel };
#
# was reported as "uses pre-built component(s) that are not available to it:
# cardStyle. Build these elements yourself with plain JSX and inline styles" —
# which is precisely what that line already does. The instruction was
# unfollowable: the only fix is to RENAME the variable, and the message never
# said so. Observed in production, and a strong candidate for scenes that burn
# all eight attempts and ship the deterministic stub.
#
# So a lowercase name is only forbidden where it is genuinely a USE of the kit
# helper — a call `cardStyle(` or a member access `kit.cardStyle` — never a
# declaration or a bare mention. The PascalCase names keep the loose match: they
# are components, nothing else is plausibly named `StatGrid`, and JSX usage is
# what matters there.
_FORBIDDEN_KIT_COMPONENT_RE = re.compile(
    r"\b("
    r"SceneFrame|Decor|SignatureArtifact|StatGrid|StatCard|MetricRow|RevealText|"
    r"HighlightPhrase|KenBurnsImage|IntroStage|CodeBlock|CustomChart|CustomTable|"
    r"CountUpValue|DropCap|Kicker|Masthead|PanelNumber|SectionDivider|EditorialRule|"
    r"SafeArea|CenteredFocal|AsymmetricSplit|FullBleedHero|OffsetCardStack|SideRail|"
    r"CornerFrame|StreakField|KineticTicker|BigGlyphBackdrop|PulseRing|AccentSweep|"
    r"DiagonalShards|HalftoneField|StarburstBadge|LightDust|OrbitRings|"
    r"KitVariantProvider|EyebrowSizeProvider"
    r")\b"
)

# The lowercase helpers, forbidden only when CALLED or accessed off an object.
# `(?<![.\w])name\s*\(` is a call; `\.name\b` is a member read. A declaration
# (`const name =`) and a bare mention match neither.
_FORBIDDEN_KIT_HELPER_RE = re.compile(
    r"(?:(?<![.\w])(?P<call>"
    r"cameraStage|cameraPush|parallaxLayer|panelTilt|cardStyle|derivePalette|"
    r"typeScale|useKit|staggerEntrance|headlinePop|panelRise|countUpString|"
    r"backgroundCss"
    r")\s*\()"
    r"|(?:\.(?P<member>"
    r"cameraStage|cameraPush|parallaxLayer|panelTilt|cardStyle|derivePalette|"
    r"typeScale|useKit|staggerEntrance|headlinePop|panelRise|countUpString|"
    r"backgroundCss"
    r")\b)"
)


# Every reserved name, as a plain name test — "is this identifier reserved?"
# rather than "does this code USE it?". The two questions are different now that
# a local `const cardStyle = ...` is legal, and only this one is a pure name
# lookup: it backs the anti-drift test that stops _score_valid_scene from scoring
# on an identifier no scene may write.
_RESERVED_KIT_NAME_RE = re.compile(
    r"\b("
    r"SceneFrame|Decor|SignatureArtifact|StatGrid|StatCard|MetricRow|RevealText|"
    r"HighlightPhrase|KenBurnsImage|IntroStage|CodeBlock|CustomChart|CustomTable|"
    r"CountUpValue|DropCap|Kicker|Masthead|PanelNumber|SectionDivider|EditorialRule|"
    r"SafeArea|CenteredFocal|AsymmetricSplit|FullBleedHero|OffsetCardStack|SideRail|"
    r"CornerFrame|StreakField|KineticTicker|BigGlyphBackdrop|PulseRing|AccentSweep|"
    r"DiagonalShards|HalftoneField|StarburstBadge|LightDust|OrbitRings|"
    r"cameraStage|cameraPush|parallaxLayer|panelTilt|cardStyle|derivePalette|"
    r"typeScale|useKit|staggerEntrance|headlinePop|panelRise|countUpString|"
    r"KitVariantProvider|EyebrowSizeProvider|backgroundCss"
    r")\b"
)


def _forbidden_kit_names(code: str) -> list[str]:
    """Every off-limits kit name this code actually USES, in source order.

    A local `const cardStyle = {...}` is not a use — see the note above
    _FORBIDDEN_KIT_COMPONENT_RE for what treating it as one cost.
    """
    names: list[str] = []
    for _m in _FORBIDDEN_KIT_COMPONENT_RE.finditer(code):
        names.append(_m.group(1))
    for _m in _FORBIDDEN_KIT_HELPER_RE.finditer(code):
        names.append(_m.group("call") or _m.group("member"))
    # De-duplicate, preserving order, so the error names each once.
    return list(dict.fromkeys(names))

# ── Font-size DEFAULT parsing ────────────────────────────────────────────────
#
# The value after `??` is what every preview and every render actually shows,
# because the editor's sliders start unset. These parse it out of the two shapes
# the prompt mandates and nothing else:
#
#     props.titleFontSize ?? 76                       -> flat (rejected, see below)
#     props.titleFontSize ?? (isPortrait ? 52 : 76)   -> {portrait: 52, landscape: 76}
#
# Anything more computed than that (a Math.min, a variable, a nested ternary) is
# NOT parsed and NOT judged. Guessing at an expression the model wrote would
# reject correct scenes, and a false positive here costs a full LLM rollout.
_FONT_DEFAULT_TERNARY = re.compile(
    r"props\.(titleFontSize|descriptionFontSize)\s*\?\?\s*\(?\s*"
    r"(!?)\s*isPortrait\s*\?\s*(\d{1,3})\s*:\s*(\d{1,3})"
)
_FONT_DEFAULT_FLAT = re.compile(
    r"props\.(titleFontSize|descriptionFontSize)\s*\?\?\s*(\d{1,3})\b"
)


def _font_defaults(code: str) -> dict[str, dict[str, int]]:
    """Map each font prop to its {portrait, landscape} default, where parseable.

    A `!isPortrait ? A : B` writes the arms in the opposite order, so the negation
    is captured and the arms swapped rather than silently read backwards — which
    would turn a correct scene into a reported defect.
    """
    out: dict[str, dict[str, int]] = {}
    for prop, negated, first, second in _FONT_DEFAULT_TERNARY.findall(code):
        p, l = (int(second), int(first)) if negated else (int(first), int(second))
        out.setdefault(prop, {"portrait": p, "landscape": l})
    return out


def _font_default_defects(code: str) -> list[str]:
    """Report every unsound font-size default: flat, inverted, or out of band."""
    from app.services.code_generator import _TYPE_CEILING, _TYPE_FLOOR

    defects: list[str] = []
    parsed = _font_defaults(code)

    # A flat default is only wrong for a scene that KNOWS about orientation.
    # A scene with no isPortrait at all is caught by the orientation gate, and
    # reporting both would send two errors for one cause.
    if re.search(r"\bisPortrait\b", code):
        for prop, raw in _FONT_DEFAULT_FLAT.findall(code):
            if prop in parsed:
                continue  # this occurrence is the ternary form, already parsed
            defects.append(
                f"props.{prop} falls back to a single flat default ({raw}px) used for BOTH "
                f"orientations. Portrait is 1080 wide against landscape's 1920, so one size "
                f"cannot serve both — the same type eats nearly twice the line in portrait. "
                f"Make it orientation-aware: props.{prop} ?? (isPortrait ? P : L)."
            )

    _band = {"titleFontSize": "headline", "descriptionFontSize": "body"}
    for prop, sizes in parsed.items():
        for orient in ("portrait", "landscape"):
            key = f"{_band[prop]}_{orient}"
            lo, hi = _TYPE_FLOOR[key], _TYPE_CEILING[key]
            got = sizes[orient]
            if not (lo <= got <= hi):
                defects.append(
                    f"props.{prop}'s {orient} default is {got}px, outside the {lo}-{hi}px "
                    f"band for {_band[prop]} type on a {orient} canvas. "
                    + (
                        "Above the ceiling it overflows the frame before FitText can pull it "
                        "back."
                        if got > hi
                        else "Below the floor it is unreadable once H.264 has crushed the frame."
                    )
                    + f" Use a value in {lo}-{hi}."
                )

    # Hierarchy: the headline must outrank the body in BOTH orientations.
    title, body = parsed.get("titleFontSize"), parsed.get("descriptionFontSize")
    if title and body:
        for orient in ("portrait", "landscape"):
            if title[orient] <= body[orient]:
                defects.append(
                    f"In {orient} the headline default ({title[orient]}px) is not larger than "
                    f"the body default ({body[orient]}px), so the type hierarchy inverts and "
                    f"the paragraph reads as loud as the headline. The headline must be "
                    f"clearly bigger — aim for about "
                    f"{'1.7' if orient == 'portrait' else '2.2'}x the body size."
                )

    return defects


# Every member Remotion's `Easing` actually has, read off the live module:
#
#   node -e "const {Easing}=require('remotion');
#            console.log(Object.getOwnPropertyNames(Easing))"
#
# There are NO flat combined members. `inOutCubic`, `easeInOut`, `inOutQuad`,
# `easeOutBack` and friends all read as `undefined`, and `undefined` is what
# then gets CALLED — see _easing_defects for what that costs.
_EASING_MEMBERS = frozenset({
    "back", "bezier", "bounce", "circle", "cubic", "ease", "elastic", "exp",
    "in", "inOut", "linear", "out", "poly", "quad", "sin", "step0", "step1",
})

_EASING_REF_RE = re.compile(r"\bEasing\.([A-Za-z_$][\w$]*)")

# The combinators, for turning a bad flat name into the right suggestion:
# inOutCubic -> Easing.inOut(Easing.cubic).
_EASING_COMBINATORS = ("inOut", "in", "out", "ease")


# The CURVES a combinator may wrap. Deliberately excludes the combinators
# themselves and bezier/poly (which take their own arguments) — suggesting
# `Easing.in(Easing.out)` for "easeInOut" is syntactically valid and
# semantically meaningless, and a wrong suggestion costs a repair round.
_EASING_CURVES = frozenset({
    "quad", "cubic", "sin", "circle", "exp", "bounce", "back", "elastic",
    "linear", "ease", "step0", "step1",
})


def _suggest_easing(bad: str) -> str:
    """Best-effort 'did you mean' for an invented Easing member."""
    name = bad[4:] if bad.lower().startswith("ease") and len(bad) > 4 else bad
    # Common near-misses for a curve Remotion spells differently.
    _aliases = {"sine": "sin", "expo": "exp", "circ": "circle", "quart": "quad"}
    # Longest combinator first, so "inOutCubic" matches "inOut" and not "in".
    for combo in sorted(_EASING_COMBINATORS, key=len, reverse=True):
        if name.lower().startswith(combo.lower()) and len(name) > len(combo):
            curve = name[len(combo):]
            curve = curve[0].lower() + curve[1:]
            curve = _aliases.get(curve, curve)
            if curve in _EASING_CURVES:
                return f"Easing.{combo}(Easing.{curve})"
    lowered = name[0].lower() + name[1:] if name else name
    if lowered in _EASING_MEMBERS:
        return f"Easing.{lowered}"
    return "Easing.inOut(Easing.cubic)"


# Every <FitText …> opening tag, with its attribute text, so each instance can
# be judged on its own props rather than file-wide.
#
# Requires whitespace or `/` after the tag name, so a bare `<FitText>` written
# in PROSE — a code comment explaining the contract, which real scenes do carry
# — is not mistaken for a real element with no attributes. That false match
# made the stub fail its own gate.
_FITTEXT_TAG_RE = re.compile(r"<\s*FitText(?=[\s/])([^>]*)>", re.DOTALL)

# A self-closing <FitText … />. Separate from the tag regex above because that
# one deliberately matches BOTH forms — it judges attributes, not shape.
# `[^>]*` cannot span a `>` inside an attribute (style objects use `{{ }}`, and
# a `>` there would be inside braces), which matches how _FITTEXT_TAG_RE
# already scans attribute text.
_FITTEXT_SELF_CLOSING_RE = re.compile(r"<\s*FitText(?=[\s/])[^>]*/\s*>", re.DOTALL)

# Comments are stripped before the scan for the same reason: a line like
# `// wrap it in <FitText containerWidth={w}>` is documentation, not an element.
_LINE_COMMENT_RE = re.compile(r"//[^\n]*")
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


def _strip_comments(code: str) -> str:
    return _LINE_COMMENT_RE.sub("", _BLOCK_COMMENT_RE.sub("", code))


def _fit_geometry_defects(code: str) -> list[str]:
    """Every <FitText> must be told the box it lives in.

    WHY THIS IS A HARD GATE. Without `containerWidth`, FitText falls back to
    `width * widthFraction` — 0.86 of the FULL 1920px canvas — so a headline in
    a 44% column is sized as if it owned the frame. Its own docstring calls this
    "a ~2x overestimate, and the direct cause of headlines breaking mid-word
    inside narrow columns". Measured on stored template 184: NOT ONE of its 9
    scenes passed containerWidth, and 8 of 9 passed no maxHeight either.

    The effect is both reported symptoms at once. Too large: the width solve
    resolves to the grow-ceiling for all but the longest copy, so a designed
    76px headline renders at 95-122px. Too small: where a scene does bound its
    box, the inflated seed drives the fitter down to its floor.

    The kit cannot fix this on its own — only the scene knows whether its text
    sits in a half-width split, a 40% rail or the full frame. So the geometry
    has to be demanded here, and taught in the prompt.

    A SPREAD COUNTS. `<FitText {...fitProps}>` where `fitProps` carries
    containerWidth is correct code, and hoisting repeated props into one object
    is the obvious thing to do in a `.map()` — the prompt even tells scenes to
    derive the width once from useVideoConfig(). Reading only the literal
    attribute text made that unsatisfiable: the model complies semantically,
    the regex still says no, and the message never hints that the LEXICAL form
    is what is being judged. So a spread whose object provably contains
    containerWidth is accepted, and the message names the tag it is talking
    about.
    """
    defects: list[str] = []
    scan = _strip_comments(code)

    # Objects that carry containerWidth, so a spread of one can be recognised:
    #     const fitProps = { containerWidth: colW, maxHeight: boxH };
    _spread_ok: set[str] = set()
    for _m in re.finditer(
        r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}",
        scan,
    ):
        if "containerWidth" in _m.group(2):
            _spread_ok.add(_m.group(1))

    _bad = 0
    for m in _FITTEXT_TAG_RE.finditer(scan):
        attrs = m.group(1)
        if "containerWidth" in attrs:
            continue
        if any(
            re.search(r"\{\s*\.\.\.\s*" + re.escape(n) + r"\b", attrs) for n in _spread_ok
        ):
            continue
        _bad += 1

    if _bad:
        defects.append(
            f"{_bad} <FitText> element(s) do not pass containerWidth, so they size "
            "themselves against 86% of the FULL canvas width instead of the box they "
            "actually occupy — roughly a 2x overestimate for anything in a column, "
            "which is why headlines render far too large and then break mid-word. "
            "Pass the real width on EVERY FitText: "
            "`const { width, height } = useVideoConfig();` then "
            "`containerWidth={width * 0.44}` (use the fraction your layout actually "
            "gives this text — 0.86 only if it spans the frame). Hoisting the shared "
            "props into one object and spreading it (`<FitText {...fitProps}>`) is "
            "fine, as long as that object sets containerWidth."
        )

    return defects


def _missing_fit_max_height(code: str) -> bool:
    """True when a wrappable <FitText> has no maxHeight. SOFT signal only.

    Deliberately NOT a hard gate, unlike containerWidth above. Two reasons:

      * containerWidth is the prop that actually fixes the reported bug. It is
        the ~2x width overestimate that made headlines render at 122px instead
        of 76px; maxHeight only refines the vertical budget afterwards.
      * The kit now falls back to a canvas-relative height budget rather than
        the old seed-derived one, so a missing maxHeight degrades to a sane
        default instead of disabling the fit entirely. A missing containerWidth
        has no such recovery — the kit cannot know the column width.

    Scored in _score_valid_scene so it still pushes scenes toward passing it,
    without rejecting otherwise-correct code over a refinement.
    """
    for m in _FITTEXT_TAG_RE.finditer(_strip_comments(code)):
        attrs = m.group(1)
        _lines = re.search(r"maxLines\s*=\s*\{?\s*(\d+)", attrs)
        multiline = (_lines is None) or int(_lines.group(1)) > 1
        if multiline and "maxHeight" not in attrs:
            return True
    return False


def _missing_fit_block(code: str) -> bool:
    """True when a scene stacks multiple <FitText> and wraps none in <FitBlock>.

    SOFT signal only, scored in _score_valid_scene — deliberately not a gate.

    WHY IT MATTERS. A <FitText> fits its OWN box. When a headline and a body
    paragraph sit in one column, each one individually "fits" its own slot while
    the two of them TOGETHER overflow the region holding them, and no FitText can
    see that — only <FitBlock>, which gives the group one shared scale. Rule 7
    teaches this; until now NOTHING checked it, so the rule was advice the model
    was free to skip. That is the "text still overflows sometimes" report: every
    individual fit gate passes and the column still spills.

    WHY IT IS NOT A HARD GATE. "Two FitTexts in the same column" is not something
    a regex can actually establish — the two could be in genuinely separate
    regions of a split layout, where independent fitting is correct and a
    FitBlock would be wrong. Counting them is a proxy, and a hard gate on a proxy
    rejects correct scenes. Scoring it pushes the model toward FitBlock without
    ever failing a scene for the proxy being wrong.
    """
    scan = _strip_comments(code)
    if "<FitBlock" in scan:
        return False
    return len(_FITTEXT_TAG_RE.findall(scan)) >= 2


def _easing_defects(code: str) -> list[str]:
    """Reject any `Easing.<member>` Remotion does not actually have.

    This is a CRASH, not a cosmetic defect, and it takes the whole page with it.
    Reading a missing member yields `undefined`; Remotion then calls it and
    throws "TypeError: easing is not a function" DURING RENDER. The throw
    unwinds into Remotion's own ErrorBoundary inside PlayerUI, which re-creates
    the component tree — re-running the same crash. crash -> catch -> remount
    pins the main thread, so ONE bad scene freezes the entire templates page,
    not just its own card. Measured on template 182: 8 of 9 scenes were correct
    and the 9th hung the browser.

    Nothing else in the pipeline could see it. The prompt never documented
    Easing's surface, no static gate inspected the value, and the runtime
    harness stubbed `interpolate` with only three parameters — so the options
    object, and the dead easing inside it, were never even passed.
    """
    bad = sorted({m for m in _EASING_REF_RE.findall(code) if m not in _EASING_MEMBERS})
    if not bad:
        return []
    return [
        f"Easing.{name} does not exist in Remotion — reading it yields `undefined`, which "
        f"is then called as a function and throws \"easing is not a function\" during "
        f"render, blanking the scene. Remotion has no flat combined easings; compose them "
        f"instead: use `{_suggest_easing(name)}`. The full set is: "
        f"{', '.join(sorted(_EASING_MEMBERS))}."
        for name in bad
    ]


_SUBSTITUTE_FOR = {
    "StatGrid": "lay the figures out yourself with divs and animate each with interpolate()",
    "MetricRow": "lay the figures out yourself with divs and animate each with interpolate()",
    "StatCard": "build the card with a div and your own styling",
    "CountUpValue": "interpolate(frame, [a, b], [0, target]) and format the number yourself",
    "RevealText": "split the string and stagger each part's opacity/transform with interpolate()",
    "HighlightPhrase": "wrap the phrase in a <span> and draw your own underline",
    "SceneFrame": "set the background and padding on your own root <AbsoluteFill>",
    "Decor": "position two or three shapes yourself at low alpha with withAlpha()",
    "SignatureArtifact": "draw the motif yourself with divs and interpolate()",
    "KenBurnsImage": "render <Img> and animate its transform with interpolate()",
    "CodeBlock": "render the lines yourself in a monospace <div>",
    "useKit": "read props.brandColors directly",
    "derivePalette": "read props.brandColors directly",
    "cardStyle": "write the panel's style object inline",
    "staggerEntrance": "interpolate(frame - i * 12, ...)",
    "headlinePop": "spring({ frame, fps }) on the headline's transform",
    "panelRise": "spring({ frame, fps }) on the panel's transform",
}


def _design_doc_defects(code: str, scene_type: str, scene_doc: str) -> list[str]:
    """Contract failures measured against this scene's own design document.

    Returns human-readable, actionable messages — see the note at the call site
    on why each one names the construct, the requirement and the minimal edit.
    """
    out: list[str] = []

    # ── 0. Micro-text ───────────────────────────────────────────────────────
    # A 1920x1080 frame watched across a room and crushed by H.264. 13px is
    # ~1.2% of frame height — invisible in playback. Measured across 108 real
    # generated scenes: 140 literals at or below 20px in 52 of them, against
    # only 8 above 96px. The design docs were fixed first (they used to specify
    # 12px themselves); this is the code-side half.
    _tiny = sorted({int(m) for m in re.findall(r"fontSize:\s*(\d+)\b", code)
                    if int(m) < MIN_ON_SCREEN_PX})
    if _tiny:
        out.append(
            f"Type below {MIN_ON_SCREEN_PX}px does not survive a 1920x1080 frame after "
            f"H.264 — this scene sets fontSize to {', '.join(str(t) for t in _tiny)}. "
            f"Derive small type from the body size with a floor instead of writing a "
            f"literal: `const labelSize = Math.max({MIN_ON_SCREEN_PX}, bodySize * 0.62);` "
            f"and use labelSize. Change only the sizes; keep the layout and motion."
        )

    # ── 0a. Content prop ────────────────────────────────────────────────────
    # The render path fills exactly ONE structured prop per scene, chosen by the
    # scene's content_type (GeneratedVideo.tsx). A scene that reads a different
    # one gets undefined, falls through to its own empty-array branch and draws
    # NOTHING — while passing every other check here, because the code is
    # perfectly valid. Measured on template 179: its `steps` scene read
    # props.bullets and rendered a blank frame from 7,782 characters of code.
    # The doc names the prop (_CONTENT_HEAD in code_generator); this gates it.
    #
    # The fix line must match the prop's SHAPE. Suggesting `(props.quote ?? [])
    # .slice(...)` for a string prop made the model write
    # `Array.isArray(props.quote) ? props.quote : []`, which is always empty —
    # the scene rendered blank and still failed here.
    _SHAPE_FIX = {
        "quote": (
            "`const text = props.quote || props.displayText;` and fit it with "
            "<FitText> — it is a STRING, so never Array.isArray / .slice it"
        ),
        "comparisonLeft": (
            "`const left = props.comparisonLeft; const right = props.comparisonRight;` "
            "— each is an OBJECT { label, description }, not an array"
        ),
    }
    _m = re.search(r"THIS SCENE'S DATA — props\.(\w+)", scene_doc)
    if _m:
        _want = _m.group(1)
        if not re.search(rf"props\.{_want}\b", code):
            _fix = _SHAPE_FIX.get(
                _want,
                f"`const items = (props.{_want} ?? []).slice(0, isPortrait ? 3 : 4);` "
                f"and fall back to props.displayText when it is empty",
            )
            out.append(
                f"This scene's content_type fills props.{_want}, but the code never "
                f"reads it — the render path leaves every other structured prop "
                f"undefined, so this scene draws an EMPTY FRAME in production. Read "
                f"props.{_want} as the scene's content source: {_fix}. Keep the "
                f"layout and motion exactly as they are — change only the data source."
            )

        # ── Object-shaped props must be read by FIELD ───────────────────────
        #
        # Reading the whole item paints the literal string "[object Object]".
        # Template 181's metrics scene did exactly this — `{String(item)}` —
        # and shipped four "[object Object]" blocks across the frame. It passed
        # every other check: String(obj) neither throws nor yields an empty
        # tree, which are the only two things the runtime check can see.
        _OBJECT_PROPS = {
            "metrics": "{ value, label, suffix? }",
            "timelineItems": "{ label, description }",
            "comparisonLeft": "{ label, description }",
            "comparisonRight": "{ label, description }",
        }
        _fields = _OBJECT_PROPS.get(_want)
        if _fields:
            # Follow the prop through its local aliases before looking for the
            # .map(). Scenes rarely map the prop directly — template 181 went
            # `props.metrics` -> metricsRaw -> metrics -> items -> .map(item),
            # three hops, so a pattern anchored on `props.metrics` saw nothing.
            # Same two-hop walk _prop_aliases does for the fit gate.
            _names = {_want}
            for _ in range(3):
                _alt = "|".join(re.escape(n) for n in _names)
                for _am in re.finditer(
                    rf"(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*?\b(?:props\.)?(?:{_alt})\b",
                    code,
                ):
                    _names.add(_am.group(1))
            _alt = "|".join(re.escape(n) for n in _names)
            # Bind the .map() item name(s), then look for the item being
            # rendered or string-handled WHOLE rather than by field.
            _items = {
                m.group(1)
                for m in re.finditer(
                    rf"\b(?:props\.)?(?:{_alt})\b[^;\n]{{0,160}}?"
                    rf"\.map\(\s*(?:function\s*)?\(?\s*(\w+)",
                    code,
                )
            }
            _bad: list[str] = []
            for _it in _items:
                _n = re.escape(_it)
                # {item} / {String(item)} / ${item} — a render with no field read.
                if (
                    re.search(rf">\s*\{{\s*{_n}\s*\}}", code)
                    or re.search(rf"\{{\s*String\(\s*{_n}\s*\)\s*\}}", code)
                    or re.search(rf"\$\{{\s*{_n}\s*\}}", code)
                    or re.search(rf"\bString\(\s*{_n}\s*\)", code)
                    # .split(/.trim()/.toUpperCase() on the object itself.
                    or re.search(rf"\b{_n}\s*\.\s*(?:split|trim|toUpperCase|toLowerCase)\s*\(", code)
                ):
                    _bad.append(_it)
            if _bad:
                _first = _fields.strip("{} ").split(",")[0].strip()
                out.append(
                    f"props.{_want} is an array of OBJECTS shaped {_fields}, but this "
                    f"scene renders the item itself (`{_bad[0]}`) rather than one of its "
                    f"fields — that paints the literal text \"[object Object]\" on the "
                    f"frame. Read a field instead: "
                    f"`{{{_bad[0]}.{_first}}}`. Keep the layout, geometry and motion "
                    f"exactly as they are — change only what is read from each item."
                )

    # ── 0b. Uncapped list ───────────────────────────────────────────────────
    # An unbounded .map() over a free-form props array overshoots the frame; the
    # hand-built templates cap at 3-5 (metrics 3, stats 4, timeline 5).
    _uncapped = [
        p for p in ("bullets", "metrics", "steps", "timelineItems")
        if re.search(rf"props\.{p}\b[^;\n]{{0,80}}\.map\(", code)
        and not re.search(rf"props\.{p}\b[^;\n]{{0,80}}\.slice\(", code)
    ]
    if _uncapped:
        out.append(
            f"props.{' and props.'.join(_uncapped)} is mapped without a cap, so a long "
            f"array runs off the bottom of the frame. Cap it before mapping: "
            f"`(props.{_uncapped[0]} ?? []).slice(0, isPortrait ? 3 : 4)`. The built-in "
            f"templates cap metrics at 3, stats at 4 and timelines at 5."
        )

    # ── 1. Kit scope ────────────────────────────────────────────────────────
    used = set(_forbidden_kit_names(code)) - ALLOWED_KIT_NAMES
    if used:
        names = sorted(used)
        hints = [f"{n} -> {_SUBSTITUTE_FOR[n]}" for n in names if n in _SUBSTITUTE_FOR]
        out.append(
            f"This scene uses pre-built component(s) that are not available to it: "
            f"{', '.join(names)}. Build these elements yourself with plain JSX and "
            f"inline styles — that is what makes this template's layouts its own. "
            f"The ONLY pre-injected names you may use are: "
            f"{', '.join(sorted(ALLOWED_KIT_NAMES))}."
            + (f" Replace: {'; '.join(hints)}." if hints else "")
            + " Keep the layout, geometry and motion you already have; change only "
            "the construction of these elements."
            # If one of these is just a local variable name, the fix is a RENAME,
            # not a rewrite. Saying so is the difference between a satisfiable
            # error and eight wasted attempts: the model reads "build it yourself
            # with inline styles", sees that it already has, and changes nothing.
            + " If one of these is simply a local variable you declared, RENAME it"
            " — the name itself is reserved."
        )

    # ── 2. Image mode ───────────────────────────────────────────────────────
    has_slot = bool(re.search(r"data-content-img", code))
    if "IMAGE — BACKGROUND MODE" in scene_doc:
        if not has_slot:
            out.append(
                "This scene's design specifies image_mode=\"background\" — a full-frame "
                "image behind the content — but the scene renders no image slot. Add a "
                "full-bleed container carrying data-content-img=\"1\" as the FIRST child "
                "with zIndex: 0, render <Img> inside it when props.imageUrl is present, "
                "and give the content layer position:'relative' and zIndex: 1."
            )
        else:
            # A background image with no scrim buries the copy under the photo.
            if not re.search(r"(withAlpha\s*\(|linear-gradient|radial-gradient|rgba\s*\()", code):
                out.append(
                    "This scene renders a background image but lays no SCRIM between the "
                    "photo and the copy, so the text is unreadable over a real photograph. "
                    "Add one absolutely-positioned layer between the image and the content "
                    "— e.g. background: withAlpha(<canvas colour>, 0.65) or a "
                    "linear-gradient — covering the area the type sits on. Do NOT fade the "
                    "image itself; the image stays opaque and the scrim does the work."
                )
            # The slot must sit behind the content, not on top of it.
            if not re.search(r"zIndex", code):
                out.append(
                    "This scene's background image has no zIndex ordering, so a full-bleed "
                    "image written after the content paints over the whole layout. Give the "
                    "image container zIndex: 0 and the content layer position:'relative' "
                    "with zIndex: 1. Change only those two style objects."
                )
    elif "IMAGE — HALF MODE" in scene_doc:
        if not has_slot:
            out.append(
                "This scene's design gives the image exactly one HALF of the frame, but the "
                "scene renders no image slot. Add a bounded container carrying "
                "data-content-img=\"1\" at 50% width / 100% height in landscape and 100% "
                "width / 50% height in portrait, on the side the design names, with the "
                "content filling the other half."
            )
        elif re.search(r"data-content-img[^>]{0,200}?(inset:\s*0|position:\s*['\"]absolute)", code, re.S):
            out.append(
                "This scene's design specifies a HALF image, but its image slot is rendered "
                "as a full-bleed layer (absolute / inset: 0). A half-mode slot must be a "
                "BOUNDED box: 50% width x 100% height in landscape, 100% width x 50% height "
                "in portrait. Change only the slot container's positioning and dimensions — "
                "keep the <Img>, the data-content-img marker, the animation and the text "
                "column exactly as they are."
            )
    elif "IMAGE — NONE" in scene_doc:
        if has_slot:
            out.append(
                "This scene is deliberately image-less — its design is carried by type, "
                "space and geometry — but it reserves an image slot "
                "(data-content-img), which leaves a hole in the frame at render time. "
                "Remove the slot and the props.imageUrl rendering, and let the composition "
                "fill the whole frame."
            )

    # ── 3. The ending must host the real CTA + socials ──────────────────────
    if scene_type == "outro":
        if not re.search(r"props\.ctaProps", code):
            out.append(
                "This is the ENDING scene, which must render the closing call-to-action and "
                "social handles itself — they arrive as props.ctaProps and this scene never "
                "reads them, so the video would end with neither. Read "
                "props.ctaProps?.socials and props.ctaProps?.ctas, and guard for ctaProps "
                "being undefined (it is absent in previews). Place them inside your own "
                "composition rather than appending a generic centred card."
            )
        if not re.search(r"<SocialIcons\b", code):
            out.append(
                "The ending scene does not render <SocialIcons>. Use it — "
                "<SocialIcons socials={props.ctaProps?.socials} accentColor={...} "
                "textColor={...} fontFamily={props.bodyFont} "
                "aspectRatio={props.aspectRatio} /> — rather than hand-rolling icons, so "
                "the glyphs match every other template. Its ARRANGEMENT in your layout is "
                "yours to choose."
            )
        elif not re.search(r"ctas|ctaButtonText", code):
            out.append(
                "The ending scene renders the socials but never the CTA buttons. Map "
                "(props.ctaProps?.ctas ?? []) and render each entry's ctaButtonText and "
                "websiteLink as a button-like element styled to this template, falling back "
                "to the single props.ctaProps?.ctaButtonText / websiteLink pair when `ctas` "
                "is absent."
            )

        # `socials` is an object MAP keyed by platform (SocialsMap in
        # SocialIcons.tsx), but `ctas` right beside it IS an array — and the
        # array idiom bleeds across, producing `(socials ?? []).map(...)`. The
        # `?? []` fallback hides it everywhere the CTA is unset, so it ships and
        # then throws "(socials ?? []).map is not a function" the moment a real
        # project supplies its handles. Match an array method applied to any
        # socials-bearing expression, however it was destructured first.
        _socials_as_array = re.search(
            r"(?:props\.ctaProps\s*(?:\?\.|\.)\s*socials|\bsocials\b)"
            r"\s*(?:\?\?\s*\[\s*\]\s*)?\)?\s*"
            r"\.\s*(map|filter|forEach|slice|reduce|some|every|find|flatMap|sort|join)\b",
            code,
        )
        if _socials_as_array:
            out.append(
                "This scene calls ."
                f"{_socials_as_array.group(1)}() on `socials`, treating it as an ARRAY. It is "
                "an OBJECT map keyed by platform — { linkedin: { enabled, label }, "
                "instagram: {...} } — so this throws \"socials.map is not a function\" at "
                "render as soon as a project has socials configured. The `?? []` fallback "
                "hides it in previews, where ctaProps is undefined. Do not iterate it "
                "yourself: pass it straight through with <SocialIcons "
                "socials={props.ctaProps?.socials} accentColor={...} textColor={...} "
                "fontFamily={props.bodyFont} aspectRatio={props.aspectRatio} />, which "
                "normalises the shape and supplies the brand glyphs. Only `ctas` is an "
                "array and may be mapped."
            )

        # Each `ctas[]` entry's real keys are `ctaButtonText` and `websiteLink`
        # (SceneEditModal writes exactly these). A scene that maps `ctas` but
        # destructures/reads `.label`, `.text` or `.link` off the mapped
        # variable is reading fields that DO NOT EXIST on the object — they
        # evaluate to undefined, so the button renders with an empty label
        # (custom_201's outro: every CTA button shipped blank while its
        # correctly-read websiteLink line stayed visible beneath it). Matches
        # the mapped param name (from `ctas.map((c) => ...)` or
        # `ctas.map((c, i) => ...)`) and looks for `c.label`/`c.text`/`c.link`
        # anywhere after it — a narrow enough name to not also flag `props`,
        # `sub`, `title`, etc.
        _ctas_map = re.search(r"\bctas\s*(?:\?\?\s*\[\s*\])?\s*\.\s*map\s*\(\s*\(?\s*(\w+)", code)
        if _ctas_map:
            _param = re.escape(_ctas_map.group(1))
            _wrong_key = re.search(rf"\b{_param}\.(label|text|link)\b", code)
            if _wrong_key:
                out.append(
                    f"The mapped `ctas` entry (`{_ctas_map.group(1)}`) reads "
                    f"`.{_wrong_key.group(1)}`, which does not exist on it — every real entry "
                    "only has `ctaButtonText` and `websiteLink`. Reading any other key "
                    "evaluates to undefined, so the button renders with no visible label. "
                    f"Replace `{_ctas_map.group(1)}.{_wrong_key.group(1)}` with "
                    f"`{_ctas_map.group(1)}.ctaButtonText` for the button label or "
                    f"`{_ctas_map.group(1)}.websiteLink` for the link line."
                )

    return out


def validate_component_code(
    code: str,
    scene_type: str = "content",
    *,
    collect_all: bool = False,
    theme: dict | None = None,
    scene_doc: str = "",
) -> tuple[bool, str | None]:
    """Validate a generated component code string.

    Returns (True, None) if valid, or (False, error_message) if invalid.

    scene_type: 'intro', 'content', or 'outro'. The OUTRO skips the imageUrl
    requirement — a CTA + socials row is composited over it at render time and
    its own generation prompt says it takes no content image, so requiring one
    here made the two contradict each other and guaranteed repair churn.
    (This parameter was previously accepted and never read.)

    theme: the brand's colours, used to resolve `palette.<slot>` references to
    real hex so the contrast gate can measure them. Omitted (None) means the
    symbolic half of the contrast check is skipped — the gate then only judges
    literal hex pairs, which is the conservative default for callers that do not
    have a theme to hand.

    collect_all: when True, report EVERY content failure at once instead of
    returning on the first. The default is False so existing callers are
    unchanged. The repair path passes True, because reporting one broken
    contract at a time is what made a scene fix its logo while dropping its
    animations, then restore animations and drop the logo again.

    scene_doc: the formatted design document this scene was generated from.
    Present ONLY on the generation path; stored scenes are re-validated without
    it. That asymmetry is deliberate — the gates it unlocks (kit scope, image
    mode, ending CTA) describe how scenes are built NOW, and applying them to a
    template generated under the previous rules would fail code that is working
    in production.
    """
    if not code or not code.strip():
        return False, "Code is empty"

    # ── Fail-fast gates ──────────────────────────────────────────────────────
    # These short-circuit even under collect_all: once the code does not parse or
    # is structurally broken, every check below reports noise derived from the
    # same root cause, which would bury the real error rather than adding to it.

    # Real parser gate — catches syntax corruption (stray tokens, malformed JSX)
    # that the regex heuristics below cannot, before wasting time on them.
    parse_ok, parse_err = _parse_check(code)
    if not parse_ok:
        return False, parse_err

    # Malformed CSS string values — invisible to the parser above.
    #
    # A scene shipped `position: 'relative,'` — the comma INSIDE the quotes.
    # That is valid JavaScript, so _parse_check passes it, but it is not a valid
    # CSS value, so the browser discards the whole declaration (CSS Cascade
    # §4.1). The element silently fell back to `position: static`, its flex
    # container collapsed, and the layout rendered its headings and divider over
    # an empty content area — identically in the project preview, the template
    # preview and the exported MP4, because all three run the same stored code.
    #
    # Nothing else could catch this: it is a typo that is legal in the host
    # language and only wrong in the embedded one.
    _bad_css = re.search(
        r"""\b(position|display|flexDirection|textAlign|alignItems|justifyContent|"""
        r"""overflow|whiteSpace|fontWeight|objectFit|visibility|flexWrap|"""
        r"""textTransform|pointerEvents|boxSizing)\s*:\s*(['"])([^'"]*[,;])\2""",
        code,
    )
    if _bad_css:
        return False, (
            f"Malformed CSS value {_bad_css.group(2)}{_bad_css.group(3)}{_bad_css.group(2)} "
            f"for `{_bad_css.group(1)}` — a stray '{_bad_css.group(3)[-1]}' inside the quotes. "
            "The browser discards the whole declaration, so the element silently "
            "loses that property and the layout collapses. Write "
            f"{_bad_css.group(2)}{_bad_css.group(3)[:-1]}{_bad_css.group(2)}."
        )

    # Dangerous API check
    for regex, name in DANGEROUS_REGEX:
        if regex.search(code):
            return False, f"Dangerous API detected: {name}"

    # Structural: balanced braces and max nesting depth
    depth = 0
    for ch in code:
        if ch == "{":
            depth += 1
            if depth > MAX_NESTING_DEPTH:
                return False, f"Excessive nesting depth (>{MAX_NESTING_DEPTH})"
        elif ch == "}":
            depth -= 1
    if depth != 0:
        return False, "Unbalanced braces in code"

    # Structural: balanced parentheses and square brackets. Braces alone are not
    # enough — an unbalanced '(' compiles to esbuild 'Expected ")"' and blanks
    # the whole video, so reject it here BEFORE the code is ever stored/rendered.
    # (A char-level count is approximate — parens inside strings/comments can skew
    # it — but generated scene code rarely puts unmatched parens in literals, and
    # catching the common corruption is worth the rare false positive.)
    for open_ch, close_ch, label in (("(", ")", "parentheses"), ("[", "]", "square brackets")):
        if code.count(open_ch) != code.count(close_ch):
            return False, f"Unbalanced {label} in code"

    # Must declare SceneComponent
    if not re.search(r"const\s+SceneComponent\s*=", code):
        return False, "Missing 'const SceneComponent' declaration"

    # Must contain JSX or React.createElement
    has_jsx = ("<" in code) and ("/>" in code or "</" in code)
    has_create_element = "React.createElement" in code
    if not has_jsx and not has_create_element:
        return False, "Code does not appear to contain JSX or React.createElement"

    # ── Content contracts ────────────────────────────────────────────────────
    # Collected together so a repair sees the FULL set at once.
    errors: list[str] = []

    def _fail(msg: str) -> tuple[bool, str | None] | None:
        """Record a failure; return early unless collecting everything."""
        errors.append(msg)
        return None if collect_all else (False, msg)

    # ── Full-bleed image slot that buries the scene ──────────────────────────
    # Observed in production: an intro whose data-content-img slot was
    # position:'absolute', 100%x100%, objectFit:'cover', rendered AFTER the
    # content and carrying the ONLY zIndex in the file. Two siblings with no
    # zIndex paint in DOM order, so the photo covered every layout element and
    # the scene rendered as a bare image.
    #
    # Only flagged when the slot is BOTH full-bleed AND written after the last
    # content layer — a full-bleed backdrop rendered first is a legitimate
    # design, and is exactly what the prompt asks for.
    _slot = _FULLBLEED_SLOT_RE.search(code)
    if _slot:
        _last_content = max(
            (m.start() for m in _CONTENT_LAYER_RE.finditer(code)),
            default=-1,
        )
        if _last_content >= 0 and _slot.start() > _last_content:
            r = _fail(
                "The image slot is a full-bleed layer rendered AFTER the scene's content, so "
                "the photo paints on top and hides every layout element. Either give the slot a "
                "bounded box (a column/card/panel), or render it FIRST as a deliberate backdrop "
                "with zIndex 0 on the slot, zIndex 1 + position:'relative' on the content, and a "
                "scrim between them."
            )
            if r:
                return r

    # ── Contrast (HARD GATE) ─────────────────────────────────────────────────
    # Unreadable text is the one defect a viewer cannot work around, and it used
    # to be enforced only as a -0.25 scoring nudge that was skipped entirely on
    # the final refine attempt — so a scene whose body copy sat at 1.7:1 against
    # its own background shipped. Only pairs that resolve to two concrete colours
    # are judged; computed values, alpha blends and gradients are skipped rather
    # than guessed at, so a false positive (which costs a full LLM rollout)
    # stays very unlikely.
    from app.services.code_generator import (
        _detect_contrast_defects,
        detect_offpalette_colors,
    )

    for _defect in _detect_contrast_defects(code, theme):
        r = _fail(f"Unreadable text: {_defect}")
        if r:
            return r
        break  # one contrast message is enough to drive a repair

    # Off-palette hues. Separate from contrast: an indigo rule on a cream canvas
    # reads perfectly well and is still wrong, because indigo is not in the
    # brand. Without this, "one theme across the template" was never actually
    # enforced — only "legible against the canvas" was.
    for _defect in detect_offpalette_colors(code, theme):
        r = _fail(f"Off-palette colour: {_defect}")
        if r:
            return r
        break  # one is enough to drive a repair

    # Must have at least 2 animation calls.
    #
    # This used to also count kit helpers (staggerEntrance, panelRise,
    # RevealText, KenBurnsImage, SignatureArtifact) toward the total, because a
    # scene could legitimately animate entirely through them. Newly generated
    # scenes can no longer use those components at all, so the helper tally is
    # kept ONLY so already-stored scenes still validate — a new scene has to
    # animate with real interpolate/spring calls, which is what it writes now.
    anim_count = code.count("interpolate(") + code.count("spring(")
    anim_count += len(_ANIM_HELPER_REGEX.findall(code))
    if anim_count < 2:
        r = _fail(
            f"Insufficient animations ({anim_count}) — need at least 2 interpolate() or "
            "spring() calls driving visible motion. Animate the entrance of your focal "
            "element and stagger at least one supporting element."
        )
        if r:
            return r

    # Must be substantial enough (not a trivial placeholder)
    if len(code) < 500:
        r = _fail("Code too short — likely missing animations and visual detail")
        if r:
            return r

    # Must have overflow:hidden to prevent content escaping the frame
    if "overflow" not in code or "hidden" not in code:
        r = _fail("Missing overflow:'hidden' on outermost container — content can escape frame")
        if r:
            return r

    # Must reference logoUrl as a conditional — not just any string match.
    if not _LOGO_CONDITIONAL_REGEX.search(code):
        r = _fail(
            "Missing conditional logoUrl rendering — scene must check props.logoUrl before rendering: "
            "e.g. {props.logoUrl && <Img src={props.logoUrl} ... />}"
        )
        if r:
            return r

    # A RENDERED headline must be inside <FitText>.
    #
    # FitText is the ONLY thing that sizes text to the space it actually has —
    # it solves for the size that fills the box and clamps to a legible range, in
    # both directions. A bare <div style={{fontSize: N}}> is a fixed guess, which
    # is exactly how headlines end up tiny on short copy and overflowing on long
    # copy. A soft score penalty was not enough: scenes shipped at 0.70-0.85 with
    # an unwrapped headline, so this is a hard gate.
    #
    # BUT IT MUST ONLY FIRE ON A HEADLINE. The trigger used to be "the string
    # props.displayText appears anywhere", which is not the same thing —
    # displayText is also the standard DATA FALLBACK, and a scene that never
    # renders it as a headline cannot possibly wrap it in FitText:
    #
    #     const quoteText = props.quote || props.displayText || '';   <- a quote
    #     const items = props.steps?.length ? props.steps : [props.displayText];
    #     const words = displayText.split(/\s+/);   <- a staggered word reveal
    #
    # Measured on template 177: five of nine scenes were rejected this way,
    # exhausted all three repairs (the model cannot add a headline that is not in
    # its design), and were stubbed — after ~1400s. The gate was unsatisfiable.
    #
    # So: fire only when displayText is actually INTERPOLATED INTO THE TREE, via
    # the prop or a local alias of it.
    _dt_alias = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*props\.displayText", code)
    _rendered_names = ["props\\.displayText"]
    if _dt_alias:
        _rendered_names.append(re.escape(_dt_alias.group(1)))
    # `>{x}` / `{x}<` / `>{x || y}` — an interpolation that is a CHILD of an
    # element, which is what "rendered" means. A `.split(...)` or `?? ...` in a
    # declaration never matches.
    _renders_headline = any(
        re.search(rf">\s*\{{\s*{n}\s*(?:\|\||\?\?|\}})", code)
        or re.search(rf"\{{\s*{n}\s*\}}\s*<", code)
        for n in _rendered_names
    )
    if _renders_headline and not re.search(r'<FitText\b', code):
        r = _fail(
            "The props.displayText copy must be wrapped in <FitText> — a fixed fontSize "
            "cannot adapt to how much text a scene actually receives, so it renders tiny on a "
            "short line and overflows on a long one. Use "
            "<FitText fontSize={props.descriptionFontSize ?? 34} minFontSize={20} maxLines={4}>"
            "{props.displayText}</FitText>."
        )
        if r:
            return r

    # The same detection for props.sceneTitle — the scene's TITLE, and what
    # props.titleFontSize sizes. Built here rather than beside the gate below so
    # both the title gates and the both-fields gate share one definition.
    _st_alias = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*props\.sceneTitle", code)
    _title_names = ["props\\.sceneTitle"]
    if _st_alias:
        _title_names.append(re.escape(_st_alias.group(1)))
    _renders_title = any(
        re.search(rf">\s*\{{\s*{n}\s*(?:\|\||\?\?|\}})", code)
        or re.search(rf"\{{\s*{n}\s*\}}\s*<", code)
        for n in _title_names
    )

    # Long-text props must ALSO go through a fitting component.
    #
    # The gate above is scoped to props.displayText, which left the two text
    # paths that actually overflowed completely ungated:
    #   * props.quote — no quote component exists in the kit, so quote scenes are
    #     hand-rolled at a literal fontSize. One shipped clipped mid-sentence.
    #   * props.metrics — a stat value at a fixed multiple of type.numeral
    #     overran its cell, colliding with its own suffix.
    # Neither reads props.displayText, so neither ever tripped the gate.
    #
    # Checked by PROXIMITY, not file-wide presence. A file-wide test is
    # satisfied by the headline's own <FitText>, so the realistic failure — a
    # correctly fitted headline sitting beside a bare quote — slipped straight
    # through. The prop must appear INSIDE a <FitText>.
    def _prop_aliases(prop: str) -> set[str]:
        """The prop plus every local name it flows into.

        Matching `props.quote` LITERALLY inside a fitter made this gate
        impossible to satisfy for code the prompt itself asks for. The contract
        says to write fallbacks ("If props.bullets / props.steps / props.metrics
        is empty or undefined: fall back to..."), and a fallback is naturally
        hoisted:

            const quoteText = props.quote ?? props.displayText;
            <FitText>{quoteText}</FitText>

        which is correct, fitted code the old check reported as a bare
        fontSize. The model then rewrote until its attempts ran out — one
        observed scene burned three rollouts (198s) on a rule it could not
        satisfy, and the same message repeated on every retry.

        Two hops, because splitting for a per-word animation is one more:
            const q = props.quote;  const words = q.split(" ");

        The same reasoning covers `.map()` callback parameters, which is how
        every ARRAY prop is actually rendered:

            {(props.metrics ?? []).slice(0, 4).map((m, i) => (
               <FitText fontSize={numeralSize}>{m.value}</FitText>
            ))}

        The fitter block contains `m`, never `metrics`, so following only
        `const` assignments made this unsatisfiable for metrics scenes — the
        identical failure this docstring already describes, one level down.

        Chased to a FIXED POINT, not a fixed number of hops.

        Two hops was not enough, and the shape that broke it is one this prompt
        ASKS FOR. The content contract tells a scene to stay presentable when
        its array is empty ("fall back to props.displayText rather than
        rendering nothing"), which every metrics scene implements as a second
        alias:

            const items    = (props.metrics ?? []).slice(0, 4);   // hop 1
            const fallback = items.length === 0 ? … : items;       // hop 2
            {fallback.map((m, i) => <FitText>{m.value}</FitText>)} // hop 3

        Three hops to reach `m`, and the loop stopped at two — so a scene that
        HAD wrapped its numerals was told to wrap them, three times, and the
        rollouts ran out. Template 199, scene 1: three repairs, all identical.

        The `.map` pass also used an `_alt` computed BEFORE the `const` pass in
        the same iteration, so a name learned from an assignment could not bind
        a callback parameter until the following hop — spending two hops to
        travel one. Recomputing between the passes is what makes each iteration
        worth a full step.
        """
        names = {prop}
        # A real chain is 2-4 links; the cap only stops a pathological file from
        # looping, and the fixed point is normally reached well before it.
        for _ in range(8):
            _before = len(names)
            _alt = "|".join(re.escape(n) for n in names)
            for _m in re.finditer(
                r"(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*?"
                r"\b(?:props\.)?(" + _alt + r")\b",
                code,
            ):
                names.add(_m.group(1))
            # `<array>.map((item, i) => ...)` — bind the item parameter. The
            # window spans the chained .slice()/.filter() that normally sit
            # between the prop and the .map. Recomputed so names just learned
            # above are usable in this same pass.
            _alt = "|".join(re.escape(n) for n in names)
            for _m in re.finditer(
                r"\b(?:props\.)?(?:" + _alt + r")\b[^;\n]{0,160}?"
                r"\.map\(\s*(?:function\s*)?\(?\s*(\w+)",
                code,
            ):
                names.add(_m.group(1))
            if len(names) == _before:
                break
        return names

    def _is_fitted(prop: str) -> bool:
        # FitText is the ONLY fitter available to generated scenes. RevealText,
        # HighlightPhrase, StatGrid and MetricRow were removed along with the
        # rest of the kit — a scene that used one was rejected by the kit-scope
        # gate anyway, so accepting them here scored a shape that could never
        # pass.
        _alt = "|".join(re.escape(n) for n in _prop_aliases(prop))
        # Inside <FitText>…{props.X}…</FitText>.
        # 2500, not 1500: a fitter wrapping several lines of markup is normal,
        # and a window that ends mid-block reads as "not fitted".
        for _blk in re.findall(
            r"<FitText\b[\s\S]{0,2500}?</FitText>",
            code,
        ):
            if re.search(rf"\b(?:props\.)?(?:{_alt})\b", _blk):
                return True
        # Or handed to a self-closing fitter, which has no block above.
        return bool(
            re.search(
                rf"<FitText\b[^>]{{0,300}}\b(?:props\.)?(?:{_alt})\b",
                code,
                re.DOTALL,
            )
        )

    for _prop, _what, _fix in (
        (
            "quote",
            "quote text",
            "<FitText fontSize={props.titleFontSize ?? 64} maxLines={4} "
            "maxHeight={<px available>}>{props.quote}</FitText>",
        ),
        (
            "metrics",
            "stat values",
            "a <FitText> around each numeral inside the map, e.g. "
            "{(props.metrics ?? []).slice(0, isPortrait ? 3 : 4).map((m, i) => "
            "(<FitText key={i} fontSize={numeralSize} maxLines={1}>{m.value}</FitText>))}",
        ),
    ):
        if re.search(rf"props\.{_prop}\b", code) and not _is_fitted(_prop):
            r = _fail(
                f"This scene renders {_what} from props.{_prop} at a fixed size. A fixed "
                f"fontSize cannot adapt to how much text a scene actually receives, so it "
                f"overflows the frame and is clipped. Use {_fix}."
            )
            if r:
                return r

    # ── A string[] prop read as if its items were objects ────────────────────
    #
    # `bullets`, `steps` and `codeLines` are declared `string[]` in
    # GeneratedSceneProps. A scene that maps one and then reads a FIELD off each
    # item — `{step.description}` — reads `undefined` on a string and renders a
    # blank row. Observed in production: SceneContent5 of a real template maps
    # props.steps and renders {step.description}, so every step drew empty.
    #
    # Nothing caught it. The contract shows `{item}` in its example but never
    # says the item is a plain string with no fields, and no gate looked at how
    # an array prop is consumed. The sibling object props (`timelineItems`,
    # `metrics`, `comparisonLeft`) DO carry `.label`/`.description`/`.value`, so
    # the two shapes sit side by side in the same taxonomy with nothing marking
    # which is which.
    #
    # Reuses _prop_aliases, which already walks props.steps -> items -> step.
    for _arr_prop in ("bullets", "steps", "codeLines"):
        if not re.search(rf"props\.{_arr_prop}\b", code):
            continue
        _names = _prop_aliases(_arr_prop)
        # The callback parameter is the last hop; a field read off it is the
        # defect. Field names taken from the OBJECT props, since those are what
        # a model confuses these with.
        _bad = None
        for _n in _names:
            _m = re.search(
                rf"(?<![A-Za-z0-9_.]){re.escape(_n)}\.(label|description|value|suffix|title|text|sub|number)\b",
                code,
            )
            if _m:
                _bad = _m.group(0)
                break
        if _bad:
            r = _fail(
                f"props.{_arr_prop} is a list of PLAIN STRINGS, but this scene reads "
                f"`{_bad}` off an item — that is undefined on a string, so the element "
                f"renders blank. Render the item itself: "
                f"{{(props.{_arr_prop} ?? []).slice(0, isPortrait ? 3 : 4).map((item, i) => "
                f"(<FitText key={{i}} fontSize={{bodySize}}>{{item}}</FitText>))}}. "
                f"If this scene genuinely needs a label AND a description per item, its "
                f"content type is `timeline` (props.timelineItems) or `metrics` "
                f"(props.metrics) — use that prop instead, not a field on this one."
            )
            if r:
                return r

    # A multi-item scene must ADAPT its arrangement to the aspect ratio.
    #
    # 1920x1080 and 1080x1920 are not the same layout problem: a row of stats
    # that reads well across a landscape frame has roughly a third of the width
    # in portrait, and a portrait-shaped vertical stack wastes most of a
    # landscape frame. A reported scene showed two stats stacked vertically in
    # LANDSCAPE, which is the portrait shape used in the wrong orientation.
    #
    # This was a -0.15 score nudge, which a scene could buy back on other
    # criteria — so it shipped anyway. Gated only for scenes that render a
    # LIST/GRID, where arrangement genuinely differs by orientation; a centred
    # headline or a single quote reads the same in both and must not be forced
    # to branch for nothing.
    if scene_type == "content" and re.search(
        r"props\.(?:metrics|bullets|steps|timelineItems)\b", code
    ):
        # The <StatGrid|MetricRow> exemption went with the kit: those components
        # are no longer available, so a scene can only satisfy this by branching
        # itself.
        _branches = bool(
            re.search(r"isPortrait\s*\?", code)                                  # ternary
            or re.search(r"(?:if\s*\(|&&|\|\|)\s*[^)\n]*\bisPortrait\b", code)   # guard
            or re.search(r"!\s*isPortrait\b", code)                              # negated
        )
        if not _branches:
            r = _fail(
                "This scene renders a list/grid but never branches on isPortrait, so the "
                "same arrangement is used for 1920x1080 and 1080x1920 — one of the two "
                "will be squashed or will waste most of the frame. Declare "
                "`const isPortrait = props.aspectRatio === 'portrait'` and branch the "
                "layout on it (column vs row, fewer items, smaller type)."
            )
            if r:
                return r

    # The TITLE must honour props.titleFontSize.
    #
    # The Typography sliders in the scene editor write layoutConfig.titleFontSize
    # / descriptionFontSize, and both the player and the export pass them into
    # the component. If the scene hardcodes `fontSize={72}` instead of
    # `fontSize={props.titleFontSize ?? 72}`, the slider silently does nothing —
    # the user drags it and the preview never moves.
    #
    # The prompt has documented this contract all along; 111 of 389 stored
    # scenes ignored it anyway, which is why it is enforced here rather than
    # merely asked for.
    #
    # It is gated on props.sceneTitle, not props.displayText. titleFontSize used
    # to size the display text and the title was a small eyebrow with its own
    # third prop; that is the naming trap this contract removed. The title is
    # now the scene's main label, and it is the only thing this size drives.
    #
    # Gated on a RENDERED title for the same reason as the FitText check above —
    # a scene that only reads sceneTitle as a data fallback has nothing to bind
    # the slider to, and demanding one is unsatisfiable.
    if _renders_title and not re.search(r'props\.titleFontSize', code):
        r = _fail(
            "The scene title ignores props.titleFontSize, so the editor's 'Title' slider "
            "does nothing for this scene. Read the prop with a fallback to your intended "
            "size: "
            "<FitText fontSize={props.titleFontSize ?? 68} maxLines={2}>{props.sceneTitle}</FitText>. "
            "Size the display text and every content prop with props.descriptionFontSize."
        )
        if r:
            return r

    # The TITLE must be sized by titleFontSize, not by a ratio of the body.
    #
    # THE GATE ABOVE IS NOT ENOUGH, and this is the gap it left. It checks that
    # a scene which RENDERS props.sceneTitle also READS props.titleFontSize
    # somewhere — but a scene can satisfy that by binding titleFontSize to a
    # different element entirely. Real generated code did exactly that:
    #
    #     const bodySize   = props.descriptionFontSize ?? 30;
    #     const chromeSize = bodySize * 0.55;
    #     const kicker     = props.sceneTitle || '';
    #     <div style={{fontSize: chromeSize}}>{kicker}</div>          <- the TITLE
    #     <FitText fontSize={props.titleFontSize ?? 44}>{quote}</FitText>
    #
    # Every gate passed. The Title slider drove the QUOTE, while the title
    # itself sat at bodySize * 0.55 and could only be moved by the OTHER
    # slider — so dragging Title to 95 left the heading at ~36 and the user saw
    # a control that did nothing. It is the v1/v2 eyebrow treatment surviving
    # into a contract that removed it.
    #
    # Detection: resolve every local that derives from descriptionFontSize, then
    # find the fontSize governing the element that renders sceneTitle. If that
    # size is body-derived, the title is being drawn as an eyebrow.
    _body_names = {"bodySize"}
    for _ in range(4):
        _before = len(_body_names)
        _balt = "|".join(re.escape(n) for n in _body_names)
        for _m in re.finditer(
            r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*props\.descriptionFontSize",
            code,
        ):
            _body_names.add(_m.group(1))
        for _m in re.finditer(
            rf"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*\b(?:{_balt})\b", code
        ):
            _body_names.add(_m.group(1))
        if len(_body_names) == _before:
            break
    # `titleSize` is by definition the title's own size; a scene that names a
    # local after it and derives it from the body is caught by the read gate.
    _body_names.discard("titleSize")

    _title_render_names = [r"props\.sceneTitle"]
    for _m in re.finditer(
        r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*props\.sceneTitle", code
    ):
        _title_render_names.append(re.escape(_m.group(1)))

    # Scan back only to THIS element's opening tag, not a fixed character
    # window. A window overshoots into the previous sibling: a scene with a
    # legitimate layoutProps kicker at labelSize immediately before a correct
    # title at titleSize was reported as eyebrowing its title, because the
    # kicker's fontSize was the last one seen.
    _eyebrowed = None
    for _tn in _title_render_names:
        for _m in re.finditer(rf"\{{\s*{_tn}\b[^}}]*\}}", code):
            _before = code[:_m.start()]
            _tag = _before.rfind("<")
            if _tag < 0:
                continue
            _open = _before[_tag:]
            _sizes = re.findall(r"fontSize:\s*([A-Za-z_$][\w$]*)", _open)
            if not _sizes:
                _sizes = re.findall(r"fontSize=\{\s*([A-Za-z_$][\w$]*)\s*\}", _open)
            if _sizes and _sizes[-1] in _body_names:
                _eyebrowed = _sizes[-1]
                break
        if _eyebrowed:
            break

    if _eyebrowed:
        r = _fail(
            f"props.sceneTitle is rendered at `{_eyebrowed}`, which derives from "
            f"props.descriptionFontSize — so the scene's TITLE is drawn at body scale "
            f"and the editor's Title slider moves nothing. There are exactly two sizes "
            f"and each owns its text: props.titleFontSize sizes props.sceneTitle and "
            f"NOTHING else; props.descriptionFontSize sizes everything else — the "
            f"display text, every content prop, and every eyebrow, kicker, label and "
            f"caption. Size the title with "
            f"`const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68)` and "
            f"render it at titleSize. If you wanted a small kicker ABOVE the title, "
            f"that is a separate string — use props.layoutProps, not props.sceneTitle."
        )
        if r:
            return r

    # There is no third type tier.
    #
    # props.sceneTitleFontSize sized an eyebrow under the previous contract. It
    # is not passed to a scene generated against this one, so reading it gives a
    # size no slider can move — a dead control by construction. Labels smaller
    # than the body are written as a ratio of the body size (bodySize * 0.8), so
    # the one body slider still drives them.
    if re.search(r"props\.sceneTitleFontSize", code):
        r = _fail(
            "This scene reads props.sceneTitleFontSize, which no longer exists. There are "
            "exactly two type sizes: props.titleFontSize sizes props.sceneTitle, and "
            "props.descriptionFontSize sizes props.displayText, every content prop and "
            "every label. For a label smaller than the body, use a ratio — "
            "`const labelSize = bodySize * 0.8` — so the body slider still moves it."
        )
        if r:
            return r

    # NOTE: "every scene renders its title and its display text" is enforced as a
    # SCORE PENALTY in code_generator._score_valid_scene, not as a gate here.
    #
    # It was written as a hard gate first, and that is the template-177 mistake
    # repeated: the model cannot add a title to a design that has no place for
    # one, so a scene missing it exhausts all three repairs and is stubbed. The
    # contract asks for it in three places and the design docs now specify a
    # title zone on every scene; the penalty is what makes the refine loop
    # prefer a compliant attempt. Promote it to a gate once real generations
    # show compliant scenes clearing it.

    # Fonts must come from props, never from a hardcoded family.
    #
    # The prompt has asked for this all along ("NEVER hardcode fontFamily
    # strings"), but nothing enforced it, so a scene writing
    # `fontFamily: 'Playfair Display'` passed every gate. The visible symptom is
    # a template whose intro renders in one face and whose content scenes render
    # in another — the fonts a user picks in Settings only reach the components
    # that actually read props.headingFont / props.bodyFont.
    #
    # A hardcoded name is also usually not loaded at all: resolveFontFamily()
    # returns null for anything outside the registry, so the raw string is used
    # as a bare CSS family and the render silently falls back to the system sans.
    #
    # Monospace is the one legitimate literal: code-content scenes genuinely need
    # it and the kit ships no mono prop.
    #
    # But the exemption must cover only faces that ACTUALLY LOAD — a bare
    # generic, a system mono, or the one mono face in the registry (Fira Code).
    # Matching the word "monospace" anywhere in the stack exempted a named font
    # sitting in front of it, and that shipped: template 181 wrote
    # `fontFamily: 'Geist Mono, monospace'` in two scenes. Geist Mono is in no
    # registry and is loaded by nothing, so those scenes silently rendered in the
    # system mono while their siblings used the brand face — the "different font
    # families" defect. A named family now has to be one we can actually serve.
    # Every family in the stack must be one of these to earn the exemption.
    _LOADABLE_MONO = {
        "monospace", "ui-monospace", "sfmono", "sfmono-regular",
        "menlo", "consolas", "courier", "courier new",
        "fira code",  # the ONE mono face in the font registry
    }

    class _MonoOk:
        """`.search(value)` -> truthy only when EVERY family in the stack loads.

        Kept call-compatible with the regex it replaces (eight call sites pass
        differently-shaped values: bare, quoted, whole stacks).
        """

        @staticmethod
        def search(value: str):
            if not value:
                return None
            families = [
                f.strip().strip("'\"`").strip().lower()
                for f in str(value).split(",")
            ]
            families = [f for f in families if f]
            if not families:
                return None
            return True if all(f in _LOADABLE_MONO for f in families) else None

    _MONO_OK = _MonoOk
    _font_offenders: list[str] = []
    # A quoted value is captured whole FIRST — a stack like 'Georgia, serif'
    # contains the comma that would otherwise terminate the unquoted branch,
    # which let multi-family stacks slip through.
    #
    # Each quote style is matched against ITS OWN closing quote, so a CSS stack
    # that quotes an inner family survives: `"'Geist Mono', monospace"` used to
    # capture just `"'"` (the outer `"` to the first inner `'`), which then read
    # as an empty family and slipped past every check. That is how template 181's
    # chronology scene shipped an unloadable font.
    for _m in re.finditer(
        r"""fontFamily\s*:\s*("[^"]*"|'[^']*'|`[^`]*`|[^,;}\n]+)""", code
    ):
        _val = _m.group(1).strip()
        if "headingFont" in _val or "bodyFont" in _val:
            continue
        if _MONO_OK.search(_val):
            continue
        # A quoted literal is the defect; an identifier may well be a const that
        # was itself assigned from the props, which is checked below.
        # Quote-style-aware for the same reason as the capture above.
        _lit = re.match(r"""^"([^"]+)"|^'([^']+)'|^`([^`]+)`""", _val)
        if _lit:
            _font_offenders.append(next(g for g in _lit.groups() if g))
            continue
        _ident = re.match(r"^([A-Za-z_$][\w$]*)\s*$", _val)
        if _ident:
            _name = _ident.group(1)
            _assign = re.search(
                rf"(?:const|let|var)\s+{re.escape(_name)}\s*=\s*([^;\n]+)", code
            )
            if _assign and (
                "headingFont" in _assign.group(1) or "bodyFont" in _assign.group(1)
            ):
                continue
            if _assign and _MONO_OK.search(_assign.group(1)):
                continue
            if _assign and re.match(r"""^\s*['"`]""", _assign.group(1)):
                _font_offenders.append(f"{_name} = {_assign.group(1).strip()}")
    # ── A NAMED family beside the font prop ──────────────────────────────────
    #
    # `const headingFont = props.headingFont || 'Playfair Display, serif'` was
    # accepted by everything: the guards above test for the SUBSTRING
    # "headingFont", which matches the variable's own name and the prop
    # reference, so the literal beside it was never examined. Two scenes could
    # carry different named fallbacks and both pass — which is how one template
    # shipped with different typefaces per scene.
    #
    # The fallback must be "inherit". The wrapper paints the template's real
    # face, so `inherit` resolves to it, whereas a named family either is not
    # loaded (silently the system sans) or pins this scene to a face the rest of
    # the template is not using.
    for _m in re.finditer(
        r"""props\.(?:headingFont|bodyFont)\s*(?:\|\||\?\?)\s*(['"`])([^'"`]+)\1""",
        code,
    ):
        _fallback = _m.group(2).strip()
        if _fallback.lower() in ("inherit", "initial", "unset"):
            continue
        if _MONO_OK.search(_fallback):
            continue
        _font_offenders.append(f"props.headingFont || {_fallback!r}")

    # CSS shorthand smuggles a family past a fontFamily-only check.
    for _m in re.finditer(r"""(?<![A-Za-z])font\s*:\s*(['"`][^'"`]+['"`])""", code):
        if not _MONO_OK.search(_m.group(1)):
            _font_offenders.append(_m.group(1))

    # ── The escapes ──────────────────────────────────────────────────────────
    # The checks above only understand `fontFamily:` and `font:` with a literal
    # or a bare identifier. Every form below was verified to slip through, and
    # each produces the same defect: one scene in the brand's face, the next in
    # something else.

    # 1. Hyphenated CSS — inside a <style> string, a styled-component, or any
    #    template literal. `fontFamily` never appears, so nothing matched.
    for _m in re.finditer(r"""font-family\s*:\s*([^;"'`}\n]+)""", code, re.I):
        _val = _m.group(1).strip()
        if _MONO_OK.search(_val) or "headingFont" in _val or "bodyFont" in _val:
            continue
        if "${" in _val or "var(" in _val:
            continue  # interpolated / CSS variable — unresolvable, skip
        _font_offenders.append(f"font-family: {_val}")

    # 2. A quoted family anywhere in a fontFamily VALUE that is not a plain
    #    literal — a ternary, an array .join(), a concatenation. The literal
    #    branch above needs the value to START with a quote, so these escaped.
    for _m in re.finditer(r"""fontFamily\s*:\s*([^,;}\n]*)""", code):
        _val = _m.group(1).strip()
        if not _val or _val.startswith(("'", '"', "`")):
            continue  # already handled by the literal branch
        if "headingFont" in _val or "bodyFont" in _val or _MONO_OK.search(_val):
            continue
        _quoted = re.findall(r"""['"]([^'"]{2,})['"]""", _val)
        for _q in _quoted:
            if not _MONO_OK.search(_q):
                _font_offenders.append(_q)

    # 3. Fonts overridden on a kit component. `<SceneFrame fonts={{heading: ...}}>`
    #    is the worst of these: KitProvider applies that face to the scene's whole
    #    subtree, so it defeats every per-element check at once.
    #
    #    This is NOT made redundant by SceneFrame being in _FORBIDDEN_KIT_RE. That
    #    gate lives in _design_doc_defects, which runs only when a scene_doc is
    #    supplied — i.e. on the generation path. Stored scenes and the edit path
    #    validate without one, and there this branch is the only thing standing
    #    between a subtree font override and a template that changes typeface
    #    mid-video.
    for _m in re.finditer(
        r"""<\s*(?:SceneFrame|KitProvider)\b[^>]{0,400}?\bfonts\s*=\s*\{\{([^}]{0,200})""",
        code,
        re.DOTALL,
    ):
        _val = _m.group(1)
        if "headingFont" in _val or "bodyFont" in _val:
            continue
        _font_offenders.append(f"<SceneFrame fonts={{{{{_val.strip()[:60]}}}}}>")
    if _font_offenders:
        r = _fail(
            f"Hardcoded font family {', '.join(repr(f) for f in _font_offenders[:3])} — a "
            "literal family is not loaded by the renderer (it falls back to the system sans) "
            "and it ignores the font the user picked in Settings, so the intro and the content "
            "scenes of one template end up in different typefaces. Use "
            'fontFamily: props.headingFont || "inherit" for headings and '
            'fontFamily: props.bodyFont || "inherit" for body text.'
        )
        if r:
            return r

    # ── The template's typefaces must actually be BOUND ──────────────────────
    #
    # The check above rejects a HARDCODED family, but a scene that sets no
    # fontFamily at all passed it outright — it inherits whatever the wrapper
    # supplies, which is the system sans. That is why one template's intro and
    # content scenes could read as two different designs even with a blueprint
    # that had chosen a typeface for both.
    #
    # `props.headingFont` was previously only a -0.25 score nudge, which alone
    # never crosses the 0.6 acceptance bar, so a scene ignoring the template's
    # typeface shipped at 0.75. `props.bodyFont` was not checked ANYWHERE.
    # Scoped to scenes that actually render a headline, exactly like the FitText
    # gate above — a chart-only or image-only scene has no heading to set a face
    # on, and demanding one there rejects a correct scene.
    _has_headline = re.search(r"props\.(?:displayText|sceneTitle)", code)
    if _has_headline and not re.search(r"props\.headingFont", code):
        r = _fail(
            "The scene never reads props.headingFont, so its headings render in whatever "
            "typeface the wrapper happens to supply instead of the one this template was "
            'designed in. Bind it: fontFamily: props.headingFont || "inherit".'
        )
        if r:
            return r

    # bodyFont is required only when the scene actually renders body copy.
    #
    # displayText IS body copy under this contract — one or two sentences set at
    # props.descriptionFontSize, not a headline — so a scene that PAINTS it must
    # bind the body font and the body size. It was absent from this list while
    # titleFontSize sized it, which meant a scene whose only body text was the
    # display text could ship binding neither: its body rendered in the system
    # sans and the body slider was dead.
    #
    # It counts via _renders_headline (interpolated as a child), never via a bare
    # mention. `const items = [props.displayText]` and
    # `props.quote || props.displayText` are data fallbacks, not body copy, and
    # demanding a font binding for text the scene never paints is the
    # unsatisfiable-gate mistake recorded above.
    #
    # narrationText is deliberately NOT a body-copy signal: it is the voiceover
    # script and must never be rendered at all (there is a gate for that below).
    # Treating it as body copy would both demand a font for text that should not
    # exist, and mask that gate's own error behind this one.
    _has_body_copy = bool(_renders_headline) or bool(
        re.search(
            r"props\.(?:bullets|steps|quote|comparison\w*|timelineItems|metrics)"
            r"|<(?:Caption|BulletList|StatGrid|MetricRow|CodeBlock)\b",
            code,
        )
    )
    if _has_body_copy and not re.search(r"props\.bodyFont", code):
        r = _fail(
            "The scene renders body copy but never reads props.bodyFont, so its body text "
            "falls back to the system sans while its headings use the template's typeface. "
            'Bind it: fontFamily: props.bodyFont || "inherit".'
        )
        if r:
            return r

    # Body copy must honour props.descriptionFontSize.
    #
    # The mirror of the titleFontSize gate above. That gate's comment used to say
    # descriptionFontSize had "no single unambiguous target element to bind to",
    # and that is still true — so this does NOT demand a specific element, only
    # that a scene rendering body copy reads the prop at least once.
    #
    # UNCONDITIONAL as of the typography pass. It used to require 2+ DISTINCT
    # hardcoded sizes in the 20-60px band before firing, which meant a scene that
    # sized all its body copy with ONE literal shipped with a dead slider — the
    # user drags "body font size" and nothing moves. That escape hatch is exactly
    # why dead sliders reached production, so the size survey is gone: if a scene
    # renders body copy, it binds the prop.
    if _has_body_copy and not re.search(r"props\.descriptionFontSize", code):
        r = _fail(
            "The scene renders body copy but never reads props.descriptionFontSize, so "
            "the editor's body font-size slider does nothing for this scene. Define "
            "`const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34)` and "
            "size every piece of supporting text from it (bodySize, bodySize * 0.9, …)."
        )
        if r:
            return r

    # ── The two font-size DEFAULTS must be sane numbers ──────────────────────
    #
    # The gates above prove the props are READ. They say nothing about the value
    # a scene falls back to when the user has not moved a slider — which is what
    # every preview and every render actually shows, because the sliders start
    # unset. Three things went wrong there often enough to gate:
    #
    #   1. title <= body, so the headline rendered smaller than the paragraph
    #      under it and the type hierarchy inverted.
    #   2. a flat default (`?? 88`) used for both orientations, so a portrait
    #      1080-wide canvas got a size chosen for a 1920-wide one.
    #   3. defaults outside _TYPE_FLOOR/_TYPE_CEILING — most often ABOVE, which
    #      overflowed the frame before FitText could pull it back.
    #
    # These were previously only score nudges in _score_valid_scene (-0.45 for
    # the band), and a nudge alone never crosses the 0.6 acceptance bar, so a
    # scene with badly-sized type shipped. The prompt itself was also telling the
    # model to write `?? 96` — above the 88 ceiling — so the model was being
    # penalised for following instructions. Both are fixed together.
    for _defect in _font_default_defects(code):
        r = _fail(_defect)
        if r:
            return r

    # An invented Easing member is a RENDER CRASH that freezes the whole
    # preview page, not just its own scene — see _easing_defects.
    for _defect in _easing_defects(code):
        r = _fail(_defect)
        if r:
            return r

    # A <FitText> with no geometry cannot actually fit — see
    # _fit_geometry_defects. This is what made the auto-fit a no-op.
    for _defect in _fit_geometry_defects(code):
        r = _fail(_defect)
        if r:
            return r

    # A SELF-CLOSING <FitText /> RENDERS NOTHING.
    #
    # FitText paints its CHILDREN; there is no `text`/`value` prop. Written
    # self-closing it is a correctly-sized, correctly-styled, permanently empty
    # box — and because it still measures and lays out, the scene looks
    # structurally fine while displaying nothing.
    #
    # Template 203's "versus" scene shipped exactly this: both sides' label and
    # description were passed into the render helper and never rendered, so the
    # layout drew its SIDE A / SIDE B kickers and VERSUS divider over empty
    # space. It survived every other gate — it parses, it has geometry, it binds
    # its fonts — and failed identically in the project preview, the template
    # preview and the exported MP4, because all three run the same code.
    for _m in _FITTEXT_SELF_CLOSING_RE.finditer(_strip_comments(code)):
        r = _fail(
            "A <FitText … /> is self-closing, so it renders NOTHING. FitText "
            "paints its children and has no text prop — an empty one is a sized, "
            "styled, invisible box. Put the text inside it: "
            "<FitText …>{yourText}</FitText>."
        )
        if r:
            return r

    # narrationText is the VOICEOVER SCRIPT — it must never be rendered.
    #
    # The three text props are distinct: `sceneTitle` is the scene's short
    # label, `displayText` is the on-screen copy, and `narrationText` is what
    # the voice reads aloud. Scenes routinely put narrationText in an eyebrow /
    # kicker / subtitle slot, which paints a full spoken sentence on screen —
    # usually a near-duplicate of the headline, in a slot sized for 2-4 words.
    # 213 of 389 stored scene codes did exactly this before this gate existed.
    #
    # The prompt already says "NEVER as the headline"; that was not enough, so
    # it is enforced here. Only JSX-rendered occurrences are rejected —
    # forwarding the prop on to a child component is left alone, since the
    # child is validated on its own terms.
    _narration_rendered = (
        # {props.narrationText} or {narrationText} in a JSX text position,
        # including guarded forms like `{props.narrationText && (` and
        # `{props.narrationText ? ... : ...}`.
        # The `(?<!=)` excludes `someProp={props.narrationText}` — passing the
        # prop down to a child is forwarding, not rendering; the child is
        # validated on its own terms.
        re.search(r'(?<!=)\{\s*(?:props\.)?narrationText\s*(?:\}|&&|\?|\|\|)', code)
        # <Foo text={props.narrationText} /> — a text-ish prop on a child.
        or re.search(
            r'(?<![A-Za-z0-9_])(?:text|label|caption|subtitle|eyebrow|kicker|children)'
            r'(?![A-Za-z0-9_])\s*=\s*\{\s*(?:props\.)?narrationText',
            code,
        )
    )
    if _narration_rendered:
        r = _fail(
            "props.narrationText is the VOICEOVER SCRIPT and must never be rendered on screen. "
            "It is what the voice reads aloud — painting it into an eyebrow, kicker, subtitle or "
            "body slot shows the viewer a spoken sentence that usually duplicates the headline. "
            "Use props.sceneTitle for a short label/eyebrow (a few words) and props.displayText "
            "for the on-screen copy. Remove every JSX use of narrationText."
        )
        if r:
            return r

    # A <FitText> must be allowed to wrap and to shrink.
    #
    # Wrapping <FitText> around the headline is not enough on its own — three
    # style choices silently defeat it, and they travel together:
    #   whiteSpace: 'nowrap'  -> the text can never break, so maxLines={N} is a
    #                            no-op and a long headline runs off-canvas
    #   overflow:   'visible' -> nothing clips the overrun, so it paints over
    #                            sibling columns instead of being contained
    # Combined with a container that bleeds past the frame (a negative
    # marginRight), this renders exactly the defect FitText exists to prevent:
    # a headline spilling across the frame while empty space sits beside it.
    # FitText solves for a size that fits the box; forbidding wrapping removes
    # the only degree of freedom it has.
    _fit_blocks = re.findall(r'<FitText\b[\s\S]{0,1200}?</FitText>', code)
    for _blk in _fit_blocks:
        if re.search(r"whiteSpace\s*:\s*['\"]nowrap['\"]", _blk):
            r = _fail(
                "A <FitText> block sets whiteSpace: 'nowrap'. That makes maxLines a no-op and "
                "forces the headline onto one line, so long copy overflows the frame instead of "
                "wrapping into the space beside it. Remove whiteSpace: 'nowrap' from every "
                "<FitText> style and let it wrap within maxLines."
            )
            if r:
                return r

    # Must reference imageUrl as a conditional — layout must adapt to its presence/absence.
    #
    # EXEMPT WHENEVER THE SCENE HAS NO IMAGE BY DESIGN. Two ways that happens:
    #   * the OUTRO — the CTA + socials row is composited over it at render time;
    #   * ANY scene whose design doc says IMAGE — NONE.
    #
    # The second was missing, and it is the same unsatisfiable-gate bug as the
    # FitText check above: the doc tells the scene "render no image", the
    # validator tells it "you must render an image", and the model cannot obey
    # both. Measured on template 177, two image-less scenes exhausted all three
    # repairs and were stubbed on exactly this contradiction.
    _image_less_by_design = "IMAGE — NONE" in scene_doc
    if (
        scene_type != "outro"
        and not _image_less_by_design
        and not _IMAGE_CONDITIONAL_REGEX.search(code)
    ):
        r = _fail(
            "Missing conditional imageUrl rendering — intro and content scenes must declare "
            "hasImage and render props.imageUrl when present: "
            "e.g. const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string')"
        )
        if r:
            return r

    # props.contentType must never be RENDERED.
    #
    # It is routing metadata ("plain", "bullets", "metrics") that tells the scene
    # which shape its data has. Scenes kept using it as an eyebrow —
    # `{props.contentType.toUpperCase()}` — which stamps the literal word "PLAIN"
    # on the video. A -0.2 score nudge was not enough: scenes shipped at 0.80 with
    # it visible, and it is ALWAYS wrong, so it is a gate.
    #
    # Reading it to branch on (`contentType === 'metrics' ? ... : ...`) is correct
    # and must keep working, so only a JSX text position is rejected.
    if re.search(r"\{\s*props\.contentType\s*(?:\?[^}]{0,120})?\}", code) or re.search(
        r"\{\s*props\.contentType\s*\.\s*(?:toUpperCase|toLowerCase|charAt|slice)\s*\(", code
    ):
        r = _fail(
            "props.contentType is rendered as visible text — it is routing metadata "
            "('plain', 'bullets', 'metrics'), so this stamps the word PLAIN on the video. "
            "Use it only to BRANCH on (contentType === 'metrics' ? ... : ...). For an "
            "eyebrow, use a real label from the scene's own copy or a fixed brand word."
        )
        if r:
            return r

    # spring()'s from/to must be NUMBERS, not objects.
    #
    # `spring({frame, fps, from: {opacity: 0, scale: 0.92}, to: {opacity: 1}})`
    # looks reasonable and compiles fine, but Remotion interpolates from/to
    # directly and throws "outputRange must contain only numbers" at RENDER time —
    # blanking the entire scene behind an error boundary. Observed in production:
    # a scene that passed every other check rendered as a blank frame with a ⚠️.
    #
    # A spring returns ONE number; animating several properties means several
    # springs (or one spring fed through interpolate).
    for _m in re.finditer(r"\bspring\s*\(\s*\{", code):
        _i, _depth = _m.end(), 1
        while _i < len(code) and _depth > 0:
            if code[_i] == "{":
                _depth += 1
            elif code[_i] == "}":
                _depth -= 1
            _i += 1
        _call = code[_m.start() : _i]
        if re.search(r"\b(?:from|to)\s*:\s*\{", _call):
            r = _fail(
                "spring()'s `from`/`to` must be NUMBERS, not objects — "
                "`from: {opacity: 0, scale: 0.9}` throws \"outputRange must contain only "
                "numbers\" at render time and blanks the whole scene. A spring produces one "
                "number: use a separate spring per property, or one spring driving "
                "interpolate(s, [0,1], [start, end]) for each value."
            )
            if r:
                return r
            break

    # interpolate() takes POSITIONAL ranges, not a config object.
    #
    # Remotion's signature is interpolate(frame, inputRange, outputRange, opts).
    # A scene that writes the React-Native/Framer style
    #     interpolate(frame, { inputRange: [...], outputRange: [...] })
    # passes an object where an array belongs, and the preview's
    # `safeInterpolate` wrapper calls `.map()` on it — "inputRange.map is not a
    # function", thrown during render, which blanks the WHOLE preview (the error
    # unwinds past the scene into the Player). Template 181's intro shipped three
    # such calls and rendered an empty frame.
    #
    # Rare (1 of 70 stored scenes) but fatal and invisible to every other check:
    # the code parses, wraps and type-checks fine.
    _obj_form = re.search(r"interpolate\s*\(\s*[^,()]+\s*,\s*\{", code)
    if _obj_form:
        r = _fail(
            "interpolate() was called with a CONFIG OBJECT as its second argument "
            "— `interpolate(frame, { inputRange: [...], outputRange: [...] })`. "
            "That is the React Native API; Remotion takes positional ranges and "
            "throws \"inputRange.map is not a function\" at render, which blanks "
            "the whole scene. Rewrite as: "
            "`interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', "
            "extrapolateRight: 'clamp' })` — ranges positional, options last."
        )
        if r:
            return r

    # interpolate()'s outputRange must be an ARRAY, not a scalar.
    #
    # The failure shape, measured on template 193's split-comparison scene:
    #     interpolate(leftIn, [0, 1], isPortrait ? 0 : -120, {...})
    # The ternary yields a NUMBER where a two-element array belongs, so Remotion
    # throws "inputRange (2) and outputRange (undefined) must have the same
    # length" at RENDER — which unwinds past the scene into the Player and
    # blanks the whole preview, not just the offending scene.
    #
    # The literal length check below cannot see this: it only matches when BOTH
    # ranges are bracketed literals, so a scalar third argument never reaches it.
    # The intent is almost always a ternary of two ARRAYS
    # (`isPortrait ? [0, 0] : [0, -120]`), which is what the message asks for.
    #
    # Matches an inputRange array followed by a third argument that does not
    # start with `[` and is not an identifier alone (a variable holding an array
    # is legitimate and unknowable statically).
    _scalar_out = re.search(
        r"interpolate\s*\([^,]+,\s*\[[^\]]*\]\s*,\s*"
        r"(?![\s]*\[)"          # not an array literal
        r"(?![\s]*[A-Za-z_$][\w$.]*\s*[,)])"  # not a bare variable/member
        r"([^,)]*\?[^,)]*:[^,)]*)",           # a ternary yielding non-arrays
        code,
    )
    if _scalar_out:
        r = _fail(
            "interpolate() was given a NON-ARRAY outputRange: "
            f"`{_scalar_out.group(1).strip()[:80]}`. Remotion needs an array the "
            "same length as inputRange, and a scalar throws \"inputRange (2) and "
            "outputRange (undefined) must have the same length\" at render, which "
            "blanks the whole scene. When the value depends on orientation, make "
            "the TERNARY RETURN ARRAYS: "
            "`interpolate(t, [0, 1], isPortrait ? [0, 0] : [0, -120], {...})` — "
            "not `isPortrait ? 0 : -120`."
        )
        if r:
            return r

    # Non-monotonic interpolate inputRange causes Remotion runtime crash
    for m in re.finditer(r'interpolate\s*\([^,]+,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]', code):
        # interpolate inputRange/outputRange must be NUMBERS. String literals like
        # ['0%','100%'] throw "outputRange must contain only numbers" at runtime —
        # the float() parse below skips them via ValueError, so reject explicitly.
        # (Variable/expression ranges like [start, end-4] are legal and are left for
        # the float() parse to skip — only quoted literals are unconditionally wrong.)
        if "'" in m.group(2) or '"' in m.group(2):
            r = _fail(
                "interpolate outputRange contains a string literal (must be numbers): "
                f"[{m.group(2).strip()}]. Interpolate numeric values, then apply units in the "
                "style — e.g. width: `${interpolate(p, [0,1], [0,100])}%` (NOT ['0%','100%'])"
            )
            if r:
                return r
        if "'" in m.group(1) or '"' in m.group(1):
            r = _fail(
                f"interpolate inputRange contains a string literal (must be numbers): [{m.group(1).strip()}]"
            )
            if r:
                return r
        try:
            inputs = [float(v.strip()) for v in m.group(1).split(',') if v.strip()]
            outputs = [float(v.strip()) for v in m.group(2).split(',') if v.strip()]
            if len(inputs) >= 2 and any(inputs[i] >= inputs[i + 1] for i in range(len(inputs) - 1)):
                r = _fail(f"Non-monotonic interpolate inputRange: {inputs}")
                if r:
                    return r
            if len(inputs) != len(outputs):
                r = _fail(
                    f"interpolate inputRange/outputRange length mismatch: {len(inputs)} vs {len(outputs)}"
                )
                if r:
                    return r
        except ValueError:
            pass

    # interpolate's first argument (the progress value) must always resolve to a
    # finite number — "Cannot interpolate an input which is not a number" is a hard
    # runtime crash. The common cause: inside a `.map((item, i) => ...)`, the progress
    # value is derived from a field read off `item` (e.g. `item.delay`, `entry.offset`)
    # instead of the guaranteed-numeric loop index `i`. Free-form props arrays
    # (timelineItems, steps, etc.) aren't guaranteed to carry that field, so it's
    # `undefined` at runtime and interpolate throws. Flag first-arg property reads —
    # legitimate uses (frame, frame - i*12, Math.min(frame, 30), a plain variable)
    # don't match this shape. Parens are depth-tracked so a nested call's own commas
    # (e.g. Math.min(frame, 30)) aren't mistaken for the arg separator.
    for call_m in re.finditer(r'\binterpolate\s*\(', code):
        start = call_m.end()
        depth = 1
        i = start
        while i < len(code) and depth > 0:
            if code[i] == '(':
                depth += 1
            elif code[i] == ')':
                depth -= 1
            elif code[i] == ',' and depth == 1:
                break
            i += 1
        first_arg = code[start:i].strip()
        # Only a bare property READ off an object (item.delay) is a crash risk;
        # item.method(), Math.min(...) and DECIMAL LITERALS are all fine.
        #
        # The identifier part must start with a letter/_/$ — `\w+` also matches
        # digits, so `Math.sin(frame * 0.06)` was flagged because `0.06` looked
        # like `object.property`. That rejected correct ambient-motion code (the
        # sine breathers the art direction now asks for) with a confusing
        # "reads a property off an object" error, burning every repair attempt.
        #
        # Namespaces whose properties are compile-time constants can never be
        # the undefined-field crash this gate exists for. `Math.PI` is the one
        # that shipped: `interpolate(Math.sin(frame / fps * Math.PI), ...)` is
        # correct, and rejecting it burned all three attempts on scenes using
        # the sine breather the art direction asks for. Same hole as the decimal
        # case above, one level up.
        _SAFE_NS = r'(?:Math|Number|JSON|Object|Array|String|Date)'
        _prop_read = re.compile(
            rf'\b(?!{_SAFE_NS}\b)[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b(?!\s*\()'
        )
        # No loop-index escape hatch is needed: `frame - i * 12` and
        # `i * stagger + frame` contain no property read at all, so they never
        # reach this branch. The old `not re.search(r'\bi\s*\*', ...)` guard
        # only recognised the `i * n` ordering and silently exempted any first
        # argument that happened to contain it — including a genuine
        # `item.delay + i * 2`.
        if _prop_read.search(first_arg):
            r = _fail(
                f"interpolate's first argument reads a property off an object ({first_arg!r}) — "
                "this crashes at runtime if that field is undefined on any item. Derive the "
                "progress value from the .map() loop index instead, e.g. `frame - i * 12`."
            )
            if r:
                return r

    # Self-referential destructure of pre-injected kit globals crashes with a TDZ
    # "Cannot access 'X' before initialization": the model writes
    #   const { staggerEntrance, panelRise } = { staggerEntrance, panelRise };
    # where the RHS shorthand resolves to the const being declared (dead zone),
    # not the global. The globals are already in scope — never redeclare them.
    for m in re.finditer(r'(?:const|let|var)\s*\{([^}]+)\}\s*=\s*\{([^}]+)\}', code):
        # LHS binding names: `a` -> a, `key: bind` -> bind, `a = default` -> a.
        def _bind(n: str) -> str:
            n = n.strip()
            if ":" in n:
                n = n.split(":", 1)[1]
            return n.split("=")[0].strip()
        lhs = {_bind(n) for n in m.group(1).split(",") if n.strip() and not n.strip().startswith("...")}
        # Only RHS SHORTHAND props (bare identifier, no `:value`) reference a variable
        # — those are what can resolve to the const being declared (the TDZ). Props
        # with values like `{x: 1}` are literals and are safe.
        rhs = set()
        for p in m.group(2).split(","):
            p = p.strip()
            if not p or p.startswith("...") or ":" in p:
                continue
            p = p.split("=")[0].strip()
            if re.match(r"^[A-Za-z_$][\w$]*$", p):
                rhs.add(p)
        clash = lhs & rhs
        if clash:
            r = _fail(
                f"Self-referential destructure (TDZ crash): const {{ {', '.join(sorted(clash))} }} "
                f"= {{ {', '.join(sorted(clash))} }}. Kit helpers are pre-injected globals already "
                "in scope — use them directly, never redeclare them."
            )
            if r:
                return r

    # ── Design-doc gates (generation path only) ──────────────────────────────
    #
    # These run ONLY when a scene_doc is supplied, i.e. while a scene is being
    # generated. Stored scenes are re-validated without one, so a template built
    # under the previous rules is never failed by rules it predates.
    #
    # Every message below is written to be DEBUGGABLE, not merely accurate: it
    # names the construct found, says what the doc required instead, and states
    # the minimal edit. A gate that returns "invalid image mode" sends the model
    # back with nothing to act on and burns three identical repairs.
    if scene_doc:
        for _msg in _design_doc_defects(code, scene_type, scene_doc):
            r = _fail(_msg)
            if r:
                return r

    if errors:
        if len(errors) == 1:
            return False, errors[0]
        # Numbered so the repair prompt reads as a checklist to work through
        # rather than one error with trailing noise.
        joined = "\n".join(f"  {i}. {e}" for i, e in enumerate(errors, 1))
        return False, f"{len(errors)} problems must ALL be fixed:\n{joined}"

    # ── Level 2: does it actually RUN? ──────────────────────────────────────
    #
    # Everything above is static. A scene can satisfy every contract here,
    # parse cleanly, and still crash or draw nothing the moment it is called —
    # `(props.comparisonLeft ?? []).slice(...)` on an OBJECT prop throws a
    # TypeError at render, and template 179 shipped exactly that. Running the
    # component is the only way to see it.
    #
    # Last, because it is the most expensive check (a node subprocess) and
    # there is no point paying for it on code the cheap gates already reject.
    # Generation path only (scene_doc present), so stored scenes built under
    # older rules are never failed by it. Fails OPEN — see runtime_check_scene.
    if scene_doc:
        try:
            from app.services.scene_runtime_check import runtime_check_scene

            _ct = "plain"
            _m = re.search(r"THIS SCENE'S DATA — props\.(\w+)", scene_doc)
            if _m:
                _ct = {
                    "bullets": "bullets", "steps": "steps", "codeLines": "code",
                    "metrics": "metrics", "timelineItems": "timeline",
                    "quote": "quote", "comparisonLeft": "comparison",
                }.get(_m.group(1), "plain")
            _rt_ok, _rt_err = runtime_check_scene(
                code, content_type=_ct, role=scene_type or "content"
            )
            if not _rt_ok:
                return False, _rt_err
        except Exception:  # noqa: BLE001 - never block generation on a tooling fault
            pass

    return True, None
