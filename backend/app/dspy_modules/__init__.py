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

# Default LLM: Claude Sonnet via Anthropic in production, Qwen 3 Max via OpenRouter (Alibaba-hosted) locally
_DEFAULT_MODEL = (
    "anthropic/claude-sonnet-4-6"
    if _IS_PRODUCTION
    else "openrouter/qwen/qwen3-max"
)

# Scene descriptor LLM: Claude Haiku via Anthropic in production, Qwen 3 30B A3B (fast MoE, parallel-friendly) via OpenRouter (Alibaba-hosted) locally
_SCENE_MODEL = (
    "anthropic/claude-haiku-4-5-20251001"
    if _IS_PRODUCTION
    else "openrouter/qwen/qwen3-30b-a3b-instruct-2507"
)


def _extract_openrouter_provider(result) -> str | None:
    """Pull the served-by provider name out of a litellm/OpenRouter response."""
    if result is None:
        return None
    for attr in ("provider", "_hidden_params"):
        val = getattr(result, attr, None)
        if isinstance(val, str) and val:
            return val
        if isinstance(val, dict) and val.get("provider"):
            return val["provider"]
    extra = getattr(result, "model_extra", None)
    if isinstance(extra, dict) and extra.get("provider"):
        return extra["provider"]
    if isinstance(result, dict):
        return result.get("provider")
    return None


class _ProviderLoggingLM(dspy.LM):
    """dspy.LM subclass that logs each OpenRouter call's provider, model fallback usage, and failures."""

    def forward(self, *args, **kwargs):
        try:
            result = super().forward(*args, **kwargs)
        except Exception as e:
            # Surface the final exception type and message so we can tell whether
            # LiteLLM's model-level fallbacks engaged or the primary error bubbled up.
            print(f"[OpenRouter] FAIL model={self.model} err={type(e).__name__}: {str(e)[:300]}")
            raise
        served_model = getattr(result, "model", None)
        provider = _extract_openrouter_provider(result)
        print(f"[OpenRouter] OK   model={self.model} served={served_model} provider={provider}")
        return result

    async def aforward(self, *args, **kwargs):
        try:
            result = await super().aforward(*args, **kwargs)
        except Exception as e:
            print(f"[OpenRouter] FAIL model={self.model} err={type(e).__name__}: {str(e)[:300]}")
            raise
        served_model = getattr(result, "model", None)
        provider = _extract_openrouter_provider(result)
        print(f"[OpenRouter] OK   model={self.model} served={served_model} provider={provider}")
        return result


def _make_anthropic_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    return dspy.LM(
        model,
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def _make_openrouter_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    return _ProviderLoggingLM(
        model,
        api_key=settings.OPEN_ROUTER_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
        # Model-level fallbacks: when the primary model rate-limits (Qwen 3 Max is
        # Alibaba-proprietary, capped at 20 RPM), LiteLLM auto-retries against these.
        # Order matters: stay in Qwen family first (open-weight, multi-provider),
        # then drop to DeepSeek as a cross-family safety net.
        fallbacks=[
            "openrouter/qwen/qwen3-235b-a22b-2507",
            "openrouter/deepseek/deepseek-chat-v3.1",
        ],
        extra_body={
            "provider": {
                # Provider names must match OpenRouter's exact slugs (case-sensitive).
                # qwen3-max is Alibaba-only; qwen3-30b adds SiliconFlow/Nebius;
                # Together/Baidu cover the multi-provider Qwen fallbacks.
                "order": ["Alibaba", "SiliconFlow", "Nebius", "Together", "Baidu"],
                "allow_fallbacks": True,
                "require_parameters": True,
                "data_collection": "deny",
            }
        },
    )


def _make_default_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    factory = _make_anthropic_lm if _IS_PRODUCTION else _make_openrouter_lm
    return factory(model, temperature, max_tokens)


def ensure_dspy_configured():
    """Configure DSPy exactly once, thread-safe."""
    global _configured
    if _configured:
        return
    with _lock:
        if _configured:
            return
        lm = _make_default_lm(_DEFAULT_MODEL, temperature=0.2, max_tokens=7000)
        dspy.configure(lm=lm, async_max_workers=100)
        _configured = True


def get_custom_lm() -> dspy.LM:
    """Claude Sonnet 4.6 via Anthropic for custom-template Remotion codegen (app.services.code_generator).

    Always routes through the Anthropic API directly, regardless of environment —
    Remotion code generation requires Claude-quality output even in local/dev.
    """
    global _codegen_lm
    if _codegen_lm is not None:
        return _codegen_lm
    with _codegen_lm_lock:
        if _codegen_lm is not None:
            return _codegen_lm
        _codegen_lm = _make_anthropic_lm("anthropic/claude-sonnet-4-6", temperature=0.7, max_tokens=12000)
        return _codegen_lm


def get_scene_lm() -> dspy.LM:
    """Scene descriptor LM — Claude Haiku via Anthropic in production, Qwen3 30B A3B (fast MoE) via OpenRouter locally."""
    global _scene_lm
    if _scene_lm is not None:
        return _scene_lm
    with _scene_lm_lock:
        if _scene_lm is not None:
            return _scene_lm
        _scene_lm = _make_default_lm(_SCENE_MODEL, temperature=0.2, max_tokens=5000)
        return _scene_lm


def get_theme_lm() -> dspy.LM:
    global _theme_lm
    if _theme_lm is not None:
        return _theme_lm
    with _theme_lm_lock:
        if _theme_lm is not None:
            return _theme_lm
        
        _theme_lm = _make_default_lm(_DEFAULT_MODEL, temperature=0.3, max_tokens=2048)
        return _theme_lm
