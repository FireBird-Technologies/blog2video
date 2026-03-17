# Remotion Neon Theme — Generator Prompt

You are implementing a complete Remotion video theme from scratch. This document defines the aesthetic, technical constraints, and creative direction. Component design and composition structure are intentionally left open — use your judgment to build whatever components serve the theme best.

---

## What You Are Building

A **video theme system** for Remotion — a set of reusable compositions and components that can be combined to produce polished video output. Think of it like a motion design kit: a consistent visual language applied across scenes, transitions, data visualizations, and UI overlays.

The reference aesthetic is a glowing cyan origami swan photographed against pure darkness — neon wireframes, electric light, black void. Everything in this theme should feel like it is lit from within.

---

## Bootstrap

```bash
npx create-video@latest remotion-neon-theme
cd remotion-neon-theme
npm install
```

Additional packages you will likely need:

```bash
npm install @remotion/google-fonts
```

Add others as you see fit based on what you build.

---

## Design Language

### Color

Everything lives on a near-black canvas. The only colors that exist are shades of electric cyan and darkness.

| Role | Value |
|------|-------|
| Background | `#000509` |
| Panel surface | `#040d14` |
| Primary neon | `#00d4ff` |
| Secondary neon | `#00ffea` |
| Borders | `rgba(0, 212, 255, 0.18)` |
| Muted text | `rgba(255, 255, 255, 0.35)` |

No other hues. No white fills. No gradients on solid objects. Depth comes from opacity, glow radius, and layering — not from color variety.

### Glow

Every neon element glows. Apply CSS `filter: drop-shadow` in layers:

```
drop-shadow(0 0 4px #00d4ff)
drop-shadow(0 0 14px rgba(0, 212, 255, 0.5))
drop-shadow(0 0 40px rgba(0, 212, 255, 0.2))
```

Scale blur radii with a global `neonIntensity` prop (default `1.0`, range `0.5–2.0`) so the caller can tune glow without touching component internals.

### Typography

- **Display / titles**: Syne, weight 700–800
- **Labels / data / monospaced readouts**: Syne Mono
- **Body / controls**: Space Grotesk, weight 300–500

Load all three via `@remotion/google-fonts`. Do not rely on system fonts.

Rules: sentence case everywhere, generous letter-spacing (`0.1–0.4em` depending on size), no bold in body copy — use weight instead.

### Motion

- Use Remotion's `spring()` for entrances, transitions, and state changes. Suggested config: `damping: 20, stiffness: 35–50`.
- Use `interpolate()` with `Easing.bezier` for scrub-linked animations.
- All neon elements should breathe — a continuous `0.65 → 1.0` opacity oscillation at roughly `0.5 Hz`.
- No instant cuts between states. Everything eases.
- Stagger multi-element reveals by `4–8 frames` per element.

---

## Technical Constraints

- **Resolution**: 1920×1080, 60fps
- **Entry point**: `src/Root.tsx` exporting `RemotionRoot`
- **All compositions registered** in `Root.tsx` using `<Composition>`
- **Canvas elements** must handle `devicePixelRatio` — multiply canvas width/height, then `ctx.scale(dpr, dpr)`
- **Particle / procedural elements** must be deterministic — derive position from index and frame, not `Math.random()` per render
- **Props must be typed** — every composition exposes a typed props interface with sensible defaults
- **`defaultProps`** set on every `<Composition>` registration so Remotion Studio renders immediately with no input

---

## What to Build

Design and implement whatever components and compositions you think best serve this aesthetic. The only requirements are:

1. **At least one full-reel composition** that sequences multiple scenes into a single video (intro → content → outro pattern)
2. **A background system** — the black void should have atmospheric depth: perspective geometry, particles, scanlines, or similar. What form this takes is up to you.
3. **At least one 3D wireframe object** rendered in projection space — a shape whose vertices are projected from 3D model coordinates to 2D screen coordinates, responding to camera angle props
4. **At least one animated data visualization** — your choice of chart type or visualization style. It should animate in when the composition starts.
5. **At least one text/title treatment** — an animated composition for displaying text with the neon aesthetic
6. **At least one overlay component** — something designed to sit on top of other video (lower thirds, watermarks, frame indicators, etc.)

Beyond these anchors, design freely. Consider: what kinds of video would someone use a neon theme for? What scenes, transitions, and building blocks would they need? Build those.

---

## Code Quality Standards

- Components are pure and composable — no global state
- All animation values derived from `useCurrentFrame()` — no `useEffect` timers or `setInterval`
- Every `<canvas>` draw call happens in a `useEffect` with the canvas ref and frame as dependencies
- Props flow down — intensity, colors, timing offsets all configurable from the composition level
- No hardcoded pixel values for layout — derive from `useVideoConfig()` width/height

---

## File Conventions

```
src/
  Root.tsx                   # composition registrations only
  tokens/design.ts           # color, font, glow constants
  compositions/              # one file per composition or composition group
  components/                # all reusable components, organized by your own logic
```

Organize components however makes sense for what you build.

---

## Render Scripts

Add npm scripts to `package.json` for:

- `npm start` — opens Remotion Studio
- `npm run build` — renders the full reel
- Individual render commands for each standalone composition

---

## Deliverable Checklist

- [ ] `src/Root.tsx` with all compositions registered
- [ ] `src/tokens/design.ts` with all shared constants
- [ ] Full-reel composition (sequenced, 6–15 seconds)
- [ ] Background system component(s)
- [ ] 3D wireframe object with camera angle prop
- [ ] Animated data visualization
- [ ] Title / text treatment composition
- [ ] Overlay component
- [ ] `package.json` with scripts
- [ ] `remotion.config.ts`
- [ ] `README.md` with composition list, props reference, and render commands
