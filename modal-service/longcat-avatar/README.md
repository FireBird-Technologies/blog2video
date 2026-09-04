# LongCat-Video-Avatar-1.5 on Modal (serverless GPU) — standalone evaluation

A **disconnected evaluation** of [LongCat-Video-Avatar-1.5](https://github.com/meituan-longcat/LongCat-Video)
as a possible alternative to blog2video's current avatar provider (OmniAvatar-1.3B, also on
Modal — see `../omniavatar/`). This directory is **not** called by blog2video's backend or
frontend — it exists only to be hit by `run_test.py` for benchmarking. See
`docs/longcat-avatar.md` in the main repo for the running write-up.

## History: this was first attempted on Hugging Face Spaces

Per instruction, this eval initially targeted a repurposed HF Space
(`firebird-technologies/echomimic-service`, see `hf-space/longcat-avatar-eval/` for that
code). The Docker image build succeeded there after fixing three upstream packaging bugs
(carried over into this Modal port's `app.py` image build — see its comments), but the
Space then stalled in `APP_STARTING` with no GPU attached for an extended period — HF's
L40S provisioning queue, not a bug in this code. Moved to Modal, reusing
`../omniavatar/app.py`'s proven deployment pattern.

## Setup

```bash
pip install modal
modal token set --token-id <id> --token-secret <secret> --profile=<name>
modal profile activate <name>

modal secret create longcat-avatar-secret LONGCAT_SERVICE_SECRET=<value>

cd modal-service/longcat-avatar
modal run app.py::download_weights            # ONE TIME, ~44GB -> Volume (filtered, see app.py)
modal deploy app.py                            # prints the https://...modal.run URL
```

`modal serve app.py` gives an ephemeral hot-reloading URL for iterating on endpoint code.

## Benchmark

```bash
export LONGCAT_MODAL_URL=<url printed by modal deploy>
export LONGCAT_SERVICE_SECRET=<same value as the modal secret>
python run_test.py my_case /path/to/portrait.jpg /path/to/audio.mp3 "<prompt>"
```

Sample portraits are available at `../omniavatar/avatar_presets/` (reused here purely as
test inputs, not wired into any preset system) and `hf-space/longcat-avatar-eval/sample_inputs/`.

## GPU / weights

- **GPU**: starting on `A100-80GB` (`MODAL_GPU` env var to override) — LongCat-Video-
  Avatar-1.5's ~16GB INT8 DiT + ~22GB bf16 UMT5 text encoder + Whisper-large-v3 + working
  memory is a materially bigger footprint than OmniAvatar's L40S-sized 1.3B model.
  `L40S` (48GB, OmniAvatar's card) is worth trying once real numbers exist, if 80GB turns
  out to be more than needed.
- **Weights**: ~44GB, filtered from ~158GB of naive combined upstream repo size — see
  `app.py`'s `AVATAR_ALLOW_PATTERNS`/`BASE_ALLOW_PATTERNS` and `docs/longcat-avatar.md`
  §3 for the full accounting of what's skipped and why (the unused text-to-video DiT,
  the redundant bf16 base model when INT8 is used, four duplicate Whisper weight formats).
- **GPU topology**: defaults to single-GPU (`LONGCAT_NPROC_PER_NODE=1`,
  `LONGCAT_CONTEXT_PARALLEL_SIZE=1`), even though upstream's README only documents a
  2-GPU invocation — see `app.py`'s module docstring and `docs/longcat-avatar.md` §4 for
  why single-GPU is a real, script-supported code path worth trying first. Modal makes
  testing the 2-GPU alternative trivial if needed (`gpu="A100-80GB:2"`), unlike HF Spaces
  which only offers single-GPU tiers.

## Design notes carried over from `../omniavatar/app.py`

- Single self-contained `/render` call — no `/prepare` step. Everything a render needs
  (portrait, audio, prompt) travels with the request, so scale-to-zero container
  reassignment between calls can't lose staged state.
- Shared-secret auth via the `x-avatar-key` header, checked in FastAPI middleware.
- `X-Render-*` timing headers on the response for `run_test.py` to log.
- The **150s-redirect risk**: Modal caps a single HTTP request at 150s, then 303s to a
  result URL. `requests` follows this by default. `run_test.py` verifies the final
  payload is really mp4 bytes (not an HTML/JSON error saved as `.mp4`), same as
  `../omniavatar/run_test.py`'s check — LongCat renders are almost certainly slower than
  OmniAvatar's 160-400s, so this boundary is even more certain to be crossed here.

## Cost

`TODO (measure)` — record actual GPU-seconds per render and Modal's published rate for
whichever GPU type is actually used, in `docs/longcat-avatar.md`.
