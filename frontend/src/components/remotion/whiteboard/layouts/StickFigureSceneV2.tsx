import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

/**
 * Motion variant of StickFigureScene ("Circus Juggler").
 *
 * Same markup, props and typography as the base layout — only the animation
 * differs. The base bounces ONE ball on a fixed sine; this runs a genuine
 * three-ball cascade that the figure also kicks with a foot.
 *
 * ── How the pattern works ────────────────────────────────────────────────
 * Three stations catch and throw: the left hand, the right hand, and the
 * right foot. They fire in the repeating order
 *
 *     L  R  L  R  L  FOOT          (N = 6 beats, BEAT frames each)
 *
 * A ball thrown on beat i lands on beat i + FLIGHT (3 beats — see the constant
 * for why that value is forced). Every throw lands at a *different* station
 * than it left, so the balls genuinely cross rather than bouncing straight up,
 * and the whole pattern loops seamlessly every N * BEAT frames.
 *
 * Ball flight is real projectile motion — linear in x, a parabola in y — not
 * an abs(sin) fake, so the balls decelerate into the apex and accelerate out
 * of it the way thrown objects actually do.
 *
 * Limbs are driven BY the pattern rather than on independent timers: each hand
 * dips as its next catch approaches and pops up on the throw, the kicking leg
 * extends only on its own beat, and the torso leans and bobs with the load.
 * Arms and legs both use the same two-bone IK, so elbows and knees bend
 * correctly at every hand/foot position and both legs are built identically.
 *
 * A dog sits to the right watching the cascade, tail wagging.
 */

// ── Pattern constants ──────────────────────────────────────────────────────
const BEAT = 15;                    // frames between throws
const N = 6;                        // stations in the repeating cycle
// Beats a ball stays airborne.
//
// This CANNOT exceed 3. With three balls and one throw per beat, each ball is
// re-thrown every 3 beats, so a longer flight re-launches the ball before it
// has landed — it teleports back to the throwing hand mid-descent, which reads
// as balls going up but never coming down. At exactly 3 the throw interval and
// the flight duration match, so each arc completes just as the next begins.
const FLIGHT = 3;
const PERIOD = N * BEAT;            // 90 frames — the full loop
const APEX = 110;                   // peak height above the throwing station

type StationId = "L" | "R" | "F";
const CYCLE: StationId[] = ["L", "R", "L", "R", "L", "F"];

// Arm segment lengths. The hand stations below must sit within UPPER + FORE of
// the shoulder or the arm renders as one over-extended straight stick with no
// elbow — which is exactly what a wider cascade looked like.
const UPPER_ARM = 46;
const FOREARM = 46;

// Half-width of the shoulder line. Both arms previously grew from a single
// point on the spine, which put their elbows ~16px apart and closed the two
// limbs into one solid triangle. Giving each arm its own shoulder is what keeps
// them legible as two separate jointed arms — they sit ~49px apart now, while
// still using the same elbow bend so neither kinks upward.
const SHOULDER_HALF = 16;

// Station positions in the 420×370 viewBox.
//
// Two constraints pin these down, both verified numerically:
//  1. The figure stands at x≈110 and juggles IN FRONT of itself. Centring it
//     under the arc puts the head in the flight path, and the balls pass
//     through it on the way up and down — no apex or width fixes that, only
//     moving the arc off the head's x.
//  2. Both hand stations must be within arm's reach of the shoulder (see
//     above), which caps how wide the cascade can be.
const STATIONS: Record<StationId, { x: number; y: number }> = {
  L: { x: 150, y: 168 },
  R: { x: 199, y: 168 },
  F: { x: 190, y: 292 },
};

// Leg segment lengths, used by the same two-bone IK as the arms so knees bend
// correctly at every foot position rather than being faked with an offset.
const THIGH = 52;
const SHIN = 52;


/**
 * Two-bone IK: given a shoulder and a hand, find the elbow.
 *
 * Placing the elbow at a fixed offset from the midpoint (the obvious shortcut)
 * only looks right at one particular reach — as the hand moves the arm folds
 * or splays wrongly. Solving it properly keeps both segments a constant length
 * at every hand position, which is what makes the limb read as jointed.
 *
 * `bendSign` picks which of the two mirror solutions to use, i.e. which way
 * the elbow points.
 */
function solveJoint(
  sx: number, sy: number,
  hx: number, hy: number,
  upper: number, lower: number,
  bendSign: 1 | -1,
) {
  const dx = hx - sx;
  const dy = hy - sy;
  const dist = Math.max(1e-3, Math.min(Math.hypot(dx, dy), upper + lower - 0.01));
  // Distance along the root→end axis to the joint's projection.
  const a = (dist * dist + upper * upper - lower * lower) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x: sx + ux * a - bendSign * uy * h,
    y: sy + uy * a + bendSign * ux * h,
  };
}

/**
 * The pattern is driven by a GLOBAL beat counter, not per-ball timers: on beat
 * `b` the station `CYCLE[b % N]` throws, and that ball lands at
 * `CYCLE[(b + FLIGHT) % N]`. With three balls and one throw per beat, ball `k`
 * owns every beat where `b % 3 === k`.
 *
 * (Pinning each ball to a fixed launch beat instead would make every ball
 * repeat one identical flight forever — all three would launch from the same
 * hand and the left hand would never receive a catch.)
 */
function beatFlight(b: number) {
  return {
    from: STATIONS[CYCLE[((b % N) + N) % N]],
    to: STATIONS[CYCLE[(((b + FLIGHT) % N) + N) % N]],
  };
}

/** Where ball `k` is at `frame`, and what it is doing. */
function ballState(k: number, frame: number) {
  // The most recent beat this ball was thrown on.
  const beatNow = Math.floor(frame / BEAT);
  let b = beatNow;
  while (((b % 3) + 3) % 3 !== k) b--;

  const { from, to } = beatFlight(b);
  const dur = FLIGHT * BEAT;
  const t = frame - b * BEAT;

  if (t <= dur) {
    const u = t / dur;
    return {
      x: from.x + (to.x - from.x) * u,
      y: from.y + (to.y - from.y) * u - 4 * APEX * u * (1 - u),
      airborne: true,
    };
  }
  // Between landing and its next launch the ball rests in the catching station.
  return { x: to.x, y: to.y, airborne: false };
}

/**
 * How "loaded" a station is right now, 0..1 — peaking at the moment of catch
 * and easing off afterwards. Drives the limb that owns the station.
 */
function stationLoad(station: StationId, frame: number) {
  let load = 0;
  const beatNow = Math.floor(frame / BEAT);
  // Look back over the beats whose catches could still be influencing the limb.
  for (let b = beatNow - N; b <= beatNow + 1; b++) {
    if (CYCLE[(((b + FLIGHT) % N) + N) % N] !== station) continue;
    const landFrame = (b + FLIGHT) * BEAT;
    const d = frame - landFrame;
    // Anticipate over the 5 frames before the catch, settle over the 9 after.
    const near = d < 0 ? (d > -5 ? 1 + d / 5 : 0) : d < 9 ? 1 - d / 9 : 0;
    load = Math.max(load, near);
  }
  return load;
}

export const StickFigureSceneV2: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const balls = [0, 1, 2].map((k) => ballState(k, frame));
  const loadL = stationLoad("L", frame);
  const loadR = stationLoad("R", frame);
  const loadF = stationLoad("F", frame);

  // ── Body ────────────────────────────────────────────────────────────────
  // Hands dip as they take a catch and spring back up on the throw.
  const handDipL = loadL * 20;
  const handDipR = loadR * 20;
  // The torso counterweights whichever hand is loaded, and rises on the kick.
  const lean = (loadR - loadL) * 5;
  const bodyBob = -loadF * 9 + Math.sin((frame / PERIOD) * Math.PI * 2 * 2) * 2;
  // The support leg braces (bends slightly) while the other kicks.
  const braceBend = loadF * 10;

  const figProgress = interpolate(frame, [0, 34], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [30, 52], [0, 1], { extrapolateRight: "clamp" });
  const textRise = interpolate(textOp, [0, 1], [26, 0]);
  const doodleOp = interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" });

  const dash = 500;
  const figOff = dash * (1 - figProgress);

  // Anchor points of the figure. It stands left of the cascade and works the
  // balls in front of itself (see STATIONS above for why it is not centred).
  const HEAD = { x: 110, y: 66, r: 30 };
  const NECK = 98;
  const HIP = 218;
  const SHOULDER = 128;

  const ballColors = [accentColor, textColor, accentColor];

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px"
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain_sfv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink_sfv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="22" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain_sfv2)" fill="none" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: p ? "space-around" : "center",
          gap: p ? 40 : 44,
          padding: p ? "15% 8%" : "5% 7%",
        }}
      >
        {/* Header-style Text for Portrait */}
        {p && (
          <div
            style={{
              color: textColor,
              opacity: textOp,
              transform: `translateY(${textRise}px)`,
              textAlign: "center",
              marginBottom: -20,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: titleFontSize ?? (p ? 73 : 62), filter: "url(#ink_sfv2)" }}>{title}</div>
            {/* Hand-drawn underline for title in portrait */}
            <svg width="100%" height="20" viewBox="0 0 300 20" style={{ opacity: doodleOp }}>
                <path d="M50,10 Q150,18 250,10" stroke={accentColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}

        <svg viewBox="0 0 420 370" style={{ width: p ? "90%" : "44%", maxWidth: 640, height: "auto" }} fill="none">
          <g filter="url(#ink_sfv2)" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground line */}
            <line x1={10} y1={310} x2={410} y2={308} stroke={textColor} strokeWidth={4} strokeOpacity={0.3} />

            {/* Faint dotted cascade path, so the pattern reads even in a still */}
            <path
              d={`M ${STATIONS.L.x},${STATIONS.L.y} Q ${(STATIONS.L.x + STATIONS.R.x) / 2},${STATIONS.L.y - APEX * 1.6} ${STATIONS.R.x},${STATIONS.R.y}`}
              stroke={accentColor}
              strokeWidth={2}
              strokeOpacity={0.16 * doodleOp}
              strokeDasharray="5 9"
              fill="none"
            />

            {/* === STICK MAN — leans and bobs with the pattern === */}
            <g transform={`translate(0, ${bodyBob}) rotate(${lean} ${HEAD.x} ${HIP})`}>
              <circle
                cx={HEAD.x}
                cy={HEAD.y}
                r={HEAD.r}
                stroke={textColor}
                strokeWidth={5}
                strokeDasharray={dash}
                strokeDashoffset={figOff}
              />
              <line
                x1={HEAD.x}
                y1={NECK}
                x2={HEAD.x}
                y2={HIP}
                stroke={textColor}
                strokeWidth={5}
                strokeDasharray={dash}
                strokeDashoffset={figOff}
              />

              {/* Arms — shoulder → elbow → hand, each reaching its own station
                  and dipping as that station takes a catch. The elbow is placed
                  below the straight shoulder-to-hand line so the arm bends
                  forward rather than reading as one rigid stick. */}
              {/* Shoulder line — gives each arm its own origin */}
              <line
                x1={HEAD.x - SHOULDER_HALF}
                y1={SHOULDER + 2}
                x2={HEAD.x + SHOULDER_HALF}
                y2={SHOULDER - 2}
                stroke={textColor}
                strokeWidth={5}
              />
              {(
                [
                  // Both arms bend the SAME way (+1), which drops each elbow
                  // below its own shoulder so the limbs hang naturally. The
                  // earlier -1 on the far arm kicked its elbow 7px *above* the
                  // shoulder, giving the up-then-down kink. Separate shoulders
                  // (not the bend sign) are what keep the two arms distinct —
                  // this pairing still leaves ~50px between the elbows.
                  {
                    sx: HEAD.x - SHOULDER_HALF, sy: SHOULDER + 2,
                    st: STATIONS.L, dip: handDipL, bend: 1 as const,
                  },
                  {
                    sx: HEAD.x + SHOULDER_HALF, sy: SHOULDER - 2,
                    st: STATIONS.R, dip: handDipR, bend: 1 as const,
                  },
                ]
              ).map(({ sx, sy, st, dip, bend }, i) => {
                const handY = st.y + dip;
                const elbow = solveJoint(sx, sy, st.x, handY, UPPER_ARM, FOREARM, bend);
                return (
                  <g key={i}>
                    <path
                      d={`M${sx},${sy} L${elbow.x.toFixed(1)},${elbow.y.toFixed(1)} L${st.x},${handY}`}
                      stroke={textColor}
                      strokeWidth={5}
                      fill="none"
                    />
                    {/* Hand — a single flat bar across the end of the forearm,
                        rotated square to it so it reads as a flat palm facing
                        the incoming ball whatever the arm is doing. */}
                    <g
                      transform={`translate(${st.x}, ${handY}) rotate(${
                        (Math.atan2(handY - elbow.y, st.x - elbow.x) * 180) / Math.PI - 90
                      })`}
                    >
                      <line
                        x1={-9}
                        y1={0}
                        x2={9}
                        y2={0}
                        stroke={textColor}
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                );
              })}

              {/* Legs — both built the same way: hip → knee (solved by the same
                  two-bone IK as the arms) → ankle, each finished with a foot, so
                  the pair is symmetric. The support leg stays planted and bends
                  as it braces; the kicking leg's ankle travels to the FOOT
                  station on its beat and returns. */}
              {(() => {
                const supportAnkle = {
                  x: HEAD.x - 26 - braceBend * 0.25,
                  y: 306,
                };
                const restAnkle = { x: HEAD.x + 30, y: 306 };
                const kickAnkle = STATIONS.F;
                const kicking = {
                  x: restAnkle.x + (kickAnkle.x - restAnkle.x) * loadF,
                  y: restAnkle.y + (kickAnkle.y + 6 - restAnkle.y) * loadF,
                };
                // Knees bend forward (away from the torso) on both legs.
                const legs = [
                  { ankle: supportAnkle, bend: -1 as const, lift: 0 },
                  { ankle: kicking, bend: -1 as const, lift: loadF },
                ];
                return legs.map(({ ankle, bend, lift }, i) => {
                  const knee = solveJoint(
                    HEAD.x, HIP, ankle.x, ankle.y, THIGH, SHIN, bend,
                  );
                  return (
                    <g key={i}>
                      <path
                        d={`M${HEAD.x},${HIP} L${knee.x.toFixed(1)},${knee.y.toFixed(1)} L${ankle.x.toFixed(1)},${ankle.y.toFixed(1)}`}
                        stroke={textColor}
                        strokeWidth={5}
                        fill="none"
                      />
                      {/* Foot — same shape on both legs, tilting up on a kick */}
                      <line
                        x1={ankle.x}
                        y1={ankle.y}
                        x2={ankle.x + 17}
                        y2={ankle.y - lift * 9}
                        stroke={textColor}
                        strokeWidth={5}
                      />
                    </g>
                  );
                });
              })()}
            </g>

            {/* === THE DOG — sits to the right, facing back at the juggler ===
                Drawn facing -x (muzzle, chest and forelegs on its left) so it
                looks toward the figure. The tail wags on the ball rhythm and the
                head tips up a little whenever a ball is at its apex, as though
                it is tracking the cascade. */}
            {(() => {
              const DOG_X = 330;
              const GROUND = 308;
              // Wag twice per pattern beat; ears/head follow the highest ball.
              const wag = Math.sin(frame * 0.34) * 15;
              const highest = Math.min(...balls.map((b) => b.y));
              const watch = interpolate(highest, [40, 170], [-7, 2], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <g
                  transform={`translate(${DOG_X}, ${GROUND})`}
                  stroke={textColor}
                  strokeWidth={4}
                  fill="none"
                  strokeDasharray={dash}
                  strokeDashoffset={figOff}
                >
                  {/* Body — one continuous outline from the seated rump, up the
                      back, along the neck and down the chest to the front paw.
                      Drawing it as a single stroke (rather than separate rump,
                      back and chest segments) is what makes the dog read as one
                      solid animal instead of a bundle of sticks. */}
                  <path
                    d="M 30,0
                       Q 34,-22 26,-36
                       Q 20,-48 4,-52
                       Q -12,-56 -20,-50
                       L -22,-8"
                  />
                  {/* Front leg — knee kink then paw, facing the juggler */}
                  <path d="M -22,-8 L -22,-2 L -34,-2" />
                  {/* Back paw tucked under the seated rump */}
                  <path d="M 30,0 L 12,0 L 6,-4" />
                  {/* Head — tips up as it tracks the highest ball */}
                  <g transform={`rotate(${watch} -20 -50)`}>
                    {/* Skull */}
                    <circle cx={-26} cy={-66} r={13} />
                    {/* Muzzle, pointing back toward the juggler */}
                    <path d="M -37,-62 Q -48,-60 -46,-54 Q -42,-51 -35,-54" />
                    {/* Nose */}
                    <circle cx={-47} cy={-57} r={2.2} fill={textColor} stroke="none" />
                    {/* Floppy ear */}
                    <path d="M -20,-76 Q -12,-82 -10,-72 Q -10,-64 -16,-62" />
                    {/* Eye */}
                    <circle cx={-30} cy={-68} r={2} fill={textColor} stroke="none" />
                    {/* Collar */}
                    <path d="M -16,-56 Q -20,-50 -26,-50" strokeWidth={3} />
                  </g>
                  {/* Tail — sweeps up and away from the rump as it wags */}
                  <g transform={`rotate(${wag} 30 -8)`}>
                    <path d="M 30,-8 Q 46,-14 48,-34" />
                  </g>
                </g>
              );
            })()}

            {/* === THE THREE BALLS === */}
            {balls.map((b, i) => (
              <g key={i}>
                {/* Motion streak behind a rising ball */}
                {b.airborne && (
                  <line
                    x1={b.x}
                    y1={b.y + 16}
                    x2={b.x}
                    y2={b.y + 30}
                    stroke={ballColors[i]}
                    strokeWidth={2.5}
                    strokeOpacity={0.22}
                  />
                )}
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={13}
                  stroke={ballColors[i]}
                  strokeWidth={5}
                  fill={bgColor}
                />
                {/* Shine mark, so the balls read as objects not rings */}
                <path
                  d={`M${b.x - 5},${b.y - 6} Q${b.x},${b.y - 9} ${b.x + 5},${b.y - 6}`}
                  stroke={ballColors[i]}
                  strokeWidth={2.5}
                  strokeOpacity={0.55}
                  fill="none"
                />
              </g>
            ))}
          </g>
        </svg>

        <div style={{
          flex: p ? "none" : 1,
          color: textColor,
          opacity: textOp,
          transform: `translateY(${textRise}px)`,
          textAlign: p ? "center" : "left",
          maxWidth: p ? "90%" : "auto"
        }}>
          {!p && <div style={{ fontWeight: 700, fontSize: titleFontSize ?? (p ? 73 : 62), filter: "url(#ink_sfv2)" }}>{title}</div>}
          <div style={{
            marginTop: p ? 0 : 18,
            fontSize: descriptionFontSize ?? (p ? 31 : 28),
            filter: "url(#ink_sfv2)",
            lineHeight: 1.4
          }}>
            {narration}
          </div>
        </div>
      </div>

      {/* Decorative Portrait Background Doodle (Top Right Cloud) */}
      {p && (
        <svg
          style={{ position: "absolute", top: "5%", right: "5%", width: "25%", opacity: doodleOp * 0.3 }}
          viewBox="0 0 100 60"
        >
          <path
            d="M10,40 Q10,10 40,10 Q50,0 70,10 Q95,10 90,40 Z"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            filter="url(#ink_sfv2)"
          />
        </svg>
      )}

      {/* Decorative Portrait Background Doodle (Bottom Left Scribble) */}
      {p && (
        <svg
          style={{ position: "absolute", bottom: "5%", left: "5%", width: "20%", opacity: doodleOp * 0.2 }}
          viewBox="0 0 100 100"
        >
          <path
            d="M10,90 Q30,70 50,90 T90,90"
            stroke={textColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 4"
          />
        </svg>
      )}
    </AbsoluteFill>
  );
};
