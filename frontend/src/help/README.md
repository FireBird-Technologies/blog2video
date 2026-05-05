# Help articles and demo videos

This folder holds **help-only** code: Remotion players, fake template previews, and picker demos. Do **not** put live product UI here—keep that under `src/components/` and `src/pages/`. Help code **imports** production components; production code should **not** import from `src/help/`.

## Entry points

- **In-app help videos:** `HelpPostPage` lazy-loads `HelpDemoPlayer` from here.
- **Blog / template marketing demos:** `BlogPostPage` and `TemplatePageView` lazy-load `BlogDemoPlayer`.

## Adding or changing a help flow

1. **`HelpDemoPlayer.tsx`** — Defines each flow (`create-project`, `edit-scene`, `change-voiceover`, `custom-template`, `change-template`), scene timing, captions, and which screen to show per `focus` key.
2. Prefer **real product components** with a `demoMode` (or similar) prop when you need the same UI as the app: gate API calls, portals, and submit handlers so demos never hit the network or escape the player frame.
3. **Template thumbnails in help** — Use `HelpFakeTemplatePreview` (or pass a matching override into forms/cards that support it) so help never depends on heavy Remotion template previews.
4. **`TemplateChangePickerDemo.tsx`** — Standalone mock of the “Change template” picker UI for the change-template flow overlay; keep built-in cells on fake previews unless the real picker is extracted and reused with demo props.

## File naming

- `*DemoPlayer.tsx` — Remotion `Player` compositions.
- `*Demo.tsx` or `*PickerDemo.tsx` — Isolated UI slices used only inside those players.
- `HelpFake*.tsx` — Static placeholders shared across flows.

## Checks before merging

- Run `npx tsc -b --noEmit` in `frontend/`.
- Open the relevant help article(s) in dev and confirm no console errors (especially missing API or portal issues).
