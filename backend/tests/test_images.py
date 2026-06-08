import httpx
import pytest

from app.services.images import ImageError, fetch_image_from_url, validate_image_bytes


def test_validate_accepts_png(png_bytes):
    # Should not raise
    validate_image_bytes(png_bytes, content_type="image/png", max_bytes=1_000_000)


def test_validate_rejects_bad_content_type(png_bytes):
    with pytest.raises(ImageError):
        validate_image_bytes(png_bytes, content_type="application/pdf", max_bytes=1_000_000)


def test_validate_rejects_oversized(png_bytes):
    with pytest.raises(ImageError):
        validate_image_bytes(png_bytes, content_type="image/png", max_bytes=10)


def test_validate_rejects_empty():
    with pytest.raises(ImageError):
        validate_image_bytes(b"", content_type="image/png", max_bytes=1_000_000)


def _transport(handler):
    return httpx.MockTransport(handler)


async def test_fetch_returns_bytes_and_type(png_bytes):
    def handler(request):
        return httpx.Response(200, content=png_bytes, headers={"content-type": "image/png"})

    async with httpx.AsyncClient(transport=_transport(handler)) as client:
        data, content_type = await fetch_image_from_url(
            "https://example.com/g.png", client=client, max_bytes=1_000_000
        )
    assert data == png_bytes
    assert content_type == "image/png"


async def test_fetch_rejects_non_image():
    def handler(request):
        return httpx.Response(200, content=b"<html></html>", headers={"content-type": "text/html"})

    async with httpx.AsyncClient(transport=_transport(handler)) as client:
        with pytest.raises(ImageError):
            await fetch_image_from_url(
                "https://example.com/page", client=client, max_bytes=1_000_000
            )


async def test_fetch_rejects_http_error():
    def handler(request):
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=_transport(handler)) as client:
        with pytest.raises(ImageError):
            await fetch_image_from_url(
                "https://example.com/missing.png", client=client, max_bytes=1_000_000
            )
