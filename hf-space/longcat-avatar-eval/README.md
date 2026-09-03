---
title: LongCat Avatar Eval
emoji: 🐈
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# LongCat-Video-Avatar-1.5 — standalone evaluation Space

A **disconnected evaluation** of [LongCat-Video-Avatar-1.5](https://github.com/meituan-longcat/LongCat-Video)
as a possible alternative to blog2video's current avatar provider (OmniAvatar-1.3B on Modal,
`modal-service/omniavatar/`). This Space is not called by blog2video's backend or frontend —
it exists only to be hit by `run_test.py` for benchmarking. See `docs/longcat-avatar.md` in the
main repo for the running write-up of what's been learned.

## Why a Hugging Face Space instead of Modal

blog2video's avatar feature originally ran on an HF Space before migrating to Modal for
scale-to-zero economics (see `docs/avatar.md` for that history). This eval deliberately starts
on HF Spaces again, per instruction — it's a faster path to "does this model even work and how
good is it" without first solving Modal-specific packaging, and the two hosting models have
genuinely different cost shapes worth understanding directly (HF Spaces bill by container
uptime; Modal bills per-GPU-second with true scale-to-zero). If this model is adopted, moving
it to Modal — reusing `modal-service/omniavatar/app.py`'s Volume + `@app.cls` pattern almost
directly — is the likely next step regardless of what's learned here.

## Where this is actually deployed

Creating a brand-new Docker Space was blocked by HF's payment gate (Team/Enterprise org
plan or personal PRO required for new Docker/Gradio Spaces). Per instruction, this eval
instead **repurposes an existing, paused, unused Space**:
[`firebird-technologies/echomimic-service`](https://huggingface.co/spaces/firebird-technologies/echomimic-service)
(left over from an earlier avatar-model experiment, EchoMimic — its original files are
preserved in that Space's git history). Hardware was changed from `t4-small` (16GB, too
small for LongCat's ~44GB footprint) to `l40sx1` (48GB) — the same GPU model
`modal-service/omniavatar/app.py` already uses for OmniAvatar, for a clean comparison.

Live URL: `https://firebird-technologies-echomimic-service.hf.space`

See `docs/longcat-avatar.md` in the main repo for the full deployment log and results.

## Setup (for redeploying elsewhere / from scratch)

1. Create the Space (Docker SDK) under an org/account with GPU hardware access, or push
   to an existing Docker Space to repurpose it, as was done here:
   ```bash
   # via huggingface_hub, or the HF web UI "Create new Space" flow
   huggingface-cli repo create longcat-avatar-eval --type space --space_sdk docker
   ```
2. Set the **GPU hardware tier** in the Space's Settings tab. This deployment uses
   `l40sx1` (48GB). HF Spaces GPU tiers are single-GPU only, which is why this Space
   defaults to `LONGCAT_NPROC_PER_NODE=1`.
3. Set a Space secret (Settings → Repository secrets):
   - `LONGCAT_SERVICE_SECRET` — shared secret for the `x-avatar-key` header this Space checks
   - (optionally) `LONGCAT_USE_INT8=true`, `LONGCAT_RESOLUTION=480p` to override the defaults
     baked into `app.py`
4. Push this directory's contents to the Space's git remote, or via `huggingface_hub`'s
   `upload_file`/`upload_folder`:
   ```bash
   git clone https://huggingface.co/spaces/<org-or-user>/<space-name>
   cp -r hf-space/longcat-avatar-eval/* <space-name>/
   cd <space-name> && git add -A && git commit -m "LongCat-Video-Avatar-1.5 eval service" && git push
   ```
5. Watch the build logs. First boot also runs `download_weights.py` (~44GB filtered
   download — see that file's docstring for what's included and why it's smaller than a
   full mirror of either upstream HF repo), which will make the first `/ping` take a while.

## Testing

```bash
export LONGCAT_SPACE_URL=https://<org-or-user>-longcat-avatar-eval.hf.space
export LONGCAT_SERVICE_SECRET=<same value as the Space secret>
python run_test.py my_case sample_inputs/portrait.jpg sample_inputs/audio.mp3 "<prompt>"
```

`run_test.py` times `/ping` (first-request / model-load cost) separately from `/render`
(actual inference), and appends results to `outputs/manifest.jsonl` in a schema comparable to
`modal-service/omniavatar/run_test.py`'s manifest — see that file's docstring for why the
separation matters.

## Single-GPU vs. 2-GPU

Upstream's documented `run_demo_avatar_single_audio_to_video.py` invocation uses
`--nproc_per_node=2 --context_parallel_size=2`, but `--context_parallel_size` defaults to
**1** in the script's own `argparse` definition, and `dist.init_process_group` is called
unconditionally regardless of world size — so a single-process run is a supported code path,
not a hack. This Space defaults to `--nproc_per_node=1 --context_parallel_size=1`
(`LONGCAT_NPROC_PER_NODE=1` in `app.py`). If that OOMs or otherwise fails on the chosen GPU
tier, that is a real, useful finding — record it in `docs/longcat-avatar.md` and fall back to
a 2-GPU topology (which HF Spaces cannot offer — this would then point back at Modal, which
can, via `gpu="A100-40GB:2"`-style syntax).

## What this Space deliberately does NOT do

- No inline background matting/cutout (OmniAvatar's `rembg` pipeline is a separate,
  product-specific decision — see `modal-service/omniavatar/app.py`'s `_matte_mp4`).
- No wiring into blog2video's `SceneAvatarJob` queue, credit system, or any router.
- No decision baked in about HF vs. Modal as an eventual production host.
