/**
 * Old Documentary Reel scene-boundary transitions.
 *
 * Ten effects, each a period-accurate 70s-documentary in-camera/in-cut/
 * optical-house trick translated into a TransitionSeries presentation:
 *   - grain_crossfade    — soft dissolve with a burst of film grain riding the cut
 *   - countdown_wipe     — 35mm leader flash: blown-out white sweep, sprocket
 *                          holes + scratch texture visible mid-wipe
 *   - splice_jump_cut    — physical tape-splice flash: a few frames of pure
 *                          white/black flicker, like the projector gate
 *                          stuttering over a taped join
 *   - light_leak_dissolve — directional light bleeding in from one edge,
 *                          blowing the frame to white before the new scene
 *                          resolves out of it
 *   - motorcar_wipe      — a dark silhouette sweeps across frame, fully
 *                          occluding it mid-sweep, revealing the next scene
 *                          as it clears
 *   - iris_wipe          — mechanical camera-iris aperture closes to a point
 *                          on the outgoing scene, then reopens on the next —
 *                          the signature 70s optical-printer scene-change
 *   - flash_frame        — a single hard frame of white noise/static, the
 *                          deliberate jarring leftover-frame trick from
 *                          70s verité editing (more abrupt than splice_jump_cut)
 *   - crt_roll           — the outgoing scene tears into horizontal scanline
 *                          bands that roll off-screen, like a CRT losing
 *                          vertical hold — broadcast-graphics, not film-optics
 *   - film_burn_through  — the projector jams: the frame FREEZES, then the
 *                          lamp burns a spreading, blistered hole through it
 *                          and the next scene shows through the gap. The
 *                          Persona (1966) effect; reserved for the slate ->
 *                          first-content cut, the video's biggest beat
 *   - photo_swap         — rostrum-camera swap: a hand pulls the current
 *                          print sideways off the table, revealing the next
 *                          already lying underneath. The only effect where
 *                          the motion belongs to the scene itself rather than
 *                          an overlay — a physical object handled, not an
 *                          optical event. (The rig the Ken Burns effect is
 *                          named after.)
 *
 * All grain/flicker randomness reuses docReelRand() so these read as the same
 * archival stock as the EmulsionGrain/DustAndScratches textures already on
 * every scene, not a distinct effects layer.
 *
 * Every effect also carries a shared punch-in (see enteringChildren()): the
 * incoming scene snaps in from a slight overscale rather than arriving at
 * rest, for a harder dramatic "hit" on the cut — layered underneath each
 * effect's own overlay, not a ninth transition type.
 *
 * Mirror byte-identical in both trees:
 *   remotion-video/src/templates/old-documentary-reel/docReelTransitions.tsx
 *   frontend/src/components/remotion/old-documentary-reel/docReelTransitions.tsx
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { hexToRgba, docReelRand, useDocReelTheme } from "./docReelStyle";

export const DOCREEL_TRANSITION_FRAMES = 26;

export type DocReelTransition =
  | "grain_crossfade"
  | "countdown_wipe"
  | "splice_jump_cut"
  | "light_leak_dissolve"
  | "motorcar_wipe"
  | "iris_wipe"
  | "flash_frame"
  | "crt_roll"
  | "film_burn_through"
  | "photo_swap";

/** Per-effect duration — a splice flash should be a quick stutter, a light
 *  leak needs room to bloom and recede. Read by pickDocReelTransition below;
 *  the composition uses this (not the fixed DOCREEL_TRANSITION_FRAMES) as the
 *  transition's actual on-screen length. */
const EFFECT_FRAMES: Record<DocReelTransition, number> = {
  grain_crossfade: 26,
  countdown_wipe: 22,
  splice_jump_cut: 10,
  light_leak_dissolve: 30,
  motorcar_wipe: 20,
  iris_wipe: 24,
  flash_frame: 6,
  crt_roll: 22,
  // Longest of the set: the freeze, the burn spreading, and the reveal each
  // need room to read. Rushed, it looks like a glitch rather than film melting.
  film_burn_through: 34,
  // A hand pulling a print off a table is a physical, weighty move — too fast
  // and it reads as a slide animation rather than someone handling paper.
  photo_swap: 28,
};

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** A crossfade with a burst of animated film grain riding over the cut. */
const GrainCrossfadeOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  const flicker = interpolate(t, [0, 0.5, 1], [0, 0.5, 0], clamp);
  const seed = Math.floor(t * 8);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: hexToRgba(theme.text, 0.08 + 0.05 * docReelRand(seed, 1)),
          opacity: flicker,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * 35mm leader flash: the frame blows out to a scratched, sprocket-flanked
 * white sweep at the midpoint, like a countdown-leader frame caught mid-cut.
 * Both outgoing and incoming scenes clip through it — this owns its own full
 * white layer rather than compositing the two scenes underneath, since a real
 * leader frame is a blank white frame, not a see-through dissolve.
 */
const CountdownWipeOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  // Sweep a hard-edged white wipe left-to-right, peaking at full coverage
  // around the midpoint before clearing — reads as a single frame of leader
  // flashing through the gate rather than a slow fade.
  const sweepX = interpolate(t, [0, 0.5, 1], [-10, 50, 110], clamp);
  const flashOpacity = interpolate(t, [0, 0.15, 0.5, 0.85, 1], [0, 1, 1, 1, 0], clamp);
  const seed = Math.floor(t * 12);
  const scratchX = 30 + docReelRand(seed, 1) * 40;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: flashOpacity }}>
      <AbsoluteFill style={{ background: theme.accent }} />
      {/* A couple of vertical scratch lines riding the flash, like leader wear */}
      <div
        style={{
          position: "absolute",
          left: `${scratchX}%`,
          top: 0,
          bottom: 0,
          width: 2,
          background: hexToRgba(theme.bg, 0.35),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${(scratchX + 22) % 100}%`,
          top: 0,
          bottom: 0,
          width: 1,
          background: hexToRgba(theme.bg, 0.25),
        }}
      />
      {/* Sweeping darker edge so the wipe reads as directional, not a flat flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, transparent ${sweepX - 8}%, ${hexToRgba(theme.bg, 0.5)} ${sweepX}%, transparent ${sweepX + 8}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Tape-splice flash: a few frames of hard white/black flicker, as if the
 * projector gate stuttered over a physical taped join in the print. Very
 * short and binary (fully on/off, no smooth easing) — that abruptness is
 * what sells "mechanical splice" rather than "designed dissolve."
 */
const SpliceJumpCutOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  // Two quick flash pulses rather than one smooth arc — a real splice
  // stutters (dark-light-dark) as the join clatters through the gate.
  const pulse1 = interpolate(t, [0, 0.18, 0.32], [0, 1, 0], clamp);
  const pulse2 = interpolate(t, [0.45, 0.62, 0.8], [0, 0.85, 0], clamp);
  const isDark = t > 0.32 && t < 0.45;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{ background: theme.bg, opacity: isDark ? 0.9 : 0 }}
      />
      <AbsoluteFill
        style={{ background: theme.accent, opacity: Math.max(pulse1, pulse2) }}
      />
    </AbsoluteFill>
  );
};

/**
 * Directional light-leak dissolve: light bleeds in from one edge and sweeps
 * across, blowing that side of the frame to warm-white before the new scene
 * resolves out of it. Direction alternates by transition index (threaded via
 * the `variant` prop) so consecutive leaks don't all bleed from the same side.
 */
const LightLeakOverlay: React.FC<{ t: number; fromLeft: boolean }> = ({ t, fromLeft }) => {
  const theme = useDocReelTheme();
  const sweep = interpolate(t, [0, 1], fromLeft ? [-30, 130] : [130, -30], clamp);
  const intensity = interpolate(t, [0, 0.5, 1], [0, 1, 0], clamp);
  const angle = fromLeft ? 100 : 260;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(${angle}deg, transparent ${sweep - 25}%, ${hexToRgba(theme.accent, 0.85)} ${sweep}%, transparent ${sweep + 30}%)`,
          opacity: intensity,
          mixBlendMode: "screen",
        }}
      />
      {/* Warm-white core at the leak's leading edge, thickest at peak intensity */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${angle}deg, ${hexToRgba(theme.accent, 0.9)} ${sweep - 6}%, transparent ${sweep + 4}%)`,
          opacity: intensity * 0.8,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Motorcar wipe: a dark silhouette sweeps left-to-right across the frame,
 * fully occluding it mid-sweep — like a passing car or a hand crossing close
 * to the lens — revealing the next scene as it clears. A soft leading/trailing
 * blur keeps the silhouette from reading as a hard graphic wipe.
 */
const MotorcarWipeOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  const center = interpolate(t, [0, 1], [-20, 120], clamp);
  const width = 55; // % of frame the occluding silhouette spans at full coverage
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, transparent ${center - width / 2 - 8}%, ${theme.bg} ${center - width / 2}%, ${theme.bg} ${center + width / 2}%, transparent ${center + width / 2 + 8}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Iris wipe: a mechanical camera-iris aperture closes down to a point on the
 * outgoing scene, then reopens on the incoming one — the signature optical-
 * printer scene-change of 70s film (Bond-era, countless TV dramas). The
 * aperture is drawn as a radial-gradient hole rather than clip-path so it
 * composites cleanly with the grain/vignette layers already on each scene.
 */
const IrisWipeOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  // Closes to ~0 radius at the midpoint, then reopens — same shape as a real
  // iris diaphragm, which closes and re-opens through the same center point.
  const radius = interpolate(t, [0, 0.5, 1], [75, 0, 75], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent ${radius}%, ${theme.bg} ${radius + 1.5}%)`,
        }}
      />
      {/* Thin bright rim tracing the aperture edge, like light catching the
          iris blades at the moment of closure. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent ${Math.max(0, radius - 1.2)}%, ${hexToRgba(theme.accent, 0.5)} ${radius}%, transparent ${radius + 2}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Flash frame: a single hard frame of blown-out static — the deliberate
 * jarring leftover-frame trick from 70s verité editing (a literal "slug" left
 * in on purpose). More abrupt than splice_jump_cut's two-pulse flicker: one
 * short, hard spike with no dark phase either side, over almost immediately.
 */
const FlashFrameOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  const flash = interpolate(t, [0, 0.35, 0.5, 0.65, 1], [0, 1, 1, 1, 0], clamp);
  const seed = Math.floor(t * 20);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: flash }}>
      <AbsoluteFill style={{ background: theme.accent }} />
      {/* Coarse static noise riding the flash — a slug frame is garbage, not
          a clean white card. */}
      <AbsoluteFill
        style={{
          background: hexToRgba(theme.bg, 0.15 + 0.15 * docReelRand(seed, 7)),
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * CRT roll: the outgoing scene tears into horizontal scanline bands that peel
 * off-screen, like a television losing vertical hold — a broadcast-graphics
 * artifact rather than a film-optics one, distinct from every other effect
 * here. Bands scroll at slightly different rates (docReelRand-seeded per
 * band) so the tear reads as unstable, not a uniform mechanical wipe.
 */
const CrtRollOverlay: React.FC<{ t: number }> = ({ t }) => {
  const theme = useDocReelTheme();
  const bandCount = 10;
  const bands = Array.from({ length: bandCount }, (_, i) => {
    const speedVariance = 0.75 + docReelRand(i, 3) * 0.5;
    const travel = interpolate(t, [0, 1], [0, 130 * speedVariance], clamp);
    return { i, travel };
  });
  const rollOpacity = interpolate(t, [0, 0.12, 0.85, 1], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: rollOpacity, overflow: "hidden" }}>
      {bands.map(({ i, travel }) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${(i / bandCount) * 100}%`,
            height: `${100 / bandCount}%`,
            transform: `translateY(${travel}%)`,
            background: theme.bg,
            borderBottom: `1px solid ${hexToRgba(theme.text, 0.25)}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/**
 * Film burn-through — the projector jams and the lamp eats the frame.
 *
 * The Persona (Bergman, 1966) effect, and the one genuine found-footage
 * failure mode this template didn't already have. Real sequence, per how film
 * actually burns in a gate: the film STOPS moving, so the picture freezes;
 * the centre of the stalled frame darkens; a hole opens and spreads with a
 * blistered brown rim as the celluloid decomposes; then the bare lamp floods
 * white through the gap.
 *
 * Deliberately NOT the commercial "film burn" look — those packs are orange
 * light-leak overlays, which is what light_leak_dissolve already does. This is
 * a hole eating outward through the picture, which nothing else here does:
 * every other effect in the set is a geometric wipe, dissolve or flash.
 *
 * The freeze is what sells it and is the part stock effects miss — the burn
 * happens BECAUSE the film stopped. Held by the caller (see the presentation
 * component), not here.
 */
const FilmBurnOverlay: React.FC<{ t: number; seed: number }> = ({ t, seed }) => {
  const theme = useDocReelTheme();
  // Nothing for the first beat: the frame is simply frozen, no burn yet.
  const BURN_START = 0.18;
  const burn = interpolate(t, [BURN_START, 1], [0, 1], clamp);

  // Off-centre ignition point — a real jam doesn't burn from dead centre.
  const cx = 38 + docReelRand(seed, 1) * 24;
  const cy = 40 + docReelRand(seed, 2) * 20;

  // The hole accelerates as it goes: celluloid catches slowly then runs away.
  const radius = Math.pow(burn, 1.7) * 145;
  // Rim thickness shrinks as the hole grows, like a real burn front thinning.
  const rim = Math.max(2.5, 13 - burn * 9);

  // Irregular, blistered edge rather than a clean circle: several offset
  // lobes at deterministic angles, so the hole reads as melted, not cut.
  const lobes = Array.from({ length: 5 }, (_, i) => {
    const a = docReelRand(seed, 10 + i) * Math.PI * 2;
    const dist = radius * (0.24 + docReelRand(seed, 20 + i) * 0.3);
    const r = radius * (0.42 + docReelRand(seed, 30 + i) * 0.34);
    return { x: cx + Math.cos(a) * dist * 0.5, y: cy + Math.sin(a) * dist * 0.5, r };
  });

  // Bare projector lamp flooding through once the hole is genuinely open.
  const lampGlow = interpolate(burn, [0.35, 1], [0, 0.55], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Scorch bloom ahead of the burn front — the picture browns and lifts
          before it actually goes. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${cx}% ${cy}%, ${hexToRgba(theme.accent, 0.5)} 0%, ${hexToRgba(theme.text, 0.22)} ${radius * 0.55}%, transparent ${radius * 1.25}%)`,
          opacity: interpolate(burn, [0, 0.25, 1], [0, 0.9, 0.55], clamp),
          mixBlendMode: "screen",
        }}
      />
      {/* The hole itself: burnt-through void with a hot rim. Main front plus
          lobes, each its own gradient so the edge is lumpy rather than round. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${cx}% ${cy}%, ${theme.bg} 0%, ${theme.bg} ${Math.max(0, radius - rim)}%, ${hexToRgba(theme.accent, 0.95)} ${radius}%, ${hexToRgba(theme.text, 0.35)} ${radius + rim * 0.6}%, transparent ${radius + rim * 1.5}%)`,
        }}
      />
      {lobes.map((l, i) => (
        <AbsoluteFill
          key={i}
          style={{
            background: `radial-gradient(circle at ${l.x}% ${l.y}%, ${theme.bg} 0%, ${theme.bg} ${Math.max(0, l.r - rim * 0.7)}%, ${hexToRgba(theme.accent, 0.8)} ${l.r}%, transparent ${l.r + rim}%)`,
            opacity: burn > 0.08 ? 1 : 0,
          }}
        />
      ))}
      {/* Bare lamp through the opened gate, washing the whole frame. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${cx}% ${cy}%, ${hexToRgba(theme.accent, 0.85)} 0%, transparent ${radius * 1.1}%)`,
          opacity: lampGlow,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

interface DocReelPresentationProps extends Record<string, unknown> {
  effect: DocReelTransition;
  /** Alternates light-leak direction per boundary index. */
  variant?: boolean;
}

/**
 * Punch-in: the incoming scene snaps in from a slight overscale rather than
 * arriving at rest — the "hit" a documentary editor cuts on for emphasis,
 * distinct from each layout's own slow Ken Burns creep (ArchiveImageBackdrop,
 * ~0.05-0.09 over the WHOLE scene). This decays fast — fully settled well
 * before the transition itself finishes — so it reads as a snap into place,
 * not a lingering zoom that would fight the slower per-layout creep once the
 * cut lands. Applied uniformly across every effect via enteringChildren()
 * below rather than duplicated per-effect branch.
 */
const PUNCH_IN_SCALE = 1.05;
const PUNCH_DECAY = 0.55; // fraction of the transition the punch takes to settle

const enteringChildren = (children: React.ReactNode, t: number): React.ReactNode => {
  const settle = interpolate(t, [0, PUNCH_DECAY], [0, 1], clamp);
  // Ease-out (1 - (1-x)^3) so the punch is sharp at the cut and eases into
  // rest, rather than a linear zoom that reads as a designed animation.
  const eased = 1 - Math.pow(1 - settle, 3);
  const scale = PUNCH_IN_SCALE - (PUNCH_IN_SCALE - 1) * eased;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 50%" }}>
      {children}
    </AbsoluteFill>
  );
};

const DocReelPresentationComponent: React.FC<
  TransitionPresentationComponentProps<DocReelPresentationProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const theme = useDocReelTheme();
  const t = presentationProgress;
  const { effect, variant } = passedProps;

  // countdown_wipe, splice_jump_cut, and flash_frame fully occlude the frame
  // at their peak (a real leader flash / splice / slug IS a blank frame), so
  // both directions just render their children plain underneath — the
  // overlay does all the work, painted once on the "entering" side so it
  // isn't drawn twice.
  if (effect === "countdown_wipe" || effect === "splice_jump_cut" || effect === "flash_frame") {
    if (presentationDirection === "exiting") {
      return <AbsoluteFill>{children}</AbsoluteFill>;
    }
    return (
      <AbsoluteFill>
        {enteringChildren(children, t)}
        {effect === "countdown_wipe" && <CountdownWipeOverlay t={t} />}
        {effect === "splice_jump_cut" && <SpliceJumpCutOverlay t={t} />}
        {effect === "flash_frame" && <FlashFrameOverlay t={t} />}
      </AbsoluteFill>
    );
  }

  if (effect === "photo_swap") {
    // Rostrum-camera swap: the camera is locked off above a table and a hand
    // pulls the current print out of frame, revealing the next one already
    // lying underneath. The apparatus documentaries actually used to film
    // stills — the Ken Burns effect is named after this rig.
    //
    // Unlike every other effect here, the motion belongs to the OUTGOING
    // SCENE itself rather than an overlay: it's a physical object being
    // handled, not an optical event happening to the film. That's what makes
    // it feel like someone is in the room.
    const dir = variant ? 1 : -1; // alternate which way the print is pulled
    if (presentationDirection === "exiting") {
      // Slight lead-in before the pull, like a hand settling on the print,
      // then it accelerates away — paper doesn't ease out, it's yanked.
      const pull = interpolate(t, [0.12, 1], [0, 1], clamp);
      const eased = Math.pow(pull, 1.6);
      const x = eased * 118 * dir;
      // A print pulled from one corner rotates a little as it goes.
      const rot = eased * 4.5 * dir;
      return (
        <AbsoluteFill
          style={{
            transform: `translateX(${x}%) rotate(${rot}deg)`,
            // Drop shadow on the leading edge so the print reads as a sheet
            // lifted above the next one, not a sliding rectangle.
            boxShadow: `${-dir * 26}px 0 46px ${hexToRgba(theme.shadowBase, 0.55)}`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill>
        {/* The next print is already on the table — static, not punched in:
            it was lying there the whole time, the one above it just left. */}
        <AbsoluteFill>{children}</AbsoluteFill>
        {/* Shadow of the departing print sweeping across as it clears. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(${dir > 0 ? 90 : 270}deg, ${hexToRgba(theme.shadowBase, 0.5)} 0%, transparent 42%)`,
            opacity: interpolate(t, [0.12, 0.55, 1], [0.9, 0.45, 0], clamp),
            transform: `translateX(${interpolate(t, [0.12, 1], [0, 105], clamp) * dir}%)`,
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  if (effect === "film_burn_through") {
    // The outgoing scene is the film stuck in the gate: it renders plain and
    // UNANIMATED — no fade, no punch — because the whole premise is that it
    // stopped moving. The burn overlay rides on top of it, and the incoming
    // scene shows through the hole as it opens.
    //
    // Ordering matters: incoming underneath, frozen outgoing above it, burn
    // above both. The hole is painted in theme.bg rather than being a real
    // cutout, so the reveal comes from the outgoing scene fading only where
    // the burn has eaten through — handled by the mask opacity below.
    const seed = Math.round((variant ? 1 : 0) * 97 + 13);
    if (presentationDirection === "exiting") {
      // Frozen frame + the burn consuming it. Opacity falls away only once
      // the hole is genuinely open, so the incoming scene beneath is revealed
      // through the burn rather than by a crossfade.
      const consumed = interpolate(t, [0.45, 1], [1, 0], clamp);
      return (
        <AbsoluteFill style={{ opacity: consumed }}>
          {children}
          <FilmBurnOverlay t={t} seed={seed} />
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill>
        {enteringChildren(children, t)}
        {/* Residual scorch/lamp wash carrying over onto the new scene for a
            beat, so the burn doesn't vanish the instant the frame changes. */}
        <AbsoluteFill
          style={{
            background: hexToRgba(theme.accent, 0.4),
            opacity: interpolate(t, [0.45, 0.7, 1], [0, 0.35, 0], clamp),
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  if (effect === "motorcar_wipe" || effect === "iris_wipe" || effect === "crt_roll") {
    // These all need both scenes visible at once (outgoing behind, incoming
    // revealed as the occluder/aperture/roll clears), so render both sides
    // plain and let the entering side paint the effect on top.
    if (presentationDirection === "exiting") {
      return <AbsoluteFill>{children}</AbsoluteFill>;
    }
    return (
      <AbsoluteFill>
        {enteringChildren(children, t)}
        {effect === "motorcar_wipe" && <MotorcarWipeOverlay t={t} />}
        {effect === "iris_wipe" && <IrisWipeOverlay t={t} />}
        {effect === "crt_roll" && <CrtRollOverlay t={t} />}
      </AbsoluteFill>
    );
  }

  if (presentationDirection === "exiting") {
    const opacity = 1 - t;
    return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
  }

  const opacity = t;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity }}>{enteringChildren(children, t)}</AbsoluteFill>
      {effect === "grain_crossfade" && <GrainCrossfadeOverlay t={t} />}
      {effect === "light_leak_dissolve" && (
        <LightLeakOverlay t={t} fromLeft={variant ?? true} />
      )}
    </AbsoluteFill>
  );
};

const makeDocReelPresentation = (
  effect: DocReelTransition,
  variant?: boolean,
): TransitionPresentation<DocReelPresentationProps> => ({
  component: DocReelPresentationComponent,
  props: { effect, variant },
});

export interface DocReelTransitionChoice {
  presentation: TransitionPresentation<DocReelPresentationProps>;
  frames: number;
}

// Rotating pool for ordinary mid-reel cuts — deterministic by boundary index so
// the same cut always produces the same transition (reproducible renders),
// while consecutive cuts still vary. flash_frame is deliberately rarer than
// the others (appears once per 8 rather than once per 7) since its abruptness
// reads as a strong punctuation mark — too frequent and it stops feeling
// deliberate.
// Ordering note: cuts 0 and 1 are almost always claimed by the hero rules
// (countdown -> slate, and slate -> first content), so pool slots 0 and 1
// rarely fire in a typical video. photo_swap sits at index 2 — the first slot
// that actually lands on a regular cut — so the rostrum swap is seen rather
// than buried at the end of a rotation most videos never reach.
const POOL: DocReelTransition[] = [
  "grain_crossfade",
  "light_leak_dissolve",
  "photo_swap",
  "iris_wipe",
  "splice_jump_cut",
  "motorcar_wipe",
  "crt_roll",
  "countdown_wipe",
  "flash_frame",
];

/**
 * Deterministic per-boundary selection.
 *
 * Hero boundaries — leaving the opening slate, or entering the closing
 * reel-out/socials card — always get the countdown_wipe leader-flash, the
 * most "this is a reel change" of the eight effects, matching how Chronicle
 * reserves its book-page flip for book_open/ending_socials.
 *
 * Everything else cycles through POOL by boundary index.
 */
export const pickDocReelTransition = (
  fromIdx: number,
  fromLayout: string | undefined,
  toLayout: string | undefined,
): DocReelTransitionChoice => {
  // Keep the slate exit clean and archival without painting the sharp white
  // burn-through blotch over its title and narration.
  if (fromLayout === "docreel_slate") {
    return {
      presentation: makeDocReelPresentation("grain_crossfade"),
      frames: EFFECT_FRAMES.grain_crossfade,
    };
  }

  const isHeroBoundary =
    // The countdown leader is scene 0, so countdown -> slate is the opening
    // cut and keeps the deliberate leader-flash treatment rather than
    // falling into the rotating pool. Same for the cut into the end card.
    fromLayout === "docreel_countdown" ||
    toLayout === "docreel_reel_out" ||
    toLayout === "ending_socials";

  if (isHeroBoundary) {
    return {
      presentation: makeDocReelPresentation("countdown_wipe"),
      frames: EFFECT_FRAMES.countdown_wipe,
    };
  }

  const effect = POOL[fromIdx % POOL.length];
  return {
    presentation: makeDocReelPresentation(effect, fromIdx % 2 === 0),
    frames: EFFECT_FRAMES[effect],
  };
};
