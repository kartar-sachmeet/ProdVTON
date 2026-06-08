from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    fal_key: str = ""
    fal_model: str = "fal-ai/kling/v1-5/kolors-virtual-try-on"
    max_image_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_image_types: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    request_timeout_seconds: float = 120.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
