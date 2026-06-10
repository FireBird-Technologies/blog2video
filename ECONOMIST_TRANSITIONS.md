# Economist Template — Scene Transitions

A reference for the transition system built on the `feat/econ-temp` branch. Every
move is **print-craft** (pages pushed/folded/rolled off the press, ink bars and
halftone plates sweeping the cut) — no stock cross-dissolves. This doc captures
**what the transitions are**, **how they're built**, and **how they're wired**, so
the same approach can be reused on other templates.

## Architecture (the idiomatic Remotion pattern)

Built on **`@remotion/transitions`** using `<TransitionSeries>` + custom
`TransitionPresentation`s — the same approach the Chronicle template uses. This is
the right way to do scene transitions in Remotion (vs. a hand-rolled per-scene
overlay wrapper, which is what the abrupt single-effect cuts used before).

Three pieces:

1. **`transitions/presentations.tsx`** — the custom presentation components. Each
   is a pure function of `presentationProgress` (0→1) and `presentationDirection`
   (`"entering"` = incoming scene, `"exiting"` = outgoing), so headless renders
   match the preview frame-for-frame. No timers, no randomness.
2. **`transitions/index.ts`** — `pickEconomistTransition(idx, fromLayout, toLayout, w, h)`
   returns `{ presentation, frames }`. A **pool** cycled by the OUTGOING scene
   index so consecutive cuts always differ, plus **hero special-cases**.
3. **`EconomistVideo.tsx`** — wires the pool into `<TransitionSeries>` and does the
   **overlap-aware frame math** (transitions consume frames, so total duration and
   audio sync must account for it).

## The transitions (7 custom presentations)

| Name | Look | Notes |
|------|------|-------|
| **pagePush** `{direction, distance}` | Parallax page-push: outgoing spread slides off + recedes (scale 0.95 + dim 0.82), incoming rides in from the opposite edge faster. Reads as one page pushed over another. | The workhorse "next spread". `distance` is canvas width so travel is correct in 16:9 **and** 9:16. |
| **whipBlur** `{direction}` | Fast directional motion-blur slide; horizontal blur peaks (~26px) at the midpoint via a `sin(πp)` bell, resolves crisp. The "whip pan". | Punchiest move; kept short (~20f) so it snaps. |
| **inkBar** `{direction, color}` | A solid Economist-red bar sweeps across; incoming revealed by the bar's trailing edge via `clip-path` so the cut happens **under** the colour, never as a visible dissolve. | Branded hard wipe. Used for the ending stamp. |
| **coverLift** `{color}` | Cinematic "turn the front cover": outgoing cover hinges at the top edge (`transformOrigin: 50% 0%`), tilts back in perspective (`rotateX`), lifts + dims; incoming settles from a 1.06 over-scale. A red seam rides the lifting edge. | **Hero exit only** — `perspective: 2200`. |
| **pageFold** `{direction}` | Crisp broadsheet half-page fold: a blank paper panel hinged at the vertical centre rotates 0→180° (`rotateY`) across the cut. Outgoing fades under the lifting panel; incoming visible when it lands. Paper gradient + hairline inset border + red free-edge seam. | Re-skin of Chronicle's bookPageFlip for newsprint. `perspective: 2400`. |
| **pressRoll** | "Hot off the press": next page rolls up from beneath a dark ink-roller cylinder riding the seam; outgoing feeds away above. Moving layers carry a soft bell-curve blur. | Cylinder is a CSS gradient bar. |
| **halftoneWipe** `{direction, color}` | inkBar geometry but the leading edge dissolves into **three columns of shrinking process dots** (CSS `radial-gradient` patterns) — ink density falling off a screened plate. | Pure styling, no SVG ids, fully deterministic. |

Shared easing: `ease(t) = t<0.5 ? 4t³ : 1 - (-2t+2)³/2` (easeInOutCubic).

## The pool & hero handling (`pickEconomistTransition`)

```
HERO_LAYOUTS_FROM = { cover_reveal }   → coverLift (46f) when leaving the cover
HERO_LAYOUTS_TO   = { ending_socials } → inkBar stamp (42f) when arriving at close

Mid-roll POOL (cycled by fromIdx % 8), alternates CALM and PUNCHY:
  0  pagePush(right)      32f   — workhorse next-spread
  1  pressRoll            28f   — page rolls up under the roller
  2  pageFold(forward)    36f   — crisp half-page fold (calm, tactile)
  3  inkBar(right)        30f   — branded red bar wipe (accent)
  4  pagePush(left)       32f   — push the other way (keeps direction varied)
  5  halftoneWipe(left)   30f   — red wipe → printer's process dots
  6  pageFold(backward)   36f   — fold turned back the other way
  7  whipBlur(right)      20f   — fast motion-blur whip (punch)
```

Keying off the **outgoing scene index** makes output deterministic: identical input
renders identical transitions, and the metadata frame-count + the render agree on
overlap (so audio stays in sync).

## The overlap math (critical)

`<TransitionSeries.Transition>` **overlaps** adjacent scenes — it consumes `frames`
from the boundary, so the composition is shorter than the naive sum of scene
durations. Two places must account for it:

1. **`calculateEconomistMetadata`** subtracts every transition's `frames` from the
   total:
   ```ts
   let totalFrames = sceneFrames.reduce((a, f) => a + f, 0);
   for (let i = 0; i < scenes.length - 1; i++)
     totalFrames -= pickEconomistTransition(i, fromLayout, toLayout).frames;
   ```
2. **Audio** runs on its own overlap-adjusted timeline. Scene start frames are
   computed by walking forward and subtracting each transition's frames, then each
   voiceover `<Sequence from={sceneStartFrames[i]}>` so narration stays in sync:
   ```ts
   let runningFrame = 0;
   scenes.forEach((s, i) => {
     sceneStartFrames[i] = runningFrame;
     runningFrame += sceneFrames[i];
     if (i < scenes.length - 1) runningFrame -= pickEconomistTransition(i, ...).frames;
   });
   ```

The pool is also **parameterised by canvas size** (`w`, `h`) so `pagePush` travel is
correct in both aspect ratios. The metadata pass only reads `.frames` (size-independent),
so passing landscape defaults there is harmless; the render site passes the real
`useVideoConfig()` dimensions.

## Why this works well

- **Variety without chaos** — the pool alternates calm (push/fold) and punchy
  (roll/bar/halftone/whip) moves, so the rhythm has lift but never feels busy.
- **On-brand** — every move is a print metaphor; the red accent + paper tones make
  the transitions feel like part of the publication, not generic stock wipes.
- **Deterministic & render-safe** — pure functions of `presentationProgress`, no
  timers/randomness, so headless render == preview.
- **Hero moments** — the cover exit and the closing stamp get dedicated cinematic
  moves the mid-roll cuts don't get.

## Files

- `remotion-video/src/templates/economist/transitions/presentations.tsx`
- `remotion-video/src/templates/economist/transitions/index.ts`
- `remotion-video/src/templates/economist/EconomistVideo.tsx` (TransitionSeries + overlap math)
- Mirrored in the CI tree: `frontend/src/components/remotion/economist/...`
