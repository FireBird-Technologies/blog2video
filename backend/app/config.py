import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Environment: "production" uses Claude Sonnet; anything else uses DeepSeek
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "local")

    # API Keys
    ANTHROPIC_API_KEY: str = ""
    # Used only for Template Studio **template creation** (plan, normalize, layout
    # TSX, prompt.md). Other features keep using ANTHROPIC_API_KEY above.
    TEMPLATE_CREATION_ANTHROPIC_API_KEY: str = ""
    # Custom-template AI generation (Remotion codegen + theme extraction). Falls
    # back to ANTHROPIC_API_KEY when empty. Lets custom templates bill / rate-limit
    # separately from the rest of the app.
    CUSTOM_ANTHROPIC_API_KEY: str = ""
    # MAIN / pro-tier key. Used for ALL custom voice creation/cloning/design (never
    # fails over — a voice created under this account doesn't exist on the backup
    # account) and for TTS synthesis whenever main isn't exhausted or a custom voice
    # is involved. See app/services/elevenlabs_keys.py.
    ELEVENLABS_API_KEY: str = ""
    # BACKUP / creator-tier key. TTS synthesis only fails over here when the main
    # key's remaining quota drops to/below ELEVENLABS_FAILOVER_THRESHOLD_PERCENT.
    # Never used for custom voice creation/cloning/design.
    ELEVENLABS_BACKUP_API_KEY: str = ""
    # Switch TTS synthesis to the backup key once the main key's remaining character
    # quota drops to/below this percent. Checked once daily (see
    # _periodic_elevenlabs_quota_check in main.py) plus reactively on quota errors.
    ELEVENLABS_FAILOVER_THRESHOLD_PERCENT: float = 2.0
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"
    EXA_API_KEY: str = ""
    FIRECRAWL_API_KEY: str = ""
    # Stock-footage providers. Each is optional and independently skipped when
    # blank, so local dev works with only one key configured.
    PEXELS_API_KEY: str = ""
    PIXABAY_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    OPEN_ROUTER_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_CODE_MODEL: str = "gemini-3.5-flash"
    # Used when a reference image is attached (vision-guided layout editing / rebuild).
    GEMINI_CODE_MODEL_WITH_IMAGE: str = "gemini-3.5-flash"
    # Override GLM_IMAGE_MODEL in .env only if z.ai ships a newer GLM image model.
    GLM_IMAGE_MODEL: str = "glm-image"
    # Shared z.ai API key: GLM LM calls (dspy_modules._make_zai_lm, reached directly
    # via LiteLLM's zai/ provider) AND GLM image generation (services.image_gen,
    # the OpenAI-compatible endpoint at https://api.z.ai/api/paas/v4/). The
    # OpenRouter key above does NOT serve either of these — z.ai requires its own key.
    ZAI_API_KEY: str = ""

    # Template studio access password. Kept server-side so it doesn't leak in
    # the JS bundle. Empty disables the gate (any password passes — useful for
    # local dev). Set via TEMPLATE_STUDIO_PASSWORD in .env.
    TEMPLATE_STUDIO_PASSWORD: str = ""

    # Template Studio — **new template** + **new layout** (plan/normalize/layout TSX/prompt.md):
    #  Claude via Anthropic. Requires TEMPLATE_CREATION_ANTHROPIC_API_KEY; model is
    #  CLAUDE_CODE_MODEL. See app/services/template_studio_llm.py.
    # Scene edit + layout rebuild use Gemini (GEMINI_API_KEY, GEMINI_CODE_MODEL,
    # GEMINI_CODE_MODEL_WITH_IMAGE). Defaults: gemini-3.5-flash; override in .env if needed.
    CLAUDE_CODE_MODEL: str = "claude-sonnet-4-6"

    # AI image generation: set IMAGE_PROVIDER ("openai" | "gemini" | "glm") and DSPY_IMAGE_LM in env
    IMAGE_PROVIDER: str = os.environ.get("IMAGE_PROVIDER", "openai")
    DSPY_IMAGE_LM: str =  "openai/gpt-4o-mini"

    # Custom-template Remotion codegen in local/dev: GLM via OpenRouter (prod still uses Claude).
    CUSTOM_TEMPLATE_LM: str = os.environ.get("CUSTOM_TEMPLATE_LM", "openrouter/z-ai/glm-5.2")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""  # Price ID for $60/mo Pro plan
    STRIPE_PRO_ANNUAL_PRICE_ID: str = ""  # Price ID for $576/yr Pro plan (20% off)
    STRIPE_STANDARD_PRICE_ID: str = ""  # Price ID for $35/mo Standard plan (30 videos)
    STRIPE_STANDARD_ANNUAL_PRICE_ID: str = ""  # Price ID for $28/mo effective Standard annual
    STRIPE_LITE_PRICE_ID: str = ""  # Price ID for $19.99/mo Lite plan (10 videos, no lifetime option)
    STRIPE_LITE_ANNUAL_PRICE_ID: str = ""  # Price ID for Lite annual billing
    STRIPE_PER_VIDEO_PRICE_ID: str = ""  # Price ID for $5 one-time per-video
    STRIPE_PER_VIDEO_PRODUCT_ID: str = ""  # Fixed Product ID for per-video ad-hoc prices (lets coupons target it). Falls back to inline product_data when unset.
    CUSTOM_TEMPLATE_PRICE_ID: str = ""  # Price ID for $5 one-time custom-template slot
    STANDARD_PLAN_LIFETIME_DEAL: str = ""  # Price ID for $1000 one-time Standard lifetime
    PRO_PLAN_LIFETIME_DEAL: str = ""       # Price ID for $1600 one-time Pro lifetime
    LIFETIME_DEAL_500: str = ""            # Price ID for $300 one-time 500-video credit pack (never expires)
    STRIPE_RETENTION_COUPON_ID: str = ""  # Coupon ID applied server-side for cancel-retention offers
    STRIPE_3VID_MONTHLY_COUPON_ID: str = ""  # Legacy out-of-videos monthly coupon (kept in env, no longer used)
    STRIPE_3VID_ANNUAL_COUPON_ID: str = ""   # Legacy out-of-videos annual coupon (kept in env, no longer used)
    STRIPE_STANDARD_MONTHLY_COUPON_ID: str = ""  # 15% off Standard monthly, once-per-customer (out-of-videos offer)
    STRIPE_STANDARD_ANNUAL_COUPON_ID: str = ""   # 20% off Standard annual, once-per-customer (out-of-videos offer)
    SURVEY_PROMO_CODE: str = ""  # Shared Stripe promotion code (20% off) revealed on survey completion

    # Post-checkout win-back coupon (abandoned / per-video → email a discount code)
    COUPON_FOLLOWUP_CODE: str = "SUB25"  # Promo code shown in the win-back email (must exist in Stripe)
    COUPON_FOLLOWUP_DISCOUNT_PERCENT: int = 25  # Discount % advertised in the email copy
    COUPON_FOLLOWUP_VALID_HOURS: int = 48  # "valid for the next N hours" messaging in the email
    # Checkout Session lifetime. On expiry Stripe fires checkout.session.expired,
    # which drives the abandoned-checkout win-back email. Stripe allows 1800–86400
    # (30 min – 24 h); values outside that range are clamped before use.
    STRIPE_CHECKOUT_EXPIRES_SECONDS: int = 86400

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 72

    # Shared secret guarding the internal template-capture endpoints (capture-data
    # + preview-image upload). The puppeteer snapshot script and the in-process
    # capture background task pass this via the X-Capture-Secret header so the
    # capture route can read/write any user's custom template without per-user
    # auth. Empty disables the endpoints.
    CAPTURE_SECRET: str = ""

    # Local testing override — set DEFAULT_PLAN=PRO in .env to auto-assign plan on login
    DEFAULT_PLAN: str = ""

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # Database
    DATABASE_URL: str = "sqlite:///./blog2video.db"

    # Remotion
    REMOTION_PROJECT_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "remotion-video",
    )

    # Scene timing: minimum duration so animations can complete before transition.
    MIN_SCENE_DURATION_SECONDS: float = float(os.environ.get("MIN_SCENE_DURATION_SECONDS", "7"))

    # Media storage
    MEDIA_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media"
    )

    # Cloudflare R2 Storage
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "blog2video"
    R2_PUBLIC_URL: str = ""  # e.g. https://media.yourdomain.com or https://pub-xxx.r2.dev
    R2_KEY_PREFIX: str = ""  # Set to "dev" (or any string) locally to avoid overwriting production R2 data

    # Talking-head avatar service (self-hosted LongCat on Modal serverless GPU).
    # Avatars are per-scene and on demand: the user asks for one from the Scene Edit
    # modal, which renders that scene's voiceover into a lip-synced clip via this
    # service and overlays it. See services/avatar.py.
    # AVATAR_ENABLED=False makes the generate endpoint fail with a clear message.
    #
    # The provider is Modal serverless GPU (modal-service/longcat-avatar/). It
    # replaced a self-hosted HuggingFace Space on 2026-08-02; the Space and its
    # settings (AVATAR_SERVICE_HF_TOKEN, AVATAR_PREPARE_TIMEOUT_SECONDS) were
    # deleted on 2026-08-07, so there is no longer a rollback target in this repo.
    AVATAR_ENABLED: bool = True
    # Modal workspace `h-raheel622`. The default is the REAL deployment, not a
    # placeholder, so a container without the env var set still reaches a live
    # service.
    #
    # Redeploying to a different Modal workspace CHANGES THIS HOSTNAME (it is
    # derived from the workspace name), so it has to be updated here and in every
    # deployed environment's env.
    AVATAR_SERVICE_URL: str = os.environ.get(
        "AVATAR_SERVICE_URL",
        "https://h-raheel622--longcat-avatar-eval-longcatavatarservice-web.modal.run",
    )
    AVATAR_SERVICE_SECRET: str = ""       # X-Avatar-Key shared secret (matches the provider's secret)

    # How long a job will wait for a cold service to come up before giving up.
    # A Modal cold start is a container schedule plus mounting the weights Volume:
    # ~6s measured, because the weights live on the Volume instead of being
    # downloaded per boot (see modal-service/longcat-avatar/app.py).
    #
    # RESTORED TO 900 on 2026-08-10. The ~6s figure above holds only when Modal
    # can schedule a GPU immediately, which is not something this side controls.
    # Measured on 2026-08-10 against arslan-29835: /ping took 68-111s cold, and
    # the app logs reported
    #     "waiting to be scheduled on a GPU_L40S worker — we are actively
    #      working on acquiring more capacity for your workload"
    # i.e. the wait is GPU-QUEUEING time at the provider, not container boot.
    # Under 180s every scene in projects 1157/1158 died in phase
    # "starting_service" at ~3m54s having never reached the GPU, and each was
    # then reported to the user as a failure with its credits refunded.
    #
    # The 45-minute-spinner concern the 180 was chosen for is handled elsewhere:
    # a recognised outage still short-circuits in seconds via
    # avatar.py's _is_workspace_disabled. This ceiling only bounds the
    # UNRECOGNISED case, where waiting is strictly better than telling a user
    # their render failed while the provider is still queueing it.
    AVATAR_SERVICE_WAIT_SECONDS: int = int(
        os.environ.get("AVATAR_SERVICE_WAIT_SECONDS", "900")
    )
    AVATAR_SERVICE_POLL_SECONDS: int = int(
        os.environ.get("AVATAR_SERVICE_POLL_SECONDS", "10")
    )
    # How many RENDERS may be in flight at once — this governs kind="render"
    # only (see AVATAR_MATTE_CONCURRENCY below for cutouts). MUST NOT exceed the
    # provider's own ceiling (`max_containers` in modal-service/longcat-avatar/app.py,
    # default 5) or the surplus jobs just queue AT THE PROVIDER while holding a
    # `running` row here — invisible from this side, since the dispatcher only
    # counts its own outstanding requests and never queries provider capacity.
    # main.py asserts this relationship at boot against
    # AVATAR_PROVIDER_MAX_CONTAINERS.
    AVATAR_CONCURRENCY: int = int(os.environ.get("AVATAR_CONCURRENCY", "5"))
    # The provider-side ceiling, mirrored here ONLY so the boot assertion can
    # check it — the authoritative value is MODAL_MAX_CONTAINERS on the Modal
    # deployment. Keep in sync when that changes.
    AVATAR_PROVIDER_MAX_CONTAINERS: int = int(
        os.environ.get("AVATAR_PROVIDER_MAX_CONTAINERS", "5")
    )
    # How many CUTOUTS (kind="matte") may run at once. A SEPARATE ceiling from
    # AVATAR_CONCURRENCY because matte jobs are not provider-bound at all: they
    # are CPU-bound rembg (u2net_human_seg, ~170MB ONNX) running in THIS
    # process's executor pool, so the constraint is local cores, not Modal
    # containers. Matting originally inherited AVATAR_CONCURRENCY by accident
    # when it joined the same queue, which is the bug this exists to fix.
    #
    # Default 1 (sequential) from measurement, not taste: uncontended a cutout
    # takes 100-164s, but with 5 running at once they took 900s+ each and never
    # finished — load average 15.23 with a single Python process at 311% CPU.
    # Being CPU-bound they do not parallelise, they thrash, so one at a time at
    # full speed finishes the batch sooner AND keeps cores free for the API.
    # Also the lowest memory: one rembg session rather than five.
    #
    # Deliberately has NO boot assertion — there is no provider ceiling to check
    # it against, and inventing one would repeat the category error above.
    AVATAR_MATTE_CONCURRENCY: int = int(
        os.environ.get("AVATAR_MATTE_CONCURRENCY", "1")
    )
    # Attempts allowed per SCENE (not per job row). The in-job retry loop in
    # services/avatar_queue.py stops at this many, and a successor row created by
    # the bulk retry endpoint INHERITS the count — so an unattended retry can
    # never burn more than this many renders for one scene. An explicit per-scene
    # Generate click resets it (see routers/projects.py), so a user is never
    # locked out of a scene that would now succeed.
    AVATAR_MAX_ATTEMPTS: int = int(os.environ.get("AVATAR_MAX_ATTEMPTS", "3"))

    # Cut the presenter out INSIDE the Modal render container, so /render returns
    # the mp4 plus its transparent .mov/.webm twins in one call and a scene's
    # cutout exists the moment its render lands (no second job, no second wait, and
    # nothing heavy on this server's CPU).
    #
    # Sent to the service as a form field on every render rather than being baked
    # into the service's own default, so matting can be switched off from backend
    # config alone — no Modal redeploy — if it ever destabilises renders or the
    # extra GPU-seconds need pausing. Turning it off falls back to the old shape:
    # /render returns a bare mp4 and cutouts come from the AVATAR_MATTE_CONCURRENCY
    # job below.
    #
    # BG-REMOVAL-DISABLED: default flipped to "false". Background removal is off
    # product-wide, so no render asks the service to matte. The Modal service also
    # refuses independently (MATTE_DISABLED there), which is what makes this safe
    # to flip back on its own without a redeploy having any effect yet.
    # TO RE-ENABLE: restore the "true" default here AND set MATTE_DISABLED = False
    # in modal-service/longcat-avatar/app.py, then redeploy that app.
    AVATAR_INLINE_MATTE: bool = (
        os.environ.get("AVATAR_INLINE_MATTE", "false").lower() != "false"
    )
    # Per-render client timeout. L40S ≈ 158s/render at 25fps/10-steps; fps=30 adds
    # ~20% → ~190s. 600s leaves generous headroom for a queued/cold render.
    # A warm render is ~3 min, but this call can also QUEUE behind a cold start
    # (HF's GPU allocation is unbounded and was observed at ~8 min), so the
    # budget covers wake + render, not just render.
    AVATAR_RENDER_TIMEOUT_SECONDS: int = int(
        os.environ.get("AVATAR_RENDER_TIMEOUT_SECONDS", "1200")
    )

    # Crafted templates (separate from built-ins and user custom templates)
    CRAFTED_TEMPLATES_ENABLED: bool = False
    CRAFTED_TEMPLATE_R2_PREFIX: str = ""  # optional namespace, e.g. "dev" | "staging" | "prod"
    CRAFTED_TEMPLATE_CACHE_TTL_SECONDS: int = 86400
    CRAFTED_TEMPLATE_MAX_PACKAGE_BYTES: int = 25 * 1024 * 1024
    CRAFTED_TEMPLATE_MAX_FILE_BYTES: int = 8 * 1024 * 1024

    # Render reliability/progress controls
    RENDER_MAX_SECONDS: int = int(os.environ.get("RENDER_MAX_SECONDS", "2700"))
    RENDER_STALL_SECONDS: int = int(os.environ.get("RENDER_STALL_SECONDS", "300"))
    RENDER_PROGRESS_UPLOAD_INTERVAL_SECONDS: int = int(
        os.environ.get("RENDER_PROGRESS_UPLOAD_INTERVAL_SECONDS", "10")
    )
    # If shared render progress file stops updating for this long, treat render as dead.
    RENDER_PROGRESS_STALE_SECONDS: int = int(
        os.environ.get("RENDER_PROGRESS_STALE_SECONDS", "360")
    )

    # Stall recovery: if a background job's updated_at heartbeat goes stale for
    # longer than its threshold while still active, the status endpoint (and the
    # boot sweep) reverts the project and refunds the credit. Script is larger
    # because stage B regenerates all scenes in one monolithic call (no per-scene
    # heartbeat).
    STALL_THRESHOLD_TEMPLATE_SECONDS: int = int(
        os.environ.get("STALL_THRESHOLD_TEMPLATE_SECONDS", "600")
    )
    STALL_THRESHOLD_VOICE_SECONDS: int = int(
        os.environ.get("STALL_THRESHOLD_VOICE_SECONDS", "600")
    )
    STALL_THRESHOLD_SCRIPT_SECONDS: int = int(
        os.environ.get("STALL_THRESHOLD_SCRIPT_SECONDS", "1200")
    )
    # Language change does two full passes over the scenes (translate, then TTS), so it
    # is slower than a voice-only change.
    STALL_THRESHOLD_LANGUAGE_SECONDS: int = int(
        os.environ.get("STALL_THRESHOLD_LANGUAGE_SECONDS", "1200")
    )
    # Must exceed the WORST case a job can legitimately take, or a slow-but-alive
    # render gets reaped as "stuck": prepare (720s) + render (1200s) + one
    # re-prepare/retry after a Space restart (720s + 1200s) = 3840s, plus headroom.
    STALL_THRESHOLD_AVATAR_SECONDS: int = int(
        os.environ.get("STALL_THRESHOLD_AVATAR_SECONDS", "4200")
    )


    # Email
    EMAIL_PROVIDER: str = "resend"              # currently only "resend" is supported
    RESEND_API_KEY: str = ""
    UNOSEND_API_KEY: str = ""  # reserved — blast email uses Resend; Unosend path commented in email.py
    FROM_EMAIL: str = "sales@blog2video.app"    # contact/internal emails
    NOREPLY_EMAIL: str = "noreply@blog2video.app"  # user-facing notifications
    INTERNAL_ALERT_EMAIL: str = "arslan@firebird-technologies.com"  # internal team alerts/forwards
    INTERNAL_ALERT_EMAIL_2: str = "humeraraheel276@gmail.com"  # second internal recipient, CC'd on select alerts (e.g. ElevenLabs failover)
    # Automated update email scheduler: UTC hour (0-23) to run the daily batch
    UPDATE_EMAIL_SEND_HOUR: int = 9

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
