"""Server-side proxy for the fal browser SDK.

Faithful reimplementation of `@fal-ai/server-proxy` so the browser realtime SDK
can authenticate (short-lived JWT tokens), upload garment images to fal storage,
and negotiate the realtime connection — all without `FAL_KEY` ever reaching the
client. The browser sends the real upstream URL in the ``x-fal-target-url``
header and posts to our proxy route; we forward the request, adding the
credential, and stream the response back.

A host allowlist prevents the proxy from being abused as an open relay that
spends our fal credits against arbitrary destinations (SSRF / credit theft).
"""

from __future__ import annotations

from urllib.parse import urlsplit

import httpx

TARGET_URL_HEADER = "x-fal-target-url"
CLIENT_PROXY_VALUE = "@fal-ai/server-proxy/python"

# Response headers that must not be copied verbatim — httpx already decodes the
# body, so the upstream length/encoding would be wrong.
_EXCLUDED_RESPONSE_HEADERS = frozenset({"content-length", "content-encoding", "transfer-encoding"})

# Only forward to fal-owned hosts. Suffix match against the URL hostname.
_ALLOWED_HOST_SUFFIXES = (".fal.ai", ".fal.run", ".fal.media", ".fal.dev")
_ALLOWED_HOSTS = frozenset({"fal.ai", "fal.run", "fal.media", "fal.dev"})


class FalProxyError(Exception):
    """Raised when a proxy request is malformed or targets a disallowed host."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _is_allowed_target(url: str) -> bool:
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        return False
    host = parts.hostname.lower()
    if host in _ALLOWED_HOSTS:
        return True
    return any(host.endswith(suffix) for suffix in _ALLOWED_HOST_SUFFIXES)


def _build_upstream_headers(incoming: dict[str, str], *, fal_key: str) -> dict[str, str]:
    """Construct headers for the upstream fal request.

    Mirrors the official proxy: sets auth + json content negotiation, identifies
    the proxy, and passes through the user-agent plus any ``x-fal-*`` headers
    (except the target-url control header).
    """
    lowered = {k.lower(): v for k, v in incoming.items()}
    headers = {
        "authorization": f"Key {fal_key}",
        "accept": "application/json",
        "content-type": lowered.get("content-type", "application/json"),
        "x-fal-client-proxy": CLIENT_PROXY_VALUE,
    }
    if "user-agent" in lowered:
        headers["user-agent"] = lowered["user-agent"]
    for key, value in lowered.items():
        if key.startswith("x-fal-") and key != TARGET_URL_HEADER:
            headers[key] = value
    return headers


async def forward(
    *,
    method: str,
    headers: dict[str, str],
    body: bytes,
    fal_key: str,
    client: httpx.AsyncClient,
) -> httpx.Response:
    """Forward a proxied request to its fal upstream target.

    Raises FalProxyError(400) if the target header is missing and 403 if the
    target host is not fal-owned.
    """
    target_url = {k.lower(): v for k, v in headers.items()}.get(TARGET_URL_HEADER)
    if not target_url:
        raise FalProxyError(400, f"Missing {TARGET_URL_HEADER} header.")
    if not _is_allowed_target(target_url):
        raise FalProxyError(403, "Proxy target host is not allowed.")

    if not fal_key:
        raise FalProxyError(500, "Server is not configured with a fal credential.")

    upstream_headers = _build_upstream_headers(headers, fal_key=fal_key)
    return await client.request(
        method,
        target_url,
        headers=upstream_headers,
        content=body,
    )


def response_headers(upstream: httpx.Response) -> dict[str, str]:
    """Headers to return to the client, dropping length/encoding artifacts."""
    return {
        name: value
        for name, value in upstream.headers.items()
        if name.lower() not in _EXCLUDED_RESPONSE_HEADERS
    }
