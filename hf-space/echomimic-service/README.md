---
title: EchoMimic Service
emoji: 🎭
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

EchoMimic-backed **expressive** audio-driven talking-avatar service for
blog2video. Unlike the MuseTalk avatar-service (mouth-only lip-sync), EchoMimic
derives facial expression and head motion from the audio, so emotion evolves with
the audio across the whole scene (AAAI 2025, antgroup/echomimic).

**License: Apache-2.0** — commercial use permitted (this is why EchoMimic was
chosen over the non-commercial Sonic model).

Endpoints: `/ping`, `/prepare`, `/render` (shared-secret auth via the
`X-Avatar-Key` header; secret set via the `AVATAR_SERVICE_SECRET` Space secret).
`/render` takes `audio` + `avatar_id`, plus optional `L` (frame count), `W`/`H`,
`steps`, `cfg`, `fps`, `seed`.

Runs the **accelerated** pipeline (`infer_audio2vid_acc.py`, ~6 denoise steps).

## GPU / current tier

Diffusion pipeline — heavier than MuseTalk. Currently targeting a **16GB T4
small Space** ($0.40/hr). T4 is the VRAM floor (upstream min = V100 16GB), so the
render defaults are deliberately T4-safe: **512×512, `L`=240 frames (~10s@24fps)**.
The repo's own 1200-frame default would OOM a 16GB card. On a 24GB Space (L4
$0.80/hr, A10G $1.00/hr) raise `L`/resolution for longer, higher-res clips.

Pause the Space when idle — a GPU Space bills continuously (~$0.40/hr ≈ $290/mo
if never paused) and renders are bursty.

Internal service only — not a public demo.
