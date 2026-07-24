---
title: OmniAvatar Service
emoji: 🗣️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

OmniAvatar-backed **audio-driven + prompt-driven** talking-avatar service for
blog2video. Unlike EchoMimic (head/face motion only) and MuseTalk (mouth-only
lip-sync), OmniAvatar derives lip-sync AND **adaptive body/gesture motion** from
the audio, and additionally lets a **text prompt steer the behavior/expression**
(github.com/Omni-Avatar/OmniAvatar, built on Wan2.1-T2V diffusion).

**License: Apache-2.0** — commercial use permitted (confirmed via GitHub's license
API). Same commercial bar EchoMimic clears; this is the more capable candidate.

Endpoints: `/ping`, `/prepare`, `/render` (shared-secret auth via the
`X-Avatar-Key` header; secret set via the `AVATAR_SERVICE_SECRET` Space secret).
`/render` takes `audio` + `avatar_id`, plus optional `prompt` (steers behavior),
`steps`, `guidance_scale`, `max_tokens`, `seed`.

Runs the **1.3B** model (`configs/inference_1.3B.yaml`) launched under
`torchrun --standalone --nproc_per_node=1` — OmniAvatar's inference calls
`dist.init_process_group('nccl')`, so even single-GPU must go through torchrun.

## GPU / current tier

Wan2.1 diffusion pipeline. Currently targeting a **16GB T4 small Space**
($0.40/hr). The 36 / 21 / 8 GB VRAM figures in the upstream README are for the
**14B** model — the **1.3B** used here is far smaller and fits a T4 with the
T4-safe defaults in `app.py`:

- **`num_persistent_param_in_dit=0`** — streams DiT params instead of keeping them
  resident (the single most important low-VRAM knob).
- **`tea_cache_l1_thresh=0.14`** — TeaCache step-skipping (faster, slight quality
  cost).
- Reduced `num_steps` (default 25 vs the config's 50) and a `max_tokens` cap.
- `max_hw: 720` (480p) from the config, left as-is.

On a 24GB Space (L4 $0.80/hr) raise `num_steps` / `max_tokens` / drop the
TeaCache threshold for higher quality. The **14B** model needs 24GB+ and is the
documented follow-up, not this deployment.

Pause the Space when idle — a GPU Space bills continuously (~$0.40/hr ≈ $290/mo if
never paused) and renders are bursty.

## Weights (downloaded at container startup, ~20GB, ephemeral disk)

Three HF repos into `omniavatar-src/pretrained_models/`:
`Wan-AI/Wan2.1-T2V-1.3B` (~17.6GB base diffusion + T5 text encoder),
`OmniAvatar/OmniAvatar-1.3B` (audio adapter), `facebook/wav2vec2-base-960h`
(~360MB audio encoder). Persistent storage NOT enabled → re-downloads on each
cold start (as with echomimic-service).

Internal service only — not a public demo.
