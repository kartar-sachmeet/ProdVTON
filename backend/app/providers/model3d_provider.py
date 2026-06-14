from __future__ import annotations

import base64

from app.config import Settings
from app.providers import runpod_client
from app.providers.base import ProviderError


class RunPodModel3DProvider:
    """Image-to-3D ingestion via a RunPod TRELLIS endpoint.

    Product photo -> GLB bytes. Offline/per-product; the resulting asset is what
    the real-time AR renderer poses on the user.
    """

    def __init__(self, settings: Settings):
        self._endpoint = settings.runpod_image3d_endpoint_id
        self._api_key = settings.runpod_api_key
        self._timeout = settings.request_timeout_seconds

    async def generate(self, *, image_bytes: bytes, seed: int | None = None) -> bytes:
        job_input: dict = {"image": base64.b64encode(image_bytes).decode()}
        if seed is not None:
            job_input["seed"] = seed
        output = await runpod_client.run_job(
            endpoint_id=self._endpoint,
            api_key=self._api_key,
            job_input=job_input,
            timeout=self._timeout,
        )
        if "error" in output:
            raise ProviderError(f"Image-to-3D worker error: {output['error']}")
        glb_b64 = output.get("glb")
        if not glb_b64:
            raise ProviderError("Image-to-3D worker returned no GLB.")
        return base64.b64decode(glb_b64)
