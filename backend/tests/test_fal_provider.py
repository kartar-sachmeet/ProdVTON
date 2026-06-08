import pytest

import app.providers.fal_provider as fal_module
from app.config import Settings
from app.providers.base import ProviderError
from app.providers.fal_provider import FalVTONProvider


async def test_try_on_uploads_and_returns_url(png_bytes, monkeypatch):
    uploads = []

    async def fake_upload(data, content_type):
        uploads.append(content_type)
        return f"https://fal.storage/{len(uploads)}"

    async def fake_subscribe(model, arguments):
        assert arguments["human_image_url"] == "https://fal.storage/1"
        assert arguments["garment_image_url"] == "https://fal.storage/2"
        return {"image": {"url": "https://fal.result/out.png"}}

    monkeypatch.setattr(fal_module.fal_client, "upload_async", fake_upload)
    monkeypatch.setattr(fal_module.fal_client, "subscribe_async", fake_subscribe)

    provider = FalVTONProvider(Settings(fal_key="test"))
    url = await provider.try_on(
        person_bytes=png_bytes,
        person_content_type="image/png",
        garment_bytes=png_bytes,
        garment_content_type="image/png",
    )
    assert url == "https://fal.result/out.png"


async def test_try_on_wraps_errors(png_bytes, monkeypatch):
    async def fake_upload(data, content_type):
        return "https://fal.storage/x"

    async def fake_subscribe(model, arguments):
        raise RuntimeError("fal exploded")

    monkeypatch.setattr(fal_module.fal_client, "upload_async", fake_upload)
    monkeypatch.setattr(fal_module.fal_client, "subscribe_async", fake_subscribe)

    provider = FalVTONProvider(Settings(fal_key="test"))
    with pytest.raises(ProviderError):
        await provider.try_on(
            person_bytes=png_bytes,
            person_content_type="image/png",
            garment_bytes=png_bytes,
            garment_content_type="image/png",
        )
