import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # API Keys
    ANTHROPIC_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"
    EXA_API_KEY: str = ""
    FIRECRAWL_API_KEY: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""  # Price ID for $50/mo Pro plan
    STRIPE_PRO_ANNUAL_PRICE_ID: str = ""  # Price ID for $480/yr Pro plan (20% off)
    STRIPE_PER_VIDEO_PRICE_ID: str = ""  # Price ID for $5 one-time per-video

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 72

    # App
    FRONTEND_URL: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str = "sqlite:///./blog2video.db"

    # Remotion
    REMOTION_PROJECT_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "remotion-video",
    )

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

    class Config:
        env_file = ".env"


settings = Settings()
