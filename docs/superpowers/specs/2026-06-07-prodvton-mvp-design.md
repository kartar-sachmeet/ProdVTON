# ProdVton MVP — Design Spec

**Date:** 2026-06-07
**Status:** Approved (design), pending implementation plan
**Owner:** Sachmeet

## 1. Goal

A production web app for virtual try-on. A user uploads a **person photo** and provides a
**garment** (image upload or pasted image URL), clicks generate, and sees the person wearing
that garment.

Indian-ethnic-specific (saree/kurta/lehenga) fine-tuning is explicitly **out of scope** for this
MVP. We ship the generic try-on experience first using a hosted model, and keep the model behind a
swappable adapter so our own fine-tuned model can replace it later without touching the rest of the
app.

### Non-goals (v1)
- No user accounts / authentication.
- No database or persisted history (session-only, client-side gallery).
- No Amazon (or any) product-**page** scraping. We fetch images from a direct image URL only.
- No Indian-garment fine-tuning, no multi-view / 360°, no video try-on.

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Inference backend | **Hosted VTON API** | Fastest path to a working production MVP; no GPU/MPS wrangling on M4 Pro. |
| Provider (default) | **fal.ai** | Strong DX, fast inference, commercial-use endpoints. |
| Default model | **`fal-ai/kling/v1-5/kolors-virtual-try-on`** | Commercial-use, strong quality. Swappable. |
| Garment input | **Upload + paste image URL** | Robust and legal; no product-page scraping. |
| Tech stack | **Python FastAPI backend + React (Vite + TS) frontend** | Backend in Python to share future ML/fine-tuning code. |
| MVP scope | **Core flow only** | Ship the magic moment; accounts/persistence later. |
| Persistence | **Client-side session gallery (in-memory)** | Lets users review prior tries this session, no backend storage. |

## 3. Architecture

```
React (Vite + TS) ──HTTP──▶ FastAPI backend ──▶ VTONProvider (interface)
  uploader / result UI         validate + orchestrate        └─ FalVTONProvider ──▶ fal.ai
```

- **No database, no auth.** Results returned directly; frontend keeps an in-memory session gallery.
- **Provider adapter pattern:** a `VTONProvider` interface with one `FalVTONProvider` implementation.
  All fal-specific code lives in one module so swapping providers / our own model later is isolated.

## 4. Backend (FastAPI)

### Endpoints
- `POST /api/tryon` — multipart form:
  - `person`: image file (required)
  - `garment`: image file (optional)
  - `garment_url`: string (optional)
  - Exactly one of `garment` / `garment_url` must be provided.
  - Returns: `{ "result_url": "<fal-hosted image url>" }`
- `GET /api/health` — readiness check: `{ "status": "ok" }`

### Modules (each small, single-purpose)
- `app/config.py` — settings via env: `FAL_KEY`, `MAX_IMAGE_BYTES` (default 10 MB),
  `ALLOWED_IMAGE_TYPES` (jpg/png/webp), `FAL_MODEL` (default kling kolors v1.5), CORS origins.
- `app/schemas.py` — Pydantic request/response models.
- `app/services/images.py` — validate file type/size; for `garment_url`, fetch the image
  server-side and verify it is a real image (content-type + magic-byte sniff). No HTML/page parsing.
- `app/providers/base.py` — `VTONProvider` Protocol: `async def try_on(person_bytes, garment_bytes) -> str` (returns result URL).
- `app/providers/fal_provider.py` — `FalVTONProvider`: upload both images to fal storage,
  invoke the configured try-on model, return result URL.
- `app/services/tryon.py` — orchestration: validation → provider call → response.
- `app/main.py` — FastAPI app, routes, CORS, dependency wiring (provider injected so it can be faked in tests).

## 5. Data Flow

1. User selects person photo + garment (upload or paste image URL) in the UI.
2. Frontend POSTs multipart to `/api/tryon`.
3. Backend validates inputs; if `garment_url` given, fetches + validates the image bytes.
4. Backend uploads person + garment to fal storage, invokes the try-on model, awaits result.
5. Backend returns the fal-hosted `result_url`.
6. Frontend renders before/after with a **download** button and appends to the session gallery.

## 6. Error Handling

| Condition | HTTP | UI behavior |
|---|---|---|
| Missing/invalid inputs (no person, both/neither garment fields, bad type/size) | `400` | Inline field error message |
| `garment_url` fetch fails or is not an image | `422` | "Couldn't load that image URL" |
| Provider error / timeout | `502` | Friendly "Generation failed, try again" + retry |

Limits: configurable max size (default 10 MB); allowed types jpg/png/webp.

## 7. Frontend (React + Vite + TS)

Single page. Components:
- `PersonUploader` — drag/drop or file picker, preview.
- `GarmentInput` — toggle between upload and paste-URL, preview.
- `GenerateButton` — disabled until valid; loading state during request.
- `ResultView` — before/after display + download button.
- `SessionGallery` — in-memory list of this session's results.
- `api.ts` — thin typed client for `/api/tryon`.

Styling: clean, polished production look (not a demo aesthetic).

## 8. Testing

- **Backend (pytest):**
  - `services/images.py` — type/size validation, URL fetch + image verification (mock HTTP).
  - `POST /api/tryon` — endpoint behavior with a **fake `VTONProvider`** injected (no real fal calls):
    success, missing person, both/neither garment fields, oversized file, bad type.
  - `FalVTONProvider` — against a mocked fal client (upload + invoke called correctly; result URL returned).
- **Frontend (Vitest):** light tests of form states (idle / loading / error / result). Mostly manual for MVP.

## 9. Project Structure

```
ProdVton/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── schemas.py
│   │   ├── providers/{base.py, fal_provider.py}
│   │   └── services/{images.py, tryon.py}
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── components/{PersonUploader,GarmentInput,GenerateButton,ResultView,SessionGallery}.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 10. Configuration & Secrets

- `FAL_KEY` — fal.ai API key, read from environment (never committed). `.env.example` documents it.
- Local dev: backend on `:8000`, frontend on `:5173`, CORS allows the dev frontend origin.

## 11. Future (explicitly deferred)

- Replace `FalVTONProvider` with our own fine-tuned Indian-ethnic model (same `VTONProvider` interface).
- Accounts + persisted history; shareable result links.
- Amazon/product-page link parsing (via a paid product-data API, not scraping).
- Multi-view / 360° (e.g. JCo-MVTON) premium tier.
