# Stable-Makeup RunPod serverless worker (generative makeup transfer).
# Built by RunPod from GitHub: build context = REPO ROOT (COPY paths repo-relative).
# Local build: docker build -f runpod/stable-makeup/Dockerfile -t <tag> .
# Endpoint GPU: 16GB+ is plenty (SD1.5 base). No GPU-compiled extensions → builds clean.
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/runpod-volume/hf

WORKDIR /app

COPY runpod/stable-makeup/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Base image torch/torchaudio CUDA mismatch crashes transformers' import; we don't
# use audio — drop torchaudio so that import path is skipped.
RUN pip uninstall -y torchaudio || true

# Stable-Makeup repo on PYTHONPATH (provides pipeline_sd15, detail_encoder, spiga_draw).
RUN git clone https://github.com/Xiaojiu-z/Stable-Makeup /app/Stable-Makeup
ENV PYTHONPATH=/app/Stable-Makeup:$PYTHONPATH
WORKDIR /app/Stable-Makeup
RUN pip install --no-cache-dir spiga facelib || true   # structural-guide + face detect
WORKDIR /app

# Checkpoints (~SD1.5 + makeup/id/pose + image_encoder_l + mobilenet detector) live
# on the network volume under MODELS_DIR (default /runpod-volume/Stable-Makeup/models);
# download per the repo README. Set HF_TOKEN if the SD1.5 base is gated.
COPY runpod/stable-makeup/handler.py .

CMD ["python", "-u", "handler.py"]
