from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPConfig(BaseSettings):
    """Config read from B2V_* environment variables (or .env file).

    With env_prefix="B2V_", field `jwt_token` maps to env var B2V_JWT_TOKEN.
    """
    api_base_url: str = "http://localhost:8000"
    jwt_token: str  # required — server raises ValidationError on startup if missing
    poll_interval: int = 5
    poll_timeout_generate: int = 300
    poll_timeout_render: int = 600

    model_config = SettingsConfigDict(env_prefix="B2V_", env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_config() -> MCPConfig:
    return MCPConfig()
