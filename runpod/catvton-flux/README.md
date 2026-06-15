# CatVTON-FLUX — RunPod serverless worker

Generative SOTA **clothing** try-on (FLUX.1-dev + catvton-flux transformer). The
clothing track; makeup/eyewear use their own workers.

## What it does
Inpaints a `[garment | masked-person]` canvas and returns the dressed person.
**Masking is self-contained:** if you don't pass `mask_image`, the worker
auto-generates a clothing-agnostic mask with CatVTON's AutoMasker (DensePose +
SCHP), whose checkpoints are pulled once from `zhengchong/CatVTON`.

## Deploy
1. Accept the FLUX license for `black-forest-labs/FLUX.1-dev` on Hugging Face; make an HF token.
2. Build & push:
   ```bash
   docker build -t <user>/catvton-flux-worker:latest runpod/catvton-flux
   docker push <user>/catvton-flux-worker:latest
   ```
3. RunPod Serverless endpoint: 24GB+ GPU, attach a **network volume** (`/runpod-volume`),
   set secret `HF_TOKEN`. First cold start downloads FLUX + transformer + masker ckpts (slow).
4. Put the **Endpoint ID** + **RunPod API key** in `backend/.env`
   (`RUNPOD_ENDPOINT_ID`, `RUNPOD_API_KEY`), set `VTON_PROVIDER=runpod`.

## Request / response
`POST https://api.runpod.ai/v2/<ID>/runsync`
```json
{ "input": { "person_image": "<b64>", "garment_image": "<b64>", "category": "upper", "steps": 30 } }
```
→ `{ "output": { "image": "<base64 PNG>" } }`

## Fine-tuning (IndoFashion)
Train a catvton-flux LoRA/transformer on saree/Indian-wear pairs and point
`CATVTON_TRANSFORMER` at it — no app changes.

## Notes
- Pin the CatVTON repo to a commit when you deploy (AutoMasker API stability).
- detectron2 builds against the image's CUDA/torch — keep the base image versions in sync.
