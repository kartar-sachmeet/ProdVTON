from __future__ import annotations

ALLOWED_TYPES_DEFAULT = ("image/jpeg", "image/png", "image/webp")


class ImageError(Exception):
    """Raised when an image fails validation or cannot be fetched."""


def validate_image_bytes(
    data: bytes,
    *,
    content_type: str | None,
    max_bytes: int,
    allowed_types: tuple[str, ...] = ALLOWED_TYPES_DEFAULT,
) -> None:
    if not data:
        raise ImageError("Image is empty.")
    if len(data) > max_bytes:
        raise ImageError(f"Image exceeds maximum size of {max_bytes} bytes.")
    normalized = (content_type or "").split(";")[0].strip().lower()
    if normalized not in allowed_types:
        raise ImageError(f"Unsupported image type: {content_type!r}.")
