import base64

import httpx
import pytest

from app.config import Settings
from app.providers.base import ProviderError
from app.providers.model3d_provider import RunPodModel3DProvider


def _patch_transport(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    orig = httpx.AsyncClient
    monkeypatch.setattr(
        "app.providers.runpod_client.httpx.AsyncClient",
        lambda *a, **k: orig(transport=transport),
    )


def _settings():
    return Settings(runpod_api_key="key", runpod_image3d_endpoint_id="i3d")


async def test_generate_returns_glb_bytes(monkeypatch):
    glb_b64 = base64.b64encode(b"GLB-DATA").decode()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/run"):
            return httpx.Response(200, json={"id": "j"})
        return httpx.Response(200, json={"status": "COMPLETED", "output": {"glb": glb_b64}})

    _patch_transport(monkeypatch, handler)
    out = await RunPodModel3DProvider(_settings()).generate(image_bytes=b"photo")
    assert out == b"GLB-DATA"


async def test_unconfigured_raises():
    with pytest.raises(ProviderError, match="not configured"):
        await RunPodModel3DProvider(Settings()).generate(image_bytes=b"x")
