---
title: AVTR1 Service
emoji: 🗣️
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

AVTR-1 (avaturn-live/avtr-1) **live-dialogue avatar** service for blog2video —
a built-in avatar + audio → lip-synced (and optional active-listening) mp4 at 25fps.

Endpoints: `/ping`, `/avatars` (list built-in avatars + backgrounds), `/render`
(audio + `avatar` id + `bg` + optional `listen` track). Shared-secret auth via the
`X-Avatar-Key` header (`AVATAR_SERVICE_SECRET` Space secret).

**Avatars are built-in** (not arbitrary photos): arnold, ben, camila, caroline,
clara, elena, gordon, jack, john, kate, marcus, maria (default), may, ming,
mozart, oliver, olivia, trevor. Backgrounds: plain_white (default), minimal_office,
bright_loft, sunlit_bedroom, study_desk, beige_sofa, jungle_window, aloe_window,
lounge_chairs, framed_art.

## ⚠️ Requirements & caveats

- **GPU: L4 / A10G (Ampere+).** NOT T4 (Turing, unsupported). Repo lists L40/A100/
  L4/RTX30-40.
- **Gated weights:** needs an **`HF_TOKEN`** Space secret whose account accepted the
  `avaturn-live/avtr-1` license on HuggingFace.
- **Long first boot:** downloads gated weights, then **builds GPU-specific TensorRT
  engines** (minutes). Cached under `AVTR1_LOCAL_STORAGE=/data/...` — enable HF
  **persistent storage** so cold starts skip the download + engine build.
- **License: PolyForm NONCOMMERCIAL** (Renderer + Streamer). Internal evaluation
  only; commercial use requires avaturn (hello@avaturn.me).

Built on `pixi` + CUDA 12.8 + TensorRT. Internal service — not a public demo.
