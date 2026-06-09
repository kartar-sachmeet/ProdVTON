# ProdVton MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production web app where a user uploads a person photo and a garment (file upload or pasted image URL) and sees the person wearing that garment, powered by the fal.ai hosted try-on API.

**Architecture:** React (Vite + TS) frontend calls a FastAPI backend. The backend validates inputs, fetches garment images from URLs when needed, and delegates the try-on to a `VTONProvider` adapter. The only implementation is `FalVTONProvider` (fal.ai), injected as a FastAPI dependency so tests can swap in a fake. No database, no auth; the frontend keeps an in-memory session gallery.

**Tech Stack:** Python 3.13, FastAPI, uv, httpx, fal_client, pytest, pytest-asyncio; React 19 + Vite + TypeScript, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-07-prodvton-mvp-design.md`

---

## File Structure

```
ProdVton/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, routes, DI wiring
│   │   ├── config.py            # Settings from env (FAL_KEY, limits, model, CORS)
│   │   ├── schemas.py           # Pydantic response models
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py          # VTONProvider Protocol
│   │   │   └── fal_provider.py  # FalVTONProvider (fal.ai)
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── images.py        # validation + garment URL fetch
│   │       └── tryon.py         # orchestration (validate -> provider)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py          # fixtures: fake provider, sample image bytes
│   │   ├── test_images.py
│   │   ├── test_tryon_service.py
│   │   ├── test_api.py
│   │   └── test_fal_provider.py
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── PersonUploader.tsx
│   │       ├── GarmentInput.tsx
│   │       ├── GenerateButton.tsx
│   │       ├── ResultView.tsx
│   │       └── SessionGallery.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

---

## Task 0: Initialize repo and backend project

**Files:**
- Create: `.gitignore`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`, `backend/tests/__init__.py`

- [ ] **Step 1: Initialize git repository**

Run (from `ProdVton/`):
```bash
git init
```
Expected: "Initialized empty Git repository in .../ProdVton/.git/"

- [ ] **Step 2: Create `.gitignore`**

Create `.gitignore`:
```gitignore
# Python
__pycache__/
*.pyc
.venv/
.env
.pytest_cache/

# Node
node_modules/
dist/

# OS
.DS_Store
```

- [ ] **Step 3: Create the backend uv project**

Run (from `ProdVton/`):
```bash
cd backend && uv init --no-workspace --name prodvton-backend --python 3.13 . && rm -f hello.py main.py
```
Then add dependencies:
```bash
uv add fastapi "uvicorn[standard]" httpx fal-client pydantic-settings python-multipart
uv add --dev pytest pytest-asyncio
```
Expected: `pyproject.toml` and `uv.lock` created, `.venv/` populated.

- [ ] **Step 4: Configure pytest asyncio mode**

Append to `backend/pyproject.toml`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 5: Create package markers**

Create `backend/app/__init__.py` (empty) and `backend/tests/__init__.py` (empty).

- [ ] **Step 6: Commit**

```bash
cd .. && git add .gitignore backend/pyproject.toml backend/uv.lock backend/app backend/tests && git commit -m "chore: initialize repo and backend project"
```

---

## Task 1: Backend configuration

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/.env.example`

- [ ] **Step 1: Write `config.py`**

Create `backend/app/config.py`:
```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    fal_key: str = ""
    fal_model: str = "fal-ai/kling/v1-5/kolors-virtual-try-on"
    max_image_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_image_types: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    request_timeout_seconds: float = 120.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Create `.env.example`**

Create `backend/.env.example`:
```dotenv
# fal.ai API key — get one at https://fal.ai/dashboard/keys
FAL_KEY=your-fal-key-here

# Optional overrides
# FAL_MODEL=fal-ai/kling/v1-5/kolors-virtual-try-on
# CORS_ORIGINS=["http://localhost:5173"]
```

- [ ] **Step 3: Verify it imports**

Run (from `backend/`): `uv run python -c "from app.config import get_settings; print(get_settings().fal_model)"`
Expected: `fal-ai/kling/v1-5/kolors-virtual-try-on`

- [ ] **Step 4: Commit**

```bash
cd .. && git add backend/app/config.py backend/.env.example && git commit -m "feat: add backend configuration"
```

---

## Task 2: Image validation service

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/images.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_images.py`

- [ ] **Step 1: Create shared test fixtures**

Create `backend/tests/conftest.py`:
```python
import pytest

# Minimal valid PNG (1x1 transparent pixel)
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae"
    "426082"
)


@pytest.fixture
def png_bytes() -> bytes:
    return PNG_BYTES
```

- [ ] **Step 2: Write failing tests for validation**

Create `backend/tests/test_images.py`:
```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_images.py -v`
Expected: FAIL with `ModuleNotFoundError` / `ImportError` (no `app.services.images`).

- [ ] **Step 4: Implement validation**

Create `backend/app/services/__init__.py` (empty), then create `backend/app/services/images.py`:
```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `backend/`): `uv run pytest tests/test_images.py -v`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
cd .. && git add backend/app/services backend/tests/conftest.py backend/tests/test_images.py && git commit -m "feat: add image validation"
```

---

## Task 3: Garment URL fetch

**Files:**
- Modify: `backend/app/services/images.py`
- Test: `backend/tests/test_images.py`

- [ ] **Step 1: Write failing tests for URL fetch**

Append to `backend/tests/test_images.py`:
```python
import httpx

from app.services.images import fetch_image_from_url


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_images.py -k fetch -v`
Expected: FAIL with `ImportError` (no `fetch_image_from_url`).

- [ ] **Step 3: Implement URL fetch**

Append to `backend/app/services/images.py`:
```python
import httpx


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
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `uv run pytest tests/test_images.py -v`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
cd .. && git add backend/app/services/images.py backend/tests/test_images.py && git commit -m "feat: add garment URL image fetch"
```

---

## Task 4: VTONProvider interface

**Files:**
- Create: `backend/app/providers/__init__.py` (empty)
- Create: `backend/app/providers/base.py`

- [ ] **Step 1: Define the provider Protocol**

Create `backend/app/providers/__init__.py` (empty), then create `backend/app/providers/base.py`:
```python
from __future__ import annotations

from typing import Protocol


class ProviderError(Exception):
    """Raised when the try-on provider fails to produce a result."""


class VTONProvider(Protocol):
    async def try_on(
        self,
        *,
        person_bytes: bytes,
        person_content_type: str,
        garment_bytes: bytes,
        garment_content_type: str,
    ) -> str:
        """Run try-on and return a URL to the result image."""
        ...
```

- [ ] **Step 2: Verify it imports**

Run (from `backend/`): `uv run python -c "from app.providers.base import VTONProvider, ProviderError; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd .. && git add backend/app/providers && git commit -m "feat: add VTONProvider interface"
```

---

## Task 5: Try-on orchestration service

**Files:**
- Create: `backend/app/services/tryon.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_tryon_service.py`

- [ ] **Step 1: Add a fake provider fixture**

Append to `backend/tests/conftest.py`:
```python
from app.providers.base import ProviderError


class FakeProvider:
    def __init__(self, result_url="https://fal.example/result.png", raises=False):
        self.result_url = result_url
        self.raises = raises
        self.calls = []

    async def try_on(self, *, person_bytes, person_content_type, garment_bytes, garment_content_type):
        self.calls.append((person_bytes, garment_bytes))
        if self.raises:
            raise ProviderError("boom")
        return self.result_url


@pytest.fixture
def fake_provider():
    return FakeProvider()
```

- [ ] **Step 2: Write failing tests for the service**

Create `backend/tests/test_tryon_service.py`:
```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_tryon_service.py -v`
Expected: FAIL with `ImportError` (no `app.services.tryon`).

- [ ] **Step 4: Implement the orchestration service**

Create `backend/app/services/tryon.py`:
```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `backend/`): `uv run pytest tests/test_tryon_service.py -v`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
cd .. && git add backend/app/services/tryon.py backend/tests/conftest.py backend/tests/test_tryon_service.py && git commit -m "feat: add try-on orchestration service"
```

---

## Task 6: Response schema

**Files:**
- Create: `backend/app/schemas.py`

- [ ] **Step 1: Define the response model**

Create `backend/app/schemas.py`:
```python
from pydantic import BaseModel


class TryOnResponse(BaseModel):
    result_url: str


class HealthResponse(BaseModel):
    status: str = "ok"
```

- [ ] **Step 2: Verify it imports**

Run (from `backend/`): `uv run python -c "from app.schemas import TryOnResponse; print(TryOnResponse(result_url='x').model_dump())"`
Expected: `{'result_url': 'x'}`

- [ ] **Step 3: Commit**

```bash
cd .. && git add backend/app/schemas.py && git commit -m "feat: add response schemas"
```

---

## Task 7: FastAPI app and endpoints

**Files:**
- Create: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

Create `backend/tests/test_api.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_api.py -v`
Expected: FAIL with `ImportError` (no `app.main`).

- [ ] **Step 3: Implement the FastAPI app**

Create `backend/app/main.py`:
```python
from __future__ import annotations

import httpx
from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.providers.base import ProviderError, VTONProvider
from app.providers.fal_provider import FalVTONProvider
from app.schemas import HealthResponse, TryOnResponse
from app.services.images import ImageError
from app.services.tryon import generate_tryon

app = FastAPI(title="ProdVton API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_provider() -> VTONProvider:
    return FalVTONProvider(get_settings())


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/api/tryon", response_model=TryOnResponse)
async def tryon(
    person: UploadFile,
    garment: UploadFile | None = None,
    garment_url: str | None = Form(default=None),
    provider: VTONProvider = Depends(get_provider),
    config: Settings = Depends(get_settings),
) -> TryOnResponse:
    person_bytes = await person.read()
    garment_bytes = await garment.read() if garment is not None else None

    async with httpx.AsyncClient(timeout=config.request_timeout_seconds) as http_client:
        try:
            result_url = await generate_tryon(
                provider=provider,
                person_bytes=person_bytes,
                person_content_type=person.content_type,
                garment_bytes=garment_bytes,
                garment_content_type=garment.content_type if garment else None,
                garment_url=garment_url,
                http_client=http_client,
                max_bytes=config.max_image_bytes,
            )
        except ImageError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return TryOnResponse(result_url=result_url)
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `uv run pytest tests/test_api.py -v`
Expected: 4 passed.

Note: `test_api.py` imports `FalVTONProvider` indirectly via `app.main`. Task 8 creates it; if running tasks out of order, create `fal_provider.py` first. The dependency override means the real provider is never called in these tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add backend/app/main.py backend/tests/test_api.py && git commit -m "feat: add FastAPI app and try-on endpoint"
```

---

## Task 8: fal.ai provider implementation

**Files:**
- Create: `backend/app/providers/fal_provider.py`
- Test: `backend/tests/test_fal_provider.py`

- [ ] **Step 1: Write failing tests with a mocked fal client**

Create `backend/tests/test_fal_provider.py`:
```python
import pytest

import app.providers.fal_provider as fal_module
from app.config import Settings
from app.providers.base import ProviderError
from app.providers.fal_provider import FalVTONProvider


async def test_try_on_uploads_and_returns_url(png_bytes, monkeypatch):
    uploads = []

    async def fake_upload(data, content_type):
        uploads.append(content_type)
        return f"https://fal.storage/{len(uploads)}"

    async def fake_subscribe(model, arguments):
        assert arguments["human_image_url"] == "https://fal.storage/1"
        assert arguments["garment_image_url"] == "https://fal.storage/2"
        return {"image": {"url": "https://fal.result/out.png"}}

    monkeypatch.setattr(fal_module.fal_client, "upload_async", fake_upload)
    monkeypatch.setattr(fal_module.fal_client, "subscribe_async", fake_subscribe)

    provider = FalVTONProvider(Settings(fal_key="test"))
    url = await provider.try_on(
        person_bytes=png_bytes,
        person_content_type="image/png",
        garment_bytes=png_bytes,
        garment_content_type="image/png",
    )
    assert url == "https://fal.result/out.png"


async def test_try_on_wraps_errors(png_bytes, monkeypatch):
    async def fake_upload(data, content_type):
        return "https://fal.storage/x"

    async def fake_subscribe(model, arguments):
        raise RuntimeError("fal exploded")

    monkeypatch.setattr(fal_module.fal_client, "upload_async", fake_upload)
    monkeypatch.setattr(fal_module.fal_client, "subscribe_async", fake_subscribe)

    provider = FalVTONProvider(Settings(fal_key="test"))
    with pytest.raises(ProviderError):
        await provider.try_on(
            person_bytes=png_bytes,
            person_content_type="image/png",
            garment_bytes=png_bytes,
            garment_content_type="image/png",
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_fal_provider.py -v`
Expected: FAIL with `ImportError` (no `app.providers.fal_provider`).

- [ ] **Step 3: Implement the fal provider**

Create `backend/app/providers/fal_provider.py`:
```python
from __future__ import annotations

import os

import fal_client

from app.config import Settings
from app.providers.base import ProviderError


class FalVTONProvider:
    def __init__(self, settings: Settings):
        self._settings = settings
        if settings.fal_key:
            os.environ.setdefault("FAL_KEY", settings.fal_key)

    async def try_on(
        self,
        *,
        person_bytes: bytes,
        person_content_type: str,
        garment_bytes: bytes,
        garment_content_type: str,
    ) -> str:
        try:
            human_url = await fal_client.upload_async(person_bytes, person_content_type)
            garment_url = await fal_client.upload_async(garment_bytes, garment_content_type)
            result = await fal_client.subscribe_async(
                self._settings.fal_model,
                arguments={
                    "human_image_url": human_url,
                    "garment_image_url": garment_url,
                },
            )
            return result["image"]["url"]
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001 — normalize provider failures
            raise ProviderError(f"Try-on provider failed: {exc}") from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `uv run pytest tests/test_fal_provider.py -v`
Expected: 2 passed.

- [ ] **Step 5: Run the full backend suite**

Run (from `backend/`): `uv run pytest -v`
Expected: all tests pass (17 total).

- [ ] **Step 6: Commit**

```bash
cd .. && git add backend/app/providers/fal_provider.py backend/tests/test_fal_provider.py && git commit -m "feat: add fal.ai try-on provider"
```

---

## Task 9: Backend smoke run

**Files:** none (verification only)

- [ ] **Step 1: Start the server**

Run (from `backend/`): `uv run uvicorn app.main:app --port 8000 &` then wait 2 seconds.

- [ ] **Step 2: Hit the health endpoint**

Run: `curl -s http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 3: Stop the server**

Run: `kill %1` (or stop the background uvicorn process).

- [ ] **Step 4: No commit needed** (verification only).

---

## Task 10: Frontend scaffold and API client

**Files:**
- Create: `frontend/` (Vite scaffold)
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Scaffold the Vite React-TS app**

Run (from `ProdVton/`):
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```
Expected: `frontend/` created with React + TS template, dependencies installed.

- [ ] **Step 2: Add a dev proxy to the backend**

Replace `frontend/vite.config.ts` with:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

- [ ] **Step 3: Define shared types**

Create `frontend/src/types.ts`:
```ts
export interface TryOnResult {
  id: string;
  resultUrl: string;
  createdAt: number;
}

export type GarmentInputMode = "upload" | "url";
```

- [ ] **Step 4: Write the API client**

Create `frontend/src/api.ts`:
```ts
export interface TryOnRequest {
  person: File;
  garmentFile: File | null;
  garmentUrl: string | null;
}

export async function requestTryOn(req: TryOnRequest): Promise<string> {
  const form = new FormData();
  form.append("person", req.person);
  if (req.garmentFile) form.append("garment", req.garmentFile);
  if (req.garmentUrl) form.append("garment_url", req.garmentUrl);

  const response = await fetch("/api/tryon", { method: "POST", body: form });
  if (!response.ok) {
    let detail = "Generation failed. Please try again.";
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  const data = (await response.json()) as { result_url: string };
  return data.result_url;
}
```

- [ ] **Step 5: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (TypeScript compiles, dist/ produced).

- [ ] **Step 6: Commit**

```bash
cd .. && git add frontend/ && git commit -m "feat: scaffold frontend with API client"
```

---

## Task 11: Frontend UI components

**Files:**
- Create: `frontend/src/components/PersonUploader.tsx`
- Create: `frontend/src/components/GarmentInput.tsx`
- Create: `frontend/src/components/GenerateButton.tsx`
- Create: `frontend/src/components/ResultView.tsx`
- Create: `frontend/src/components/SessionGallery.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: PersonUploader**

Create `frontend/src/components/PersonUploader.tsx`:
```tsx
interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

export function PersonUploader({ file, onChange }: Props) {
  return (
    <div className="field">
      <label className="field-label">Person photo</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <img className="preview" src={URL.createObjectURL(file)} alt="person preview" />}
    </div>
  );
}
```

- [ ] **Step 2: GarmentInput**

Create `frontend/src/components/GarmentInput.tsx`:
```tsx
import type { GarmentInputMode } from "../types";

interface Props {
  mode: GarmentInputMode;
  onModeChange: (mode: GarmentInputMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  url: string;
  onUrlChange: (url: string) => void;
}

export function GarmentInput({ mode, onModeChange, file, onFileChange, url, onUrlChange }: Props) {
  return (
    <div className="field">
      <label className="field-label">Garment</label>
      <div className="toggle">
        <button
          type="button"
          className={mode === "upload" ? "active" : ""}
          onClick={() => onModeChange("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          className={mode === "url" ? "active" : ""}
          onClick={() => onModeChange("url")}
        >
          Paste image URL
        </button>
      </div>
      {mode === "upload" ? (
        <>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {file && <img className="preview" src={URL.createObjectURL(file)} alt="garment preview" />}
        </>
      ) : (
        <>
          <input
            type="url"
            placeholder="https://.../garment.jpg"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
          {url && <img className="preview" src={url} alt="garment preview" />}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: GenerateButton**

Create `frontend/src/components/GenerateButton.tsx`:
```tsx
interface Props {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

export function GenerateButton({ disabled, loading, onClick }: Props) {
  return (
    <button className="generate" disabled={disabled || loading} onClick={onClick}>
      {loading ? "Generating…" : "Try it on"}
    </button>
  );
}
```

- [ ] **Step 4: ResultView**

Create `frontend/src/components/ResultView.tsx`:
```tsx
interface Props {
  resultUrl: string;
}

export function ResultView({ resultUrl }: Props) {
  return (
    <div className="result">
      <img className="result-image" src={resultUrl} alt="try-on result" />
      <a className="download" href={resultUrl} download target="_blank" rel="noreferrer">
        Download
      </a>
    </div>
  );
}
```

- [ ] **Step 5: SessionGallery**

Create `frontend/src/components/SessionGallery.tsx`:
```tsx
import type { TryOnResult } from "../types";

interface Props {
  results: TryOnResult[];
}

export function SessionGallery({ results }: Props) {
  if (results.length === 0) return null;
  return (
    <div className="gallery">
      <h2>This session</h2>
      <div className="gallery-grid">
        {results.map((r) => (
          <a key={r.id} href={r.resultUrl} target="_blank" rel="noreferrer">
            <img src={r.resultUrl} alt="previous result" />
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire up App.tsx**

Replace `frontend/src/App.tsx`:
```tsx
import { useState } from "react";
import "./App.css";
import { requestTryOn } from "./api";
import { GarmentInput } from "./components/GarmentInput";
import { GenerateButton } from "./components/GenerateButton";
import { PersonUploader } from "./components/PersonUploader";
import { ResultView } from "./components/ResultView";
import { SessionGallery } from "./components/SessionGallery";
import type { GarmentInputMode, TryOnResult } from "./types";

export default function App() {
  const [person, setPerson] = useState<File | null>(null);
  const [garmentMode, setGarmentMode] = useState<GarmentInputMode>("upload");
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentUrl, setGarmentUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [results, setResults] = useState<TryOnResult[]>([]);

  const hasGarment = garmentMode === "upload" ? garmentFile !== null : garmentUrl.trim() !== "";
  const canSubmit = person !== null && hasGarment;

  async function handleGenerate() {
    if (!person) return;
    setLoading(true);
    setError(null);
    try {
      const url = await requestTryOn({
        person,
        garmentFile: garmentMode === "upload" ? garmentFile : null,
        garmentUrl: garmentMode === "url" ? garmentUrl.trim() : null,
      });
      setCurrent(url);
      setResults((prev) => [
        { id: crypto.randomUUID(), resultUrl: url, createdAt: Date.now() },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <h1>ProdVton — Virtual Try-On</h1>
      <p className="subtitle">Upload a photo and a garment to see how it looks.</p>

      <div className="inputs">
        <PersonUploader file={person} onChange={setPerson} />
        <GarmentInput
          mode={garmentMode}
          onModeChange={setGarmentMode}
          file={garmentFile}
          onFileChange={setGarmentFile}
          url={garmentUrl}
          onUrlChange={setGarmentUrl}
        />
      </div>

      <GenerateButton disabled={!canSubmit} loading={loading} onClick={handleGenerate} />
      {error && <p className="error">{error}</p>}
      {current && <ResultView resultUrl={current} />}
      <SessionGallery results={results} />
    </main>
  );
}
```

- [ ] **Step 7: Minimal styling**

Replace `frontend/src/App.css`:
```css
.app { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui, sans-serif; }
h1 { margin-bottom: 0.25rem; }
.subtitle { color: #666; margin-top: 0; }
.inputs { display: grid; gap: 1.5rem; margin: 1.5rem 0; }
.field { display: grid; gap: 0.5rem; }
.field-label { font-weight: 600; }
.toggle { display: flex; gap: 0.5rem; }
.toggle button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 6px; }
.toggle button.active { background: #111; color: #fff; border-color: #111; }
.preview { max-width: 200px; max-height: 240px; object-fit: contain; border: 1px solid #eee; border-radius: 8px; }
.generate { padding: 0.75rem 1.5rem; font-size: 1rem; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.generate:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #c00; }
.result { margin-top: 1.5rem; display: grid; gap: 0.5rem; justify-items: start; }
.result-image { max-width: 100%; border-radius: 12px; }
.download { color: #06f; }
.gallery { margin-top: 2rem; }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem; }
.gallery-grid img { width: 100%; border-radius: 8px; }
```

- [ ] **Step 8: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
cd .. && git add frontend/ && git commit -m "feat: add try-on UI components"
```

---

## Task 12: README and end-to-end manual verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `ProdVton/README.md`:
```markdown
# ProdVton — Virtual Try-On MVP

Upload a person photo and a garment (file or image URL) to see the person wearing it.
Powered by the fal.ai hosted try-on API behind a swappable provider adapter.

## Prerequisites
- Python 3.13 + uv
- Node 22 + npm
- A fal.ai API key: https://fal.ai/dashboard/keys

## Backend
```bash
cd backend
cp .env.example .env   # then set FAL_KEY
uv run uvicorn app.main:app --port 8000 --reload
```

## Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api to :8000)
```

## Tests
```bash
cd backend && uv run pytest
```

## Architecture
- `backend/app/providers/` — `VTONProvider` interface + `FalVTONProvider`. Swap this to use a
  different model (including a future fine-tuned one) without touching the rest of the app.
- `backend/app/services/` — image validation/fetch and try-on orchestration.
- `frontend/src/` — React UI with an in-memory session gallery (no persistence).
```

- [ ] **Step 2: Manual end-to-end test**

With a real `FAL_KEY` in `backend/.env`, start both servers (backend on :8000, frontend on :5173).
In the browser at http://localhost:5173: upload a person photo, upload a garment (or paste an image URL), click "Try it on". Confirm a result image appears and downloads, and that it shows in the session gallery.

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: add README and setup instructions"
```

---

## Self-Review Notes

- **Spec coverage:** hosted fal.ai inference (Tasks 8–9), upload + paste-URL garment input (Tasks 3, 5, 11), FastAPI + React stack (all), core-flow-only scope with client-side session gallery (Task 11), provider adapter (Tasks 4, 8), error handling 400/422→400 surface/502 (Tasks 5, 7), tests with fake provider + mocked fal (Tasks 5, 7, 8), `.env`/`FAL_KEY` config (Tasks 1, 12). All covered.
- **Note on error codes:** the spec lists 422 for URL-fetch failures; for simplicity all `ImageError` cases (including URL fetch) surface as 400 with a descriptive message. This is a deliberate simplification — adjust the handler in `main.py` if distinct 422 handling is desired.
- **Type consistency:** `VTONProvider.try_on` signature is identical across `base.py`, `FakeProvider`, and `FalVTONProvider`. `generate_tryon` parameters match between service, tests, and the `main.py` call site. fal input keys (`human_image_url`, `garment_image_url`) and output path (`result["image"]["url"]`) match the verified fal API.
```
