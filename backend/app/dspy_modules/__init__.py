"""
Shared DSPy configuration. Called once at import time so all modules
share the same LM instance and thread context.
"""
import threading
import litellm
import dspy
from app.config import settings

# Disable LiteLLM's async LoggingWorker — it spawns a persistent background
# task per request that never gets cleanly cancelled, flooding logs with
# "Task was destroyed but it is pending!" errors.
litellm.suppress_debug_info = True
litellm.set_verbose = False
litellm.turn_off_message_logging = True
litellm.callbacks = []
litellm.success_callback = []
litellm.failure_callback = []
litellm._async_success_callback = []
litellm._async_failure_callback = []
litellm.service_callback = []

# Patch out the LoggingWorker entirely so it never spawns background tasks.
try:
    from litellm.litellm_core_utils import logging_worker as _lw

    class _NoOpLoggingWorker:
        def __init__(self, *a, **kw): pass
        async def _worker_loop(self): pass
        def start(self): pass
        def flush(self): pass
        async def async_log_success_event(self, *a, **kw): pass
        async def async_log_failure_event(self, *a, **kw): pass

    _lw.LoggingWorker = _NoOpLoggingWorker
except Exception:
    pass

_lock = threading.Lock()
_configured = False

# Dedicated LMs for custom template flows
_codegen_lm: dspy.LM | None = None
_codegen_lm_lock = threading.Lock()

_theme_lm: dspy.LM | None = None
_theme_lm_lock = threading.Lock()

_scene_lm: dspy.LM | None = None
_scene_lm_lock = threading.Lock()


_IS_PRODUCTION = settings.ENVIRONMENT.lower() == "production"

# Default LLM: Claude Sonnet in production, DeepSeek Flash locally
_DEFAULT_MODEL = (
    "openrouter/anthropic/claude-sonnet-4-6"
    if _IS_PRODUCTION
    else "openrouter/deepseek/deepseek-v4-flash"
)

# Scene descriptor LLM: Claude Haiku in production (fast + cheap), Gemini Flash locally
_SCENE_MODEL = (
    "openrouter/anthropic/claude-haiku-4-5-20251001"
    if _IS_PRODUCTION
    else "openrouter/google/gemini-2.0-flash-001"
)


def _make_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    return dspy.LM(
        model,
        api_key=settings.OPEN_ROUTER_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
        fallbacks=["openrouter/anthropic/claude-sonnet-4-6"],
        extra_body={
            "provider": {
                "order": ["DeepSeek", "Together", "Fireworks"],
                "allow_fallbacks": True,
            }
        },
    )


def ensure_dspy_configured():
    """Configure DSPy exactly once, thread-safe."""
    global _configured
    if _configured:
        return
    with _lock:
        if _configured:
            return
        lm = _make_lm(_DEFAULT_MODEL, temperature=0.2, max_tokens=5000)
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
        _codegen_lm = _make_lm("openrouter/anthropic/claude-sonnet-4-6", temperature=0.7, max_tokens=12000)
        return _codegen_lm


def get_scene_lm() -> dspy.LM:
    """Scene descriptor LM — Claude Haiku in production, Gemini Flash locally."""
    global _scene_lm
    if _scene_lm is not None:
        return _scene_lm
    with _scene_lm_lock:
        if _scene_lm is not None:
            return _scene_lm
        _scene_lm = _make_lm(_SCENE_MODEL, temperature=0.2, max_tokens=5000)
        return _scene_lm


def get_theme_lm() -> dspy.LM:
    global _theme_lm
    if _theme_lm is not None:
        return _theme_lm
    with _theme_lm_lock:
        if _theme_lm is not None:
            return _theme_lm
        _theme_lm = _make_lm(_DEFAULT_MODEL, temperature=0.3, max_tokens=2048)
        return _theme_lm
