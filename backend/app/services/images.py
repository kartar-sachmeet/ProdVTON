from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import anyio
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


async def _ensure_safe_url(url: str) -> None:
    """Reject non-http(s) schemes and hosts that resolve to private/loopback/link-local/reserved IPs (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ImageError(f"Unsupported URL scheme: {parsed.scheme or '(none)'!r}. Use http or https.")
    host = parsed.hostname
    if not host:
        raise ImageError("URL has no host.")
    try:
        addr_infos = await anyio.to_thread.run_sync(socket.getaddrinfo, host, None)
    except socket.gaierror as exc:
        raise ImageError(f"Could not resolve host: {host}") from exc
    for info in addr_infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ImageError("Refusing to fetch from a private or local network address.")


async def fetch_image_from_url(
    url: str,
    *,
    client: httpx.AsyncClient,
    max_bytes: int,
    allowed_types: tuple[str, ...] = ALLOWED_TYPES_DEFAULT,
) -> tuple[bytes, str]:
    """Fetch an image from a direct image URL. Does not parse HTML pages.

    Streams the body and aborts as soon as it exceeds max_bytes, and refuses
    private/local addresses and non-http(s) schemes (SSRF protection).
    Redirects are not followed, to prevent redirect-based SSRF bypass.
    """
    await _ensure_safe_url(url)
    try:
        async with client.stream("GET", url, follow_redirects=False) as response:
            response.raise_for_status()
            declared = response.headers.get("content-length")
            if declared is not None and declared.isdigit() and int(declared) > max_bytes:
                raise ImageError(f"Image exceeds maximum size of {max_bytes} bytes.")
            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > max_bytes:
                    raise ImageError(f"Image exceeds maximum size of {max_bytes} bytes.")
                chunks.append(chunk)
            data = b"".join(chunks)
            content_type = response.headers.get("content-type", "")
    except httpx.HTTPError as exc:
        raise ImageError(f"Could not fetch image from URL: {exc}") from exc

    validate_image_bytes(
        data, content_type=content_type, max_bytes=max_bytes, allowed_types=allowed_types
    )
    return data, content_type.split(";")[0].strip().lower()
