# Test image candidates

All Unsplash (free, model-released stock photos, not scraped private
individuals) unless marked "existing fixture" (already in the repo, used to
verify EchoMimic/MuseTalk previously).

| Filename | Source | Description | Style |
|---|---|---|---|
| `fixture_obama.jpg` | existing fixture | Obama press photo | formal/press |
| `fixture_biden.jpg` | existing fixture | Biden press photo | formal/press |
| `fixture_lena.jpg` | existing fixture | Standard "Lena" test image | classic CV test image |
| `candidate_woman_blueeyes.jpg` | Unsplash (photo-1521146764736) | Woman, dark hair, blue eyes, nose ring, straight-on neutral gaze, bright even studio lighting | neutral / studio |
| `candidate_man1.jpg` | Unsplash (photo-1758874383966) | Man, denim shirt, short dark hair, neutral composed expression, home/office background | neutral / natural lighting |
| `candidate_man2.jpg` | Unsplash (photo-1758598497190) | Bearded man, beige sweater, direct gaze, relaxed, brick-wall background | neutral / natural lighting |
| `candidate_woman1.jpg` | Unsplash (photo-1758598304245) | Young woman, long brown hair, green eyes, red blazer, serene expression | neutral / natural lighting |
| `candidate_woman2.jpg` | Unsplash (photo-1758600434324) | Young woman, curly dark hair, freckles, close crop, neutral expression, gray background | neutral / close crop |
| `test9.jpeg` | user-provided | Man, cap, white t-shirt, standing straight facing camera, arms/hands naturally hanging at sides, park/outdoor background, neutral expression | full-torso, arms visibly at sides — the exact pose requested when stock search couldn't find one |

## Rejected/considered-and-dropped candidates
- Man waving (arm-extended selfie, shirt+tie) — good hand-motion test but
  smiling/waving (not neutral), and superseded by the "straight-faced" ask.
- Woman with curly hair mid-speech, colorful geometric background — good
  webcam-selfie framing but not neutral (talking/smiling), dropped for the
  same reason.
- 2 dramatic black-and-white studio portraits (shaved-head man, mustached
  man) — neutral/straight-faced as requested but very artistic/moody
  lighting, not representative of a typical webcam.
- **`test45.webp` / `test234.webp` — REJECTED and DELETED**: both were the
  same Dreamstime stock photo with visible "dreamstime.com" watermarks
  tiled across the image (an unpurchased preview, not a licensed photo).
  Not used — using unlicensed watermarked stock content isn't appropriate
  even for internal testing, and the watermarks would bake into the
  rendered video anyway.
- 5 rounds of Unsplash search for "standing straight, arms/hands visibly
  hanging at sides, neutral face, plain background" (to replace the
  rejected Dreamstime image's pose) — never found a genuine match. Most
  stock portraits either crop above the waist (hands never visible) or pose
  the arms deliberately (crossed, on hips, holding something, in pockets) —
  a dead-straight-down arm pose reads as awkward in curated stock photography,
  so it's rare. The AI search-summarization tool also repeatedly
  misdescribed poses (claiming "hands visible at sides" for photos where
  they clearly weren't) — had to download and manually eyeball every
  candidate. Resolved by the user providing `test9.jpeg` directly instead.

## Notes for comparison
- All "neutral" candidates deliberately avoid smiling/mid-speech/waving so
  the model's own expression generation (driven by audio + prompt) isn't
  fighting a pre-existing expression baked into the source photo.
  "candidate_woman_blueeyes.jpg" was the first genuinely straight-faced,
  well-lit (non-dramatic) pick and is the one used in the first full retest.
