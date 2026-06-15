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
| **Eyewear** | **3D AR** (three.js + head pose + occluder) + product→3D ingest | Works in-browser; placement constants need on-camera tuning |

### Just removed (this session)
The crude **2D canvas renditions** were deleted: 2D eyewear (superseded by 3D),
the procedural live makeup AR, and the 2D jewellery — plus the now-dead 2D AR core
(`frontend/src/ar/`). Consequences:
- **Makeup** is now generative-only (the real-time AR makeup was procedural/crude).
- **Jewellery tab was removed** — no rendition remains until it's rebuilt.

### Rebuild backlog (AR done properly)
- **Jewellery (3D):** earrings via `ar3d/` (head pose + occluder), necklace needs
  **MediaPipe Pose Landmarker** (neck/shoulders). Then re-add the Jewellery tab.
- **Makeup (real-time AR, the true SOTA):** MediaPipe face mesh + **face-parsing
  masks (BiSeNet)** + PBR finish shaders — keep generative as the high-fidelity mode.
- **Eyewear:** tune `ArStage3D` placement constants on a live camera; consider
  Jeeliz for turnkey PBR.
- See `docs/research/ar-tryon-oss.md` for the OSS approach + model picks.

---

## Deploy RunPod (the priority)

Three deploy-ready workers in `runpod/` (each has its own README):

| Worker | Dir | Purpose | GPU | Key prereqs |
|---|---|---|---|---|
| **CatVTON-FLUX** | `runpod/catvton-flux/` | clothing try-on | 24GB+ | `HF_TOKEN` (accept FLUX.1-Fill-dev license); optional auto-mask (DensePose/SCHP) |
| **Stable-Makeup** | `runpod/stable-makeup/` | makeup transfer | 16GB+ | Stable-Makeup checkpoints on volume |
| **TRELLIS** | `runpod/image-to-3d/` | product photo → GLB | 24GB+ | builds TRELLIS from source |

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
