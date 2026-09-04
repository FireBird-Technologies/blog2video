"""
Shared DSPy configuration. Called once at import time so all modules
share the same LM instance and thread context.
"""
import asyncio
import contextlib
import logging
import random
import threading
import time
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
_scene_edit_lm: dspy.LM | None = None
_scene_edit_lm_lock = threading.Lock()

_theme_lm: dspy.LM | None = None
_theme_lm_lock = threading.Lock()

_scene_lm: dspy.LM | None = None
_scene_lm_lock = threading.Lock()

_scene_type_lm: dspy.LM | None = None
_scene_type_lm_lock = threading.Lock()

_design_doc_lm: dspy.LM | None = None
_design_doc_lm_lock = threading.Lock()


_IS_PRODUCTION = settings.ENVIRONMENT.lower() == "production"

# Default LLM: Claude Sonnet via Anthropic in production, GLM 5.2 via Z.AI direct locally
# (_make_zai_lm strips the openrouter/z-ai/ prefix below down to the bare "glm-5.2" slug
# Z.AI's API expects — this string doubles as the OpenRouter-style model id for
# _make_openrouter_lm, still available but no longer the default path).
#
# THIS IS THE WHOLE VIDEO PIPELINE: script generation, scene descriptors,
# translations, content classification. The custom-template path follows
# CUSTOM_TEMPLATE_LM separately, so the two can diverge without touching this.
#
# Left the Qwen3.x reasoning-toggle family entirely — every attempt (qwen3.6-27b's
# chat_template_kwargs/reasoning.enabled, qwen3.5-35b-a3b's enable_thinking) had no
# confirmed-working disable path in OpenRouter's own docs for that specific model. GLM 5.2
# is different: Z.ai's own docs explicitly confirm `reasoning={"enabled": False}` "disables
# the chain of thought and returns only the final answer" — a concrete, model-specific
# confirmation, not inferred from a general family description.
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
# NOTE: this switch only exists on 5.2 and earlier. The 5.3 line "always engages
# in thinking and cannot be disabled" (Z.AI error 1210) — if CUSTOM_TEMPLATE_LM
# is ever pointed there, _make_zai_lm silently caps the EFFORT instead and this
# flag becomes "use the cheapest tier". The measurements above are 5.2's.
_CODEGEN_THINKING = False
# The reasoning tier for codegen. "low" everywhere.
#
# On 5.2 and earlier this is a NO-OP while _CODEGEN_THINKING is False (Z.AI
# ignores reasoning_effort when thinking is disabled).
#
# On the 5.3 line it is LOAD-BEARING, because thinking cannot be switched off at
# all: _make_zai_lm sends this instead of the disable switch, so "low" is the
# floor rather than a starting point. That is deliberate — it is the cheapest
# legal tier and leaves the most of max_tokens for the `code` field, which is
# the exact failure mode documented above.
#
# The wider GLM family takes max/xhigh/high/medium/low/minimal/none; the 5.3 line
# takes ONLY low/high/max, so _make_zai_lm clamps this for a 5.3 model.
#
# DO NOT set this to "medium" on the 5.3 path. It is not a legal 5.3 tier:
# _GLM53_EFFORT_ALIASES silently maps it UP to "high" (the opposite of what the
# name suggests), and an unaliased illegal tier fails the call outright with the
# same Z.AI error 1210 as the disable switch. "medium" is also the specific
# setting measured to cause the truncations described above.
_CODEGEN_REASONING_EFFORT = "low"

# Output budget for custom-template codegen. Measured against 378 stored scenes:
# median code is ~2.6k tokens, p99 ~5.5k, plus the CoT rationale and the four
# numeric fields — roughly 6k of actual answer.
#
# 12000, set deliberately. This is a CEILING, not a reservation: unused budget
# costs nothing, so this number only changes behaviour on calls that would
# otherwise have exceeded it. 12000 leaves ~6k for reasoning on top of the ~6k
# answer, which is comfortable on 5.2 with `thinking: disabled` (the historical
# value was 12000 for exactly that reason).
#
# THE RISK IT CARRIES on the 5.3 line: 5.3 cannot disable thinking, so reasoning
# is emitted into this same pool even at reasoning_effort="low". An exhausted
# pool does NOT truncate gracefully — it returns an EMPTY `code` field after a
# full-length call (~145-300s), which then costs a repair. The one measurement
# on record is 1825 of 1986 completion tokens spent on reasoning for a TRIVIAL
# request; the real ~30k-char codegen prompt is not trivial, and that figure was
# taken on 5.2.
#
# The mitigation is get_custom_lm_fallback(): a scene that comes back empty is
# retried on 5.2 with thinking off, where the whole pool is answer. Watch
# codegen_fallback_count() — if a large share of scenes are falling back, this
# budget is the cause and raising it is the fix, not more retries.
_CODEGEN_MAX_TOKENS = 12000

# Output budget for the DESIGN DOC stage. Kept separate from
# _CODEGEN_MAX_TOKENS on purpose — see get_design_doc_lm for why. One call emits
# a general design doc plus a full per-scene document for up to 12 scenes, so it
# is the largest single output in the pipeline; the blueprint JSON it replaced
# was smaller and still truncated at 12000 (template 134), losing the entire
# design stage to the deterministic fallback.
_DESIGN_DOC_MAX_TOKENS = 16000

# The model line the codegen fallback drops to when a scene comes back with
# empty code. Pinned rather than read from settings.CUSTOM_TEMPLATE_LM: this is
# the fallback FOR that setting, so following it would leave nothing to fall
# back to once it points at a line that cannot disable thinking.
_CODEGEN_FALLBACK_MODEL = "glm-5.2"


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


# How many times a rate-limited call is retried before the error is allowed out.
#
# A 429 is a TRANSPORT failure, not a bad answer, and the difference matters
# because of who catches it: dspy.Refine counts any exception as a spent rollout
# ("Refine: Attempt failed with rollout id 0: RateLimitError"). Left unhandled, a
# burst of 429s can consume a scene's entire rollout budget without the model
# ever having produced a candidate to judge — the scene then falls to the repair
# loop, or stubs, for reasons that have nothing to do with its code.
#
# So it is absorbed HERE, below Refine, where a retry costs only time.
_RATE_LIMIT_RETRIES = 5
# Base for exponential backoff with full jitter: 2s, 4s, 8s, 16s, 32s (jittered).
# Jitter matters more than the base here — 11 scenes rate-limit at the SAME
# instant, and a fixed schedule would march them all into the next window
# together.
_RATE_LIMIT_BACKOFF_BASE = 2.0


def _is_rate_limit(exc: Exception) -> bool:
    """True for a provider rate-limit / 429, whatever the SDK wrapped it in."""
    if exc.__class__.__name__ in ("RateLimitError", "Timeout", "APIConnectionError"):
        return True
    if getattr(exc, "status_code", None) == 429:
        return True
    text = str(exc).lower()
    return "rate limit" in text or "429" in text or "too many requests" in text


# Process-wide ceiling on SIMULTANEOUS calls to the custom-template provider.
#
# Tuning SCENE_CONCURRENCY alone does not bound provider load, because a scene
# is not one call. Each generated scene also runs _describe_scene_props (a
# separate dspy.Predict on get_scene_type_lm) inside the same task, and the
# repair pass adds more — so a window of N scenes puts well over N requests in
# flight, and the number that actually reaches the provider was never stated
# anywhere. That is why 429s survived cutting the scene window.
#
# Enforcing it HERE, on the LM, is what makes the bound true regardless of which
# code path issues the call: codegen, prop extraction, the critic and the design
# docs all queue against the same gate.
#
# 8 is below Z.AI's observed threshold (429s appeared at 11) with headroom for
# the retry traffic that a burst generates. Raise it only with 429 counts to
# show it is safe. NOTE this is a CONCURRENCY bound, not a rate: a permit is held
# for the duration of one call, so the requests-per-minute it implies depends
# entirely on how long calls take.
#
# ── Why the budget is SPLIT ──────────────────────────────────────────────────
# One workload can saturate this gate on its own: a custom-template generation
# runs SCENE_CONCURRENCY (8) scenes at once and each issues more than one call
# (codegen + _describe_scene_props, plus repairs), so it always has more work
# queued than there are permits. A semaphore has no notion of priority — waiters
# are just threads blocked on a counter — so anything else that arrives during a
# generation waits behind the whole batch. That is what made a scene edit hang
# long enough for the editor's poll to give up while the backend was still fine.
#
# So the budget is split by WORKLOAD, and only the saturating one is capped:
#
#   * custom-template GENERATION may hold at most _PROVIDER_TEMPLATE_INFLIGHT
#     permits — an LM built with capped=True, and
#   * everything else (video generation, scene edits) is uncapped: it may use the
#     whole gate when nothing else runs, and still has
#     _PROVIDER_MAX_INFLIGHT - _PROVIDER_TEMPLATE_INFLIGHT while a generation is
#     in flight.
#
# The flag is POSITIVE ("capped") and defaults False on purpose. An LM added
# later is then uncapped by default, which costs throughput at worst; the
# inverse default would silently let new template work exceed the cap.
_PROVIDER_MAX_INFLIGHT = 8
# Ceiling for custom-template generation. The remainder is what it can never
# hold, and is therefore always reachable by video generation and scene edits.
_PROVIDER_TEMPLATE_INFLIGHT = 4

# Two gates rather than one counter with a rule, because "template work may take
# at most N" is exactly a second, smaller semaphore: capped work acquires BOTH
# (so the smaller one bounds it), uncapped work acquires only the total. Nothing
# has to inspect a queue or count waiters, and capped work can never starve the
# remainder.
_provider_gate = threading.BoundedSemaphore(_PROVIDER_MAX_INFLIGHT)
_provider_template_gate = threading.BoundedSemaphore(_PROVIDER_TEMPLATE_INFLIGHT)
# The async side needs its own primitives, created lazily: asyncio.Semaphore
# binds to the running loop, and this module is imported long before one exists.
_provider_agate: "asyncio.Semaphore | None" = None
_provider_template_agate: "asyncio.Semaphore | None" = None
_provider_agate_lock = threading.Lock()


def _get_provider_agate() -> "asyncio.Semaphore":
    global _provider_agate
    if _provider_agate is None:
        with _provider_agate_lock:
            if _provider_agate is None:
                _provider_agate = asyncio.Semaphore(_PROVIDER_MAX_INFLIGHT)
    return _provider_agate


def _get_provider_template_agate() -> "asyncio.Semaphore":
    global _provider_template_agate
    if _provider_template_agate is None:
        with _provider_agate_lock:
            if _provider_template_agate is None:
                _provider_template_agate = asyncio.Semaphore(_PROVIDER_TEMPLATE_INFLIGHT)
    return _provider_template_agate


@contextlib.contextmanager
def _provider_slot(capped: bool):
    """Hold a provider permit for the duration of one call.

    Capped (custom-template generation) work takes the template gate FIRST and
    then the total gate; uncapped work takes only the total. Acquiring in that
    fixed order — never the reverse — is what keeps the pair deadlock-free: no
    path holds the total while waiting for the template gate.

    The effect: at most _PROVIDER_TEMPLATE_INFLIGHT template calls are ever in
    flight, so the remaining permits stay reachable by video generation and scene
    edits; and when no template work is running, uncapped callers can use the
    whole gate.
    """
    if capped:
        with _provider_template_gate, _provider_gate:
            yield
    else:
        with _provider_gate:
            yield


@contextlib.asynccontextmanager
async def _aprovider_slot(capped: bool):
    """Async mirror of :func:`_provider_slot`, same ordering rule."""
    if capped:
        async with _get_provider_template_agate():
            async with _get_provider_agate():
                yield
    else:
        async with _get_provider_agate():
            yield


class _ProviderLoggingLM(dspy.LM):
    """dspy.LM subclass that logs each call's served-by provider, fallback usage, and failures.

    Works for any LiteLLM provider prefix (openrouter/, zai/, ...) — the log tag is
    derived from the model string so it stays accurate regardless of which one is used.

    Also absorbs provider rate limits with jittered exponential backoff, so a 429
    costs latency rather than one of dspy.Refine's rollouts. See
    _RATE_LIMIT_RETRIES for why that distinction is load-bearing.

    `capped=True` marks an LM belonging to custom-template GENERATION — the one
    workload that saturates the gate on its own — so its calls are bounded by
    _PROVIDER_TEMPLATE_INFLIGHT rather than the full budget. Everything else
    (video generation, scene edits) leaves it False and may use the whole gate.
    See the note on _PROVIDER_MAX_INFLIGHT for why the flag is positive.
    """

    def __init__(self, *args, capped: bool = False, **kwargs):
        super().__init__(*args, **kwargs)
        # Not a dspy.LM field — kept off the kwargs dspy round-trips so it can
        # never leak into a request payload.
        self._capped = capped

    @property
    def _log_tag(self) -> str:
        return self.model.split("/", 1)[0]

    def _report(self, result):
        served_model = getattr(result, "model", None)
        provider = _extract_openrouter_provider(result)
        print(f"[{self._log_tag}] OK   model={self.model} served={served_model} provider={provider}")
        return result

    def forward(self, *args, **kwargs):
        for attempt in range(_RATE_LIMIT_RETRIES + 1):
            try:
                # Held only for the duration of the call, so a backoff sleep
                # RELEASES the slot rather than blocking a waiting scene behind
                # a request that is not even in flight.
                with _provider_slot(self._capped):
                    return self._report(super().forward(*args, **kwargs))
            except Exception as e:
                if attempt < _RATE_LIMIT_RETRIES and _is_rate_limit(e):
                    delay = random.uniform(0, _RATE_LIMIT_BACKOFF_BASE * (2**attempt))
                    print(
                        f"[{self._log_tag}] RATE-LIMIT model={self.model} "
                        f"attempt {attempt + 1}/{_RATE_LIMIT_RETRIES} — retrying in {delay:.1f}s"
                    )
                    time.sleep(delay)
                    continue
                # Surface the final exception type and message so we can tell whether
                # LiteLLM's model-level fallbacks engaged or the primary error bubbled up.
                print(f"[{self._log_tag}] FAIL model={self.model} err={type(e).__name__}: {str(e)[:300]}")
                raise

    async def aforward(self, *args, **kwargs):
        for attempt in range(_RATE_LIMIT_RETRIES + 1):
            try:
                async with _aprovider_slot(self._capped):
                    return self._report(await super().aforward(*args, **kwargs))
            except Exception as e:
                if attempt < _RATE_LIMIT_RETRIES and _is_rate_limit(e):
                    delay = random.uniform(0, _RATE_LIMIT_BACKOFF_BASE * (2**attempt))
                    print(
                        f"[{self._log_tag}] RATE-LIMIT model={self.model} "
                        f"attempt {attempt + 1}/{_RATE_LIMIT_RETRIES} — retrying in {delay:.1f}s"
                    )
                    await asyncio.sleep(delay)
                    continue
                print(f"[{self._log_tag}] FAIL model={self.model} err={type(e).__name__}: {str(e)[:300]}")
                raise


def _make_anthropic_lm(
    model: str,
    temperature: float,
    max_tokens: int,
    api_key: str | None = None,
    *,
    capped: bool = False,
) -> dspy.LM:
    # _ProviderLoggingLM, not a bare dspy.LM. This used to return a plain LM, so
    # Anthropic calls bypassed the provider gate entirely — invisible while
    # everything runs on GLM, but it would have silently voided the template cap
    # (and the rate-limit absorption) the moment ENVIRONMENT was set to
    # "production" and these branches started being used.
    return _ProviderLoggingLM(
        model,
        capped=capped,
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


# The ONLY reasoning tiers glm-5.3 accepts, cheapest first. Straight from the
# API's own rejection message: "This model always engages in thinking and cannot
# be disabled; please use low, high, or max". The wider GLM family also takes
# minimal/medium/xhigh/none — 5.3 rejects every one of them with error 1210, the
# same hard 400 as the disable switch, so an unclamped value fails the call.
_GLM53_EFFORTS = ("low", "high", "max")

# What a value from the wider family maps to on 5.3. Anything unknown, or None,
# falls to "low" — the cheapest legal tier, which is what an un-thinking caller
# is asking for.
_GLM53_EFFORT_ALIASES = {
    "none": "low",
    "minimal": "low",
    "medium": "high",
    "xhigh": "max",
}


def _clamp_glm53_effort(effort: str | None) -> str:
    """Coerce a reasoning_effort into one glm-5.3 will actually accept."""
    if not effort:
        return "low"
    e = effort.strip().lower()
    if e in _GLM53_EFFORTS:
        return e
    return _GLM53_EFFORT_ALIASES.get(e, "low")


def _make_zai_lm(
    model: str,
    temperature: float,
    max_tokens: int,
    *,
    thinking: bool = False,
    reasoning_effort: str | None = None,
    capped: bool = False,
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

    # HOW thinking is capped differs BY MODEL FAMILY, and the two forms are not
    # interchangeable — sending the wrong one is a hard API error, not a soft
    # downgrade:
    #
    #   * glm-5.2 and earlier accept `thinking: {"type": "disabled"}`.
    #   * the glm-5.3 line REJECTS that outright (Z.AI error 1210, "always
    #     engages in thinking and cannot be disabled") and wants
    #     `reasoning_effort` instead.
    #
    # 5.3 therefore cannot have thinking switched off at all; the cheapest it
    # goes is reasoning_effort="low". That still matters for the same reason
    # _CODEGEN_THINKING exists: GLM emits reasoning into the SAME max_tokens pool
    # as the answer, so an uncapped 5.3 can exhaust the budget before the `code`
    # field is written and return an empty string. Capping the effort is what
    # keeps that from happening.
    #
    # 5.3 ALSO ACCEPTS A NARROWER SET OF TIERS than the wider GLM family. Its own
    # error text spells them out: "please use low, high, or max". "minimal" and
    # "medium" are valid elsewhere and are rejected here — with the SAME 1210
    # error as the disable switch, so a wrong tier fails the call outright rather
    # than degrading. Anything outside the trio is clamped to the nearest legal
    # tier below, so a caller tuned for another model cannot break this one.
    #
    # The split was learned against the live API, and was duplicated in the
    # vision path until that was removed — this is now the only copy. A THIRD
    # GLM family means re-checking the tiers here.
    extra_body: dict = {}
    if bare_model.startswith("glm-5.3"):
        # No disable switch exists — pick the effort tier instead.
        extra_body["reasoning_effort"] = _clamp_glm53_effort(
            reasoning_effort if thinking and reasoning_effort else None
        )
    else:
        extra_body["thinking"] = {"type": "enabled" if thinking else "disabled"}
        if thinking and reasoning_effort:
            extra_body["reasoning_effort"] = reasoning_effort

    return _ProviderLoggingLM(
        f"zai/{bare_model}",
        api_key=settings.ZAI_API_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
        extra_body=extra_body,
        capped=capped,
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


def _make_default_lm(
    model: str, temperature: float, max_tokens: int, *, capped: bool = False
) -> dspy.LM:
    factory = _make_anthropic_lm if _IS_PRODUCTION else _make_zai_lm
    return factory(model, temperature, max_tokens, capped=capped)


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
                capped=True,
                temperature=0.7,
                max_tokens=_CODEGEN_MAX_TOKENS,
                api_key=_custom_anthropic_key(),
            )
        else:
            # GLM's thinking/reasoning tokens are NOT a separate budget from Anthropic-
            # style extended thinking — they're emitted into the same max_tokens pool as
            # the final answer (see _make_zai_lm's extra_body={"thinking": {...}}, no
            # separate allowance field). Reasoning alone can burn past the budget before
            # a single token of the `code` output is emitted, truncating it to empty
            # ("[REFINE] FAILED: Code is empty"). When that happens, the repair loop in
            # code_generator.py reaches for get_custom_lm_fallback() below instead of
            # retrying on the same configuration that just failed.
            #
            # On 5.3 that fallback is a MODEL SWITCH, not an effort switch: this line
            # cannot disable thinking, and _CODEGEN_REASONING_EFFORT is already at the
            # floor, so there is no cheaper tier left to drop to.
            _codegen_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=0.7,
                max_tokens=_CODEGEN_MAX_TOKENS,
                thinking=_CODEGEN_THINKING,
                reasoning_effort=_CODEGEN_REASONING_EFFORT,
                capped=True,
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


def get_scene_edit_lm() -> dspy.LM:
    """LM for EDITING one scene of an existing custom template.

    Separate from get_custom_lm() on purpose. Generating a template writes every
    scene from nothing and is the quality-sensitive path that keeps its own model
    (Claude in production). Editing one scene is a narrower task — the design doc,
    the theme and the surrounding scenes are all fixed, and the model is rewriting
    a single component against them — so it runs on the cheaper, faster GLM 5.3
    Flash line instead.

    Unlike get_custom_lm this does NOT branch on environment: editing uses the
    same model everywhere, so what a developer sees is what production does.

    The slug comes from settings.SCENE_EDIT_LM. `_make_zai_lm` inspects it and
    routes any `glm-5.3*` value through `reasoning_effort` rather than the
    `thinking: {type: disabled}` form that line rejects (Z.AI error 1210), so a
    change of slug needs no change here.

    UNCAPPED (capped=False, the default): editing is not template generation, so
    it is not bound by _PROVIDER_TEMPLATE_INFLIGHT. It may use the whole provider
    gate when nothing else is running, and always has the permits a running
    generation cannot hold — which is what stops an edit queueing behind a batch.
    """
    global _scene_edit_lm
    if _scene_edit_lm is not None:
        return _scene_edit_lm
    with _scene_edit_lm_lock:
        if _scene_edit_lm is not None:
            return _scene_edit_lm
        _scene_edit_lm = _make_zai_lm(
            settings.SCENE_EDIT_LM,
            temperature=0.7,
            max_tokens=_CODEGEN_MAX_TOKENS,
            thinking=_CODEGEN_THINKING,
            reasoning_effort=_CODEGEN_REASONING_EFFORT,
            # capped left False on purpose — see the docstring.
        )
        # Same reason as get_custom_lm: DSPy's disk cache would replay a stored
        # completion for an identical prompt signature, which makes "edit this
        # scene again" return byte-identical code forever. An edit must always be
        # a fresh completion.
        _scene_edit_lm.cache = False
        return _scene_edit_lm


_codegen_lm_fallback: dspy.LM | None = None
_codegen_lm_fallback_lock = threading.Lock()

# Counts scenes that fell back because their primary call returned empty code.
# Read by code_generator.py's logging: a HIGH share means the primary model is
# not viable at this token budget, and the answer is the env revert documented
# on settings.CUSTOM_TEMPLATE_LM — not more retries silently absorbing the cost.
_codegen_fallback_count = 0


def codegen_fallback_count() -> int:
    """How many scenes have dropped to the fallback model this process."""
    return _codegen_fallback_count


def note_codegen_fallback() -> int:
    """Record one fallback and return the new running total."""
    global _codegen_fallback_count
    with _codegen_lm_fallback_lock:
        _codegen_fallback_count += 1
        return _codegen_fallback_count


def get_custom_lm_fallback() -> dspy.LM:
    """Escape hatch for a codegen call that returned EMPTY code (local/dev Z.AI).

    Reached by code_generator.py's repair loop after a scene comes back with
    truly empty code from get_custom_lm() — GLM's reasoning pass consumed the
    whole max_tokens budget before a single token of `code` was emitted (see
    get_custom_lm's docstring).

    This is a MODEL DOWNGRADE, not an effort downgrade, and that distinction is
    the whole point on the 5.3 line: 5.3 cannot disable thinking (Z.AI error
    1210) and _CODEGEN_REASONING_EFFORT is already at "low", the cheapest legal
    tier — so there is nothing left to turn down. The only configuration
    measured to write fields directly with NO reasoning competing for the budget
    is 5.2 with thinking disabled outright (286 tokens, all content, against
    1825-of-1986 spent on reasoning at "low"; see the _CODEGEN_THINKING note).

    The model is therefore PINNED to _CODEGEN_FALLBACK_MODEL rather than read
    from settings.CUSTOM_TEMPLATE_LM. Following that setting would point the
    fallback at the same line that just failed, leaving nothing to fall back to.

    max_tokens matches the primary rather than sitting below it: this fallback
    exists precisely because a budget was exhausted, so a SMALLER budget would
    be the wrong direction. With thinking off the whole pool is answer.

    Production (Claude, no thinking toggle, no budget-exhaustion failure mode)
    has no equivalent and just returns the same LM as get_custom_lm().
    """
    global _codegen_lm_fallback
    if _codegen_lm_fallback is not None:
        return _codegen_lm_fallback
    with _codegen_lm_fallback_lock:
        if _codegen_lm_fallback is not None:
            return _codegen_lm_fallback
        if _IS_PRODUCTION:
            _codegen_lm_fallback = get_custom_lm()
        else:
            _codegen_lm_fallback = _make_zai_lm(
                _CODEGEN_FALLBACK_MODEL,
                temperature=0.7,
                max_tokens=_CODEGEN_MAX_TOKENS,
                thinking=False,
                capped=True,
            )
            _codegen_lm_fallback.cache = False
        return _codegen_lm_fallback


def get_scene_type_lm() -> dspy.LM:
    """Small bounded-task LM for the custom-template path.

    Now serves two callers, both of which read finished code rather than write
    it: DescribeSceneProps (extracting the editor's layoutProps schema) and the
    scene code critic. It originally backed DecideBrandSceneTypes, which the
    design-doc refactor removed.

    Split out from get_custom_lm() because that LM's budget was getting eaten by
    reasoning before the output field: these run under dspy.ChainOfThought (its
    own prose "reasoning" field) ON TOP OF GLM's internal thinking pass, so two
    reasoning layers stacked into one budget and truncated the response. These
    are bounded tasks, not open-ended generation, so a low effort tier leaves
    more of the budget for the actual answer.

    Follows CUSTOM_TEMPLATE_LM, so it tracks the custom-template path's model
    rather than the video pipeline's. Production still uses Claude Sonnet 4.6,
    same as get_custom_lm's prod branch.
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
                capped=True,
            )
        else:
            _scene_type_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=0.7,
                max_tokens=12000,
                thinking=_CODEGEN_THINKING,
                reasoning_effort="low",
                capped=True,
            )
        # Disable the DSPy disk cache, matching get_custom_lm and the blueprint
        # LM. This was the ONLY one of the three still caching, so two brands
        # whose brand_context shared a prefix replayed a byte-identical scene-type
        # answer — a direct contributor to templates coming out the same. Scene
        # decisions are creative generation; a fresh completion is always wanted.
        _scene_type_lm.cache = False
        return _scene_type_lm


def get_design_doc_lm() -> dspy.LM:
    """Design-doc LM (app.dspy_modules.design_doc).

    Runs at temperature 1.0 — hotter than the blueprint stage it replaces, which
    ran at 0.9. That 0.9 was fighting a headwind: the model was handed a fixed
    vocabulary ("you MUST choose from these exact values") and temperature was
    the only force pushing it apart, so brands differed by which cell of a grid
    they landed in. With no menu, sampling IS the divergence, so it is turned up.

    The usual risk of a high temperature does not apply: the output is prose plus
    a small JSON envelope that is schema-validated and clamped (scene count 3-12,
    roles coerced by position, fonts/decor snapped through render_registry), and
    a total failure falls back to a deterministic doc set. Codegen stays at 0.7 —
    creative sampling of *code* is a different bet entirely.

    Cache disabled for the same reason as codegen: a regenerate must produce a
    genuinely different design, not replay the stored completion.
    """
    global _design_doc_lm
    if _design_doc_lm is not None:
        return _design_doc_lm
    with _design_doc_lm_lock:
        if _design_doc_lm is not None:
            return _design_doc_lm
        # 16000. The output is now PROSE, not a terse enum-filled schema: a
        # general design doc plus one complete per-scene document for up to 12
        # scenes, each describing geometry in both orientations, focal element,
        # type treatment and motion beat. That is materially longer than the
        # blueprint JSON this replaced, which already needed 12000 and still
        # truncated on template 134 — losing the whole design stage to the
        # deterministic fallback.
        #
        # This is a CEILING, not a reservation — unused budget costs nothing, so a
        # larger number only removes a failure mode.
        #
        # This budget is deliberately NOT _CODEGEN_MAX_TOKENS. The two stages
        # have different shapes and different costs of failure, and tying them
        # together means tuning one silently retunes the other: codegen emits one
        # scene component, while this emits a general doc PLUS a full per-scene
        # document for up to 12 scenes in one call. It is the larger output of
        # the two and it has already truncated at 12000, which is why the number
        # here is bigger than the codegen ceiling rather than equal to it.
        #
        # Truncation here is also expensive out of proportion to the call: a
        # lost design stage does not cost one scene, it drops the whole template
        # to the deterministic fallback docs.
        if _IS_PRODUCTION:
            _design_doc_lm = _make_anthropic_lm(
                "anthropic/claude-sonnet-4-6",
                temperature=1.0,
                max_tokens=_DESIGN_DOC_MAX_TOKENS,
                api_key=_custom_anthropic_key(),
                capped=True,
            )
        else:
            _design_doc_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=1.0,
                max_tokens=_DESIGN_DOC_MAX_TOKENS,
                thinking=_CODEGEN_THINKING,
                reasoning_effort="low",
                capped=True,
            )
        _design_doc_lm.cache = False
        return _design_doc_lm


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
    """Small, cheap, low-temperature LM.

    Two callers with different lineages share it: the video pipeline's content
    classifier, and — historically — custom-template theme extraction. The latter
    has since moved to get_brand_extraction_lm() below, because the custom-template
    design path runs on a different model locally. This one stays on the pipeline
    default so the classifier is unaffected by that switch.
    """
    global _theme_lm
    if _theme_lm is not None:
        return _theme_lm
    with _theme_lm_lock:
        if _theme_lm is not None:
            return _theme_lm
        if _IS_PRODUCTION:
            _theme_lm = _make_anthropic_lm(
                _DEFAULT_MODEL,
                temperature=0.3,
                max_tokens=2048,
                api_key=_custom_anthropic_key(),
                capped=True,
            )
        else:
            _theme_lm = _make_default_lm(
                _DEFAULT_MODEL, temperature=0.3, max_tokens=2048, capped=True
            )
        return _theme_lm


_brand_extraction_lm: dspy.LM | None = None
_brand_extraction_lm_lock = threading.Lock()


def get_brand_extraction_lm() -> dspy.LM:
    """Brand/theme extraction for CUSTOM TEMPLATES (app.dspy_modules.theme_extractor).

    Split from get_theme_lm so the custom-template design path can run on a
    different local model from the video pipeline: this follows
    CUSTOM_TEMPLATE_LM alongside the design-doc and codegen stages, while the
    content classifier stays on the pipeline default.

    It belongs with the design path rather than the pipeline because its
    `brand_description` output is the primary input to the design docs — the
    quality of that one field sets the ceiling on how distinct templates can be.

    Production is unchanged: Claude via the custom key, exactly as before.
    """
    global _brand_extraction_lm
    if _brand_extraction_lm is not None:
        return _brand_extraction_lm
    with _brand_extraction_lm_lock:
        if _brand_extraction_lm is not None:
            return _brand_extraction_lm
        if _IS_PRODUCTION:
            _brand_extraction_lm = _make_anthropic_lm(
                _DEFAULT_MODEL,
                temperature=0.3,
                max_tokens=2048,
                api_key=_custom_anthropic_key(),
                capped=True,
            )
        else:
            _brand_extraction_lm = _make_zai_lm(
                settings.CUSTOM_TEMPLATE_LM,
                temperature=0.3,
                max_tokens=2048,
                capped=True,
            )
        return _brand_extraction_lm
