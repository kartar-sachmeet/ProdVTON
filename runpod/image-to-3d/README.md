# Image-to-3D ingestion worker (TRELLIS)

The **AR ingestion step**: product photo → GLB 3D asset. Run once per product;
the resulting GLB is what the real-time AR renderer poses on the user live.
This is where the "generative middle" lives for eyewear/jewellery — never in the
live loop.

- **Model:** [microsoft/TRELLIS](https://github.com/microsoft/TRELLIS) (SOTA OSS
  single-image-to-3D). Alternatives: Hunyuan3D-2, TripoSR, InstantMesh, SF3D —
  swap in `handler._load()`.
- **Input:** background-removed product image works best.

## Deploy
```bash
docker build -t <user>/image-to-3d-worker:latest runpod/image-to-3d
docker push <user>/image-to-3d-worker:latest
```
Create a 24GB+ RunPod serverless endpoint, attach a network volume, set the
endpoint ID as `RUNPOD_IMAGE3D_ENDPOINT_ID` in `backend/.env` (reuses `RUNPOD_API_KEY`).

## Request / response
`POST https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync`
```json
{ "input": { "image": "<b64>", "simplify": 0.95, "texture_size": 1024 } }
```
→ `{ "output": { "glb": "<base64 .glb>" } }`

## Flow into the app
```
merchant product photo ─► /api/ingest-3d ─► GLB ─► store ─► three.js GLTFLoader
                          (this worker)                      (live AR render)
```
The backend `RunPodModel3DProvider` + `POST /api/ingest-3d` call this; the
frontend `loadGlbModel()` util loads the returned GLB into the eyewear/jewellery
3D stage instead of the procedural mesh.
