from __future__ import annotations

import httpx

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


async def fetch_image_from_url(
    url: str,
    *,
    client: httpx.AsyncClient,
    max_bytes: int,
    allowed_types: tuple[str, ...] = ALLOWED_TYPES_DEFAULT,
) -> tuple[bytes, str]:
    """Fetch an image from a direct image URL. Does not parse HTML pages."""
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ImageError(f"Could not fetch image from URL: {exc}") from exc

    data = response.content
    content_type = response.headers.get("content-type", "")
    validate_image_bytes(
        data, content_type=content_type, max_bytes=max_bytes, allowed_types=allowed_types
    )
    return data, content_type.split(";")[0].strip().lower()
