import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app, get_settings
from app.services import fal_proxy


# --- unit: host allowlist ---------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "https://rest.alpha.fal.ai/tokens/",
        "https://queue.fal.run/decart/lucy2-vton",
        "https://v3.fal.media/files/abc.png",
        "https://fal.ai/anything",
    ],
)
def test_allows_fal_hosts(url):
    assert fal_proxy._is_allowed_target(url) is True


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example.com/steal",
        "http://rest.alpha.fal.ai/tokens/",  # not https
        "https://fal.ai.evil.com/x",  # suffix-spoof
        "ftp://fal.ai/x",
        "not-a-url",
    ],
)
def test_rejects_non_fal_or_insecure(url):
    assert fal_proxy._is_allowed_target(url) is False


# --- unit: header construction ----------------------------------------------


def test_build_upstream_headers_injects_auth_and_forwards_x_fal():
    headers = fal_proxy._build_upstream_headers(
        {
            "X-Fal-Target-Url": "https://rest.alpha.fal.ai/tokens/",
            "x-fal-flavor": "realtime",
            "user-agent": "Mozilla/5.0",
            "content-type": "application/json",
            "cookie": "secret",  # must NOT be forwarded
        },
        fal_key="abc:def",
    )
    assert headers["authorization"] == "Key abc:def"
    assert headers["x-fal-client-proxy"] == fal_proxy.CLIENT_PROXY_VALUE
    assert headers["x-fal-flavor"] == "realtime"
    assert headers["user-agent"] == "Mozilla/5.0"
    assert "cookie" not in headers
    # the target-url control header is not forwarded upstream
    assert fal_proxy.TARGET_URL_HEADER not in headers


def test_response_headers_strip_length_and_encoding():
    upstream = httpx.Response(
        200,
        headers={"content-length": "5", "content-encoding": "gzip", "x-keep": "yes"},
    )
    out = fal_proxy.response_headers(upstream)
    assert out == {"x-keep": "yes"}


# --- unit: forward() --------------------------------------------------------


async def test_forward_sends_to_target_with_auth():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"token": "jwt"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        resp = await fal_proxy.forward(
            method="POST",
            headers={fal_proxy.TARGET_URL_HEADER: "https://rest.alpha.fal.ai/tokens/"},
            body=b"{}",
            fal_key="abc:def",
            client=client,
        )
    assert resp.json() == {"token": "jwt"}
    assert captured["url"] == "https://rest.alpha.fal.ai/tokens/"
    assert captured["auth"] == "Key abc:def"


async def test_forward_missing_target_raises_400():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200))) as c:
        with pytest.raises(fal_proxy.FalProxyError) as exc:
            await fal_proxy.forward(method="POST", headers={}, body=b"", fal_key="k", client=c)
    assert exc.value.status_code == 400


async def test_forward_disallowed_host_raises_403():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200))) as c:
        with pytest.raises(fal_proxy.FalProxyError) as exc:
            await fal_proxy.forward(
                method="POST",
                headers={fal_proxy.TARGET_URL_HEADER: "https://evil.example.com"},
                body=b"",
                fal_key="k",
                client=c,
            )
    assert exc.value.status_code == 403


# --- route integration (error paths need no upstream) -----------------------


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: Settings(fal_key="test-key")
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_route_missing_target_header_returns_400(client):
    resp = client.post("/api/fal/proxy", content=b"{}")
    assert resp.status_code == 400


def test_route_disallowed_host_returns_403(client):
    resp = client.post(
        "/api/fal/proxy",
        content=b"{}",
        headers={fal_proxy.TARGET_URL_HEADER: "https://evil.example.com/x"},
    )
    assert resp.status_code == 403
