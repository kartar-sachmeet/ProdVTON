import httpx
import pytest

from app.config import Settings
from app.providers.base import ProviderError
from app.providers.runpod_provider import RunPodVTONProvider

KW = dict(
    person_bytes=b"person",
    person_content_type="image/png",
    garment_bytes=b"garment",
    garment_content_type="image/png",
)


def _patch_transport(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    orig = httpx.AsyncClient
    monkeypatch.setattr(
        "app.providers.runpod_client.httpx.AsyncClient",
        lambda *a, **k: orig(transport=transport),
    )


def _settings():
    return Settings(vton_provider="runpod", runpod_api_key="key", runpod_endpoint_id="ep")


async def test_returns_data_url_on_completion(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/run"):
            return httpx.Response(200, json={"id": "job1"})
        return httpx.Response(200, json={"status": "COMPLETED", "output": {"image": "QUJD"}})

    _patch_transport(monkeypatch, handler)
    url = await RunPodVTONProvider(_settings()).try_on(**KW)
    assert url == "data:image/png;base64,QUJD"


async def test_worker_error_becomes_provider_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/run"):
            return httpx.Response(200, json={"id": "job1"})
        return httpx.Response(200, json={"status": "COMPLETED", "output": {"error": "bad mask"}})

    _patch_transport(monkeypatch, handler)
    with pytest.raises(ProviderError, match="bad mask"):
        await RunPodVTONProvider(_settings()).try_on(**KW)


async def test_failed_job_becomes_provider_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/run"):
            return httpx.Response(200, json={"id": "job1"})
        return httpx.Response(200, json={"status": "FAILED", "error": "oom"})

    _patch_transport(monkeypatch, handler)
    with pytest.raises(ProviderError):
        await RunPodVTONProvider(_settings()).try_on(**KW)


async def test_unconfigured_raises():
    with pytest.raises(ProviderError, match="not configured"):
        await RunPodVTONProvider(Settings(vton_provider="runpod")).try_on(**KW)
