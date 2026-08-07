# Inline Matting on the GPU: Experiment Log

**Date:** 2026-08-07
**Branch:** `feature/avatar`
**Author:** engineering log, written as the experiment ran

Moving avatar background-removal ("matting") out of the app server and **into the
Modal GPU render container**, so `/render` returns the mp4 *and* its transparent
twins in a single call.

---

## 1. What matting is and why it exists at all

The roster portraits are ordinary photographs — real rooms, brick walls, shelves.
OmniAvatar animates the **whole frame**, so the mp4 it returns has that room baked
into every pixel. There is no alpha channel and nothing chroma-keyable.

So if a user wants their presenter over a colour of their choosing, we must
literally **segment the person out of the footage**, frame by frame. That is
matting.

It produces **two** files, not one, and both are load-bearing:

| File | Codec | Used by | Why it cannot be the other one |
|---|---|---|---|
| `.mov` | ProRes 4444, `yuva444p10le` | the final Remotion **render** | The only format verified in this codebase to carry a real, *varying* alpha channel through an encode→decode round trip |
| `.webm` | VP9, `yuva420p` | the editor **preview** (`<video>`) | Chromium has **no ProRes decoder at all** |

Two separately-diagnosed traps live in that table:

- **VP9 alpha dies in Remotion.** `ffmpeg -vf alphaextract` returns a flat,
  non-varying mask even though the container advertises `alpha_mode=1`. Confirmed
  independently inside Remotion's compositor via a real render: solid black box,
  regardless of the WebM encoding trick used.
- **`-auto-alt-ref 0` is mandatory.** With alt-ref frames enabled, libvpx-vp9
  *silently* discards the alpha plane in some players.

And one more, downstream: ProRes also requires `transparent` on the
`<OffthreadVideo>` that reads it. Without that prop, even a correct ProRes source
renders as an opaque box, because Remotion's global config
(`Config.setVideoImageFormat("jpeg")`) has no alpha channel by default.

---

## 2. Why we changed it — three constraints

Matting used to run **on the app server**, as a second job after the render came
back. Three problems, all stated as hard requirements:

### 2.1 It OOM-killed the production server

Matting was the only heavy CPU/memory work inside the API process. It took a 16GB
box down mid-batch, **taking every user's requests with it**. The code carries
custom RSS instrumentation (`_peak_rss_mb` / `_rss_mb`) written specifically
because of that incident.

### 2.2 It was capped at one at a time

`AVATAR_MATTE_CONCURRENCY=1`. Five scenes matted **sequentially** — about five
minutes of wall clock for a job that should take one. The cap existed *because* of
2.1, so the two problems reinforced each other.

### 2.3 It was a second wait

The user rendered, waited, then waited again for cutouts. The requirement was
explicit: **one wait, and afterwards background/appearance changes are instant.**

### The fix

The render container already has the mp4 on local disk, ffmpeg installed, and up to
`max_containers=5` instances running in parallel. Matting there satisfies all three
at once — no second dispatch, no cold start, no R2 round-trip, and five scenes
matte concurrently because five containers already exist.

---

## 3. Design decisions (and what was rejected)

### 3.1 Inline in `/render`, not a separate `/matte` endpoint

A separate CPU-only Modal function would be **cheaper** (a GPU is not needed for 3
of the 4 stages). It was rejected deliberately: it reintroduces a second dispatch,
a second cold start, an R2 re-fetch, and a new job kind. The user chose simplicity
and accepted the GPU cost. See §7 for what that cost actually turned out to be.

### 3.2 Bytes in the response, never paths

The container's filesystem is destroyed ~2s after the response
(`scaledown_window=2`), so a path would be meaningless to the caller. The backend
constructs its own paths and owns the R2 upload, exactly as before.

### 3.3 `multipart/form-data`, hand-rolled

Parts named `video` / `matte` / `preview`.

- Rejected **base64-in-JSON**: inflates a ~60MB ProRes by 33% and pushes the whole
  payload through a JSON string.
- Rejected **R2-upload-from-Modal**: needs R2 credentials in the Modal secret and
  duplicates upload logic the backend already has.
- Rejected **`requests_toolbelt`**: this image's dependency list is load-bearing
  (see §5). The encoder is ~20 lines of RFC 7578 framing; the backend parses it
  with the stdlib `email` module. No new package on either side.

### 3.4 One matte attempt, no retry

Render failures are **transient** (cold start, 5xx) and *are* retried. Matte
failures are **deterministic** (ffmpeg, a bad frame, a missing codec) — a retry
would hold a billed L40S for another ~30-250s to fail identically.

### 3.5 A matte failure must never lose the render

The render costs real GPU money before matting even starts. Every failure degrades
to "mp4 only" plus an `X-Matte-Error` header, and the reason is persisted to
`Scene.avatar_matte_error` / `avatar_matte_failed_at`.

It is recorded on the **Scene**, not the job row, because **the job succeeded** —
the video plays; only the cutout is missing. That is what lets the UI explain why a
background change is unavailable and offer the manual re-matte, instead of the
reason existing only in a server log.

### 3.6 The old path stays alive

`avatar_matte.py` is now the **fallback**: clips rendered before this existed,
`AVATAR_INLINE_MATTE=false`, failed inline mattes, and deliberate re-mattes.

---

## 4. Only ONE of four stages can use the GPU

This is the single most important technical fact in the whole experiment, and it is
a **hardware** limit, not a tuning gap:

| Stage | GPU? | Why |
|---|---|---|
| ffmpeg explode → PNG | ❌ | H.264 decode + PNG DEFLATE writes. CPU/disk bound |
| **rembg (u2netp)** | ✅ | A conv net → dense matmuls. Exactly what GPUs do |
| ProRes 4444 encode | ❌ | **NVENC has no ProRes encoder.** Fixed-function silicon implements H.264/HEVC/AV1 only — not a driver gap, the circuit does not exist |
| VP9 + alpha encode | ❌ | NVIDIA **decodes** VP9 (NVDEC) but no NVENC generation has ever **encoded** it |

So the L40S is attached and billed for all four stages while being usable by one.
**The wall-clock win for a batch comes from parallelism (5 containers), not from
the GPU.**

---

## 5. Everything that broke, in order

### 5.1 `rembg==2.0.77` cannot be installed (build failure)

```
ERROR: Ignored versions that require a different python version:
  2.0.70 … 2.0.78 Requires-Python <4.0,>=3.11
ERROR: No matching distribution found for rembg==2.0.77
```

The backend pins `rembg[cpu]==2.0.77`, but **every rembg ≥2.0.70 requires Python
≥3.11** and this image is **Python 3.10** — fixed by OmniAvatar's cu124 torch
stack, not a free choice.

**Resolution:** pinned **2.0.69**, the newest release that installs on 3.10. The
two paths therefore run *different rembg versions*. They use the same u2netp ONNX
weights through the same `remove()` call, so output is equivalent in practice — but
this is documented in the code as the first thing to check if they ever diverge.

### 5.2 The workspace was disabled (mid-experiment)

```
HTTP 404 — modal-http: workspace ac-awoBkFqO8XGJBgT9RRpWgJ is disabled
```

Failed in 8 seconds without reaching a container. An earlier run had also been
killed mid-inference by a `cancellation signal` — in hindsight, the workspace being
shut down while a render was in flight.

**Resolution:** migrated to a new workspace, `hstyle622`. Nothing crosses
workspaces:

| Thing | Crosses? | Action |
|---|---|---|
| Modal token | ❌ | new token, new profile |
| `omniavatar-secret` | ❌ | recreated with the **same** `AVATAR_SERVICE_SECRET` value, so the backend needed no change |
| Weights Volume | ❌ | **re-downloaded 19.1 GB** |
| Image layers | ❌ | rebuilt |
| Service URL | — | changed to `hstyle622--…`; updated in `backend/.env:94` |

### 5.3 THE BIG ONE — rembg silently ran on CPU

```
[E:onnxruntime] Failed to load library libonnxruntime_providers_cuda.so
  with error: libcublasLt.so.11: cannot open shared object file
>>> [matte] rembg session ready (u2netp) in 0.5s
```

`onnxruntime-gpu==1.18.1` links against **CUDA 11**; the image is **CUDA 12.4**. The
CUDA execution provider failed to load and onnxruntime **fell back to CPU silently**.

**This is the worst class of bug**: nothing errored. The session built, the matte
ran, the output was correct. It was just ~10× slower, and the logs looked identical
to a healthy run. It cost a full render to notice.

**Resolution, two parts:**

1. `onnxruntime-gpu==1.19.2` — the first release built against CUDA 12.
2. **A provider assertion.** `_get_rembg_session` now prints
   `session.inner_session.get_providers()` and flags `GPU` or
   `CPU (!! CUDA provider did not load)` on every cold container. A future CUDA
   mismatch fails **loudly** instead of quietly halving throughput.

Note this is unrelated to OmniAvatar, which runs on **torch** and never touches
onnxruntime. The only shared surface is numpy, re-pinned to 1.26.4 after the rembg
block.

### 5.4 `onnxruntime-gpu` 1.19.2 segfaults on the image builder

```
=> Step 1: RUN python -c "from rembg import new_session; new_session('u2netp')"
Downloading u2netp.onnx … 100% 4.57M
Segmentation fault
container exit status: 139
```

The step that bakes the weights into the image constructs a session — and **image
builders have no GPU**. 1.18.1 survived it (by falling back to CPU, i.e. the very
bug in 5.3); the CUDA-12 build hard-crashes.

**Resolution:** the build step now only **downloads** the file with `pooch`. The
session is constructed at runtime, on a container that actually has the L40S.

### 5.5 Modal's 150-second HTTP limit

Modal enforces a **150s maximum on any single HTTP request** to a web function,
entirely independent of `@app.cls(timeout=1800)`. Past that it issues an HTTP 303
redirect carrying a token that links the in-flight call; clients following the
chain can reach ~50 minutes (20 hops × 150s).

Renders take 258-287s, so **every render has always crossed this line.** Inline
matting pushes the request to ~540s, needing more hops.

**Status: VERIFIED WORKING.** A 541.5s request completed through **3 redirect hops**
and returned all three files intact to a plain `requests.post()` — no special
handling, no session config:

```
hop 1: HTTP 303 -> …/render?__modal_attempt_token=eyJhbGciOiJIUzI1NiI…
hop 2: HTTP 303 -> …/render?__modal_attempt_token=eyJhbGciOiJIUzI1NiI…
hop 3: HTTP 303 -> …/render?__modal_attempt_token=eyJhbGciOiJIUzI1NiI…
final: HTTP 200, multipart/form-data, all 3 parts parsed
```

**A false alarm to record**, because it wasted time and would mislead the next
person: the container log shows `GET /render -> 200 OK` — a **GET**, not the POST
that was sent. That looks like the classic 303-drops-the-body failure, and it was
briefly diagnosed as one. It is not. The GET is simply how a redirect *leg* is
logged; Modal replays the queued input server-side, so the body is never needed
again. The response came back complete.

This also explains the `408 "Missing request, possibly due to expiry or
cancellation"` that `avatar.py` already documents as transient/retryable — same
lifecycle machinery.

---

## 6. Benchmarks

### 6.1 Test setup

| | |
|---|---|
| Portrait | `marcus.png`, 1920×1080 RGBA, 1.37MB, sent **inline** as `avatar_id="custom"` |
| Audio | real voiceover from the DB — scene 25 / project 1142, 187KB, **11.7s** |
| GPU | Modal **L40S** (48GB), `scaledown_window=2`, `min_containers=0` |
| Inference | 10 steps, guidance 4.5, TeaCache 0.14, seed 42, 30fps |
| Output | **358 frames**, 72MB of intermediate PNGs |

### 6.2 Render (unchanged by this work)

| Run | Time | Context |
|---|---|---|
| Old workspace | **258.0s** | warm Volume |
| New workspace | **286.8s** | **first-ever read of a cold 19.1 GB Volume** |

The ~29s delta is the cold Volume, one-time. Render is **24.6× realtime** for an
11.7s clip. Output mp4: 610,928 B.

### 6.3 Matte — rembg on CPU (the 5.3 bug)

```
>>> [matte] TIMING total=210.0s explode=0.5s (358 frames, 72MB)
    rembg=194.6s (0.543s/frame) prores=1.0s webm=14.0s
    size=60,461,574B / 951,294B
>>> [render] TOTAL render=286.8s matte=254.7s wall=541.5s gpu_billed=541.5s
```

| Stage | Time | Share of matte |
|---|---|---|
| explode | 0.5s | 0.2% |
| **rembg** | **194.6s** | **76%** |
| prores | 1.0s | 0.4% |
| webm | 14.0s | 5.5% |
| *(overhead/IO)* | 44.7s | 17.5% |
| **total** | **254.7s** | |

### 6.4 Two predictions this falsified

**Prediction: "ProRes and VP9 will dominate; the GPU only removes rembg's 34s, so
expect maybe 2×."**

**Wrong.** ProRes took **1.0s** and VP9 **14.0s**. rembg is **76%** of the matte.
The CUDA fix is therefore far more valuable than estimated — the projection was
built on the backend's 0.097s/frame figure without questioning whether a Modal
container's CPU matches a dev laptop's.

**Prediction: "the VP9 encode is probably the worst offender."**

**Wrong**, though the flags added for it (`-row-mt 1 -cpu-used 4 -threads 4`)
clearly work: 14.0s for 358 frames. Without `-row-mt`, libvpx splits only across
tile columns — one tile column at this resolution — so it would run single-threaded.

### 6.5 The container CPU is much slower than the dev box

| | s/frame | source |
|---|---|---|
| Dev server (measured previously) | **0.097** | `avatar_matte.py` comment |
| Modal container CPU | **0.543** | this experiment |

**5.6× slower.** A Modal container is a poor place to run CPU work, which makes the
GPU path matter *more* here than it would locally.

---

## 6.6 The ProRes quantiser — the single biggest win

The ProRes encode originally had **no quality flag**, so `prores_ks` defaulted to
near-lossless. That is wildly wasteful here: the clip is **720×400**, renders at
**16-32% of frame width**, and the pipeline's final output is **h264 anyway** — so
every preserved bit is discarded one step later.

It mattered because **the file, not the GPU, had become the bottleneck**: 57.7MB
took ~890s to transfer against 370s of actual compute.

Measured by re-encoding the lossless original at several quantisers:

| qscale | size | alpha PSNR | RGB PSNR |
|---|---|---|---|
| (none) | 57.7 MB | — | — |
| 7 | 26.9 MB | **inf** | 59.2 dB |
| 9 | 24.8 MB | **inf** | 57.5 dB |
| **11** | **23.4 MB** | **inf** | **56.0 dB** ← chosen |
| 13 | 22.3 MB | **inf** | 54.9 dB |

**ALPHA IS BIT-IDENTICAL AT EVERY SETTING** (`mse_avg 0.00`, `psnr inf`, across all
300 compared frames). ProRes 4444 keeps the alpha plane mathematically lossless and
quantises only the colour planes — so the obvious worry, quantisation fraying hair
and collar edges into a halo, **cannot happen**. Worth having measured rather than
assumed; it also means the quantiser could go more aggressive if transfer ever
becomes the bottleneck again.

56 dB is far past the ~40 dB usually called visually lossless. 11 over 13 because
the curve has flattened by then: 13 saves ~1MB more for another 1 dB.

**Result: client wall 1262.8s → 443.9s, a 2.8× speedup from one flag.**

---

## 6.7 The portrait matters more than the model

An early test used `~/Downloads/avtr1_avatars/marcus.png` — **1920×1080 RGBA**, a
pre-cut image with its own alpha channel. The output had white/grey fringing and a
yellow smear above the hair, and the cutout edges looked chewed up.

**This was not a matting failure.** Zooming into the *raw mp4*, before matting ran,
showed the artifacts already baked in: OmniAvatar expects an ordinary opaque photo
and mishandled the pre-existing transparency. rembg then faithfully cut around a
damaged edge.

Re-running with the actual roster preset — `candidate_man2.jpg`, the "Marcus"
entry in `avatar_presets.py`, an opaque JPEG of a man against a **brick wall with
shelving and plants** (the hard case for any matte) — produced clean edges around
hair, beard, ears and shoulders. No fringing, no halo.

**Conclusion: u2netp is fine. Feed OmniAvatar opaque photographs, never pre-cut
RGBA.** A confusingly-named file cost a full render to diagnose.

---

## 7. Cost per scene

L40S billing: **$0.000542/s**. The GPU is attached for the **entire** request,
including the stages that cannot use it.

### Final, measured (roster preset, GPU rembg, qscale 11)

```
render    275.0s  (79% of billed time)
matte      35.3s  (10%)  explode 0.7 | rembg 20.2 | prores 0.6 | webm 13.8
overhead   38.8s  (11%)  reading files into the multipart response
─────────────────
service   349.1s         <- BILLED
```

| | per scene | per 5-scene project |
|---|---|---|
| Render only (before this work) | **$0.149** | $0.745 |
| **Render + inline matte (final)** | **$0.189** | **$0.945** |
| **Matte's share** | **$0.040** | $0.200 |
| **Overhead vs render-only** | **+27%** | +$0.20 |

### How the cost moved during the experiment

| Stage | Wall | Cost | vs render-only |
|---|---|---|---|
| Render only | 286.8s | $0.155 | — |
| + matte, rembg on **CPU** (bug) | 541.5s | **$0.294** | **+89%** |
| + matte, rembg on **GPU** | 370.0s | $0.201 | +29% |
| + qscale 11 | 357.7s | $0.194 | +25% |
| **+ roster preset (final)** | **349.1s** | **$0.189** | **+27%** |

The original estimate was **+18%**. Final is **+27%** — the gap is the ~39s of
multipart buffering, which is real and fixable (§11).

**The CUDA bug was a ~2× cost regression that never announced itself.** That is the
whole argument for the provider assertion in 5.3.

---

## 8. Drawbacks, honestly stated

1. **Every avatar now pays for a matte**, including users who never change the
   background. This is the literal price of "no second wait," and it was accepted
   explicitly. `AVATAR_INLINE_MATTE=false` is the off-switch.
2. **A billed GPU runs CPU work.** Three of four stages cannot use the L40S. A
   separate CPU-only Modal function would be cheaper; simplicity was chosen instead.
3. **Re-matting now costs a full re-render** *if* it must go through `/render`.
   Mitigated by keeping `avatar_matte.py` alive as the fallback path.
4. **Render and matte share a failure domain.** Mitigated by the try/except +
   `X-Matte-Error` + mp4-only degradation, so a matte crash cannot destroy a paid
   render.
5. **Two rembg versions** (2.0.69 in-container vs 2.0.77 on the backend), forced by
   Python 3.10 vs ≥3.11. Same weights, same call, so equivalent in practice — but
   it is a real divergence.
6. **The image dependency list got more fragile.** rembg drags in numpy/opencv/
   scikit-image, all of which will happily upgrade past OmniAvatar's load-bearing
   `numpy==1.26.4`. Handled with `--no-deps` + an explicit re-pin, but it is one
   more thing that can silently break inference.
7. **PNG intermediates are large** — 72MB per 11.7s clip, written twice (in and
   out). Cleaned up in a `finally`, but disk is finite.

---

## 9. Changes made

### Modal service — `modal-service/omniavatar/app.py`

- Image: `onnxruntime-gpu==1.19.2`, `rembg==2.0.69 --no-deps`, explicit runtime deps
  (`pooch`, `pymatting`, `jsonschema`, `scikit-image`), numpy re-pinned to 1.26.4
- u2netp weights **downloaded** at build time (not session-constructed — see 5.4),
  `U2NET_HOME=/root/.u2net`
- `_matte_mp4()` — the 4-stage pipeline, ported from `avatar_matte.py`, with all
  hard-won comments carried across verbatim
- `_get_rembg_session()` — lazy, container-lifetime, **asserts the CUDA provider**
- `_multipart_response()` — hand-rolled RFC 7578 encoder
- `/render` gains `inline_matte` form field; returns multipart on success, bare
  `video/mp4` when matting is off or failed
- Timing headers: `X-Matte-Seconds`, `-Explode-`, `-Rembg-`, `-Prores-`, `-Webm-`,
  `-Frames`, `-Error`, plus `X-Render-Wall-Seconds`
- Logs `>>> [matte] TIMING …` and `>>> [render] TOTAL … gpu_billed=…`

### Backend

- `avatar.py` — `RenderPayload` + `_parse_render_response()` accepting **both**
  multipart and legacy `video/mp4` (the two deploy separately, so either can be
  newer); writes and uploads all three files, each R2 upload isolated
- `avatar.py` — `_persist_render_result()` writes 2 scene columns + up to 3 Asset
  rows in one transaction; full timing breakdown logged
- `models/scene.py` + `alembic/versions/avatar_feature_squash.py` —
  `avatar_matte_error`, `avatar_matte_failed_at`
- `config.py` — `AVATAR_INLINE_MATTE` (default true)
- `avatar_queue.py` — auto-chain demoted to a backstop; **the docstring recording
  the DB-pool-drain incident is preserved**, since that is why nobody should
  re-add local per-scene chaining
- `avatar_matte.py` — now documented as the fallback path; clears
  `avatar_matte_error` on a successful re-matte
- `routers/projects.py` — exposes `matte_error` beside `has_matte`

### Verification done

- Multipart round-trip tested locally, **byte-exact** on all three parts, plus the
  legacy `video/mp4` fallback
- Full end-to-end render on the L40S with a real portrait and a real DB voiceover

---

## 10. Final verified result

Roster preset `man_beard` (`candidate_man2.jpg`) + a real DB voiceover
(scene 25 / project 1142, 11.7s), on an L40S:

```
HTTP 200 · 2-3 redirect hops · 3 parts parsed
render 275.0s | matte 35.3s | wall 349.1s | client 449.5s
  explode 0.7s | rembg 20.2s (0.056s/frame) | prores 0.6s | webm 13.8s
  358 frames · mp4 523KB · mov 20.1MB · webm 638KB
providers=['CUDAExecutionProvider', 'CPUExecutionProvider']  GPU
ALPHA IS REAL AND VARYING (5 frames, 5 distinct hashes, yuva444p12le)
```

### Whole experiment, end to end

| Stage | client wall | .mov | note |
|---|---|---|---|
| rembg on CPU (silent bug) | 1823s | 57.7 MB | CUDA 11 lib on a CUDA 12 image |
| rembg on GPU | 1263s | 60.5 MB | onnxruntime-gpu 1.19.2 |
| + qscale 11 | 444s | 24.6 MB | transfer was the bottleneck |
| **+ roster preset** | **449s** | **20.1 MB** | clean edges |

**~4× faster overall.** Every constraint met: matting is off the app server, runs
in parallel with the render across containers, and costs the user one wait.

### Verified

- ✅ rembg genuinely on CUDA (asserted at runtime, not assumed)
- ✅ Alpha real and varying — the check VP9 failed
- ✅ Alpha bit-identical under quantisation (`mse 0.00` / `psnr inf`, 300 frames)
- ✅ Multipart survives Modal's 150s→303 handoff, 3 parts intact
- ✅ Backend parses a real 62MB three-part response (previously synthetic-only)
- ✅ Clean edges on the hard case (brick + shelving + plants behind the presenter)

---

## 11. Open items

- [ ] **~39s of multipart buffering per render.** `_matte_mp4` reports 35.3s but the
      matte block bills 74.1s; the gap is reading all three files into memory before
      responding. Streaming the response would recover ~$0.021/scene and is the
      largest remaining waste
- [ ] Confirm `numpy==1.26.4` survived the rembg install (`pip list` in-container).
      Never verified; rembg's tree (opencv, scikit-image, pymatting) actively wants
      to upgrade it, and OmniAvatar's pin is load-bearing
- [ ] Measure a **5-scene parallel batch** — the wall-clock claim rests on the
      render path's known behaviour plus matting now living in those same
      containers. Reasonable, but not yet measured end to end
- [ ] Check **temporal stability** of the mask at full speed — per-frame stills
      cannot reveal silhouette jitter between frames
- [ ] `transparent: true` costs Remotion **~40% slower** frame extraction (PNG vs
      BMP). Unmeasured here; it is a real cost of matting on the render side
- [ ] Old workspace `h-raheel622` still holds a 19.1 GB Volume and a deployment;
      clean up to stop carrying storage in a dead account
- [ ] Consider a CPU-only Modal `/matte` for the **fallback** path, so no matte
      path can OOM the app server
- [ ] Nothing here is committed to git yet
