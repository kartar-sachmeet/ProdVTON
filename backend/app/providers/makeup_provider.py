from __future__ import annotations

import base64

from app.config import Settings
from app.providers import runpod_client
from app.providers.base import ProviderError


class RunPodMakeupProvider:
    """High-fidelity generative makeup transfer via a RunPod Stable-Makeup endpoint.

    Source face + reference makeup look -> source wearing that makeup. Non-real-time
    (diffusion); complements the live AR makeup. Returns the result as a data URL.
    """

    def __init__(self, settings: Settings):
        self._endpoint = settings.runpod_makeup_endpoint_id
        self._api_key = settings.runpod_api_key
        self._timeout = settings.request_timeout_seconds

    async def transfer(self, *, source_bytes: bytes, reference_bytes: bytes, intensity: float = 1.0) -> str:
        output = await runpod_client.run_job(
            endpoint_id=self._endpoint,
            api_key=self._api_key,
            job_input={
                "source_image": base64.b64encode(source_bytes).decode(),
                "reference_image": base64.b64encode(reference_bytes).decode(),
                "intensity": intensity,
            },
            timeout=self._timeout,
        )
        if "error" in output:
            raise ProviderError(f"Makeup worker error: {output['error']}")
        image_b64 = output.get("image")
        if not image_b64:
            raise ProviderError("Makeup worker returned no image.")
        return f"data:image/png;base64,{image_b64}"
