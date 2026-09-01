Layout catalog for Old Documentary Reel template

**Never output `assignedVideo`, `videoUrl`, `videoMuted`, or `videoVolume`** — stock-footage clips are chosen by the user in the editor after generation, and inventing one breaks rendering.

**`narration` is required on every scene except `ending_socials`.** Every layout displays `narration` on screen, either directly or as the fallback for a layout-specific text field (`dossierBody`, `interviewQuote`, `subCaption`, `statContext`). Filling the layout-specific field does not excuse leaving `narration` empty — always write a genuine documentary-voiceover sentence for `narration` too.

=====================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `old-documentary-reel` template. Think like a documentary editor: each scene should feel like a distinct piece of archival evidence. Distribute layouts across the story (slate → title card → dossier/photo-pan/contact-sheet/interview/statistic/field-notes/essay-captions → reel-out) instead of repeating one layout.

- `docreel_slate`
  - **Best for**: Scene 0 hero. Clapperboard clap, title + narration beneath. (The 3-2-1 leader is a separate auto-added scene before this one.)
  - **Rule**: Use **only for the opening scene**.

- `docreel_title_card`
  - **Best for**: Chapter breaks, establishing a new location or time period. Full-bleed archive photo, chapter number/location metadata, chapter title, narration line.
  - **Props**: `chapterTitle` (overrides global title). `narration` is required — it's the primary description text.

- `docreel_dossier`
  - **Best for**: Case files, official reports, evidence summaries. Typewritten report card with heading, type-in body, optional stamp.
  - **Props**: `dossierHeading`, `dossierBody` (the report paragraph), `dossierStamp`, `dossierClassification`. Also set `narration` to a plain-voiceover version of the same fact. `dossierStamp` is this scene's actual verdict (`"FAILED"`, `"SHIPPED"`, `"RESOLVED"`, `"DEPRECATED"`) and `dossierClassification` is what kind of record it is in the subject's own vocabulary (`"Benchmark"`, `"Advisory"`, `"Post-Mortem"`). Derive both from **this scene's own** `title`, `narration`, `visual_description` and `dossierBody` — the classification names what kind of document the body reads like, the stamp is the outcome that body reports. Never generic officialdom like `"INTERNAL"`/`"VERIFIED"`; if the same pair would fit any other scene equally well, it's too generic. Omit either if nothing genuine fits.

- `docreel_photo_pan`
  - **Best for**: A single evocative archive photograph (or a "no photo available" moment), paired with a real record panel (heading + long description), not just a small caption.
  - **Props**: `caption` (short title, falls back to global title), `subCaption` (the main description — write it genuinely long, 4+ sentences, falls back to `narration`), `photoPanLabel` (optional heading override, defaults to "ARCHIVE PHOTOGRAPH"). Write real substance — this layout has room for a full paragraph, with or without a photo.
  - **No-photo behavior**: with no image/video bound, the print column is dropped entirely and the record panel fills the full frame, with a spinning film reel + unspooling filmstrip watermark behind the text — no extra props needed for this.

- `docreel_contact_sheet`
  - **Best for**: Montage beats or "reviewing the evidence" moments — works with a single strong image (repeated across the grid as varied crops) or genuinely multiple images.
  - **Props**: `contactSheetImages` (up to 9 URLs, only if the scene genuinely has multiple distinct bound images — otherwise omit and the single scene image fills the grid automatically), `contactSheetNotes` (the CASE NOTES panel's main body — write it genuinely long, several full sentences; falls back to `narration`). Global `title` is the panel heading.
  - **Rule**: No longer requires multiple images, but don't default to it for every scene — reserve it for genuine montage/evidence-review beats.

- `docreel_interview`
  - **Best for**: Eyewitness testimony or expert commentary. Full-frame photo/clip with lower-third quote card.
  - **Props**: `interviewQuote` (exact quote, falls back to `narration`), `interviewSubject` (falls back to title), `interviewRole`.
  - **Rule**: Use only when the source contains an actual quote or testimony.

- `docreel_statistic`
  - **Best for**: Key figures, "by the numbers", scale-of-the-story beats. Ledger-style animated tally.
  - **Props**: `statValue`, `statLabel`, `statContext` (short source note). `narration` shown as a fuller, different sentence beneath `statContext` — never duplicate it.
  - **Rule**: Use **only** when the source content for this scene contains an actual numeric figure — an integer, decimal, percentage, currency amount, multiplier, ratio, or count (e.g. `47`, `3.2`, `12%`, `$4.5M`, `10x`, `1 in 5`). If the scene has no such number, pick a different layout. A year/date on its own, a vague quantifier ("many", "most", "several", "a handful"), or a number you would have to infer or invent does **not** qualify — never manufacture a figure to justify this layout.

- `docreel_field_notes`
  - **Best for**: A "what we know so far" recap beat — several short, independent confirmed facts at once. Single photo faded behind a typed checklist page.
  - **Props**: `fieldNotesHeading` (falls back to title), `fieldNotesItems` (up to 7 standalone facts — never a sequence/timeline).
  - **Rule**: Use only when the source supports 3+ distinct facts.

- `docreel_essay_captions`
  - **Best for**: A sharp editorial/argumentative beat — blunt statements punched directly onto full-bleed footage, no card, accumulating into a stack that stays fully visible (lines never disappear). Modeled on essay-documentary style (text as argument, not decoration).
  - **Props**: `essayStatements` (2–6 short, blunt, standalone assertions — never a numbered sequence or fragment). Pick the count to match how many distinct beats the argument has; don't pad to a fixed number.
  - **Rule**: Use sparingly — at most once or twice per video, for a genuine turning point in the argument.

- `ending_socials`
  - **Best for**: Final scene only — projector spin-down, "THE END" card, brand name, website CTA, social icons.
  - **Props**: `brandName`, `ctaButtonText`, `websiteLink`, `showWebsiteButton`, `socials`.
  - **Rule**: Use **only** on the last scene. Leave global `narration` empty for this layout — it has no narration slot.

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `docreel_slate`.

**System-owned opening leader:** every documentary video also opens with a voiced 3-2-1 academy-leader countdown scene (`docreel_countdown`). It is added automatically by the pipeline and uses the voice selected for the project — **never generate it yourself, and never use `docreel_countdown` as a `preferred_layout`.** Your scene 0 is still `docreel_slate`; the leader is prepended in front of it.
- The last scene → **always** `ending_socials`.
- Use `docreel_title_card` for chapter/location transitions.
- Alternate between `docreel_dossier`, `docreel_photo_pan`, `docreel_contact_sheet`, `docreel_interview`, `docreel_statistic`, `docreel_field_notes`, and `docreel_essay_captions` for the middle scenes, based on what the source content actually supports.
- Do not repeat the same layout more than 2 consecutive scenes.
- `docreel_contact_sheet` works with a single image but shouldn't be the default for every image-bearing scene — reserve it for genuine montage/evidence-review beats; `docreel_interview` only when a real quote/testimony exists in the source; `docreel_statistic` only when the scene has a real number/decimal/percentage/currency figure in the source; `docreel_field_notes` only when 3+ independent facts are available; `docreel_essay_captions` at most once or twice per video.
