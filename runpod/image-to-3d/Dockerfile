# Image-to-3D ingestion worker (TRELLIS) for RunPod serverless.
# Built by RunPod from GitHub: build context = REPO ROOT (COPY paths repo-relative).
# Local build: docker build -f runpod/image-to-3d/Dockerfile -t <tag> .
#
# ⚠️ TRELLIS's CUDA extensions (kaolin/nvdiffrast/diff-gaussian-rasterization) often
# need a GPU at build time. RunPod's GitHub builder has NO GPU — this image may fail
# to build there. If so, build it on a RunPod GPU Pod (or any x86 GPU box) and push to
# a registry, then point the endpoint at that image. Do clothing + makeup first.
# Endpoint GPU: 24GB+ (A100/L40S). Asset generation is offline/per-product.
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/runpod-volume/hf \
    ATTN_BACKEND=flash-attn \
    SPCONV_ALGO=native \
    FORCE_CUDA=1 \
    TORCH_CUDA_ARCH_LIST="7.0;7.5;8.0;8.6;8.9;9.0"

WORKDIR /app

COPY runpod/image-to-3d/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# TRELLIS from source (+ its CUDA extensions). Pin a commit when you deploy.
RUN git clone --recurse-submodules https://github.com/microsoft/TRELLIS /app/TRELLIS \
    && cd /app/TRELLIS \
    && . ./setup.sh --basic --xformers --flash-attn --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast || true
ENV PYTHONPATH=/app/TRELLIS:$PYTHONPATH

COPY runpod/image-to-3d/handler.py .

CMD ["python", "-u", "handler.py"]
