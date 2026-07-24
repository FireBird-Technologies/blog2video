FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Ubuntu 22.04 ships Python 3.10 by default - matches MuseTalk's target
# exactly, unlike Kaggle's fixed Python 3.12 base which had no cp312 wheels
# for torch==2.0.1+cu118, numpy==1.23.5, tensorflow==2.12.0, or mmcv==2.0.1.
# curl is required by download_weights.sh's resnet18 download line
# (confirmed via runtime logs: "./download_weights.sh: 48: curl: not found",
# silently non-fatal since the script has no `set -e`, meaning that file
# never actually downloaded despite the script's own "success" message).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-venv git wget curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# HF Docker Spaces run the container as UID 1000 - create that user and
# switch to it before any COPY/pip install, per HF's documented convention,
# to avoid permission errors.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH
WORKDIR $HOME/app

RUN python3.10 -m pip install --no-cache-dir --upgrade pip

# Clone MuseTalk and install its dependencies at BUILD time (CPU-only steps -
# no GPU access during `docker build`, confirmed by HF's own docs, so nothing
# GPU-dependent belongs in a RUN step; weight download happens at container
# startup instead, in app.py).
RUN git clone --depth 1 https://github.com/TMElyralab/MuseTalk.git musetalk-src

WORKDIR $HOME/app/musetalk-src

# README order: torch (cu118 wheel) before requirements.txt. torch==2.0.1
# DOES have a cp310 wheel (verified: only cp312 lacked it) - the README's
# exact pin works here, no version bump needed.
RUN python3.10 -m pip install --no-cache-dir \
    torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 \
    --index-url https://download.pytorch.org/whl/cu118

# requirements.txt used UNPATCHED - numpy==1.23.5 and tensorflow==2.12.0 both
# have cp310 wheels (this only broke under Kaggle's forced cp312).
RUN python3.10 -m pip install --no-cache-dir -r requirements.txt

# mim works normally under 3.10 - the pkgutil.ImpImporter AttributeError we
# hit on Kaggle is a Python-3.12-specific removal; 3.10's pkg_resources still
# has that attribute.
#
# chumpy (an mmpose dependency) has a longstanding upstream bug: its setup.py
# imports `pip` directly, which breaks under PEP 517 isolated builds with
# "ModuleNotFoundError: No module named 'pip'" (confirmed by hitting this
# directly - see github.com/mattloper/chumpy/issues/56). Fix: install it
# first with --no-build-isolation so its build step can see the pip already
# installed in this environment, before mmpose tries to pull it in normally.
RUN python3.10 -m pip install --no-cache-dir numpy six && \
    python3.10 -m pip install --no-cache-dir --no-build-isolation chumpy

RUN python3.10 -m pip install --no-cache-dir -U openmim && \
    python3.10 -m mim install mmengine && \
    python3.10 -m mim install "mmcv==2.0.1" && \
    python3.10 -m mim install "mmdet==3.1.0" && \
    python3.10 -m mim install "mmpose==1.1.0"

RUN python3.10 -m pip install --no-cache-dir fastapi uvicorn python-multipart pyyaml

# One of the mmlab/openmim installs above transitively upgraded huggingface-hub
# to 1.24.0, which breaks transformers==4.39.2's own hard-coded version check
# at import time ("transformers 4.39.2 requires huggingface-hub<1.0,>=0.19.3").
# Confirmed by hitting this exact ImportError when scripts/inference.py tries
# `from transformers import WhisperModel`. Re-pin it last so nothing after
# this step can silently re-upgrade it again.
RUN python3.10 -m pip install --no-cache-dir "huggingface-hub<1.0,>=0.19.3"

WORKDIR $HOME/app
COPY --chown=user app.py app.py

# Default Docker Space port per HF convention (also set as app_port in
# README.md YAML frontmatter).
EXPOSE 7860

CMD ["python3.10", "app.py"]
