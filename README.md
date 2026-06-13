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

## Two modes
- **Photo** — upload a person photo + a garment; one-shot try-on via fal Kling Kolors.
- **Live camera** — real-time try-on over your webcam via Decart **Lucy2 VTON Realtime**
  (`decart/lucy2-vton/realtime`) over WebRTC. Pick a garment (image upload or URL) and/or
  type a prompt, hit **Start**, and the transformed feed streams back at ~30fps.
  Billed by fal at **$0.02/sec** while streaming — the UI shows a live cost indicator.

## How it works
- `POST /api/tryon` — multipart: `person` (file, required) plus **exactly one** of `garment`
  (file) or `garment_url` (a direct image URL). Returns `{ "result_url": "..." }`.
- `GET /api/health` — readiness check.
- `/api/fal/proxy` — server-side proxy for the browser fal SDK (a faithful
  `@fal-ai/server-proxy` reimplementation). The realtime SDK fetches its short-lived JWT
  tokens and uploads garment images through this route, so `FAL_KEY` never reaches the
  browser. A fal-host allowlist prevents the proxy from relaying to arbitrary destinations.

## Architecture
- `backend/app/providers/` — `VTONProvider` interface + `FalVTONProvider`. Swap this to use a
  different model (including a future fine-tuned one) without touching the rest of the app.
- `backend/app/services/` — image validation/fetch (with SSRF + size guards), try-on
  orchestration, and the fal SDK proxy (`fal_proxy.py`).
- `frontend/src/` — React UI. `components/PhotoTryOn.tsx` (one-shot) and `components/LiveTryOn.tsx`
  (webcam). `hooks/useLucyRealtime.ts` owns the WebRTC negotiation; `lib/fal.ts` points the SDK at
  the proxy. In-memory session gallery only (no persistence).

> Note: if port 8000 is taken, run the backend on another port (e.g. `--port 8001`) and update
> the `/api` proxy target in `frontend/vite.config.ts` to match.

## Notes
- No accounts or database — results are session-only by design (MVP scope).
- The garment URL path fetches a **direct image URL** only; it does not scrape product pages.
- Indian-ethnic-wear fine-tuning, multi-view/360°, and persistence are deferred (see
  `docs/superpowers/specs/2026-06-07-prodvton-mvp-design.md`).
