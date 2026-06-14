"""RunPod serverless worker for Stable-Makeup (generative makeup transfer).

High-fidelity, NON-real-time makeup: given a source face and a reference makeup
image, render the source wearing that makeup. Complements the live AR makeup
(which is real-time but shade/shader based). Stable-Makeup (SIGGRAPH 2025) is a
diffusion model — seconds per image on a GPU.

Request input (job["input"]):
  source_image:    base64 of the face to make up (required)
  reference_image: base64 of the makeup look to transfer (required)
  intensity:       float 0..2 makeup strength (default 1.0)
  steps:           int diffusion steps (default 30)
  seed:            int (optional)

Response: { "image": "<base64 PNG>" }

Prerequisites baked into the image (see README + Dockerfile):
  - The Stable-Makeup repo (Xiaojiu-z/Stable-Makeup) on PYTHONPATH
  - SD1.5 base + Stable-Makeup checkpoints (detail encoder, makeup modules) and
    the SPIGA/face landmark model, mounted on the network volume.
"""

from __future__ import annotations

import base64
import io
import os

import runpod
import torch
from PIL import Image

_pipeline = None


def _load():
    """Load the Stable-Makeup pipeline once per cold start.

    Mirrors the reference inference in the Stable-Makeup repo: SD1.5 UNet +
    the makeup detail encoder + the makeup cross-attention modules, with a
    face-landmark guide. Checkpoint paths come from env (network volume).
    """
    global _pipeline
    if _pipeline is None:
        from pipeline_sd15 import StableMakeupPipeline  # provided by the repo on PYTHONPATH

        _pipeline = StableMakeupPipeline.from_pretrained(
            base_model=os.environ.get("SD15_MODEL", "runwayml/stable-diffusion-v1-5"),
            makeup_encoder_ckpt=os.environ["MAKEUP_ENCODER_CKPT"],
            id_encoder_ckpt=os.environ["ID_ENCODER_CKPT"],
            makeup_unet_ckpt=os.environ["MAKEUP_UNET_CKPT"],
            torch_dtype=torch.float16,
        ).to("cuda")
    return _pipeline


def _decode(b64: str) -> Image.Image:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def _encode(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def run_makeup(job_input: dict) -> dict:
    source = _decode(job_input["source_image"]).resize((512, 512))
    reference = _decode(job_input["reference_image"]).resize((512, 512))
    seed = job_input.get("seed")
    generator = torch.Generator("cuda").manual_seed(int(seed)) if seed is not None else None

    pipe = _load()
    result = pipe(
        id_image=source,
        makeup_image=reference,
        num_inference_steps=int(job_input.get("steps", 30)),
        makeup_guidance_scale=float(job_input.get("intensity", 1.0)) * 1.6,
        generator=generator,
    ).images[0]
    return {"image": _encode(result)}


def handler(job):
    try:
        return run_makeup(job["input"])
    except Exception as exc:  # surface a clean error
        return {"error": f"{type(exc).__name__}: {exc}"}


runpod.serverless.start({"handler": handler})
