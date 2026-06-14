# Image-to-3D ingestion worker (TRELLIS) for RunPod serverless.
# Build:  docker build -t <user>/image-to-3d-worker:latest runpod/image-to-3d
# Endpoint GPU: 24GB+ (A100/L40S recommended). Asset generation is offline/per-product.
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/runpod-volume/hf \
    ATTN_BACKEND=flash-attn \
    SPCONV_ALGO=native

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# TRELLIS from source (+ its CUDA extensions). Pin a commit when you deploy.
RUN git clone --recurse-submodules https://github.com/microsoft/TRELLIS /app/TRELLIS \
    && cd /app/TRELLIS \
    && . ./setup.sh --basic --xformers --flash-attn --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast || true
ENV PYTHONPATH=/app/TRELLIS:$PYTHONPATH

COPY handler.py .

CMD ["python", "-u", "handler.py"]
