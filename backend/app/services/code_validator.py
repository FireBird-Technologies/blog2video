"""
Validates AI-generated Remotion component code before storing in DB.

Cleans common AI artifacts (markdown fences, import lines) then checks
for dangerous APIs and required structure.
"""

import re

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

    # Remove import lines (AI often adds these despite instructions)
    code = re.sub(r"^import\s+.*?[;\n]", "", code, flags=re.MULTILINE)

    # Remove export lines
    code = re.sub(r"^export\s+(?:default\s+)?", "", code, flags=re.MULTILINE)

    return code.strip()


def validate_component_code(code: str, scene_type: str = "content") -> tuple[bool, str | None]:
    """Validate a generated component code string.

    Returns (True, None) if valid, or (False, error_message) if invalid.
    scene_type: 'intro', 'content', or 'outro' — intro/outro skip the hasImage requirement.
    """
    if not code or not code.strip():
        return False, "Code is empty"

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

    # Must declare SceneComponent
    if not re.search(r"const\s+SceneComponent\s*=", code):
        return False, "Missing 'const SceneComponent' declaration"

    # Must contain JSX or React.createElement
    has_jsx = ("<" in code) and ("/>" in code or "</" in code)
    has_create_element = "React.createElement" in code
    if not has_jsx and not has_create_element:
        return False, "Code does not appear to contain JSX or React.createElement"

    # Must have at least 2 animation calls
    anim_count = code.count("interpolate(") + code.count("spring(")
    if anim_count < 2:
        return False, f"Insufficient animations ({anim_count}) — need at least 2 interpolate/spring calls"

    # Must be substantial enough (not a trivial placeholder)
    if len(code) < 500:
        return False, "Code too short — likely missing animations and visual detail"

    # Must have overflow:hidden to prevent content escaping the frame
    if "overflow" not in code or "hidden" not in code:
        return False, "Missing overflow:'hidden' on outermost container — content can escape frame"

    # Must reference logoUrl as a conditional — not just any string match.
    # Accepts: props.logoUrl &&, logoUrl &&, hasLogo, !!props.logoUrl, logoUrl ?
    has_logo_conditional = bool(re.search(
        r'(?:props\.logoUrl\s*&&|logoUrl\s*&&|hasLogo\b|!!props\.logoUrl|logoUrl\s*\?[^:])',
        code,
    ))
    if not has_logo_conditional:
        return False, (
            "Missing conditional logoUrl rendering — scene must check props.logoUrl before rendering: "
            "e.g. {props.logoUrl && <Img src={props.logoUrl} ... />}"
        )

    # Must reference imageUrl as a conditional — layout must adapt to its presence/absence.
    # Intro and outro are branded scenes (logo/title/CTA) — image support is optional there.
    # Accepts: hasImage, props.imageUrl &&, imageUrl &&, !!props.imageUrl, imageUrl ?
    if scene_type == "content":
        has_image_conditional = bool(re.search(
            r'(?:hasImage\b|props\.imageUrl\s*&&|imageUrl\s*&&|!!props\.imageUrl|imageUrl\s*\?[^:])',
            code,
        ))
        if not has_image_conditional:
            return False, (
                "Missing conditional imageUrl rendering — scene must declare hasImage and adapt layout: "
                "e.g. const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string')"
            )

    # Non-monotonic interpolate inputRange causes Remotion runtime crash
    for m in re.finditer(r'interpolate\s*\([^,]+,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]', code):
        try:
            inputs = [float(v.strip()) for v in m.group(1).split(',') if v.strip()]
            outputs = [float(v.strip()) for v in m.group(2).split(',') if v.strip()]
            if len(inputs) >= 2 and any(inputs[i] >= inputs[i + 1] for i in range(len(inputs) - 1)):
                return False, f"Non-monotonic interpolate inputRange: {inputs}"
            if len(inputs) != len(outputs):
                return False, f"interpolate inputRange/outputRange length mismatch: {len(inputs)} vs {len(outputs)}"
        except ValueError:
            pass

    return True, None
