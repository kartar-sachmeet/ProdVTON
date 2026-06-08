import httpx
import pytest

from app.services.images import ImageError
from app.services.tryon import generate_tryon
from tests.conftest import FakeProvider


async def test_generate_with_uploaded_garment(png_bytes, fake_provider):
    url = await generate_tryon(
        provider=fake_provider,
        person_bytes=png_bytes,
        person_content_type="image/png",
        garment_bytes=png_bytes,
        garment_content_type="image/png",
        garment_url=None,
        http_client=None,
        max_bytes=1_000_000,
    )
    assert url == fake_provider.result_url
    assert len(fake_provider.calls) == 1


async def test_generate_rejects_missing_garment(png_bytes, fake_provider):
    with pytest.raises(ImageError):
        await generate_tryon(
            provider=fake_provider,
            person_bytes=png_bytes,
            person_content_type="image/png",
            garment_bytes=None,
            garment_content_type=None,
            garment_url=None,
            http_client=None,
            max_bytes=1_000_000,
        )


async def test_generate_rejects_both_garment_inputs(png_bytes, fake_provider):
    with pytest.raises(ImageError):
        await generate_tryon(
            provider=fake_provider,
            person_bytes=png_bytes,
            person_content_type="image/png",
            garment_bytes=png_bytes,
            garment_content_type="image/png",
            garment_url="https://example.com/g.png",
            http_client=None,
            max_bytes=1_000_000,
        )


async def test_generate_fetches_garment_url(png_bytes, fake_provider):
    def handler(request):
        return httpx.Response(200, content=png_bytes, headers={"content-type": "image/png"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        url = await generate_tryon(
            provider=fake_provider,
            person_bytes=png_bytes,
            person_content_type="image/png",
            garment_bytes=None,
            garment_content_type=None,
            garment_url="https://example.com/g.png",
            http_client=client,
            max_bytes=1_000_000,
        )
    assert url == fake_provider.result_url
