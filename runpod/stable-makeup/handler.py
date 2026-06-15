"""RunPod serverless worker for Stable-Makeup (generative makeup transfer).

High-fidelity, NON-real-time makeup: source face + reference makeup look ->
source wearing it. Complements the live (future) AR makeup.

This mirrors Xiaojiu-z/Stable-Makeup `infer_kps.py`: SD1.5 UNet + two ControlNets
(id + pose) + a makeup detail-encoder, with SPIGA drawing the structural/pose
guide from the source face. It is assembled from modules — not a single
`from_pretrained` — so the Stable-Makeup repo must be on PYTHONPATH and its
checkpoints present under MODELS_DIR.

Request input (job["input"]):
  source_image:    base64 of the face to make up (required)
  reference_image: base64 of the makeup look (required)
  intensity:       float makeup strength → guidance_scale (default 1.6)
  seed:            int (optional)

Response: { "image": "<base64 PNG>" }

MODELS_DIR layout (download from the repo's release; see README):
  $MODELS_DIR/stablemakeup/pytorch_model.bin     (makeup encoder)
  $MODELS_DIR/stablemakeup/pytorch_model_1.bin   (id controlnet)
  $MODELS_DIR/stablemakeup/pytorch_model_2.bin   (pose controlnet)
  $MODELS_DIR/image_encoder_l/                   (CLIP image encoder)
  $MODELS_DIR/mobilenet0.25_Final.pth            (face detector for SPIGA)
"""

from __future__ import annotations

import base64
import io
import os

import runpod
import torch
from PIL import Image

SD15_MODEL = os.environ.get("SD15_MODEL", "runwayml/stable-diffusion-v1-5")
MODELS_DIR = os.environ.get("MODELS_DIR", "/runpod-volume/Stable-Makeup/models")

_state = None  # (pipe, makeup_encoder, get_draw)


def _load():
    """Assemble the Stable-Makeup pipeline once per cold start (per infer_kps.py)."""
    global _state
    if _state is None:
        from diffusers import ControlNetModel, DDIMScheduler, UNet2DConditionModel

        # Repo-provided modules (Stable-Makeup on PYTHONPATH):
        from detail_encoder.encoder_plus import detail_encoder
        from pipeline_sd15 import StableDiffusionControlNetPipeline
        from spiga_draw import get_draw  # SPIGA structural/pose guide

        unet = UNet2DConditionModel.from_pretrained(SD15_MODEL, subfolder="unet").to(
            "cuda", dtype=torch.float32
        )
        id_encoder = ControlNetModel.from_unet(unet)
        pose_encoder = ControlNetModel.from_unet(unet)
        makeup_encoder = detail_encoder(
            unet, os.path.join(MODELS_DIR, "image_encoder_l"), "cuda", dtype=torch.float32
        )

        ckpt = os.path.join(MODELS_DIR, "stablemakeup")
        makeup_encoder.load_state_dict(torch.load(os.path.join(ckpt, "pytorch_model.bin")), strict=False)
        id_encoder.load_state_dict(torch.load(os.path.join(ckpt, "pytorch_model_1.bin")), strict=False)
        pose_encoder.load_state_dict(torch.load(os.path.join(ckpt, "pytorch_model_2.bin")), strict=False)
        id_encoder.to("cuda")
        pose_encoder.to("cuda")
        makeup_encoder.to("cuda")

        pipe = StableDiffusionControlNetPipeline.from_pretrained(
            SD15_MODEL,
            safety_checker=None,
            unet=unet,
            controlnet=[id_encoder, pose_encoder],
            torch_dtype=torch.float32,
        )
        pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
        pipe = pipe.to("cuda")
        _state = (pipe, makeup_encoder, get_draw)
    return _state


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

    pipe, makeup_encoder, get_draw = _load()
    pose_image = get_draw(source, size=512)  # SPIGA structural guide
    result = makeup_encoder.generate(
        id_image=[source, pose_image],
        makeup_image=reference,
        pipe=pipe,
        guidance_scale=float(job_input.get("intensity", 1.6)),
    )
    if isinstance(result, list):
        result = result[0]
    return {"image": _encode(result)}


def handler(job):
    try:
        return run_makeup(job["input"])
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


runpod.serverless.start({"handler": handler})
