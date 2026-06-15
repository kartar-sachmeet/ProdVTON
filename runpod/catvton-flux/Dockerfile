# CatVTON-FLUX RunPod serverless worker.
# Build:  docker build -t <user>/catvton-flux-worker:latest runpod/catvton-flux
# Endpoint GPU: 24GB+ (A100 / L40S / 4090).
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/runpod-volume/hf \
    DIFFUSERS_CACHE=/runpod-volume/hf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CatVTON repo (provides model.cloth_masker.AutoMasker) + DensePose via detectron2.
# AutoMasker checkpoints (DensePose/SCHP) are auto-pulled from the zhengchong/CatVTON
# HF repo at runtime, cached on the network volume.
RUN git clone https://github.com/Zheng-Chong/CatVTON /app/CatVTON
ENV PYTHONPATH=/app/CatVTON:$PYTHONPATH
RUN pip install --no-cache-dir 'git+https://github.com/facebookresearch/detectron2.git'

COPY handler.py .

# Weights download on first cold start (cached on the volume). FLUX.1-dev is gated —
# set HF_TOKEN as a secret on the endpoint.
CMD ["python", "-u", "handler.py"]
