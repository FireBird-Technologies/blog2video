# Design Philosophy

Old Documentary Reel is raw, archival, found-footage true-crime/history storytelling. Scenes should feel like they were pulled from a battered film canister: clapperboard slates, grainy archive photographs, typewritten field reports, ledger-style statistics, contact sheets of negatives, and lower-third interview cutaways. Not clean or modern — worn, dusty, and procedural.

Core rules:
- Favor a document/evidence feel over polish: reports, photographs, tallies, testimony.
- Keep tone investigative and narrative, like a true-crime or historical documentary voiceover.
- Every layout must use **only** the prop names defined in this catalog; unknown keys are ignored downstream.
- **Always** populate `layout_props_json` with the layout-specific keys listed below when content supports them — do not leave structured layouts with `{}` if the narration contains extractable data.
- **Do not** put `titleFontSize` in `layout_props_json`. That is a UI default from `meta.json` and is not set by the scene generator.
- Global scene fields `title` and `narration` are **not** `layout_props_json` keys — they are set separately on every scene.
- **`narration` is required on every scene except `ending_socials`.** Every layout renders `narration` somewhere on screen — sometimes directly, sometimes as the fallback for a layout-specific text field (see per-layout rules below). A layout-specific field being filled does **not** excuse leaving `narration` empty; write both. `narration` should be a complete sentence of documentary voiceover, never a fragment or a duplicate of the title.
- **Every text field in this template — `narration` and every layout-specific body/paragraph field (`dossierBody`, `fieldNotesItems` entries, `statContext`, `interviewQuote`, etc.) — should be substantial enough to fill 2–3 lines at its default on-screen size, not a clipped one-liner.** These layouts have generous, enlarged text areas built for real paragraphs; a single short clause reads as sparse and undersells the space. Write full, detailed sentences with real specifics (names, numbers, dates, causes) pulled from the source — short labels (`title`, `statLabel`, `caption`, `slateDate`, stamp text) are the exception and stay brief.
- **Never output `assignedVideo`, `videoUrl`, `videoMuted`, or `videoVolume`.** A scene's background clip is stock footage chosen by the user in the editor after generation; any value you invent breaks rendering.

**Prop naming reminders (same field, different meaning per layout):**
- On `docreel_dossier`: `dossierBody` = the typed report paragraph — if set, `narration` should still carry the plain-language version of the same fact for continuity with the voiceover.
- On `docreel_interview`: `interviewQuote` = the exact spoken quote — if set, `narration` can repeat or closely echo it, since narration is also used as the fallback quote when `interviewQuote` is absent.
- On `docreel_photo_pan`: `subCaption` = the main description shown in the record panel (not a short credit line) — write it genuinely long, 4+ full sentences of real content.
- On `docreel_statistic`: `statContext` = a short one-line source note; `narration` carries the fuller descriptive sentence and is shown as a **separate** line beneath `statContext` when both are present and different — never make them identical.

---

# Layout Catalog

## docreel_slate
**Visual:** A clapperboard claps shut revealing production info, then the scene title and narration appear beneath it, italic, centered. (The SMPTE 3-2-1 leader that precedes it is its own auto-added scene, not part of this layout.)

**Best for:** Opening scene only; establishes the "case file" or documentary framing.

**Props (put in `layout_props_json`):**
- `slateScene` (string) — scene number on the clapperboard, e.g. `"1"`
- `slateTake` (string) — take number, e.g. `"3"`
- `slateDate` (string) — production-log style date, e.g. `"07.14.86"`
- `slateDirector` (string) — director name shown on the board
- `slateProduction` (string) — production/case title shown on the board
- `slateProductionLabel` / `slateSceneLabel` / `slateTakeLabel` / `slateDirectorLabel` / `slateDateLabel` (string, optional) — override the row label words themselves (defaults: `"PRODUCTION"`, `"SCENE"`, `"TAKE"`, `"DIRECTOR"`, `"DATE"`). Leave unset in almost every case — only set these if the source explicitly calls for different terminology.

Uses global `title` as the headline beneath the clapperboard, global `narration` as the italic line beneath the title.

Example:
```json
{
  "slateScene": "1",
  "slateTake": "3",
  "slateDate": "07.14.86",
  "slateDirector": "M. HALLORAN",
  "slateProduction": "COLD CASE FILES"
}
```

**When to Use:** scene 0, documentary opener.

---

## docreel_statistic
**Visual:** Ledger-style overlay — a big animated number counting up inside a bordered tally box, with a label and a line of context beneath.

**Best for:** Key figures, "by the numbers" moments, scale-of-the-story beats.

**Props (put in `layout_props_json`):**
- `statValue` (string) — the large number/figure, e.g. `"47"` or `"12%"`
- `statLabel` (string) — short label describing the statistic, e.g. `"Cases Reopened"`
- `statContext` (string) — 2–3 lines of source/context, a real sentence, e.g. `"Each file was cross-referenced against the original 1986 archive, confirming a pattern investigators had missed for nearly a decade."`

Uses global `narration` as a fuller descriptive sentence shown beneath `statContext` (only shown if it differs from `statContext` — write a genuinely different, more complete sentence, not a restatement).

Example:
```json
{
  "statValue": "47",
  "statLabel": "Cases Reopened",
  "statContext": "Each file was cross-referenced against the original 1986 archive, revealing a pattern of missed connections investigators had overlooked for nearly a decade."
}
```

**When to Use:** data-led beats, scale, outcomes, tallies.

---

## docreel_title_card
**Visual:** Full-bleed archive photo or clip with a bottom scrim, a large chipped-edge chapter title, and a narration line beneath it.

**Best for:** Establishing a new chapter, location, or time period.

**Props (put in `layout_props_json`):**
- `chapterTitle` (string) — overrides the on-screen title text if set (otherwise falls back to global `title`)

Uses global `title` as the chapter title when `chapterTitle` is not set, global `narration` as the line beneath the title (**always required** — this is the primary description text for this layout). The title and narration are centered and the narration line has room for a real sentence or two, not just a fragment — write a fuller establishing description here than the global 12–20 word guideline (aim 20–35 words) since this layout is otherwise text-sparse.

Example:
```json
{
  "chapterTitle": "A Town Divided"
}
```

**When to Use:** chapter breaks, establishing shots, scene-setting.

---

## docreel_dossier
**Visual:** A typewritten field-report insert on aged paper texture, with a heading, a type-in body paragraph, and an optional rubber-stamp classification mark.

**Best for:** Case files, reports, evidence summaries, official-record beats.

**Props (put in `layout_props_json`):**
- `dossierHeading` (string) — heading at the top of the report, e.g. `"Incident Summary"`
- `dossierBody` (string) — the typewritten body paragraph, type-in animated. Write 2–4 full sentences (real case detail: who, what, when, where) — enough to fill 2–3 lines, not a single clipped line.
- `dossierStamp` (string) — short rubber-stamp verdict, 1–2 words, that states **this specific scene's actual conclusion or status**. It must be derived from the content, not a generic spy-movie word. Ask "what did this record conclude?" and stamp that: a benchmark that failed → `"FAILED"`; a deprecated API → `"DEPRECATED"`; a shipped feature → `"SHIPPED"`; a resolved outage → `"RESOLVED"`; an unresolved case → `"UNRESOLVED"`. Only use `"CONFIDENTIAL"`/`"CLASSIFIED"` when the subject genuinely involves secrecy. If no verdict fits the content, omit the field entirely rather than inventing one.
- `dossierClassification` (string) — short label, top-right, naming **what kind of record this is** within the subject's own domain. Again content-derived, not generic: a performance report → `"Benchmark"`; a security writeup → `"Advisory"`; a postmortem → `"Incident Report"`; a spec → `"Specification"`; migration notes → `"Migration Log"`. Avoid defaulting to bureaucratic filler like `"Internal"`, `"Restricted"` or `"Official"` unless the source material is literally about classified or internal-only material. Omit rather than pad.

**Both of these must read as if lifted from a real document about THIS topic.** A viewer who knows the subject should recognise the words as belonging to it. Generic officialdom (`"INTERNAL"`, `"VERIFIED"`, `"OFFICIAL"`, `"APPROVED"`) applied to unrelated technical or cultural content looks like set-dressing and breaks the documentary illusion.

**Derive both from this scene's own content, not from the template's examples.** Before writing them, re-read what you have already written for *this specific scene* — its `title`, its `narration`, its `visual_description`, and the `dossierHeading`/`dossierBody` you just wrote — and pull the stamp and classification out of that material. They are a summary of this scene, not decoration bolted onto it:
- `dossierClassification` should name the kind of document `dossierBody` reads like. If the body describes a measured comparison, it's a `"Benchmark"`; if it describes an outage and its fix, it's a `"Post-Mortem"`; if it warns about a vulnerability, it's an `"Advisory"`.
- `dossierStamp` should be the outcome that same body reports. If `dossierBody` ends with the problem fixed, stamp `"RESOLVED"`; if it ends unanswered, stamp `"UNRESOLVED"`; if the thing described was discontinued, stamp `"DEPRECATED"`.

A quick check before you commit them: if you swapped this scene's stamp/classification onto a different scene in the video and nobody would notice, they are too generic — rewrite them so they only fit *this* scene.

`dossierBody` is the primary on-screen text for this layout; still set global `narration` to a plain-voiceover version of the same fact (used as the fallback body if `dossierBody` is ever absent).

Example — a true-crime/archival subject, where the classified vocabulary genuinely fits:
```json
{
  "dossierHeading": "Incident Summary",
  "dossierBody": "Subject was last confirmed seen departing the north gate at approximately 22:40. Security logs show no further contact after that point, and no forced entry was recorded at the residence in the following forty-eight hours.",
  "dossierStamp": "UNRESOLVED",
  "dossierClassification": "Incident Report"
}
```

Example — a software/technical subject, where the SAME layout must speak that domain's language instead:
```json
{
  "dossierHeading": "Migration Post-Mortem",
  "dossierBody": "The cutover began at 02:00 and was expected to take twenty minutes. Replication lag on the primary shard pushed it past four hours, and read traffic was served from a stale replica for most of that window.",
  "dossierStamp": "RESOLVED",
  "dossierClassification": "Post-Mortem"
}
```
Note how the stamp and classification change completely with the subject — that is the point. Copying the first example's wording onto an unrelated topic is the failure mode to avoid.

**When to Use:** case files, official reports, evidence beats.

---

## docreel_photo_pan
**Visual:** Split frame — a single archive photograph slow-panned and zoomed (Ken Burns) on one side, presented as a print pulled from a torn negative-sleeve corner with a grease-pencil review tick, paired with a full archival-record panel on the other side: a small heading, the caption, and a genuinely long multi-sentence description. This is a text-substantial layout, not a photo-with-small-caption layout. When no photo/video is supplied, the print column doesn't exist at all — the record panel expands to fill the entire frame, with a faint spinning film reel and an unspooling filmstrip spiral watermarked behind the text, so the scene reads as archival footage rather than a bare text card.

**Best for:** A single evocative archive photo (or a moment with no available photo at all) that needs real accompanying description — not just a credit line.

**Props (put in `layout_props_json`):**
- `caption` (string) — primary caption/title for the photo, e.g. `"Main Street, looking east"` (falls back to global `title`)
- `subCaption` (string) — **the main body text of the record panel. Write it genuinely long and detailed: 4+ full sentences** covering what the photo shows, when and where it was taken, who took it if known, and why it matters to the story. This is the layout's primary content — do not write a short credit line here. Falls back to global `narration` if unset, so `narration` must also carry real descriptive substance.
- `photoPanLabel` (string, optional) — small heading at the top of the record panel, defaults to `"ARCHIVE PHOTOGRAPH"`. Leave unset unless the source calls for different terminology.

Example:
```json
{
  "caption": "Main Street, looking east",
  "subCaption": "Photographer unknown. The print was taken sometime in the early 1970s, most likely in autumn based on the shadows and the awnings visible over the storefronts. This stretch of Main Street was demolished within the decade to make way for the municipal parking structure, and no other photographs of the block are known to survive in any collection."
}
```

**When to Use:** single-photo beats where the photo needs a substantial accompanying description, not just archival imagery moments in passing. Also works as a "no image available" beat — the empty-print treatment still reads as intentional archival evidence.

---

## docreel_contact_sheet
**Visual:** A grid of archive frames styled as a contact sheet of negatives on a backlit light table — sprocketed cell edges, a grease-pencil circle on one "pick" frame, and a grease-pencil X scrawled across a "reject" frame, with a still take-up reel watermarked in the corner. The `title` and body text sit in a "CASE NOTES" card that fills the last cells of that same grid as one merged block (not a separate header line) — the panel occupies a full 2x2 block in landscape or the whole bottom row in portrait, so it comfortably holds a genuinely long note, not just a short line. When only the single scene image is available (the usual case — scenes carry one bound image), it's repeated across the grid cells with a different crop/zoom in each, so the sheet still reads as multiple frames off the same roll rather than one photo shown once; this is intentional, not a placeholder state.

**Best for:** A single evocative image OR a true montage — works well either way, since the single-image case now fills the whole sheet on its own.

**Props (put in `layout_props_json`):**
- `contactSheetImages` (array of image URLs, up to 9) — only include if the scene genuinely has multiple distinct bound images; otherwise omit it and the single scene image is used and repeated across the grid automatically
- `contactSheetNotes` (string) — **the CASE NOTES panel's main body text. Write it genuinely long and detailed: several full sentences** about what the frames show, why one was circled, what the roll represents to the case — the panel has real room, don't write a short caption here. Falls back to global `narration` if left empty, so `narration` must also carry real substance when this is unset.

Uses global `title` as the panel heading.

Example:
```json
{
  "contactSheetNotes": "Dozens of frames from that same roll survive in the case file, most of them unremarkable — a stretch of road, a parked car, the same intersection shot three times from slightly different angles. Only one frame was ever circled by an investigator, and the report never explains why."
}
```

**When to Use:** montage moments or reviewing-the-evidence beats — with multiple archive images if available, but a single strong image works too.

---

## docreel_interview
**Visual:** A full-frame interview photo/clip (framed slightly high, talking-head bias) with a lower-third quote card: large quote mark, the spoken quote in italic, and a subject name/role credit line.

**Best for:** Eyewitness testimony, expert commentary, first-person accounts.

**Props (put in `layout_props_json`):**
- `interviewQuote` (string) — the exact spoken quote (falls back to global `narration` if absent — so `narration` should still contain a genuine quote-like line even when `interviewQuote` is set)
- `interviewSubject` (string) — name of the person quoted (falls back to global `title`)
- `interviewRole` (string) — their role/relation, e.g. `"Former Resident"`

Example:
```json
{
  "interviewQuote": "I heard the sirens before I saw anything at all, and by the time I got to the window, half the street was already outside.",
  "interviewSubject": "Margaret Doyle",
  "interviewRole": "Former Resident"
}
```

**When to Use:** testimony, first-person accounts, expert commentary.

---

## docreel_field_notes
**Visual:** A single photograph faded to a watermark behind a typewritten notebook page — a heading and a list of short, independent facts, each with a checkbox that ticks itself off as the row reveals. Purely a list of facts, not a sequence or timeline — items don't reference each other.

**Best for:** A scene that needs to state several short confirmed details at once — a "what we know so far" recap beat.

**Props (put in `layout_props_json`):**
- `fieldNotesHeading` (string, optional) — heading at the top of the page; falls back to global `title` if unset
- `fieldNotesItems` (array of strings, up to 7) — each a short, standalone fact (one sentence). Falls back to global `narration` as a single item if omitted, so the page never renders empty.

Uses global `title` as the heading when `fieldNotesHeading` is not set. Global `narration` is only shown as a fallback item — when `fieldNotesItems` is populated, still write a real `narration` sentence too (it's not displayed twice, but every scene needs it per the global rule).

Example:
```json
{
  "fieldNotesHeading": "What We Know So Far",
  "fieldNotesItems": [
    "Subject last confirmed seen 03.14.86, 22:40.",
    "No forced entry found at the residence.",
    "Vehicle recovered eight miles north, undamaged.",
    "Two witnesses report the same description."
  ]
}
```

**When to Use:** recapping multiple confirmed facts at once, a "known details" beat. Each item must be independently true on its own — never phrase items as steps in a sequence or events that build on each other (that belongs in prose narration, not this layout).

---

## docreel_essay_captions
**Visual:** Full-bleed archival footage with blunt statements punched directly onto the frame — no card, no box, no caption background beyond a dimming wash. Statements accumulate one at a time, each new line appearing below the last while every earlier line stays fully visible, building a readable stack rather than replacing lines. Modeled on the Adam Curtis essay-documentary technique, where on-screen text carries the argument itself rather than decorating the footage.

**Best for:** A pointed editorial beat — stating the documentary's argument or a sharp turn in the story as a sequence of blunt assertions, rather than a flowing narrated paragraph.

**Props (put in `layout_props_json`):**
- `essayStatements` (array of strings, 2–6 items) — short, blunt, standalone declarative statements. **Do not default to a fixed count** — decide how many lines the actual argument needs: a single sharp turn might only need 2 lines, a fuller unraveling of an assumption might need 5 or 6. Split the argument at its natural beats rather than padding to a target number or cramming everything into one or two overloaded lines. Each statement must work as a complete assertion on its own — never a fragment that only makes sense next to the others, and never a numbered/dated sequence (that belongs in `docreel_field_notes` or plain narration instead).

Falls back to `[title, narration]` as a two-statement sequence if `essayStatements` is omitted, so the scene never renders empty.

Example:
```json
{
  "essayStatements": [
    "The official story had a problem.",
    "Nobody could agree on the timeline.",
    "And the one witness who could was never interviewed."
  ]
}
```

**When to Use:** sharp editorial or argumentative beats — sparingly, since its blunt directness stands out from the archival/document-driven layouts. Best once or twice per video, at a turning point in the story.

---

## ending_socials
**Visual:** The projector spins down, a spotlight blooms behind a script-style "THE END" card, then brand name, website CTA, and social icons roll in.

**Best for:** Final scene only.

**Props (put in `layout_props_json`):**
- `brandName` (string) — production/brand name shown beneath the end card
- `ctaButtonText` (string, optional) — short CTA label
- `websiteLink` (string) — URL for the CTA
- `showWebsiteButton` — `"true"` or `"false"` (string)
- `socials` (array) — rows `{ "platform": "instagram", "enabled": "true", "label": "@handle or URL" }`. Supported platforms: `facebook`, `instagram`, `youtube`, `medium`, `substack`, `linkedin`, `tiktok`. Set `enabled` to `"false"` for platforms not mentioned in the source.

Uses global `title` as the end-card text (defaults to "The End" if empty). **This is the one layout where `narration` should be left empty** — it has no narration slot.

Example:
```json
{
  "brandName": "Cold Case Files",
  "showWebsiteButton": "true",
  "websiteLink": "https://example.com",
  "socials": [
    { "platform": "instagram", "enabled": "true", "label": "@coldcasefiles" }
  ]
}
```

**When to Use:** Always the **last scene** when CTA or social data exists; otherwise still use it as a plain sign-off with just `brandName`/title.

---

# Scene Flow Rules

- Scene 0 must use `docreel_slate`.

**System-owned opening leader:** every documentary video also opens with a silent 3-2-1 academy-leader countdown scene (`docreel_countdown`). It is added automatically by the pipeline — **never generate it yourself, and never use `docreel_countdown` as a `preferred_layout`.** Your scene 0 is still `docreel_slate`; the leader is prepended in front of it.
- Use `docreel_title_card` for chapter breaks and establishing new locations/time periods.
- Use `docreel_dossier` for case files, reports, and evidence summaries.
- Use `docreel_photo_pan` for single evocative archive photographs.
- Use `docreel_contact_sheet` for montage beats or "reviewing the evidence" moments — multiple related images if available, a single strong image otherwise.
- Use `docreel_interview` for eyewitness or expert testimony.
- Use `docreel_statistic` for key figures and scale-of-the-story beats.
- Use `docreel_field_notes` for a "what we know so far" beat that states several confirmed facts at once.
- Use `docreel_essay_captions` sparingly, for a sharp editorial/argumentative turn in the story.
- Always end with `ending_socials`.
- Aim for setup (`docreel_slate` → `docreel_title_card`) → development (dossier, photo pan, contact sheet, interview, statistic, field notes, essay captions) → resolution (`ending_socials`).

---

# Content Extraction Rules

**Global fields (every scene):**
- `title`: 3–8 words, chapter/section label or subject name.
- `narration`: 1–2 full sentences of documentary voiceover, about 25–40 words per scene — enough to fill 2–3 lines at the layout's default text size, not a short clipped clause. **Required on every scene except `ending_socials`.**
- Use an investigative, narrative documentary tone — not marketing copy.

**Per layout (`layout_props_json`):**
- **`docreel_slate`:** Fill `slateScene`/`slateTake`/`slateDate`/`slateDirector`/`slateProduction` when the source supports a case/production framing; otherwise use plausible generic values (these stay short — production-log fields, not prose). Global `narration` is the line under the title — required, 25–40 words, 2–3 lines.
- **`docreel_statistic`:** Map the cited figure to `statValue`/`statLabel` (short labels, stay brief). Write `statContext` as a real 2–3 line sentence of source/context (not a clipped fragment) — e.g. how the figure was verified, compared, or what it means. Global `narration` must be a fuller, different 2–3 line sentence from `statContext` — never duplicate it, and never leave either as a one-liner.
- **`docreel_title_card`:** Set `chapterTitle` only if it should differ from the global `title`. Global `narration` is the primary description text for this layout — always required, 25–40 words / 2–3 lines, since the centered layout has room for it.
- **`docreel_dossier`:** Write `dossierBody` as a real 2–3 line typed paragraph (multiple sentences of case detail — who, what, when, where), not a single clipped line; the type-in effect is built for real paragraph length. Global `narration` should restate the same fact as a full plain-voiceover sentence — do not leave it empty just because `dossierBody` is filled.
- **`docreel_photo_pan`:** `caption` is short (a few words, a title/label). `subCaption` is the layout's primary body text — write it genuinely long and detailed (4+ full sentences: what/when/where/who/why it matters), enough to comfortably fill the record panel; do not write a short line here. Global `narration` should carry the same substance as a fallback (used verbatim as `subCaption` if that field is left empty). Applies equally when no photo is available — the scene still needs its full description.
- **`docreel_contact_sheet`:** Global `title` and `narration` are shown together inside the CASE NOTES panel — write `narration` as a full 2–3 line description of what the images/roll depict, not a short caption; it must add real information, not repeat the title.
- **`docreel_interview`:** Put the exact quote in `interviewQuote`, written as a real 2–3 line quote (a full remembered moment, not a one-line soundbite) when the source supports it. Global `narration` should still be a genuine quote-like sentence of similar length (it is the fallback quote), not a generic label.
- **`docreel_field_notes`:** Populate `fieldNotesItems` with independent, standalone facts — never phrase them as a sequence. Each item should be a full sentence with real specifics (not a 2-3 word tag), long enough to wrap to 1-2 lines in its row. Global `narration` is still required per the global rule (25–40 words) even though the list is the primary on-screen content.
- **`docreel_essay_captions`:** Populate `essayStatements` with blunt, complete assertions — short (aim under 12 words each) but each independently meaningful, unlike `fieldNotesItems` which are neutral facts; these should read as editorial punches. Choose the number of statements (2–6) based on how many distinct beats the argument actually has — don't pad to a round number or squeeze multiple ideas into one line. Global `narration` is still required per the global rule.
- **`ending_socials`:** Leave global `narration` empty. Populate `brandName`, `websiteLink`, `socials` only from what the source actually provides.

**Grounding:** If the source does not support a layout's required props, choose a simpler layout instead of inventing figures or names. Never invent case numbers, dates, or names not present in the source — use generic but plausible placeholders (e.g. `"UNTITLED"`) only for slate/production metadata that has no narrative bearing.

---

# Variety Rules

- Do not repeat the same layout more than 2 consecutive scenes.
- Alternate between title-card, dossier, photo-pan, contact-sheet, interview, statistic, field-notes, and essay-captions when the content fits.
- `docreel_contact_sheet` no longer requires multiple images — it works fine with just the single scene image — but don't overuse it; reserve it for genuine montage/"reviewing the evidence" beats rather than defaulting to it for every image-bearing scene.
- Use `docreel_interview` only when the source contains an actual quote or testimony.
- Use `docreel_field_notes` only when the source supports at least 3 distinct, independent facts — otherwise a shorter layout fits better.
- Use `docreel_essay_captions` at most once or twice per video — it's a sharp editorial punctuation mark, not a repeating pattern.
- End with `ending_socials`.
