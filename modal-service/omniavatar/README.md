# OmniAvatar on Modal (serverless GPU)

The **inference provider** for OmniAvatar-1.3B. It replaced a self-hosted
HuggingFace Space on 2026-08-02; that Space was deleted from this repo on
2026-08-07, so references to `hf-space/` below are historical context only.

The endpoints are `GET /ping`, `POST /render`, `GET /lastlog`.

**`POST /prepare` is gone** — it diverges from the Space, deliberately. It staged a
portrait to container-local disk for a later `/render`, which cannot work under
scale-to-zero: with `scaledown_window=2s` the two requests routinely landed on
different containers, and the second found nothing (`404 no staged photo`). A render
is now a single self-contained request — a roster preset resolves from its id, and an
uploaded portrait is sent as an `image` part alongside the audio.
Nothing in the backend queue or the DB is touched by this directory.

## Why

| | HF Space | Modal |
|---|---|---|
| Weights (~20GB) | re-downloaded **every boot** (ephemeral disk, ~2.5 min) | downloaded **once** to a Volume, mounted thereafter |
| GPU wait on wake | 2.5–12 min (unbounded HF allocation) | container schedule (seconds) |
| Idle billing | **4×L40S bill continuously** while the Space is up | **$0** — scales to zero |
| Concurrency | 4-slot GPU pool (unused: dispatcher is concurrency-1) | 1 container, 1 GPU, autoscaled |

## Setup

```bash
pip install modal
modal setup                                     # interactive browser auth
modal secret create omniavatar-secret AVATAR_SERVICE_SECRET=<value>

cd modal-service/omniavatar
modal run app.py::download_weights              # ONE TIME, ~20GB -> Volume
modal deploy app.py                             # prints the https://...modal.run URL
```

`modal serve app.py` gives an ephemeral hot-reloading URL for iterating on endpoint
code without redeploying.

## Benchmark

```bash
export MODAL_AVATAR_URL=<url printed by modal deploy>
export AVATAR_SERVICE_SECRET=<same value as the modal secret>
./run_benchmark.sh
```

Phase 1 forces a cold start (waits past the scaledown window), phase 2 runs 3 warm
renders. Results append to `outputs/manifest.jsonl` in the same schema as the HF
manifest, so the two are directly diffable.

Single case:

```bash
python3 run_test.py my_case woman_red /path/to/audio.mp3 "<prompt>" [steps]
```

`run_test.py` times `/ping` **separately** from `/render` — that separation is the
whole point, since `ping_s` on a scaled-to-zero app *is* the cold-start cost, and
`X-Render-Gpu-Seconds` isolates pure inference.

### Comparing GPUs

```bash
MODAL_GPU=A100-40GB modal deploy app.py && MODAL_GPU=A100-40GB ./run_benchmark.sh
```

L40S is the recommended default: same card as the Space (clean comparison), best
cost/performance for inference per Modal's own docs, and 48GB keeps the DiT resident.
Note the Space's A100 test was *slower* than L40S (470–680s vs 158s).

## Baseline to beat

From [the HF manifest](../../hf-space/omniavatar-service/test_sets/outputs/manifest.jsonl):

| Config | Time |
|---|---|
| L40S, 10 steps, 25fps | **158.2s** |
| L40S, roster presets, 30fps | 189–256s |
| L4, 10 steps | 395.0s |
| L4, 5 steps | 246.9s |
| HF cold start | ~2.5 min download + 2.5–12 min GPU wait |

## Cost

| Line item | Rate | This workload |
|---|---|---|
| L40S GPU | $0.000542/s (~$1.95/hr) | ~$0.087 per 160s render |
| CPU / memory | $0.0000131/core/s, $0.00000222/GiB/s | negligible |
| Volume storage | $0.09/GiB/mo, **first 1 TiB free** | ~20GB → **$0.00** |

**The scaledown window is billed.** Modal: *"you will be billed for any resources used
while the container is idle (e.g. GPU reservation or residual memory occupancy)."* So
`scaledown_window=300` costs up to **300s × $0.000542 ≈ $0.163** of idle L40S per burst.

Per-burst, one scene: cold start (~$0.02–0.03) + render (~$0.087) + idle tail (~$0.163)
≈ **$0.27**. A 5-scene project amortises one cold start and one idle tail across all
five ≈ $0.61 (~$0.12/scene) — the case the 300s window was chosen for. An isolated
one-off render pays the full idle tail for nothing, so benchmark 60s too:

```bash
MODAL_SCALEDOWN_WINDOW=60 modal deploy app.py
```

Starter plan: $30/month free credits ≈ 110 single-scene bursts.

## Design notes

- **No GPU pool.** The Space ran a 4-slot `queue.Queue` pinning `CUDA_VISIBLE_DEVICES`.
  The backend dispatcher is concurrency-1, so that pool never held more than one
  render — it was unused machinery. Here: `max_containers=1`, `@modal.concurrent(max_inputs=1)`.
- **`/render` is self-contained; there is no `/prepare`.** Under scale-to-zero the two
  calls routinely landed on different containers, so anything staged by the first was
  gone by the second — an edge case on the Space, the *normal* case here. `/render`
  therefore resolves a roster preset from the bundled image itself, and takes an
  uploaded portrait inline. A custom portrait is written to the per-render `work_dir`,
  never the shared `/tmp/avatars/<id>/` slot: every custom render arrives as
  `avatar_id="custom"`, so a shared path on a reused container could serve one
  project's face to another's render.
- **Version pins are load-bearing.** The `pip_install` order in `app.py` reproduces
  [the Dockerfile's](../../hf-space/omniavatar-service/Dockerfile) final re-pin block,
  which fixes three separately-diagnosed runtime crashes. Do not tidy them.
- **`torchrun` is required** even on one GPU — OmniAvatar calls
  `dist.init_process_group('nccl')` regardless.

### The one open risk: the 150s redirect

Modal caps a single HTTP request at 150s, then returns a 303 to a result URL. Renders
take 160–400s, so **every render crosses that boundary**. `requests` follows 303 by
default, which preserves the sync `POST → mp4 bytes` contract and means zero backend
changes.

`run_test.py` verifies this on the first render: it records `redirect_hops` and asserts
the payload is really mp4 (not an HTML redirect page or JSON error silently saved as
`.mp4`). If that assertion fires, switch to spawn+poll — `POST /render` returns a
`call_id`, `GET /result/<id>` polls — which would then require a poll loop in
`avatar.py` and is no longer a drop-in swap.

## Switching production over

Only after the benchmark. It is an env change, not a code change:

```
AVATAR_SERVICE_URL=https://<...>.modal.run
AVATAR_SERVICE_SECRET=<the modal secret value>
```

Modal is now the only provider — the HF Space has been removed from the repo, so
there is nothing to roll back to.
