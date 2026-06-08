import pytest

from app.services.images import ImageError, validate_image_bytes


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
