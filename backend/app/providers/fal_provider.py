from __future__ import annotations

import os

import fal_client

from app.config import Settings
from app.providers.base import ProviderError


class FalVTONProvider:
    def __init__(self, settings: Settings):
        self._settings = settings
        if settings.fal_key:
            os.environ.setdefault("FAL_KEY", settings.fal_key)

    async def try_on(
        self,
        *,
        person_bytes: bytes,
        person_content_type: str,
        garment_bytes: bytes,
        garment_content_type: str,
    ) -> str:
        try:
            human_url = await fal_client.upload_async(person_bytes, person_content_type)
            garment_url = await fal_client.upload_async(garment_bytes, garment_content_type)
            result = await fal_client.subscribe_async(
                self._settings.fal_model,
                arguments={
                    "human_image_url": human_url,
                    "garment_image_url": garment_url,
                },
            )
            return result["image"]["url"]
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001 — normalize provider failures
            raise ProviderError(f"Try-on provider failed: {exc}") from exc
