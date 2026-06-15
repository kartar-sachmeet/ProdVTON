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
3. Put the Stable-Makeup checkpoints on the network volume under `MODELS_DIR`
   (default `/runpod-volume/Stable-Makeup/models`), matching the repo layout:
   ```
   stablemakeup/pytorch_model.bin     # makeup encoder
   stablemakeup/pytorch_model_1.bin   # id controlnet
   stablemakeup/pytorch_model_2.bin   # pose controlnet
   image_encoder_l/                   # CLIP image encoder
   mobilenet0.25_Final.pth            # face detector (SPIGA)
   ```
   (Download links are in the Stable-Makeup repo README.) Set `HF_TOKEN` if the SD1.5 base is gated.
4. Note the **Endpoint ID** → `backend/.env` as `RUNPOD_MAKEUP_ENDPOINT_ID`
   (reuses `RUNPOD_API_KEY`). The `/api/makeup` route calls it.

## Request / response
`POST https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync`
```json
{ "input": { "source_image": "<b64>", "reference_image": "<b64>", "intensity": 1.0, "steps": 30 } }
```
→ `{ "output": { "image": "<base64 PNG>" } }`

## Note
`handler.py` mirrors the repo's `infer_kps.py` (assembled UNet + id/pose
ControlNets + `detail_encoder`, with SPIGA `get_draw` for the structural guide,
then `makeup_encoder.generate(...)`). **Pin the repo to a commit** when you deploy
and re-check the import paths (`detail_encoder.encoder_plus`, `pipeline_sd15`,
`spiga_draw`) against that commit.
