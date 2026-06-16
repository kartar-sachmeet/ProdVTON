# CatVTON-FLUX RunPod serverless worker.
# Built by RunPod from GitHub: build context = REPO ROOT, so COPY paths are
# repo-root-relative. Local build: docker build -f runpod/catvton-flux/Dockerfile -t <tag> .
# Endpoint GPU: 24GB+ (A100 / L40S / 4090).
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/runpod-volume/hf \
    DIFFUSERS_CACHE=/runpod-volume/hf \
    FORCE_CUDA=1 \
    TORCH_CUDA_ARCH_LIST="7.0;7.5;8.0;8.6;8.9;9.0"

WORKDIR /app

COPY runpod/catvton-flux/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Base image ships incompatible extras that crash diffusers' import chain:
#  - torchaudio (cu124 vs torch cu121) → CUDA-version check crash via transformers
#  - flash-attn v3 → torch.library.infer_schema chokes on its op signature when
#    diffusers imports FluxFill
# We need neither (diffusers falls back to PyTorch SDPA attention). Remove both.
RUN pip uninstall -y torchaudio flash-attn flash_attn || true

# CatVTON repo (provides model.cloth_masker.AutoMasker) + DensePose via detectron2.
# AutoMasker checkpoints (DensePose/SCHP) are auto-pulled from the zhengchong/CatVTON
# HF repo at runtime, cached on the network volume. FORCE_CUDA + arch list let
# detectron2's CUDA ops compile without a GPU present (RunPod's builder has none).
RUN git clone https://github.com/Zheng-Chong/CatVTON /app/CatVTON
ENV PYTHONPATH=/app/CatVTON:$PYTHONPATH
RUN pip install --no-cache-dir 'git+https://github.com/facebookresearch/detectron2.git'

COPY runpod/catvton-flux/handler.py .

# Weights download on first cold start (cached on the volume). FLUX.1-dev is gated —
# set HF_TOKEN as a secret on the endpoint.
CMD ["python", "-u", "handler.py"]
