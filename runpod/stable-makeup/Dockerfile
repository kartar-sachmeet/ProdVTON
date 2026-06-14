# Stable-Makeup RunPod serverless worker (generative makeup transfer).
# Build:  docker build -t <user>/stable-makeup-worker:latest runpod/stable-makeup
# Endpoint GPU: 16GB+ is plenty (SD1.5 base).
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/runpod-volume/hf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stable-Makeup repo on PYTHONPATH (provides pipeline_sd15 + modules).
RUN git clone https://github.com/Xiaojiu-z/Stable-Makeup /app/Stable-Makeup
ENV PYTHONPATH=/app/Stable-Makeup:$PYTHONPATH

# Checkpoints (detail/makeup/id encoders + SPIGA) live on the network volume;
# set their paths as endpoint env vars:
#   MAKEUP_ENCODER_CKPT, ID_ENCODER_CKPT, MAKEUP_UNET_CKPT  (and HF_TOKEN if gated)
COPY handler.py .

CMD ["python", "-u", "handler.py"]
