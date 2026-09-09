import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
// NOTE: this import path is the ONE line that differs from the remotion-video
// copy of this file — `resolveCtas` lives at `templates/shared/` there and at
// `src/utils/` here. The base `EndingSocials.tsx` diverges in exactly the same
// way; everything else in the two copies stays byte-identical.
import { resolveCtas } from "../../../../utils/resolveCtas";
import { useFitText } from "../components/useFitText";

/**
 * ending_socials__v2 — "Signboard".
 *
 * Variant of `ending_socials`. Same props, different composition: a two-column
 * stage. The left column carries the hand-drawn signboard on two posts with
 * the title written on it and the subtext underneath; the right column has a
 * stick figure pointing across at the CTA ribbons stacked beside it. The
 * socials sit centred in a drawn row along the bottom, spanning both columns.
 *
 * Portrait stacks the two columns vertically (sign, then figure + CTAs, then
 * socials) — side-by-side columns are unreadable at 9:16.
 *
 * `resolveCtas` + `SocialIcons` are reused verbatim so multi-CTA behaviour and
 * platform handling match the base exactly.
 *
 * Filter IDs carry a `-esv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

// The board carries both the title and the subtext, so it is deeper than a
// title-only sign would be.
const BOARD_W = 900;
const BOARD_H = 420;
const BOARD_PERIMETER = 2 * (BOARD_W + BOARD_H);

export const EndingSocialsV2: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const fade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const boardProgress = interpolate(frame, [4, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [28, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsOp = interpolate(frame, [70, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Holder choreography ───────────────────────────────────────────────
     The holders WALK IN from off-frame right, stop on their marks, and only
     then raise their cards. The walk reuses the base `drawn_title` rig
     verbatim — same `frame * 0.22 * 0.9` cadence, same
     `sin(ph)*32` / `max(0,sin(ph-PI/2))*40` leg phases, same `sin(cycle*2)*3`
     bob and `sin(cycle)*30` arm swing — so it matches the rest of the
     template's motion.

     They arrive in sequence (rightmost first, since it has least ground to
     cover) rather than in lockstep: a row of identical figures stopping on the
     same frame reads as one object, not as three people. */
  const WALK_IN_END = 46;
  const ARRIVE_STAGGER = 7;
  const RAISE_DUR = 16;

  /* The floor is drawn in ahead of the walkers, so they arrive on ground that
     already exists rather than appearing to walk on nothing. */
  const groundIn = interpolate(frame, [2, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** Frame this holder finishes walking. Later cards start further right. */
  const arriveAt = (idx: number) => WALK_IN_END + idx * ARRIVE_STAGGER;

  /** 1 while walking, 0 once stopped — fades the gait out over a few frames. */
  const walkAmt = (idx: number) =>
    1 -
    interpolate(frame, [arriveAt(idx) - 6, arriveAt(idx)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    });

  /** 0 → 1 as this holder presses its card overhead, a beat after arriving. */
  const raiseAmt = (idx: number) =>
    interpolate(frame, [arriveAt(idx) + 4, arriveAt(idx) + 4 + RAISE_DUR], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  /* A slow wave on each raised card. Every holder gets its own PHASE OFFSET, so
     the row sways in a loose ripple instead of moving as one rigid block —
     three cards rocking in perfect unison reads as a glitch, not as people.
     It eases in on the raise so the card is steady while it is still rising. */
  const cardWave = (idx: number) =>
    Math.sin(frame * 0.07 + idx * 1.1) * 2.6 * raiseAmt(idx);

  const subtext = (narration ?? "").trim();
  const markerFont = (fontFamily ?? "").trim() || "'Patrick Hand', system-ui, sans-serif";
  const ink = textColor || "#111111";

  /* ── Auto-fit (title + subtext) ────────────────────────────────────
     Both render the full prop text directly from frame 0 (only opacity /
     transform animate) — no slice-reveal — so they can be measured directly,
     matching the `ending_socials` base. The title is bounded by the signboard
     it is written on. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitSubtextRef = React.useRef<HTMLDivElement>(null);
  // Landscape targets come down a notch from the single-column version: the
  // sign now occupies the left column rather than the full stage width.
  const fitTitleTarget = titleFontSize ?? (p ? 46 : 43);
  const fitSubtextTarget = descriptionFontSize ?? (p ? 29 : 24);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.14 : 0.16)),
  );
  const { px: fitSubtextPx } = useFitText(
    fitSubtextRef,
    fitSubtextTarget,
    descriptionFontSizeIsUserSet ? fitSubtextTarget : Math.round(fitSubtextTarget * 0.5),
    [subtext, fitSubtextTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(height * (p ? 0.12 : 0.13)),
  );

  // CTA cards (1-3). Only render cards with the toggle on and a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );

  /* CTA card text scales with the description size, so raising or lowering
     `descriptionFontSize` moves the cards with the subtext instead of leaving
     them at a fixed size.

     It also scales DOWN with the card count: each card gets its own holder
     standing side by side, so N cards share the column's width. Without this
     three cards overrun each other and their labels clip. */
  /* No CTA at all is a valid configuration (the toggle can be off, or no link
     given). The holder column is then omitted entirely rather than rendered
     empty — an empty flex child still reserves its width, which pushed the sign
     off-centre and left a stray ground line floating beside it. */
  const hasCards = cards.length > 0;
  const cardScale = cards.length >= 3 ? 0.62 : cards.length === 2 ? 0.8 : 1;
  const ctaButtonPx = Math.round(
    Math.max(11, Math.min(p ? 50 : 43, fitSubtextTarget * (p ? 1.05 : 1.15)) * cardScale),
  );
  const ctaLinkPx = Math.round(
    Math.max(9, Math.min(p ? 34 : 29, fitSubtextTarget * (p ? 0.75 : 0.8)) * cardScale),
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor, fontFamily: markerFont }}>
      <WhiteboardBackground bgColor={bgColor} />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="grain-esv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.05" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink-esv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="96" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkSign-esv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="4" seed="67" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="4.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain-esv2)" fill="none" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Portrait pins the title card to the top and the socials to the
          // bottom, letting the figure take the space between; landscape stays
          // vertically centred.
          justifyContent: p ? "space-between" : "center",
          padding: p ? "10% 7%" : "7% 7%",
          gap: p ? 40 : 52,
          boxSizing: "border-box",
          opacity: fade,
          zIndex: 10,
        }}
      >
        {/* ── Two columns: sign + copy on the left, figure + CTAs on the
            right. Portrait stacks them instead. ─────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: p ? "column" : "row",
            // Landscape BOTTOM-aligns the two columns so the holders' feet and
            // the sign's posts share one ground line, which drops the figures
            // lower in frame than centring them did.
            alignItems: p ? "center" : "flex-end",
            gap: p ? 32 : "5%",
            width: "100%",
            minHeight: 0,
            // Portrait: take the space between the pinned socials and the top,
            // so the sign and figure distribute through it instead of bunching.
            flex: p ? 1 : undefined,
            justifyContent: p ? "space-evenly" : "center",
          }}
        >
          {/* ── LEFT: signboard on two posts + subtext ──────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              /* With no CTA there is no second column to share the stage with,
                 so the sign centres instead of staying pinned to the left half.
                 It does NOT go full-width: the board's height scales with its
                 width, so 100% overflows the frame vertically. 62% keeps it at
                 roughly the size it has when a CTA column is present. */
              width: p ? "100%" : hasCards ? "50%" : "62%",
            }}
          >
            {/* The posts SVG below is absolutely positioned and so adds no
                layout height; this wrapper reserves that space itself, keeping
                the ground line and subtext tight under the posts' feet. */}
            <div
              style={{
                position: "relative",
                width: p ? "96%" : "100%",
                paddingBottom: p ? "22%" : "19%",
              }}
            >
              {/* The board itself. The posts hang off its bottom edge, so they
                  are sized against the board rather than the padded wrapper. */}
              <div style={{ position: "relative", zIndex: 3 }}>
                <svg
                  style={{
                    position: "absolute",
                    left: 0,
                    // Overlaps up behind the board so the post tops are hidden,
                    // and hangs below it by the reserved strip's depth.
                    top: "78%",
                    height: "63%",
                    width: "100%",
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: -1,
                  }}
                  viewBox="0 0 900 300"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <g filter="url(#inkSign-esv2)" fill="none" strokeLinecap="round">
                    <line
                      x1={190}
                      y1={0}
                      x2={175}
                      y2={290}
                      stroke={ink}
                      strokeWidth={9}
                      strokeOpacity={0.7}
                      strokeDasharray={300}
                      strokeDashoffset={300 * (1 - boardProgress)}
                    />
                    <line
                      x1={710}
                      y1={0}
                      x2={725}
                      y2={290}
                      stroke={ink}
                      strokeWidth={9}
                      strokeOpacity={0.7}
                      strokeDasharray={300}
                      strokeDashoffset={300 * (1 - boardProgress)}
                    />
                  </g>
                </svg>

                <svg
                  style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
                  viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
                  aria-hidden
                >
                  <g filter="url(#inkSign-esv2)" strokeLinecap="round" strokeLinejoin="round">
                    <rect
                      x={8}
                      y={8}
                      width={BOARD_W - 16}
                      height={BOARD_H - 16}
                      rx={10}
                      fill="#FFFFFF"
                      fillOpacity={0.92}
                    />
                    <rect
                      x={8}
                      y={8}
                      width={BOARD_W - 16}
                      height={BOARD_H - 16}
                      rx={10}
                      fill="none"
                      stroke={ink}
                      strokeWidth={11}
                      strokeOpacity={0.2}
                      strokeDasharray={BOARD_PERIMETER}
                      strokeDashoffset={BOARD_PERIMETER * (1 - boardProgress)}
                    />
                    <rect
                      x={8}
                      y={8}
                      width={BOARD_W - 16}
                      height={BOARD_H - 16}
                      rx={10}
                      fill="none"
                      stroke={ink}
                      strokeWidth={6}
                      strokeDasharray={BOARD_PERIMETER}
                      strokeDashoffset={BOARD_PERIMETER * (1 - boardProgress)}
                    />
                  </g>
                </svg>

                {/* Title and subtext, both written on the board */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4%",
                    padding: "6% 8%",
                    boxSizing: "border-box",
                    opacity: titleOp,
                  }}
                >
                  <div
                    ref={fitTitleRef}
                    style={{
                      color: ink,
                      fontWeight: 800,
                      fontSize: fitTitlePx,
                      lineHeight: 1.08,
                      width: "100%",
                      textAlign: "center",
                      fontFamily: markerFont,
                      filter: "url(#ink-esv2)",
                    }}
                  >
                    {title}
                  </div>

                  {subtext ? (
                    <div
                      ref={fitSubtextRef}
                      style={{
                        fontSize: fitSubtextPx,
                        lineHeight: 1.25,
                        color: `${ink}CC`,
                        fontFamily: markerFont,
                        width: "100%",
                        textAlign: "center",
                      }}
                    >
                      {subtext}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Ground line, sitting just under the posts' feet. */}
            <svg
              style={{
                width: "92%",
                height: 16,
                marginTop: 0,
                overflow: "visible",
                pointerEvents: "none",
              }}
              viewBox="0 0 800 16"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0,8 Q200,12 400,8 Q600,4 800,9"
                fill="none"
                stroke={ink}
                strokeWidth={5}
                strokeOpacity={0.25}
                strokeLinecap="round"
                filter="url(#inkSign-esv2)"
                strokeDasharray={820}
                strokeDashoffset={820 * (1 - boardProgress)}
              />
            </svg>
          </div>

          {/* ── RIGHT: one figure per CTA, each holding its own card ──
              A single figure pointing at a stack made the extra cards belong to
              nobody. Giving each CTA its own holder keeps every card physically
              accounted for, and reuses the shoulder-press idiom from
              `drawn_title__v2` so the whole template reads consistently. */}
          {hasCards ? (
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: p ? "4%" : "6%",
              width: p ? "100%" : "45%",
            }}
          >
            {cards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: 0,
                  flex: "1 1 0",
                }}
              >
                {/* The card, held overhead */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: `${Math.round(ctaButtonPx * 0.45)}px ${Math.round(ctaButtonPx * 0.8)}px`,
                    border: `4px solid ${ink}`,
                    borderRadius: 10,
                    backgroundColor: "#FFFFFF",
                    boxShadow: `6px 6px 0px ${accentColor}44`,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    /* The card is only revealed as it is PRESSED UP: before
                       that the holder is still walking in empty-handed, so a
                       card sitting overhead would have nothing holding it.
                       `raiseAmt` both fades it in and lifts it into place, and
                       the wave rides on the same scalar. */
                    transform: `translateY(${(1 - raiseAmt(idx)) * 26}px) scale(${
                      0.9 + raiseAmt(idx) * 0.1
                    }) rotate(${cardWave(idx)}deg)`,
                    // Pivot at the card's BOTTOM edge — that is where the hands
                    // grip it, so the wave reads as the holder tilting the card
                    // rather than the card sliding out of their grasp.
                    transformOrigin: "50% 100%",
                    opacity: raiseAmt(idx),
                    minWidth: 0,
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      color: ink,
                      fontSize: ctaButtonPx,
                      fontWeight: 800,
                      fontFamily: markerFont,
                      textAlign: "center",
                      // NOT nowrap: with one holder per CTA the cards share the
                      // column, so a long label has to wrap rather than force
                      // the card wider than its share and clip.
                      lineHeight: 1.15,
                    }}
                  >
                    {card.ctaButtonText.trim() || "Get started"}
                  </div>
                  <div
                    style={{
                      fontSize: ctaLinkPx,
                      fontWeight: 600,
                      color: `${ink}CC`,
                      fontFamily: markerFont,
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                      textAlign: "center",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                </div>

                {/* Its holder. Walks in from off-frame RIGHT on the base
                    `drawn_title` rig, stops on its mark, then presses the card
                    overhead. The svg is pulled UP under the card so the raised
                    hands meet its edge (hands land at y=34 of a 210 viewBox). */}
                <svg
                  style={{
                    width: p ? "92%" : "86%",
                    maxWidth: p ? 190 : 170,
                    height: "auto",
                    marginTop: -Math.round(ctaButtonPx * 0.2),
                    overflow: "visible",
                    pointerEvents: "none",
                  }}
                  viewBox="0 0 150 210"
                  fill="none"
                  aria-hidden
                >
                  {(() => {
                    const walk = walkAmt(idx);
                    const raise = raiseAmt(idx);

                    /* Base `drawn_title` gait, verbatim: same cadence, leg
                       phases, bob and arm swing. Frozen at the arrival frame so
                       the legs stop stepping once the figure is standing. */
                    const cycle = Math.min(frame, arriveAt(idx)) * 0.22 * 0.9;
                    const bob = Math.sin(cycle * 2) * 3 * walk;
                    const leg = (phase: number) => ({
                      thigh: Math.sin(cycle + phase) * 32 * walk,
                      knee: Math.max(0, Math.sin(cycle + phase - Math.PI / 2)) * 40 * walk,
                    });
                    const legL = leg(0);
                    const legR = leg(Math.PI);
                    const armSwing = Math.sin(cycle) * 30 * walk * (1 - raise);

                    /* Travel: linear, as the base does it. A constant ground
                       speed is what keeps every stride the same length —
                       easing here would stretch and squash the stride against
                       the unchanged leg cycle and make the figure skate. The
                       run-in distance is per-holder so they arrive staggered. */
                    const walkX = interpolate(
                      frame,
                      [0, arriveAt(idx)],
                      [260 + idx * 40, 0],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                    );

                    /* Arms: swinging at the sides while walking, pressed
                       overhead once raised. Both ends are interpolated on the
                       SAME `raise` scalar as the card, so the hands cannot
                       drift off its underside mid-press.

                       The walking pose is the base rig's arm SCALED to this
                       taller viewBox — the base is 124 units tall about a
                       shoulder at y=48, this one is 210 about a shoulder at
                       y=92, so its 50→55→70 / 48→68→82 arm becomes roughly
                       75→81→101 / 92→118→136. Reusing the base's raw numbers
                       here gives a stub of an arm collapsed against the head. */
                    const upperY = interpolate(raise, [0, 1], [118, 74]);
                    const handY = interpolate(raise, [0, 1], [136, 34]);
                    /* Each arm gets its OWN raised target, mirrored about the
                       body, so the pair opens into a V with one limb either
                       side of the head. Sending both to the same point put both
                       hands on one corner of the card and left the other side
                       of it visibly unsupported. Walking, they sit at the same
                       x and are separated only by the swing. */
                    const armX = (dir: 1 | -1) => ({
                      upper: interpolate(raise, [0, 1], [81, 75 + dir * 37]),
                      hand: interpolate(raise, [0, 1], [101, 75 + dir * 41]),
                    });
                    const frontArm = armX(-1);
                    const backArm = armX(1);

                    return (
                      // The base rig FACES RIGHT, and these walk right→left, so
                      // the whole group is mirrored about its own centre. The
                      // travel is applied OUTSIDE the mirror, or the flip would
                      // also invert it and send the figure the wrong way.
                      <g transform={`translate(${walkX}, 0)`}>
                        <g transform="translate(150 0) scale(-1 1)">
                          <g
                            fill="none"
                            stroke={ink}
                            strokeWidth={5}
                            strokeLinecap="round"
                            filter="url(#ink-esv2)"
                            transform={`translate(0, ${bob})`}
                          >
                            {/* Head */}
                            <circle cx={75} cy={62} r={18} />
                            {/* Spine */}
                            <line x1={75} y1={80} x2={75} y2={140} />

                            {/* Back arm. The parent group already mirrors the
                                whole rig, so these coordinates are NOT flipped
                                again — doing so double-mirrored the limb and
                                collapsed it against the head. It swings in
                                opposition to the front arm; when raised both
                                converge on the same overhead pose. */}
                            <g transform={`rotate(${-armSwing} 75 92)`}>
                              <line x1={75} y1={92} x2={backArm.upper - 6 * (1 - raise)} y2={upperY} />
                              <line
                                x1={backArm.upper - 6 * (1 - raise)}
                                y1={upperY}
                                x2={backArm.hand - 10 * (1 - raise)}
                                y2={handY}
                              />
                            </g>

                            {/* Legs — the base rig's thigh/shin, scaled to this
                                taller viewBox (hip 140 → knee 166 → foot 194).
                                Standing, the feet plant either side of centre;
                                walking, both hang off the same hip as the base
                                does, so the stride reads correctly in profile. */}
                            <g transform={`rotate(${legR.thigh} 75 140)`}>
                              <line x1={75} y1={140} x2={75 - 11 * (1 - walk)} y2={166} />
                              <g transform={`translate(${75 - 11 * (1 - walk)}, 166) rotate(${legR.knee})`}>
                                <line x1={0} y1={0} x2={interpolate(walk, [0, 1], [-3, 10])} y2={28} />
                              </g>
                            </g>
                            <g transform={`rotate(${legL.thigh} 75 140)`}>
                              <line x1={75} y1={140} x2={75 + 11 * (1 - walk)} y2={166} />
                              <g transform={`translate(${75 + 11 * (1 - walk)}, 166) rotate(${legL.knee})`}>
                                <line x1={0} y1={0} x2={interpolate(walk, [0, 1], [3, 10])} y2={28} />
                              </g>
                            </g>

                            {/* Front arm */}
                            <g transform={`rotate(${armSwing} 75 92)`}>
                              <line x1={75} y1={92} x2={frontArm.upper} y2={upperY} />
                              <line x1={frontArm.upper} y1={upperY} x2={frontArm.hand} y2={handY} />
                            </g>
                          </g>
                        </g>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            ))}

            {/* Ground line under the holders' feet. Lives INSIDE the right
                column so it sits directly beneath them; placed after the row it
                stacked below BOTH columns and floated clear of the feet. */}
            <svg
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -10,
                width: "100%",
                height: 16,
                overflow: "visible",
                pointerEvents: "none",
                opacity: groundIn,
              }}
              viewBox="0 0 800 16"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0,8 Q200,11 400,8 Q600,5 800,9"
                fill="none"
                stroke={ink}
                strokeWidth={5}
                strokeOpacity={0.25}
                strokeLinecap="round"
                filter="url(#inkSign-esv2)"
                strokeDasharray={820}
                strokeDashoffset={820 * (1 - groundIn)}
              />
            </svg>
          </div>
          ) : null}
        </div>

        {/* ── Socials row, centred across the bottom of both columns.
            `SocialIcons` sizes each item as a fraction of its container, so the
            row is capped rather than left to span the full stage width. ── */}
        <div
          style={{
            width: "100%",
            maxWidth: p ? "100%" : 720,
            flexShrink: 0,
            opacity: socialsOp,
          }}
        >
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={ink}
            maxPerRow={p ? 3 : 4}
            fontFamily={markerFont}
            aspectRatio={aspectRatio}
            // Smaller than the component defaults (46 / 64): the row is a
            // footer here, below the sign and the CTA stack.
            iconSize={p ? 46 : 34}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
