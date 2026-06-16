"""RunPod serverless worker for CatVTON-FLUX virtual try-on.

Mirrors nftblackmagic/catvton-flux + Zheng-Chong/CatVTON: FLUX.1-dev base with
the catvton-flux transformer, run as inpainting over a side-by-side
[garment | masked-person] canvas; the right half is the dressed person.

Self-contained masking: if the caller doesn't supply a mask, we auto-generate a
clothing-agnostic one with CatVTON's AutoMasker (DensePose + SCHP), whose
checkpoints are pulled once from the `zhengchong/CatVTON` HF repo.

Request input (job["input"]):
  person_image:  base64 PNG/JPEG of the person (required)
  garment_image: base64 PNG/JPEG of the garment (required)
  mask_image:    base64 grayscale mask (optional; auto-generated when omitted)
  category:      "upper" | "lower" | "overall"  (default "upper")
  steps:         int diffusion steps (default 30)
  guidance:      float guidance scale (default 30)
  seed:          int (optional)

Response: { "image": "<base64 PNG of the try-on result>" }

Prereqs (see Dockerfile/README): HF access to black-forest-labs/FLUX.1-dev
(gated; set HF_TOKEN). The CatVTON repo is on PYTHONPATH for AutoMasker.
"""

from __future__ import annotations

import base64
import io
import os

import runpod
import torch

# Build stamp printed BEFORE the diffusers import — so even if that import crashes,
# the logs show which build is actually running (settles "did it deploy?").
print(f"[catvton] BUILD=torch251 booting; torch={torch.__version__}", flush=True)

from diffusers import FluxFillPipeline, FluxTransformer2DModel
from PIL import Image, ImageFilter

WIDTH, HEIGHT = 576, 768
FLUX_BASE = os.environ.get("FLUX_BASE_MODEL", "black-forest-labs/FLUX.1-dev")
CATVTON_TRANSFORMER = os.environ.get("CATVTON_TRANSFORMER", "xiaozaa/catvton-flux-alpha")
CATVTON_REPO = os.environ.get("CATVTON_REPO", "zhengchong/CatVTON")
PROMPT = (
    "The pair of images highlights a clothing and its styling on a model, "
    "[IMAGE1] Detailed product shot of a clothing; "
    "[IMAGE2] The same clothing is worn by a model in a lifestyle setting."
)

_pipe: FluxFillPipeline | None = None
_automasker = None


def log(msg: str) -> None:
    print(f"[catvton] {msg}", flush=True)


def _load_pipeline() -> FluxFillPipeline:
    global _pipe
    if _pipe is None:
        log(f"loading transformer {CATVTON_TRANSFORMER} …")
        transformer = FluxTransformer2DModel.from_pretrained(
            CATVTON_TRANSFORMER, torch_dtype=torch.bfloat16
        )
        log(f"loading FluxFillPipeline base {FLUX_BASE} …")
        pipe = FluxFillPipeline.from_pretrained(
            FLUX_BASE, transformer=transformer, torch_dtype=torch.bfloat16
        )
        pipe.to("cuda")
        pipe.enable_model_cpu_offload()  # fit ~24GB; drop if you have headroom
        _pipe = pipe
        log("pipeline ready ✓")
    return _pipe


def _get_automasker():
    """CatVTON AutoMasker (DensePose + SCHP); checkpoints auto-pulled from HF."""
    global _automasker
    if _automasker is None:
        from huggingface_hub import snapshot_download
        from model.cloth_masker import AutoMasker  # CatVTON repo on PYTHONPATH

        log(f"downloading masker checkpoints from {CATVTON_REPO} …")
        repo = snapshot_download(repo_id=CATVTON_REPO)
        _automasker = AutoMasker(
            densepose_ckpt=os.path.join(repo, "DensePose"),
            schp_ckpt=os.path.join(repo, "SCHP"),
            device="cuda",
        )
        log("automasker ready ✓")
    return _automasker


def _decode(b64: str) -> Image.Image:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def _encode(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _build_mask(person: Image.Image, category: str, supplied: str | None) -> Image.Image:
    if supplied:
        return _decode(supplied).convert("L").resize((WIDTH, HEIGHT))
    mask = _get_automasker()(person.resize((WIDTH, HEIGHT)), category)["mask"]
    return mask.convert("L").filter(ImageFilter.GaussianBlur(4))  # soften edges


def run_tryon(job_input: dict) -> dict:
    log("job received; decoding inputs")
    person = _decode(job_input["person_image"]).resize((WIDTH, HEIGHT))
    garment = _decode(job_input["garment_image"]).resize((WIDTH, HEIGHT))
    log("building agnostic mask")
    mask = _build_mask(person, job_input.get("category", "upper"), job_input.get("mask_image"))

    canvas = Image.new("RGB", (WIDTH * 2, HEIGHT))
    canvas.paste(garment, (0, 0))
    canvas.paste(person, (WIDTH, 0))
    full_mask = Image.new("L", (WIDTH * 2, HEIGHT), 0)
    full_mask.paste(mask, (WIDTH, 0))

    seed = job_input.get("seed")
    generator = torch.Generator("cuda").manual_seed(int(seed)) if seed is not None else None

    pipe = _load_pipeline()
    log("running diffusion")
    result = pipe(
        prompt=PROMPT,
        image=canvas,
        mask_image=full_mask,
        height=HEIGHT,
        width=WIDTH * 2,
        num_inference_steps=int(job_input.get("steps", 30)),
        guidance_scale=float(job_input.get("guidance", 30)),
        max_sequence_length=512,
        generator=generator,
    ).images[0]
    log("done ✓")
    return {"image": _encode(result.crop((WIDTH, 0, WIDTH * 2, HEIGHT)))}


def handler(job):
    try:
        return run_tryon(job["input"])
    except Exception as exc:
        import traceback

        log(f"ERROR: {type(exc).__name__}: {exc}\n{traceback.format_exc()}")
        return {"error": f"{type(exc).__name__}: {exc}"}


log("handler module imported ✓ (torch/diffusers OK) build=flashfix3")


runpod.serverless.start({"handler": handler})
