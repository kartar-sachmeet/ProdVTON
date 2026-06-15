# ProdVton — Handoff (for the next session)

A multi-vertical virtual try-on app. **Two-track strategy:** real-time **AR** where
it's the production SOTA (accessories/makeup), **generative diffusion** where AR
can't compete (clothing). Self-hosted generative runs on **RunPod serverless**.

> The main goal next session is to **deploy the three RunPod workers and switch the
> app onto them**. Everything app-side is built and waiting on endpoints + keys.

---

## Current state (branch `main`)

| Tab | Technique | Status |
|---|---|---|
| **Photo** (clothing) | Generative diffusion | Works on **fal Kling** today; flip to self-hosted **CatVTON-FLUX** with `VTON_PROVIDER=runpod` |
| **Live camera** | fal Lucy2 VTON realtime | Blocked — account lacks realtime entitlement (see Gotchas) |
| **Makeup** | Generative (Stable-Makeup) | UI built; needs the makeup RunPod endpoint |
| **Eyewear** | **3D AR** — product photo → 3D (TRELLIS) → posed live | needs image-to-3D endpoint; GLB orientation needs tuning |
| **Jewellery** | **3D AR** — product photo → 3D → earrings (pair) / necklace | needs image-to-3D endpoint; placement constants need tuning |

### Design (this session)
The crude 2D canvas renditions and procedural 3D frames were removed. Accessories
are now **product-photo → 3D (ingestion) → live AR pose** — no fake built-in assets.
Makeup is generative-only for now.

### Rebuild backlog (AR done properly)
- **Necklace:** chin-anchored today; true neck/shoulder draping wants **MediaPipe
  Pose Landmarker**.
- **Makeup (real-time AR, the true SOTA):** MediaPipe face mesh + **face-parsing
  masks (BiSeNet)** + PBR finish shaders — keep generative as the high-fidelity mode.
- **Eyewear/jewellery:** tune placement + ingested-GLB orientation on a live camera.
- See `docs/research/ar-tryon-oss.md` for the OSS approach + model picks.

---

## Deploy RunPod (the priority)

Three deploy-ready workers in `runpod/` (each has its own README):

| Worker | Dir | Purpose | GPU | Key prereqs |
|---|---|---|---|---|
| **CatVTON-FLUX** | `runpod/catvton-flux/` | clothing try-on | 24GB+ | `HF_TOKEN` (accept **FLUX.1-dev** license). Auto-masking is **built in** (AutoMasker ckpts auto-pulled from `zhengchong/CatVTON`). |
| **Stable-Makeup** | `runpod/stable-makeup/` | makeup transfer | 16GB+ | Stable-Makeup checkpoints under `MODELS_DIR` (layout in its README) |
| **TRELLIS** | `runpod/image-to-3d/` | product photo → GLB | 24GB+ | builds TRELLIS from source |

> **Gaps closed this session:** CatVTON now self-masks (no backend mask needed; base is
> FLUX.1-dev). Stable-Makeup handler rewritten to match the repo's `infer_kps.py`.
> Remaining per-worker risks are just **pin-a-commit + checkpoint download + first-deploy
> verification** (and ingested-GLB orientation tuning).

Per worker:
1. `docker build -t <user>/<name>:latest runpod/<name> && docker push …`
2. Create a RunPod **Serverless endpoint** from the image; attach a **network volume**
   (mounted `/runpod-volume`) so weights persist across cold starts; set secrets/env.
3. Keep ≥1 active worker warm during demos (cold-start weight load is slow).
4. Copy the **Endpoint ID**.

Then set `backend/.env` (see `backend/.env.example`):
```
VTON_PROVIDER=runpod                 # switches clothing to CatVTON-FLUX
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID=...                # CatVTON-FLUX (clothing)
RUNPOD_CATEGORY=upper                 # upper | lower | overall
RUNPOD_MAKEUP_ENDPOINT_ID=...         # Stable-Makeup
RUNPOD_IMAGE3D_ENDPOINT_ID=...        # TRELLIS
```
Backend routes that consume them: `POST /api/tryon` (provider-selected),
`POST /api/makeup`, `POST /api/ingest-3d` (returns a binary GLB).

### Verify an endpoint quickly
```bash
curl -s -X POST https://api.runpod.ai/v2/<ID>/runsync \
  -H "Authorization: Bearer <RUNPOD_API_KEY>" \
  -H "content-type: application/json" \
  -d '{"input":{...}}'
```

---

## Run locally
```bash
# backend (port 8000 is taken by the user's "Vimarsha" project → use 8001)
cd backend && uv run uvicorn app.main:app --port 8001
# frontend (Vite proxies /api → :8001; see frontend/vite.config.ts)
cd frontend && npm run dev          # http://localhost:5173
```
- `backend/.env` holds the working **fal key** (gitignored — do not commit/echo it).
- Backend tests: `cd backend && uv run pytest` (47 passing).
- Provider abstraction: `backend/app/providers/` — `VTONProvider` protocol with
  `FalVTONProvider` / `RunPodVTONProvider`; `RunPodMakeupProvider`,
  `RunPodModel3DProvider`; shared `runpod_client.run_job` (submit + poll).

---

## Gotchas
- **fal realtime (Live tab) is gated:** the key mints tokens + runs queue inference,
  but the realtime WebSocket returns `Forbidden` (account lacks realtime entitlement,
  confirmed against a public model too). Needs billing/realtime access on fal, or a
  different key. Code is correct.
- **Eyewear 3D placement** uses landmark-derived roll/yaw/pitch with reasonable
  defaults — needs on-camera tuning (constants in `frontend/src/ar3d/ArStage3D.tsx`).
- **Background bg shells + zsh `noclobber`:** don't `>` an existing log file (fails);
  use a fresh log filename when starting servers in the background.
- **Branches:** `main` is canonical (full suite). Feature branches still exist
  (`makeup`, `eyewear`, `jewellery`, `combined`, `vton-suite`, `generative-sota`,
  `ar-3d`) and can be deleted.

## Next-session checklist
1. Deploy the 3 RunPod workers (clothing first) + set `.env`.
2. `VTON_PROVIDER=runpod`; verify `/api/tryon`, `/api/makeup`, `/api/ingest-3d`.
3. Tune eyewear 3D on camera; wire ingested GLBs in (already supported via
   `ar3d/ingest3d.ts` + `ArStage3D` `glbUrl`).
4. Rebuild jewellery (3D earrings + Pose necklace) and real-time AR makeup.
5. (Stretch) Fine-tune CatVTON-FLUX LoRA on Indian wear (IndoFashion).
