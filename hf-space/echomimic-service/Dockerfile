# EchoMimic needs CUDA >= 11.7 and torch in the 2.0.1-2.2.2 range. We use the
# same cu118 base family as the MuseTalk avatar-service (Ubuntu 22.04 -> Python
# 3.10, which EchoMimic supports). This is heavier than MuseTalk (diffusion) -
# we currently target a 16GB T4 Space; render defaults in app.py are T4-safe.
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# xz-utils extracts the ffmpeg-static .tar.xz below; git/wget/curl/ffmpeg match
# the MuseTalk service. EchoMimic's requirements pin `av==11.0.0`, which has NO
# prebuilt cp310 wheel -> pip compiles PyAV from source, which needs pkg-config
# plus the ffmpeg/libav* DEV headers (build error hit without them:
# "pkg-config is required for building PyAV"). build-essential provides the C
# toolchain the source build also needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-venv python3.10-dev git wget curl ffmpeg xz-utils \
    build-essential pkg-config \
    libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev \
    libavfilter-dev libswscale-dev libswresample-dev \
    && rm -rf /var/lib/apt/lists/*

# ffmpeg-static, exactly the build EchoMimic's README calls for. Placed at a
# fixed path and pointed to by FFMPEG_PATH (read by app.py / EchoMimic).
RUN wget -q https://www.johnvansickle.com/ffmpeg/old-releases/ffmpeg-4.4-amd64-static.tar.xz \
        -O /tmp/ffmpeg.tar.xz \
    && mkdir -p /opt/ffmpeg-static \
    && tar -xJf /tmp/ffmpeg.tar.xz -C /opt/ffmpeg-static --strip-components=1 \
    && rm /tmp/ffmpeg.tar.xz
ENV FFMPEG_PATH=/opt/ffmpeg-static

# HF Docker Spaces run the container as UID 1000 - create that user and switch
# to it before any COPY/pip install, per HF's documented convention.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH
WORKDIR $HOME/app

RUN python3.10 -m pip install --no-cache-dir --upgrade pip

# Clone EchoMimic and install its deps at BUILD time (CPU-only steps - no GPU
# during `docker build`; weight download happens at container startup in app.py).
RUN git clone --depth 1 https://github.com/antgroup/echomimic.git echomimic-src

WORKDIR $HOME/app/echomimic-src

# Install the cu118 torch trio FIRST from PyTorch's own index so the plain torch
# line in requirements.txt resolves to the CUDA build (PyPI default is CPU-only).
# 2.2.1 is inside EchoMimic's supported 2.0.1-2.2.2 range and has cu118 wheels.
RUN python3.10 -m pip install --no-cache-dir \
    torch==2.2.1 torchvision==0.17.1 torchaudio==2.2.1 \
    --index-url https://download.pytorch.org/whl/cu118

# EchoMimic's pinned deps (diffusers==0.24.0, transformers>=4.38.2, facenet_pytorch,
# mediapipe, moviepy, av, einops, omegaconf, ffmpeg-python, opencv-python...).
# torch is already satisfied above so pip won't pull the CPU wheel.
RUN python3.10 -m pip install --no-cache-dir -r requirements.txt

# snapshot_download (weight fetch) + fastapi/uvicorn/python-multipart (API) +
# pyyaml (per-render config).
#
# THREE load-bearing pins, all fixing version skew in the diffusers/transformers/
# huggingface_hub trio (EchoMimic's `transformers>=4.38.2` pulled versions too new
# for its own `diffusers==0.24.0`). Each was confirmed at runtime:
#   1. `numpy<2` - torch 2.2.1 / EchoMimic compiled against NumPy 1.x; NumPy 2.x
#      aborts import ("module compiled using NumPy 1.x cannot be run in 2.2.6").
#   2. `huggingface_hub==0.20.3` - diffusers==0.24.0 imports `hf_cache_home` from
#      huggingface_hub.constants (removed in hub v1.0). 0.20.x keeps it + has the
#      CLI/snapshot_download we use. (Hit: "cannot import name 'hf_cache_home'".)
#   3. `transformers==4.36.2` - the too-new transformers 4.43.x that `>=4.38.2`
#      resolved to imports `is_offline_mode` FROM huggingface_hub, which 0.20.3
#      doesn't export ("cannot import name 'is_offline_mode' from
#      'huggingface_hub'"). 4.36.2 is the diffusers-0.24-era transformers and
#      has its OWN is_offline_mode - self-consistent with hub 0.20.3.
# Installed LAST and pinned so nothing after can silently re-upgrade them; the
# explicit transformers pin also OVERRIDES EchoMimic's requirements.txt line.
RUN python3.10 -m pip install --no-cache-dir \
    fastapi uvicorn python-multipart pyyaml \
    "numpy<2" "huggingface_hub[cli]==0.20.3" "transformers==4.36.2"

WORKDIR $HOME/app
COPY --chown=user app.py app.py

# Default Docker Space port per HF convention (also app_port in README.md YAML).
EXPOSE 7860

CMD ["python3.10", "app.py"]
