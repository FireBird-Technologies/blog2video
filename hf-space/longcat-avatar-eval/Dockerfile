# LongCat-Video-Avatar-1.5 — standalone eval Space. Ported from the install steps in
# meituan-longcat/LongCat-Video's README, following the version-pin discipline
# modal-service/omniavatar/app.py documents (cu124 torch installed from PyTorch's own
# index FIRST, other deps after, with awareness that requirements files can silently
# upgrade torch/numpy past what the model actually needs). Do not reorder the
# pip_install steps without re-verifying against a clean build.
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3.10-venv python3-pip \
    git wget curl ffmpeg build-essential pkg-config \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.10 /usr/bin/python && ln -sf /usr/bin/python3.10 /usr/bin/python3

WORKDIR /root

# cu124 torch FIRST from PyTorch's own index — PyPI's default `torch` wheel is CPU-only.
RUN pip install --upgrade pip && \
    pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 \
        --index-url https://download.pytorch.org/whl/cu124

# Prebuilt wheel from Dao-AILab's own GitHub releases, NOT `pip install flash_attn`.
# Building from source needs nvcc (the CUDA *compiler*), which the cudnn-runtime base
# image below deliberately doesn't ship (only the runtime .so's) — switching to a
# cudnn-devel base just to compile flash-attn would roughly double the image size and
# build time for a wheel that's built once, correctly, upstream. This exact filename
# is pinned to flash-attn 2.7.4.post1 + cu12 + torch 2.6 + cp310 + cxx11abiFALSE, matching
# the torch/python versions installed above; if either changes, the matching wheel name
# must be looked up again at https://github.com/Dao-AILab/flash-attention/releases.
RUN pip install ninja psutil packaging && \
    pip install "https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/flash_attn-2.7.4.post1+cu12torch2.6cxx11abiFALSE-cp310-cp310-linux_x86_64.whl"

RUN git clone --depth 1 https://github.com/meituan-longcat/LongCat-Video.git /root/LongCat-Video
WORKDIR /root/LongCat-Video

# torch and flash-attn are BOTH stripped from this file before installing: torch is
# already the cu124 build from PyTorch's own index (a plain `pip install -r
# requirements.txt` would silently re-pin it to PyPI's CPU-only default), and flash-attn
# is already installed above from the prebuilt wheel (re-running `pip install flash-attn`
# here would try to compile from source again and fail with the same missing-nvcc error
# the prebuilt wheel exists to avoid).
RUN grep -vE '^(torch|flash-attn)==' requirements.txt > requirements.fixed.txt && \
    pip install -r requirements.fixed.txt

# requirements_avatar.txt's own deps (onnxruntime, audio-separator, openai, etc.) — kept
# as a separate layer/step from the base requirements so a future dependency conflict is
# easy to bisect, same reasoning as the OmniAvatar Modal image's staged pip_install calls.
#
# TWO LINES ARE STRIPPED FIRST, both bogus pins in upstream's requirements_avatar.txt:
#   - `libsndfile1==0.0.1` is the Debian/Ubuntu APT package name for the C library
#     soundfile/librosa link against — there is no such PyPI package ("No matching
#     distribution found for libsndfile1==0.0.1"). Already installed via apt above.
#   - `tritonserverclient==0.0.6` does not exist on PyPI under that name at all (the
#     real NVIDIA Triton client package is `tritonclient`) and is not imported by either
#     avatar demo script (run_demo_avatar_single_audio_to_video.py /
#     run_demo_avatar_multi_audio_to_video.py) — dropped rather than guessing at a
#     correctly-named replacement for a dependency nothing here actually calls.
RUN grep -vE '^(libsndfile1|tritonserverclient)==' requirements_avatar.txt > requirements_avatar.fixed.txt && \
    pip install -r requirements_avatar.fixed.txt

# fastapi/uvicorn/huggingface_hub for the wrapper app + weight download script.
RUN pip install fastapi uvicorn python-multipart huggingface_hub hf_transfer

# numpy re-pin LAST: requirements_avatar.txt's tree (scikit-learn, scikit-image, scipy,
# onnxruntime) can upgrade numpy past whatever the base requirements.txt wanted. Mirrors
# the same defensive re-pin modal-service/omniavatar/app.py applies for the identical
# reason (rembg's tree upgrading numpy past OmniAvatar's pin there).
RUN pip install numpy==1.26.4

COPY app.py download_weights.py /root/LongCat-Video/

# HF Spaces serve on $PORT (Docker SDK default 7860). Weights are fetched at container
# start, not at build time — baking ~44GB into the image would blow past HF's image-size
# practicalities and make every code change re-push the weights. See download_weights.py
# for exactly what's fetched and why it's a filtered subset of both source repos.
ENV PORT=7860
EXPOSE 7860

CMD python download_weights.py && python app.py
