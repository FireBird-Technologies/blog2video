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


def validate_component_code(code: str) -> tuple[bool, str | None]:
    """Validate a generated component code string.

    Returns (True, None) if valid, or (False, error_message) if invalid.
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

    return True, None
