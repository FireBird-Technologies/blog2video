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
            "openrouter/deepseek/deepseek-v4-flash",
            api_key=settings.OPEN_ROUTER_KEY,
            temperature=0.2,
            max_tokens=3000,
        )
        dspy.configure(lm=lm, async_max_workers=100)
        _configured = True


def get_custom_lm() -> dspy.LM:
    """Claude Sonnet 4.6 via Anthropic for custom-template Remotion codegen (app.services.code_generator)."""
    global _codegen_lm
    if _codegen_lm is not None:
        return _codegen_lm
    with _codegen_lm_lock:
        if _codegen_lm is not None:
            return _codegen_lm
        _codegen_lm = dspy.LM(
            "openrouter/anthropic/claude-sonnet-4-6",
            api_key=settings.OPEN_ROUTER_KEY,
            temperature=0.7,
            max_tokens=12000,
        )
        return _codegen_lm


def get_theme_lm() -> dspy.LM:
    global _theme_lm
    if _theme_lm is not None:
        return _theme_lm
    with _theme_lm_lock:
        if _theme_lm is not None:
            return _theme_lm
        _theme_lm = dspy.LM(
            "openrouter/deepseek/deepseek-v4-flash",
            api_key=settings.OPEN_ROUTER_KEY,
            temperature=0.3,
            max_tokens=2048,
        )
        return _theme_lm
