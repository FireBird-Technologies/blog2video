# AVTR-1 (avaturn-live/avtr-1) — live-dialogue avatar, hosted offline-render as an
# HF Docker Space. This is the HEAVIEST of our avatar services:
#   - uses `pixi` (prefix.dev) to resolve a conda+pypi env, NOT plain pip
#   - CUDA 12.8 + TensorRT <=10.12 + Python 3.12 + torch 2.5-2.8
#   - builds GPU-ARCHITECTURE-SPECIFIC TensorRT engines at container startup
#     (can't be done at docker-build time — no GPU there)
#   - weights are GATED on HF -> needs an HF_TOKEN whose account accepted the
#     avaturn-live/avtr-1 license.
# Requires an Ampere+ GPU (repo lists L40/A100/L4/RTX30-40; NOT T4/Turing).
# Target: L4 (24GB).
#
# License note: AVTR-1 Renderer+Streamer are PolyForm NONCOMMERCIAL. Internal
# evaluation only — commercial use needs avaturn (hello@avaturn.me).
FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu22.04

# System deps: git (clone), ffmpeg (mux), curl/ca-certs (pixi install), plus the
# libs onnxruntime-gpu / opencv-headless / TensorRT commonly need at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates ffmpeg \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# HF Docker Spaces run as UID 1000 — create + switch before installs (HF convention).
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:/home/user/.pixi/bin:$PATH
WORKDIR $HOME/app

# Install pixi (the repo's package manager) to a user-writable location.
RUN curl -fsSL https://pixi.sh/install.sh | bash

# Clone AVTR-1 at build time and resolve its env with `pixi install` (CPU-only —
# no GPU / no weights during docker build; those happen at container startup).
RUN git clone --depth 1 https://github.com/avaturn-live/avtr-1.git avtr1-src

WORKDIR $HOME/app/avtr1-src
# pixi.lock is committed in the repo -> reproducible resolve of py3.12 / torch /
# tensorrt / onnxruntime-gpu / the avaturn_live_streamer package itself.
# Install the `renderer` environment explicitly: it's the one that carries the
# `dev`+`build` features (onnx, tensorrt, cuda-nvcc, onnx-graphsurgeon) needed to
# BUILD the TRT engines. The bare `default`/`renderer` install otherwise missed
# `onnx` at engine-build time ("ModuleNotFoundError: No module named 'onnx'").
RUN pixi install -e renderer

# NOTE: no extra dep install needed. The repo's pixi env ALREADY provides
# fastapi + uvicorn + python-multipart (it ships a FastAPI streamer, and
# python-multipart==0.0.32 is pinned by the conda solve — `pixi add` conflicts on
# it). app.py imports only fastapi + uvicorn, so the repo env covers everything.

# Artifact storage location. Default to a WRITABLE in-container path (works
# without HF persistent storage — the container user owns $HOME). Weights + built
# TRT engines land here; they re-download/rebuild on cold starts since this isn't
# persistent. To make them survive restarts, enable HF persistent storage and
# override this to /data/avtr1-artifacts via a Space variable.
# (/data is NOT writable unless persistent storage is enabled -> earlier
# PermissionError: [Errno 13] '/data'.)
ENV AVTR1_LOCAL_STORAGE=/home/user/app/avtr1-src/artifacts

WORKDIR $HOME/app/avtr1-src
COPY --chown=user app.py app.py

EXPOSE 7860

# Run our app.py INSIDE the `renderer` pixi env (the default+build env) so it can
# import the renderer package and its script subprocesses have onnx/tensorrt.
CMD ["pixi", "run", "-e", "renderer", "python", "app.py"]
