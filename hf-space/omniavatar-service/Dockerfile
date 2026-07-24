# OmniAvatar is built on Wan2.1-T2V diffusion and pins torch 2.4.0 on CUDA 12.4
# (cu124). This is a different CUDA family than echomimic-service (cu118), so we
# use the 12.4 runtime base. Ubuntu 22.04 -> Python 3.10 (OmniAvatar's tested
# range). This is heavy (diffusion) - we currently target a 16GB T4 Space; the
# render defaults in app.py (num_persistent_param_in_dit=0, TeaCache, reduced
# steps) are deliberately T4-safe.
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

# NON-INTERACTIVE apt (tzdata etc. would otherwise block the build).
ENV DEBIAN_FRONTEND=noninteractive

# git/wget/ffmpeg + build toolchain. OmniAvatar's requirements can pull source
# builds (e.g. PyAV-family / decord); pkg-config + build-essential + libav* dev
# headers cover those, matching the echomimic-service apt line. NOTE: the plain
# `ffmpeg` package provides /usr/bin/ffmpeg, which OmniAvatar's
# save_video_as_grid_and_mp4 HARDCODES for muxing audio into the output mp4 - so
# it must exist, independent of the ffmpeg-static below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-venv python3.10-dev git wget curl ffmpeg xz-utils \
    build-essential pkg-config \
    libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev \
    libavfilter-dev libswscale-dev libswresample-dev \
    && rm -rf /var/lib/apt/lists/*

# ffmpeg-static at a fixed path, pointed to by FFMPEG_PATH (some moviepy/
# ffmpeg-python code paths read it). The muxing inside OmniAvatar uses the apt
# /usr/bin/ffmpeg above; this is just belt-and-suspenders parity with the other
# services.
RUN wget -q https://www.johnvansickle.com/ffmpeg/old-releases/ffmpeg-4.4-amd64-static.tar.xz \
        -O /tmp/ffmpeg.tar.xz \
    && mkdir -p /opt/ffmpeg-static \
    && tar -xJf /tmp/ffmpeg.tar.xz -C /opt/ffmpeg-static --strip-components=1 \
    && rm /tmp/ffmpeg.tar.xz
ENV FFMPEG_PATH=/opt/ffmpeg-static

# HF Docker Spaces run as UID 1000 - create that user and switch before any
# COPY/pip install, per HF convention.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH
WORKDIR $HOME/app

RUN python3.10 -m pip install --no-cache-dir --upgrade pip

# Clone OmniAvatar and install deps at BUILD time (CPU-only - no GPU during
# `docker build`; weight download happens at container startup in app.py).
RUN git clone --depth 1 https://github.com/Omni-Avatar/OmniAvatar.git omniavatar-src

WORKDIR $HOME/app/omniavatar-src

# Install the cu124 torch trio FIRST from PyTorch's own index so torch resolves
# to the CUDA build (PyPI default is CPU-only). These are the exact versions
# OmniAvatar's README calls for. NOTE: this is installed but NOT relied upon to
# survive - the requirements.txt step below (peft's unbounded `torch>=1.13.0`)
# re-resolves torch to a bogus torch-2.13.0/CUDA-13 build, so we RE-INSTALL the
# cu124 torch trio LAST, after everything else, to lock it in.
RUN python3.10 -m pip install --no-cache-dir \
    torch==2.4.0 torchvision==0.19.0 torchaudio==2.4.0 \
    --index-url https://download.pytorch.org/whl/cu124

# OmniAvatar's own requirements (transformers==4.52.3, peft==0.15.1, xfuser==0.4.1,
# numpy==1.26.4, ...). NOTE: peft's `torch>=1.13.0` has no ceiling, so pip pulls a
# bad torch here - fixed by the final torch re-pin below.
RUN python3.10 -m pip install --no-cache-dir -r requirements.txt

# Service layer + weight download + video-writer deps.
# imageio/imageio-ffmpeg back OmniAvatar's save_video_as_grid_and_mp4;
# omegaconf/opencv/soundfile are imported by the inference/data path.
RUN python3.10 -m pip install --no-cache-dir \
    fastapi uvicorn python-multipart pyyaml "huggingface_hub[cli]" \
    imageio imageio-ffmpeg omegaconf opencv-python-headless soundfile

# LOAD-BEARING FINAL PINS (mirrors the echomimic-service pin discipline).
# THREE runtime crashes were caused by earlier pip steps pulling wrong versions:
#   1. `-r requirements.txt` (via peft's unbounded torch>=1.13.0) replaced the
#      cu124 torch with torch-2.13.0 + CUDA-13 wheels -> transformers failed to
#      import `BloomPreTrainedModel` against the wrong torch.
#   2. the extras step upgraded numpy 1.26.4 -> 2.2.6 (past OmniAvatar's pin).
#   3. diffusers came in transitively at 0.36.0, whose dependency check demands
#      `peft>=0.17.0`, but OmniAvatar pins `peft==0.15.1` -> ImportError at render.
#      diffusers==0.33.1 is the Wan2.1-era release; its table only wants
#      `peft>=0.6.0`, so it's compatible with peft 0.15.1.
# Re-install the correct cu124 torch trio + re-assert numpy/diffusers pins LAST,
# so nothing after can silently override them. --no-deps on torch keeps it from
# dragging its own resolver back in.
RUN python3.10 -m pip install --no-cache-dir --force-reinstall --no-deps \
        torch==2.4.0 torchvision==0.19.0 torchaudio==2.4.0 \
        --index-url https://download.pytorch.org/whl/cu124 \
    && python3.10 -m pip install --no-cache-dir "numpy==1.26.4" "diffusers==0.33.1"

# SPEED FIX: SageAttention. OmniAvatar's own attention code
# (OmniAvatar/models/wan_video_dit.py) has a NATIVE fallback chain -
# FlashAttention3 -> FlashAttention2 -> SageAttention -> plain PyTorch
# scaled_dot_product_attention (our previous path, the SLOWEST option, since
# none of the faster backends were installed). Unlike flash_attn, sageattention
# is a plain pip package (no fragile from-source CUDA compile), so it's safe
# to add here. Community benchmarks report SageAttention alone ~2x faster than
# FlashAttention2, and combined with TeaCache one Wan2.1 workload went from
# 542s -> 248s (54% faster) on comparable GPU hardware. This is a pure
# opt-in - OmniAvatar auto-detects and uses it via try/except ModuleNotFoundError,
# no code or CLI-flag changes needed on our side.
RUN python3.10 -m pip install --no-cache-dir sageattention

WORKDIR $HOME/app
COPY --chown=user app.py app.py

# Default Docker Space port per HF convention (also app_port in README.md YAML).
EXPOSE 7860

CMD ["python3.10", "app.py"]
