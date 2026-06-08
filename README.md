# ProdVton — Virtual Try-On MVP

Upload a person photo and a garment (file or image URL) to see the person wearing it.
Powered by the fal.ai hosted try-on API behind a swappable provider adapter.

## Prerequisites
- Python 3.13 + [uv](https://docs.astral.sh/uv/)
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

## How it works
- `POST /api/tryon` — multipart: `person` (file, required) plus **exactly one** of `garment`
  (file) or `garment_url` (a direct image URL). Returns `{ "result_url": "..." }`.
- `GET /api/health` — readiness check.

## Architecture
- `backend/app/providers/` — `VTONProvider` interface + `FalVTONProvider`. Swap this to use a
  different model (including a future fine-tuned one) without touching the rest of the app.
- `backend/app/services/` — image validation/fetch (with SSRF + size guards) and try-on
  orchestration.
- `frontend/src/` — React UI with an in-memory session gallery (no persistence).

## Notes
- No accounts or database — results are session-only by design (MVP scope).
- The garment URL path fetches a **direct image URL** only; it does not scrape product pages.
- Indian-ethnic-wear fine-tuning, multi-view/360°, and persistence are deferred (see
  `docs/superpowers/specs/2026-06-07-prodvton-mvp-design.md`).
