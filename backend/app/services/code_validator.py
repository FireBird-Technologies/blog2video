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


def clean_code(raw: str) -> str:
    """Clean common AI artifacts from generated code.

    - Strips markdown fences (```tsx ... ```)
    - Removes import/export lines (globals are pre-injected)
    - Trims whitespace
    """
    code = raw.strip()

    # Strip markdown fences
    code = re.sub(r"^```(?:tsx|jsx|javascript|js|typescript|ts)?\s*\n?", "", code)
    code = re.sub(r"\n?```\s*$", "", code)

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


def validate_component_code(
    code: str,
    scene_type: str = "content",
    *,
    collect_all: bool = False,
) -> tuple[bool, str | None]:
    """Validate a generated component code string.

    Returns (True, None) if valid, or (False, error_message) if invalid.

    scene_type: 'intro', 'content', or 'outro'. The OUTRO skips the imageUrl
    requirement — a CTA + socials row is composited over it at render time and
    its own generation prompt says it takes no content image, so requiring one
    here made the two contradict each other and guaranteed repair churn.
    (This parameter was previously accepted and never read.)

    collect_all: when True, report EVERY content failure at once instead of
    returning on the first. The default is False so existing callers are
    unchanged. The repair path passes True, because reporting one broken
    contract at a time is what made a scene fix its logo while dropping its
    animations, then restore animations and drop the logo again.
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

    # Must have at least 2 animation calls, counting kit helpers as animation.
    anim_count = code.count("interpolate(") + code.count("spring(")
    anim_count += len(_ANIM_HELPER_REGEX.findall(code))
    if anim_count < 2:
        r = _fail(
            f"Insufficient animations ({anim_count}) — need at least 2 interpolate/spring "
            "calls, or kit animation helpers (staggerEntrance, panelRise, RevealText, "
            "KenBurnsImage, SignatureArtifact, ...)"
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

    # The headline must be inside <FitText>.
    #
    # FitText is the ONLY thing that sizes text to the space it actually has —
    # it solves for the size that fills the box and clamps to a legible range, in
    # both directions. A bare <div style={{fontSize: N}}> is a fixed guess, which
    # is exactly how headlines end up tiny on short copy and overflowing on long
    # copy. A soft score penalty was not enough: scenes shipped at 0.70-0.85 with
    # an unwrapped headline, so this is a hard gate.
    if re.search(r'props\.displayText', code) and not re.search(r'<FitText\b', code):
        r = _fail(
            "The props.displayText headline must be wrapped in <FitText> — a fixed fontSize "
            "cannot adapt to how much text a scene actually receives, so it renders tiny on a "
            "short title and overflows on a long one. Use "
            "<FitText fontSize={<target>} maxLines={3}>{props.displayText}</FitText>."
        )
        if r:
            return r

    # The headline must honour props.titleFontSize.
    #
    # The Typography sliders in the scene editor write layoutConfig.titleFontSize
    # / descriptionFontSize, and both the player and the export pass them into
    # the component. If the scene hardcodes `fontSize={72}` instead of
    # `fontSize={props.titleFontSize ?? 72}`, the slider silently does nothing —
    # the user drags it and the preview never moves.
    #
    # The prompt has documented this contract all along; 111 of 389 stored
    # scenes ignored it anyway, which is why it is enforced here rather than
    # merely asked for. Only the headline is gated: body/eyebrow/caption sizes
    # are the scene's own business, and `descriptionFontSize` has no single
    # unambiguous target element to bind to.
    if re.search(r'props\.displayText', code) and not re.search(
        r'props\.titleFontSize', code
    ):
        r = _fail(
            "The headline ignores props.titleFontSize, so the editor's 'Title font size' "
            "slider does nothing for this scene. Read the prop with a fallback to your "
            "intended size: "
            "<FitText fontSize={props.titleFontSize ?? 72} maxLines={3}>{props.displayText}</FitText>. "
            "Do the same for body copy with props.descriptionFontSize."
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
    # Required in intro and content. The OUTRO is exempt: the CTA + socials row is
    # composited over it at render time and its prompt explicitly says it takes no
    # content image, so requiring one here put the prompt and the validator in
    # direct conflict and the scene could never satisfy both.
    if scene_type != "outro" and not _IMAGE_CONDITIONAL_REGEX.search(code):
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
        _prop_read = re.compile(r'\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b(?!\s*\()')
        if _prop_read.search(first_arg) and not re.search(r'\bi\s*\*', first_arg):
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

    if errors:
        if len(errors) == 1:
            return False, errors[0]
        # Numbered so the repair prompt reads as a checklist to work through
        # rather than one error with trailing noise.
        joined = "\n".join(f"  {i}. {e}" for i, e in enumerate(errors, 1))
        return False, f"{len(errors)} problems must ALL be fixed:\n{joined}"

    return True, None
