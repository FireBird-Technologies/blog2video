# OmniAvatar prompt test set

Prompts tuned for blog2video's actual use case: an avatar narrating ONE scene
of a multi-scene video, where each scene has its own voiceover narration. All
avoid explicit hand-gesture language where the earlier test showed artifacts,
except where deliberately testing hand motion again with a calmer phrasing.

## P1 — webcam narration, confirmed baseline (in progress)
> A person on a webcam speaking directly to the camera as if narrating a
> video, explaining ideas naturally with animated hand gestures that
> emphasize key points, genuine facial expressions that match the emotion
> and tone of their voice, and natural head movement.

Use case: general default narration prompt. Currently under test
(blueeyes_webcam_narration).

## P2 — calmer hands, explainer tone
> A person recording a video explainer, speaking clearly and confidently to
> the camera, with occasional light hand movements while making a point,
> facial expressions that shift naturally with the tone of their voice, and
> relaxed natural head movement.

Use case: softer hand-gesture phrasing than P1 ("occasional light hand
movements" vs "animated hand gestures") — tests whether toning down the
gesture language reduces hand artifacts while keeping some hand presence.

## P3 — no hands, pure expression/head focus (matches the successful retest)
> A person looking at the camera, speaking naturally with facial expressions
> that match the emotion and tone of their voice, with natural head and neck
> movement.

Use case: safest/cleanest option if hands keep artifacting — this is the
prompt that already tested clean on the Obama photo.

## P4 — enthusiastic / feature-highlight tone
> A person excitedly presenting a feature or product highlight directly to
> camera, energetic facial expressions and lively head movement that track
> the excitement in their voice, speaking as if genuinely enthusiastic about
> what they're explaining.

Use case: matches blog2video scenes that are upbeat/promotional (e.g.
feature call-outs, "why this matters" scenes).

## P5 — calm / narrative storytelling tone
> A person speaking thoughtfully and calmly to the camera as if telling a
> story, subtle and warm facial expressions that follow the emotional tone
> of their voice, gentle natural head movement, composed and sincere
> demeanor.

Use case: matches narrative/story-driven scenes (intros, emotional beats,
customer-story style content) rather than punchy feature lists.

## P6 — data/explainer with slight gravitas
> A person calmly and clearly explaining information to the camera as if
> presenting a report, measured facial expressions that reflect the tone of
> their voice, minimal but natural head movement, professional and composed
> presence.

Use case: matches data-heavy or serious-tone scenes (stats, comparisons,
"here's what the numbers show" style narration).

## P7 — calibrated lip-sync intensity (fixes exaggerated lip movement)
> A person speaking naturally to the camera, with lip movements and facial
> expressions that closely and subtly match the actual volume and pacing of
> their voice — calm delivery stays calm, emphasis stays understated,
> without exaggerated or theatrical motion. Natural head movement.

Use case: user feedback after watching P4 (enthusiastic tone) — lip movement
felt exaggerated/theatrical, likely because P4 explicitly asked for
"energetic... lively... genuinely enthusiastic" delivery, which pushed
lip-sync amplitude too far. P7 explicitly asks the model to CALIBRATE motion
to the real vocal intensity rather than amplify it — "calm delivery stays
calm" is the key constraint. No hand-gesture language (kept out per the
earlier hand-artifact fix). This is now the DEFAULT prompt going forward
unless a scene specifically calls for a different register.

## P8 — voiceover-matched, no over-exaggeration (refined from P7)
> A person speaking naturally to the camera, with lip movements and facial
> expressions that closely match the actual voiceover audio — driven by the
> real volume and emotion of the voice, calm delivery stays calm, emphasis
> stays understated, without over-exaggerated, dramatic, or theatrical
> motion. Natural head movement.

Use case: refinement of P7, keeping P7's sentence structure (which the user
liked) but making the exaggeration-suppression stronger. Adds "driven by the
real volume and emotion of the voice" (expressions follow the voiceover's
actual emotion, not a forced mood) while keeping P7's "calm delivery stays
calm, emphasis stays understated" clause. First used with the 10-step speed
test (man2).

---

## Test matrix run so far

L4 = $0.80/hr → cost = elapsed_s / 3600 * 0.80.

| Case name | Image | Prompt | Status | Render time | Cost |
|---|---|---|---|---|---|
| blueeyes_webcam_narration | candidate_woman_blueeyes.jpg | P1 | ✅ OK — 559382 bytes, h264 400x720+aac 6.2s | 583.6s (9.7min) | ~$0.13 |
| man1_no_hands_clean | candidate_man1.jpg | P3 | ✅ OK — 340701 bytes | 613.5s (10.2min) | ~$0.14 |
| lena_enthusiastic_feature | fixture_lena.jpg | P4 | ✅ OK — 560462 bytes. **User feedback: lip movement exaggerated/theatrical** — led to P7 | 1190s (19.8min) — ~2x the other two | ~$0.26 |
| woman1_calibrated_lipsync | candidate_woman1.jpg | P7 | ✅ OK — 314442 bytes | 620s (10.3min) | ~$0.14 |
| man2_calibrated_lipsync | candidate_man2.jpg | P7 | ✅ OK — 270565 bytes | 618s (10.3min) | ~$0.14 |
| test9_calibrated_lipsync | test9.jpeg | P7 | ❌ TIMED OUT (>1800s) then space was paused mid-render — no result, unclear if it would have succeeded or was genuinely stuck | >1800s | — |
| **man2_sageattention_comparison** | candidate_man2.jpg | P7 (identical to man2_calibrated_lipsync) | ✅ OK — 272670 bytes. **Controlled SageAttention before/after test** | 605s (10.1min) | ~$0.13 |

**Notable:** lena/P4 took ~2x as long as the other two (1190s vs ~600s) AND
is the one with reported exaggerated lip movement — worth watching whether
render time correlates with motion intensity/amplitude across future tests.

**SageAttention result: NO meaningful speedup.** man2_sageattention_comparison
(605s) vs man2_calibrated_lipsync (618s, identical image/audio/prompt) = only
~2% faster — within normal run-to-run noise, not a real improvement. Root
cause: `pip install sageattention` from PyPI installs an inert 20KB
Python-only stub, not the real CUDA-kernel-accelerated version (which needs a
from-source build with CUDA available, same fragility class as flash_attn).
Full writeup in AVATAR_PROGRESS.md.

### num_steps speed curve (all man2, same image/audio, DEFAULT_STEPS changed)
| Steps | Render time | vs 25-step | Output | Prompt |
|---|---|---|---|---|
| 25 | 618s (10.3min) | baseline | man2_calibrated_lipsync.mp4 | P7 |
| 15 | 526.6s (8.8min) | −15% | man2_15steps_comparison.mp4 | P7 |
| **10** | **395s (6.6min)** | **−36%** | man2_10steps_p8.mp4 | **P8** |

**Steps do NOT scale linearly** — there's a large fixed overhead per render
(model load, VRAM streaming via `num_persistent_param_in_dit=0`, T5/VAE
once-off). Revised estimate after the 10-step point: ~250-290s fixed floor +
higher per-step cost. Going below ~10 steps yields diminishing time returns
AND risks visible diffusion quality degradation (10 is already low; config
default is 50).

### GPU comparison (same man2, 10 steps, P8 prompt) — L40S is the BIG win
| GPU | $/hr | VRAM | Render time | Speed vs L4 | Cost/render |
|---|---|---|---|---|---|
| L4 (Ada) | $0.80 | 24GB | 395s (6.6min) | baseline | ~$0.088 |
| **L40S (Ada)** | **$1.80** | **48GB** | **158s (2.6min)** | **2.5x faster** | **~$0.079** ✓ |

**L40S is 2.5x faster AND slightly cheaper per render** despite 2.25x hourly
cost — the rare upgrade that wins on both. Architecture reason: L40S is the
same Ada Lovelace family as L4 but a far bigger chip (~3x FP16 compute, has
FP8 tensor cores, 48GB VRAM). A10G was correctly REJECTED — it's older
Ampere (no FP8), same 24GB, ~2x cost, no speed benefit. **L40S is the
recommended production GPU for OmniAvatar.**
NOTE: 48GB on L40S also means `num_persistent_param_in_dit=0` (T4-era VRAM
streaming) could likely be RELAXED — keeping the model resident on-GPU might
cut time even further. Untested — next lever if more speed is wanted.

NOTE: the 10-step runs also use the P8 prompt (not P7) — outputs should be
QA'd for both quality-at-10-steps AND whether P8 reduced the over-exaggerated
expressions vs P7/P4.

(Append rows here as more cases run — cross-reference outputs/manifest.jsonl
for full machine-readable detail: elapsed time, byte size, pass/fail.)
