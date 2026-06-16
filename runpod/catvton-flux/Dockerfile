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
# We need neither (diffusers falls back to PyTorch SDPA). Remove torchaudio and ALL
# flash-attn-family distributions (FA3 ships under various dist names, so match by name).
RUN pip uninstall -y torchaudio || true
RUN python -c "import importlib.metadata as m; print('\n'.join(d.metadata['Name'] for d in m.distributions() if 'flash' in (d.metadata['Name'] or '').lower()))" \
      | xargs -r pip uninstall -y || true

# ROOT-CAUSE FIX: torch 2.4's torch.library.infer_schema can't parse string type
# annotations ('torch.Tensor'), so the FA3 op registration crashes during diffusers'
# FluxFill import. Fixed in torch 2.5+. Install a coherent torch 2.5.1 cu121
# (+matching torchvision, no torchaudio). cu121 wheels run fine on the 12.4 driver.
RUN pip install --no-cache-dir --force-reinstall \
      torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121

# CatVTON repo (provides model.cloth_masker.AutoMasker) + DensePose via detectron2.
# Built AFTER the torch upgrade so detectron2 compiles against torch 2.5.1.
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
