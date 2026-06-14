"""RunPod serverless worker: product image -> 3D asset (GLB).

The ingestion step for the AR track. A merchant uploads a product photo of
glasses / an earring / a pendant; this reconstructs a 3D mesh (GLB) that the
real-time AR renderer (three.js) then poses on the user live. Runs once per
product, offline — NOT in the live loop.

Uses TRELLIS (microsoft/TRELLIS), SOTA open image-to-3D. Swap to Hunyuan3D-2 or
TripoSR by changing _load()/run.

Request input (job["input"]):
  image:        base64 product photo (required; clean/background-removed is best)
  simplify:     float 0..1 mesh simplification (default 0.95)
  texture_size: int (default 1024)
  seed:         int (optional)

Response: { "glb": "<base64 .glb>" }
"""

from __future__ import annotations

import base64
import io
import os

import runpod
from PIL import Image

_pipeline = None


def _load():
    global _pipeline
    if _pipeline is None:
        from trellis.pipelines import TrellisImageTo3DPipeline

        _pipeline = TrellisImageTo3DPipeline.from_pretrained(
            os.environ.get("TRELLIS_MODEL", "microsoft/TRELLIS-image-large")
        )
        _pipeline.cuda()
    return _pipeline


def _decode(b64: str) -> Image.Image:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def run_ingest(job_input: dict) -> dict:
    from trellis.utils import postprocessing_utils

    image = _decode(job_input["image"])
    pipe = _load()
    outputs = pipe.run(
        image,
        seed=int(job_input.get("seed", 1)),
    )
    glb = postprocessing_utils.to_glb(
        outputs["gaussian"][0],
        outputs["mesh"][0],
        simplify=float(job_input.get("simplify", 0.95)),
        texture_size=int(job_input.get("texture_size", 1024)),
    )
    buf = io.BytesIO()
    glb.export(buf, file_type="glb")
    return {"glb": base64.b64encode(buf.getvalue()).decode()}


def handler(job):
    try:
        return run_ingest(job["input"])
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


runpod.serverless.start({"handler": handler})
