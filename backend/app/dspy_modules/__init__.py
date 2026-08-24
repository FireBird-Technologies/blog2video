"""
Shared DSPy configuration. Called once at import time so all modules
share the same LM instance and thread context.
"""
import logging
import threading
import litellm
import dspy
from app.config import settings

# Silence LiteLLM's fallback-attempt ERROR logs. When the primary model 429s and
# we recover via model-level fallbacks, LiteLLM still logs the intermediate
# failure at ERROR with a full traceback — which is noise, not a real failure.
# Our own _ProviderLoggingLM still surfaces the final outcome.
logging.getLogger("LiteLLM").setLevel(logging.CRITICAL)

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

_scene_type_lm: dspy.LM | None = None
_scene_type_lm_lock = threading.Lock()

_blueprint_lm: dspy.LM | None = None
_blueprint_lm_lock = threading.Lock()


_IS_PRODUCTION = settings.ENVIRONMENT.lower() == "production"

# Default LLM: Claude Sonnet via Anthropic in production, GLM 5.2 via Z.AI direct locally
# (_make_zai_lm strips the openrouter/z-ai/ prefix below down to the bare "glm-5.2" slug
# Z.AI's API expects — this string doubles as the OpenRouter-style model id for
# _make_openrouter_lm, still available but no longer the default path).
# Left the Qwen3.x reasoning-toggle family entirely — every attempt (qwen3.6-27b's
# chat_template_kwargs/reasoning.enabled, qwen3.5-35b-a3b's enable_thinking) had no
# confirmed-working disable path in OpenRouter's own docs for that specific model. GLM 5.2
# is different: Z.ai's own docs explicitly confirm `reasoning={"enabled": False}` "disables
# the chain of thought and returns only the final answer" — a concrete, model-specific
# confirmation, not inferred from a general family description. Also the best-hosted model
# evaluated all session (26 OpenRouter providers vs. Qwen's best of 9), with confirmed
# median 173.5 tok/s across providers (reasoning-mode figure; non-reasoning should be
# faster still, since disabling it removes the thinking-token generation phase entirely).
_DEFAULT_MODEL = (
    "anthropic/claude-sonnet-4-6"
    if _IS_PRODUCTION
    else "openrouter/z-ai/glm-5.2"
)

# Scene descriptor LLM: Claude Sonnet 4.6 via Anthropic in production, GLM 5.2 via
# Z.AI direct locally. Same model and reasoning-disabled setup as _DEFAULT_MODEL above —
# this call site is only reached by resolve_auto_video_style during a normal generation
# run (per-scene descriptors run on the default LM, not this).
_SCENE_MODEL = (
    "anthropic/claude-sonnet-4-6"
    if _IS_PRODUCTION
    else "openrouter/z-ai/glm-5.2"
)

# GLM's INTERNAL chain-of-thought for custom-template codegen (local/dev Z.AI).
#
# Disabled. Measured against the live Z.AI API: for a trivial component request,
# thinking consumed 1825 of 1986 completion tokens (92%) at reasoning_effort
# "low", and 1005 of 1338 at "minimal". Disabled, the same request used 286
# tokens — all of them content.
#
# On the real ~30k-char codegen prompt that overhead exhausted max_tokens before
# the `code` field was emitted, so the call returned an EMPTY string after
# ~145-300s. It hit content scenes specifically because their reward penalties
# push scores under Refine's 0.75 threshold, and Refine retries at escalating
# temperature (up to 1.0) where GLM's thinking grows repetitive — hence the
# "consider increasing the temperature ... if the reason is repetition" warning,
# which is inverted here.
#
# DSPy's own ChainOfThought rationale field is untouched: the model still plans
# its answer, it just does not also burn budget on a second private pass.
_CODEGEN_THINKING = False
# A NO-OP while _CODEGEN_THINKING is False (Z.AI ignores reasoning_effort when
# thinking is disabled). Kept at "low" so that re-enabling thinking starts from
# the cheapest setting rather than the "medium" that caused the truncations.
# One of: max, xhigh, high, medium, low, minimal, none.
_CODEGEN_REASONING_EFFORT = "low"

# Output budget for custom-template codegen. Measured against 378 stored scenes:
# median code is ~2.6k tokens, p99 ~5.5k. Plus the CoT rationale and the four
# numeric fields that is ~6k — comfortably inside 12000 now that GLM's internal
# thinking (which was eating 75-92% of the budget) is off.
#
# This is a CEILING, not a reservation: unused budget costs nothing, so a larger
# number only delays truncation. 12000 was never the real cause of the empty
# responses — see _CODEGEN_THINKING above.
_CODEGEN_MAX_TOKENS = 12000


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
    """dspy.LM subclass that logs each call's served-by provider, fallback usage, and failures.

    Works for any LiteLLM provider prefix (openrouter/, zai/, ...) — the log tag is
    derived from the model string so it stays accurate regardless of which one is used.
    """

    @property
    def _log_tag(self) -> str:
        return self.model.split("/", 1)[0]

    def forward(self, *args, **kwargs):
        try:
            result = super().forward(*args, **kwargs)
        except Exception as e:
            # Surface the final exception type and message so we can tell whether
            # LiteLLM's model-level fallbacks engaged or the primary error bubbled up.
            print(f"[{self._log_tag}] FAIL model={self.model} err={type(e).__name__}: {str(e)[:300]}")
            raise
        served_model = getattr(result, "model", None)
        provider = _extract_openrouter_provider(result)
        print(f"[{self._log_tag}] OK   model={self.model} served={served_model} provider={provider}")
        return result

    async def aforward(self, *args, **kwargs):
        try:
            result = await super().aforward(*args, **kwargs)
        except Exception as e:
            print(f"[{self._log_tag}] FAIL model={self.model} err={type(e).__name__}: {str(e)[:300]}")
            raise
        served_model = getattr(result, "model", None)
        provider = _extract_openrouter_provider(result)
        print(f"[{self._log_tag}] OK   model={self.model} served={served_model} provider={provider}")
        return result


def _make_anthropic_lm(
    model: str, temperature: float, max_tokens: int, api_key: str | None = None
) -> dspy.LM:
    return dspy.LM(
        model,
        api_key=(api_key or settings.ANTHROPIC_API_KEY),
        temperature=temperature,
        max_tokens=max_tokens,
    )


def _custom_anthropic_key() -> str:
    """Key for custom-template AI work (codegen + theme extraction).

    Prefers CUSTOM_ANTHROPIC_API_KEY so custom templates can bill / rate-limit
    separately; falls back to ANTHROPIC_API_KEY when unset.
    """
    return (settings.CUSTOM_ANTHROPIC_API_KEY or "").strip() or settings.ANTHROPIC_API_KEY


def _make_openrouter_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    return _ProviderLoggingLM(
        model,
        api_key=settings.OPEN_ROUTER_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
        # Model-level fallback: GLM 5.2 has 26 OpenRouter providers — the best redundancy
        # of any model evaluated this session — but they can still all be down/rate-limited
        # at once. Drop to DeepSeek V4 Flash — 12 providers (no realistic rate ceiling),
        # fast (~13B activated MoE), cheap ($0.42/M), and a much closer instruction-
        # follower than qwen3-235b/deepseek-chat-v3.1 were.
        fallbacks=[
            "openrouter/deepseek/deepseek-v4-flash",
        ],
        extra_body={
            # Genuinely turn reasoning off — Z.ai's own docs confirm this exact parameter
            # ("reasoning={'enabled': False}") disables chain-of-thought and returns only
            # the final answer for GLM 5.2 specifically, not inferred from general family
            # behavior. No chat_template_kwargs needed here — GLM 5.2's disable path is
            # OpenRouter's own unified reasoning control, confirmed model-specific.
            # Note: GLM 5.2 also supports effort tiers ("high"/"max") via
            # reasoning={"effort": ...}, but effort only applies when reasoning is ON —
            # it's ignored once enabled=False, so there's nothing to combine here.
            "reasoning": {"enabled": False},
            "provider": {
                # Provider names must match OpenRouter's exact slugs (case-sensitive).
                # Ordered by fastest confirmed response time (TTFT), per Artificial
                # Analysis: Nebius (0.69s TTFT, 174 tok/s) is fastest to first token by a
                # clear margin; Fireworks (0.85s TTFT, 362 tok/s) and Databricks (0.88s,
                # 350 tok/s) are close behind with much higher throughput once started.
                # Alibaba last as a high-uptime (99.97%) fallback.
                "order": ["Nebius", "Fireworks", "Databricks", "Alibaba"],
                "allow_fallbacks": True,
                "require_parameters": True,
                "data_collection": "deny",
            }
        },
    )


def _make_zai_lm(
    model: str,
    temperature: float,
    max_tokens: int,
    *,
    thinking: bool = False,
    reasoning_effort: str | None = None,
) -> dspy.LM:
    """GLM via Z.AI's own API directly (LiteLLM's `zai/` provider). This is the local/dev
    default for every GLM call site (global default LM, scene descriptors, theme
    extraction, custom-template codegen) via _make_default_lm / get_custom_lm.

    dspy.LM is a thin wrapper over litellm.completion/acompletion, so any LiteLLM-
    supported provider works here — this is the same _ProviderLoggingLM class used
    by _make_openrouter_lm, just pointed at LiteLLM's native Z.AI integration.

    Uses ZAI_API_KEY — the same shared z.ai key used by GLM image generation
    (app.services.image_gen.GLMProvider); both need a z.ai key, LiteLLM/DSPy just
    isn't the code path image gen goes through.

    Trade-off vs _make_openrouter_lm (kept in this file, no longer called by
    default but still available): single provider (Z.AI's own infra) instead of
    OpenRouter's 26-provider routing/fallback pool, and no DeepSeek fallback — but
    skips the OpenRouter hop. Reasoning toggle uses Z.AI's own `thinking` param
    (https://docs.z.ai/guides/llm/glm-5.2), NOT OpenRouter's `reasoning` schema —
    the two are different shapes for the same idea and are not interchangeable.

    reasoning_effort (GLM-5.2 only, per Z.AI's own API reference) is a sub-dial that
    ONLY takes effect when thinking=True — Z.AI's docs state it "takes effect when
    `thinking` is enabled"; passing it with thinking=False is a no-op. Accepted
    values: max (default), xhigh, high, medium, low, minimal, none. This is Z.AI's
    native field, not OpenRouter's reasoning.effort — different API, same idea, not
    interchangeable (same caveat as the thinking/reasoning split above).

    Accepts either a bare model name ("glm-5.2") or an openrouter/z-ai/-prefixed
    one (from _DEFAULT_MODEL / _SCENE_MODEL / CUSTOM_TEMPLATE_LM) — the slug after
    the last "/" is what Z.AI's API expects.
    """
    bare_model = model.rsplit("/", 1)[-1]
    extra_body: dict = {
        "thinking": {"type": "enabled" if thinking else "disabled"},
    }
    if thinking and reasoning_effort:
        extra_body["reasoning_effort"] = reasoning_effort
    return _ProviderLoggingLM(
        f"zai/{bare_model}",
        api_key=settings.ZAI_API_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
        extra_body=extra_body,
    )


def _make_openrouter_codegen_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    """OpenRouter LM for custom-template codegen. No longer called by default —
    get_custom_lm now routes local/dev codegen through _make_zai_lm (GLM 5.2 via
    Z.AI direct, thinking controlled by _CODEGEN_THINKING). Kept as the fallback
    path if codegen ever needs OpenRouter's multi-provider routing again.

    Mirrors _make_openrouter_lm but drops its GLM-5.2-tuned provider order, reasoning
    override, and DeepSeek fallback — lets OpenRouter pick the model's own serving
    providers and falls back to a smaller GLM if the primary is down.
    """
    return _ProviderLoggingLM(
        model,
        api_key=settings.OPEN_ROUTER_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
        fallbacks=["openrouter/z-ai/glm-4.7"],
        extra_body={
            "provider": {
                "allow_fallbacks": True,
                "require_parameters": True,
                "data_collection": "deny",
            }
        },
    )


def _make_default_lm(model: str, temperature: float, max_tokens: int) -> dspy.LM:
    factory = _make_anthropic_lm if _IS_PRODUCTION else _make_zai_lm
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
    """Custom-template Remotion codegen LM (app.services.code_generator).

    Production keeps Claude Sonnet 4.6 via Anthropic (Claude-quality TSX). Local/dev
    uses GLM via Z.AI direct (settings.CUSTOM_TEMPLATE_LM) so devs iterate without
    burning the Anthropic key. Swap the two by changing ENVIRONMENT, like every
    other LM path. Unlike the other GLM call sites, thinking here follows
    _CODEGEN_THINKING — codegen is the one quality-sensitive path where
    chain-of-thought is worth the extra tokens/latency.
    """
    global _codegen_lm
    if _codegen_lm is not None:
        return _codegen_lm
    with _codegen_lm_lock:
        if _codegen_lm is not None:
            return _codegen_lm
        if _IS_PRODUCTION:
            _codegen_lm = _make_anthropic_lm(
                "anthropic/claude-sonnet-4-6",
                temperature=0.7,
                max_tokens=_CODEGEN_MAX_TOKENS,
                api_key=_custom_anthropic_key(),
            )
        else:
            _codegen_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=0.7,
                max_tokens=_CODEGEN_MAX_TOKENS,
                thinking=_CODEGEN_THINKING,
                reasoning_effort=_CODEGEN_REASONING_EFFORT,
            )
        # Disable DSPy's disk cache for CODEGEN ONLY. The disk cache defaults to ON
        # and persists completions keyed on the prompt signature — so a "regenerate"
        # of the same custom template (identical scene_purpose kwargs) silently
        # replays the cached completion instead of asking the model again. That made
        # broken scenes un-regeneratable: a blank-rendering scene passes the static
        # validator, gets stored, and every regenerate returned byte-identical output
        # forever. Codegen is creative generation — we always want a fresh completion.
        # Scoped to this LM (NOT the global dspy.configure_cache) so theme/script/
        # scene/translation caching is untouched. Set on the built instance so it
        # applies regardless of which factory (Anthropic dspy.LM / Z.AI
        # _ProviderLoggingLM) produced it. (A per-scene nonce in code_generator.py is
        # kept as a redundant safety net.)
        _codegen_lm.cache = False
        return _codegen_lm


def get_scene_type_lm() -> dspy.LM:
    """Brand scene-type decision LM (DecideBrandSceneTypes, app.services.code_generator).

    Split out from get_custom_lm() because that LM's max_tokens=12000 was getting
    eaten by reasoning before the JSON array output: DecideBrandSceneTypes runs
    under dspy.ChainOfThought (its own "reasoning" prose field) ON TOP OF GLM's own
    internal thinking pass (reasoning_effort="medium" via get_custom_lm), so two
    reasoning layers stacked into one budget and truncated the response. This is a
    bounded classification task (pick 5-8 archetypes from a fixed taxonomy), not
    open-ended generation, so it doesn't need get_custom_lm's codegen-tuned
    "medium" effort — reasoning_effort="low" here leaves more of the budget for
    the actual output and uses fewer tokens per call. Production still uses Claude
    Sonnet 4.6 (no reasoning_effort knob), same as get_custom_lm's prod branch.
    """
    global _scene_type_lm
    if _scene_type_lm is not None:
        return _scene_type_lm
    with _scene_type_lm_lock:
        if _scene_type_lm is not None:
            return _scene_type_lm
        if _IS_PRODUCTION:
            _scene_type_lm = _make_anthropic_lm(
                "anthropic/claude-sonnet-4-6",
                temperature=0.7,
                max_tokens=12000,
                api_key=_custom_anthropic_key(),
            )
        else:
            _scene_type_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=0.7,
                max_tokens=12000,
                thinking=_CODEGEN_THINKING,
                reasoning_effort="low",
            )
        return _scene_type_lm


def get_blueprint_lm() -> dspy.LM:
    """Design-blueprint LM (app.dspy_modules.blueprint).

    Runs HOT (temperature=0.9) on purpose. This is the one stage where we
    actively want divergence between brands — it is designing the template, and
    a conservative sample is what produced the "every template looks the same"
    problem in the first place. The risk normally associated with a high
    temperature does not apply here because the output is a schema that is
    validated and REPAIRED (unknown vocabulary snaps to real kit values, numbers
    clamp to safe ranges), and a total failure falls back to the deterministic
    signature engine. Codegen stays at 0.7 — creative sampling of *code* is a
    different bet entirely.

    Cache disabled for the same reason as codegen: a regenerate must produce a
    genuinely different design, not replay the stored completion.
    """
    global _blueprint_lm
    if _blueprint_lm is not None:
        return _blueprint_lm
    with _blueprint_lm_lock:
        if _blueprint_lm is not None:
            return _blueprint_lm
        # 12000, not 8000. A compliant blueprint is 8-10 layouts, each carrying two
        # geometry descriptions capped at 600 chars plus a motion beat — roughly
        # 2-3k tokens of JSON. On ChainOfThought the rationale is emitted BEFORE
        # the JSON field, and at temperature 0.9 a low-reasoning model rambles
        # there, so the budget ran out before `blueprint_json` was ever written.
        # Observed on template 134: both attempts truncated and the template fell
        # back to the deterministic blueprint, losing the whole design stage.
        #
        # This is a CEILING, not a reservation — unused budget costs nothing, so a
        # larger number only removes a failure mode.
        if _IS_PRODUCTION:
            _blueprint_lm = _make_anthropic_lm(
                "anthropic/claude-sonnet-4-6",
                temperature=0.9,
                max_tokens=12000,
                api_key=_custom_anthropic_key(),
            )
        else:
            _blueprint_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=0.9,
                max_tokens=12000,
                thinking=_CODEGEN_THINKING,
                reasoning_effort="low",
            )
        _blueprint_lm.cache = False
        return _blueprint_lm


def get_scene_lm() -> dspy.LM:
    """Scene descriptor LM — Claude Sonnet 4.6 via Anthropic in production, GLM 5.2 (reasoning disabled) via OpenRouter locally."""
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
        # Theme extraction is custom-template work, so route it through the
        # custom key in production. Local/dev keeps Z.AI direct (via _make_default_lm).
        if _IS_PRODUCTION:
            _theme_lm = _make_anthropic_lm(
                _DEFAULT_MODEL, temperature=0.3, max_tokens=2048, api_key=_custom_anthropic_key()
            )
        else:
            _theme_lm = _make_default_lm(_DEFAULT_MODEL, temperature=0.3, max_tokens=2048)
        return _theme_lm
