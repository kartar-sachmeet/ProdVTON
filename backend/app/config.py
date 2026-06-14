from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Clothing try-on backend: "fal" (hosted Kling) or "runpod" (self-hosted CatVTON-FLUX).
    vton_provider: str = "fal"

    fal_key: str = ""
    fal_model: str = "fal-ai/kling/v1-5/kolors-virtual-try-on"

    # RunPod serverless (generative SOTA). One API key, separate endpoints per model.
    runpod_api_key: str = ""
    runpod_endpoint_id: str = ""  # CatVTON-FLUX clothing worker
    runpod_category: str = "upper"  # upper | lower | overall
    runpod_makeup_endpoint_id: str = ""  # Stable-Makeup worker
    runpod_image3d_endpoint_id: str = ""  # TRELLIS image-to-3D ingestion worker

    max_image_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_image_types: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    request_timeout_seconds: float = 120.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
