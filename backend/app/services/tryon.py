from __future__ import annotations

import httpx

from app.providers.base import VTONProvider
from app.services.images import ImageError, fetch_image_from_url, validate_image_bytes


async def generate_tryon(
    *,
    provider: VTONProvider,
    person_bytes: bytes,
    person_content_type: str | None,
    garment_bytes: bytes | None,
    garment_content_type: str | None,
    garment_url: str | None,
    http_client: httpx.AsyncClient | None,
    max_bytes: int,
) -> str:
    validate_image_bytes(person_bytes, content_type=person_content_type, max_bytes=max_bytes)

    has_file = garment_bytes is not None
    has_url = bool(garment_url)
    if has_file == has_url:
        raise ImageError("Provide exactly one of a garment file or a garment URL.")

    if has_file:
        validate_image_bytes(garment_bytes, content_type=garment_content_type, max_bytes=max_bytes)
        g_bytes, g_type = garment_bytes, (garment_content_type or "image/jpeg")
    else:
        if http_client is None:
            raise ImageError("No HTTP client available to fetch the garment URL.")
        g_bytes, g_type = await fetch_image_from_url(
            garment_url, client=http_client, max_bytes=max_bytes
        )

    return await provider.try_on(
        person_bytes=person_bytes,
        person_content_type=person_content_type or "image/jpeg",
        garment_bytes=g_bytes,
        garment_content_type=g_type,
    )
