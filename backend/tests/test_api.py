import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_provider
from tests.conftest import FakeProvider


@pytest.fixture
def client_with_fake():
    fake = FakeProvider()
    app.dependency_overrides[get_provider] = lambda: fake
    with TestClient(app) as client:
        yield client, fake
    app.dependency_overrides.clear()


def test_health(client_with_fake):
    client, _ = client_with_fake
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_tryon_with_uploaded_garment(client_with_fake, png_bytes):
    client, fake = client_with_fake
    response = client.post(
        "/api/tryon",
        files={
            "person": ("p.png", png_bytes, "image/png"),
            "garment": ("g.png", png_bytes, "image/png"),
        },
    )
    assert response.status_code == 200
    assert response.json() == {"result_url": fake.result_url}


def test_tryon_missing_garment_returns_400(client_with_fake, png_bytes):
    client, _ = client_with_fake
    response = client.post(
        "/api/tryon",
        files={"person": ("p.png", png_bytes, "image/png")},
    )
    assert response.status_code == 400


def test_tryon_bad_type_returns_400(client_with_fake, png_bytes):
    client, _ = client_with_fake
    response = client.post(
        "/api/tryon",
        files={
            "person": ("p.pdf", b"%PDF-1.4", "application/pdf"),
            "garment": ("g.png", png_bytes, "image/png"),
        },
    )
    assert response.status_code == 400
