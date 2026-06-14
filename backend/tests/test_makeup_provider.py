import httpx
import pytest

from app.config import Settings
from app.providers.base import ProviderError
from app.providers.makeup_provider import RunPodMakeupProvider

KW = dict(source_bytes=b"face", reference_bytes=b"look", intensity=1.0)


def _patch_transport(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    orig = httpx.AsyncClient
    monkeypatch.setattr(
        "app.providers.runpod_client.httpx.AsyncClient",
        lambda *a, **k: orig(transport=transport),
    )


def _settings():
    return Settings(runpod_api_key="key", runpod_makeup_endpoint_id="mk")


async def test_makeup_returns_data_url(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/run"):
            return httpx.Response(200, json={"id": "j"})
        return httpx.Response(200, json={"status": "COMPLETED", "output": {"image": "QUJD"}})

    _patch_transport(monkeypatch, handler)
    url = await RunPodMakeupProvider(_settings()).transfer(**KW)
    assert url == "data:image/png;base64,QUJD"


async def test_makeup_worker_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/run"):
            return httpx.Response(200, json={"id": "j"})
        return httpx.Response(200, json={"status": "COMPLETED", "output": {"error": "no face"}})

    _patch_transport(monkeypatch, handler)
    with pytest.raises(ProviderError, match="no face"):
        await RunPodMakeupProvider(_settings()).transfer(**KW)


async def test_makeup_unconfigured():
    with pytest.raises(ProviderError, match="not configured"):
        await RunPodMakeupProvider(Settings()).transfer(**KW)
