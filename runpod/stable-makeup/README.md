# Stable-Makeup — RunPod serverless worker

Generative **high-fidelity makeup transfer** (SIGGRAPH 2025 diffusion model). This
is the *quality, non-real-time* makeup mode; the live AR Makeup tab stays the
real-time option. Source face + reference makeup look → source wearing it.

## Deploy
1. Build & push:
   ```bash
   docker build -t <user>/stable-makeup-worker:latest runpod/stable-makeup
   docker push <user>/stable-makeup-worker:latest
   ```
2. Create a RunPod Serverless endpoint (16GB+ GPU), attach a network volume.
3. Put the Stable-Makeup checkpoints on the volume and set endpoint env:
   `MAKEUP_ENCODER_CKPT`, `ID_ENCODER_CKPT`, `MAKEUP_UNET_CKPT` (+ `HF_TOKEN` for SD1.5 if needed).
4. Note the **Endpoint ID** → `backend/.env` as `RUNPOD_MAKEUP_ENDPOINT_ID`
   (reuses `RUNPOD_API_KEY`). The `/api/makeup` route calls it.

## Request / response
`POST https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync`
```json
{ "input": { "source_image": "<b64>", "reference_image": "<b64>", "intensity": 1.0, "steps": 30 } }
```
→ `{ "output": { "image": "<base64 PNG>" } }`

## Note
The handler targets the Stable-Makeup repo's pipeline (`pipeline_sd15`). Exact
class/arg names track that repo — pin a commit when you deploy and adjust
`_load()` / `run_makeup()` if upstream changes its API.
