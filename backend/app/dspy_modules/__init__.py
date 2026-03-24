"""
Shared DSPy configuration. Called once at import time so all modules
share the same LM instance and thread context.
"""
import threading
import dspy
from app.config import settings

_lock = threading.Lock()
_configured = False

# Dedicated LMs for custom template flows
_codegen_lm: dspy.LM | None = None
_codegen_lm_lock = threading.Lock()

_theme_lm: dspy.LM | None = None
_theme_lm_lock = threading.Lock()


def ensure_dspy_configured():
    """Configure DSPy exactly once, thread-safe."""
    global _configured
    if _configured:
        return
    with _lock:
        if _configured:
            return
        lm = dspy.LM(
            "anthropic/claude-sonnet-4-5-20250929",
            api_key=settings.ANTHROPIC_API_KEY,
        )
        dspy.configure(lm=lm, async_max_workers=100)
        _configured = True


def get_custom_lm() -> dspy.LM:
    """Get or create the code generation LM (Sonnet 4.6, temp 0.7, 5120 max tokens).

    Used for code generation in the custom template flow.
    Higher temperature for creative diversity. 5120 tokens ≈ 300-400 lines of JSX,
    matching built-in template complexity (KineticInsight=208L, GlassNarrative=358L).
    """
    global _codegen_lm
    if _codegen_lm is not None:
        return _codegen_lm
    with _codegen_lm_lock:
        if _codegen_lm is not None:
            return _codegen_lm
        _codegen_lm = dspy.LM(
            "anthropic/claude-sonnet-4-6",
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.7,
            max_tokens=5120,
            cache_control_injection_points=[{"location": "message", "role": "system"}],
        )
        return _codegen_lm


def get_theme_lm() -> dspy.LM:
    """Get or create the theme extraction LM (Haiku 4.5, temp 0.3, 2048 max tokens).

    Used for theme extraction — deterministic, small output (JSON).
    Haiku is sufficient for structured JSON extraction from HTML/CSS.
    Lower temperature for consistency, smaller token budget since output is ~500 chars.
    """
    global _theme_lm
    if _theme_lm is not None:
        return _theme_lm
    with _theme_lm_lock:
        if _theme_lm is not None:
            return _theme_lm
        _theme_lm = dspy.LM(
            "anthropic/claude-haiku-4-5-20251001",
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.3,
            max_tokens=2048,
        )
        return _theme_lm
