from __future__ import annotations

import base64

from app.config import Settings
from app.providers import runpod_client
from app.providers.base import ProviderError


class RunPodVTONProvider:
    """Self-hosted generative clothing try-on via a RunPod CatVTON-FLUX endpoint.

    Submits person + garment as base64, polls to completion, and returns the
    result as a data URL. Slots in beside FalVTONProvider behind VTONProvider.
    """

    def __init__(self, settings: Settings):
        self._endpoint = settings.runpod_endpoint_id
        self._api_key = settings.runpod_api_key
        self._timeout = settings.request_timeout_seconds
        self._category = settings.runpod_category

    async def try_on(
        self,
        *,
        person_bytes: bytes,
        person_content_type: str,
        garment_bytes: bytes,
        garment_content_type: str,
    ) -> str:
        output = await runpod_client.run_job(
            endpoint_id=self._endpoint,
            api_key=self._api_key,
            job_input={
                "person_image": base64.b64encode(person_bytes).decode(),
                "garment_image": base64.b64encode(garment_bytes).decode(),
                "category": self._category,
            },
            timeout=self._timeout,
        )
        if "error" in output:
            raise ProviderError(f"RunPod worker error: {output['error']}")
        image_b64 = output.get("image")
        if not image_b64:
            raise ProviderError("RunPod worker returned no image.")
        return f"data:image/png;base64,{image_b64}"
