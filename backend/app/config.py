import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Environment: "production" uses Claude Sonnet; anything else uses DeepSeek
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "local")

    # API Keys
    ANTHROPIC_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"
    EXA_API_KEY: str = ""
    FIRECRAWL_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    OPEN_ROUTER_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_CODE_MODEL: str = "gemini-2.5-flash"
    # Used automatically when an image is attached (vision-guided layout editing).
    GEMINI_CODE_MODEL_WITH_IMAGE: str = "gemini-2.5-pro"

    # Template studio access password. Kept server-side so it doesn't leak in
    # the JS bundle. Empty disables the gate (any password passes — useful for
    # local dev). Set via TEMPLATE_STUDIO_PASSWORD in .env.
    TEMPLATE_STUDIO_PASSWORD: str = ""

    # AI image generation: set IMAGE_PROVIDER ("openai" | "gemini") and DSPY_IMAGE_LM in env
    IMAGE_PROVIDER: str = os.environ.get("IMAGE_PROVIDER", "openai")
    DSPY_IMAGE_LM: str =  "openai/gpt-4o-mini"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""  # Price ID for $50/mo Pro plan
    STRIPE_PRO_ANNUAL_PRICE_ID: str = ""  # Price ID for $480/yr Pro plan (20% off)
    STRIPE_STANDARD_PRICE_ID: str = ""  # Price ID for $25/mo Standard plan (30 videos)
    STRIPE_STANDARD_ANNUAL_PRICE_ID: str = ""  # Price ID for $20/mo effective Standard annual
    STRIPE_PER_VIDEO_PRICE_ID: str = ""  # Price ID for $5 one-time per-video
    STRIPE_RETENTION_COUPON_ID: str = ""  # Coupon ID applied server-side for cancel-retention offers
    STRIPE_3VID_MONTHLY_COUPON_ID: str = ""  # 15% off Pro monthly, once-per-customer (out-of-videos offer)
    STRIPE_3VID_ANNUAL_COUPON_ID: str = ""   # 25% off Pro annual, once-per-customer (out-of-videos offer)

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 72

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


    # Email
    EMAIL_PROVIDER: str = "resend"              # currently only "resend" is supported
    RESEND_API_KEY: str = ""
    UNOSEND_API_KEY: str = ""  # reserved — blast email uses Resend; Unosend path commented in email.py
    FROM_EMAIL: str = "sales@blog2video.app"    # contact/internal emails
    NOREPLY_EMAIL: str = "noreply@blog2video.app"  # user-facing notifications
    # Automated update email scheduler: UTC hour (0-23) to run the daily batch
    UPDATE_EMAIL_SEND_HOUR: int = 9

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
