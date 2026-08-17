import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { NightfallClip } from "../components/NightfallClip";
import type { NightfallLayoutProps } from "../types";

/**
 * CinematicTitleV2 — "Aperture"
 *
 * Variant of `cinematic_title`. Same props, different composition.
 *
 * Base is a centred title over a full-bleed image that fades up late. This one
 * irises the visual into a wide OVAL: the ring opens from the centre, the title
 * rises from BEHIND the oval's lower edge and settles under it, and a single
 * accent dot tracks the rim on an elliptical orbit in place of the base's
 * scattered particles.
 *
 * The title is clipped by an overflow:hidden mask whose top edge sits on the
 * oval's bottom — that mask is what sells "rising from behind the aperture", so
 * it must stay tied to RING_H (the vertical extent), not the width.
 */
export const CinematicTitleV2: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  textColor,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const font = fontFamily ?? "'Playfair Display', Georgia, serif";
  const hasVisual = !!(imageUrl || videoUrl);

  // ── Aperture geometry. Everything else keys off this. ──────────────────────
  // Both orientations lift the aperture above centre so the masked copy below it
  // has room; landscape is the tight case (only ~half the frame height is left
  // under the ring), so the ring is smaller and sits higher there.
  //
  // The aperture is an OVAL: wider than tall. Height is what buys vertical room
  // for the copy below, so widening happens on RING_W only and RING_H is left at
  // the value the layout was tuned against.
  const RING_H = p ? 460 : 440;
  const RING_W = Math.round(RING_H * 1.45);
  const ringCentreY = p ? -180 : -215;

  // Iris: snaps open from a hard pinhole with real overshoot, so the opening
  // reads as a shutter firing rather than a circle fading up.
  const irisSpring = spring({
    frame: frame - 2,
    fps,
    config: { damping: 13, stiffness: 78, mass: 1.1 },
  });
  const irisScale = 0.04 + irisSpring * 0.96;
  const irisOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  // Shutter blades sweep across the aperture as it opens, then clear.
  const bladeSweep = interpolate(frame, [2, 30], [1, 0], { extrapolateRight: "clamp" });

  // Shockwave ring thrown off at the moment the iris reaches full bore.
  const shockProgress = interpolate(frame, [16, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Softer than a hard flash — the template's register is slow and atmospheric
  // (see DarkBackground's drift), so the shock reads as a breath, not a strobe.
  const shockOpacity = interpolate(frame, [16, 26, 54], [0, 0.42, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rim flare pulses on open, then settles into a slow breath. The sustained
  // level is what carries most of the scene, so the peak is only modestly above
  // it — a hard spike would sit outside the template's register.
  const rimFlare =
    interpolate(frame, [8, 22, 46], [0, 0.82, 0.34], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) +
    0.1 * Math.sin(frame / 34);

  // The visual itself resolves a little after the ring so the ring leads.
  const visualOpacity = interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp" });
  // Ken-Burns settle. This multiplies the user's imageZoom (the template-wide
  // convention — cf. GlassImage), so an aggressive start pushes the framing well
  // off what the adjust modal previewed. Kept close to the base layout's 1.05 so
  // the crop the user chose is what they broadly see.
  const visualScale = interpolate(frame, [10, 150], [1.12, 1], { extrapolateRight: "clamp" });

  // Title rises out from behind the circle's lower edge.
  const titleRise = spring({
    frame: frame - 26,
    fps,
    config: { damping: 24, stiffness: 62, mass: 1.2 },
  });
  const titleOpacity = interpolate(frame, [26, 50], [0, 1], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [52, 76], [0, 1], { extrapolateRight: "clamp" });
  const bracketW = interpolate(frame, [52, 80], [0, 1], { extrapolateRight: "clamp" });

  // Divider between the aperture and the title — lands just before the title
  // rises, so the copy block reads as arriving in order top-to-bottom.
  const eyebrowOpacity = interpolate(frame, [22, 46], [0, 1], { extrapolateRight: "clamp" });

  // ── Two orbiting bodies, replacing the base's scattered particles. ─────────
  // Deliberately NOT a symmetric pair: different sizes, periods and radii, so
  // they drift in and out of phase and read as independent bodies rather than
  // two ends of one spinning bar. Each rides its own tilted ellipse offset
  // outside the rim, and `depth` sends a body BEHIND the aperture on the far
  // half of its travel, which is what gives the orbit its sense of depth.
  //
  // Colour follows DarkBackground's indigo→cyan sky rather than making both
  // bodies flat accent balls: the inner body carries the scene accent, the outer
  // one picks up the background's cyan so the pair sits inside the palette.
  const PLANETS = [
    {
      size: 22,
      period: 300,
      phase: -Math.PI / 2,
      pad: 18,
      tilt: 0.06,
      color: accentColor,
      trail: 26,
    },
    {
      size: 13,
      period: -430, // retrograde — counter-rotation keeps the pair from reading as one rigid system
      phase: Math.PI * 0.72,
      pad: 58,
      tilt: -0.28,
      color: "#22D3EE", // DarkBackground's cyan wash
      trail: 20,
    },
  ];

  // Orbit paths fade in after the iris settles — faint elliptical traces so the
  // bodies read as following a path rather than drifting free.
  const pathOpacity = interpolate(frame, [30, 62], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      {/* Ambient bloom behind the aperture */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: RING_W * 1.9,
          height: RING_H * 1.9,
          transform: `translate(-50%, calc(-50% + ${ringCentreY}px))`,
          background: `radial-gradient(ellipse, ${accentColor}22 0%, transparent 62%)`,
          filter: "blur(70px)",
          opacity: irisOpacity,
        }}
      />

      {/* ── The aperture ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: RING_W,
          height: RING_H,
          transform: `translate(-50%, calc(-50% + ${ringCentreY}px)) scale(${irisScale})`,
          borderRadius: "50%",
          overflow: "hidden",
          opacity: irisOpacity,
          border: `3px solid ${accentColor}`,
          boxShadow: `0 0 ${60 + rimFlare * 120}px ${accentColor}${rimFlare > 0.6 ? "AA" : "66"}, 0 0 ${
            160 + rimFlare * 200
          }px ${accentColor}44, inset 0 0 90px rgba(0,0,0,0.6)`,
          backgroundColor: "rgba(255,255,255,0.03)",
          zIndex: 3,
        }}
      >
        {hasVisual && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: visualOpacity,
              transform: `scale(${visualScale})`,
            }}
          >
            {videoUrl ? (
              <NightfallClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={{ display: "block" }}
              />
            ) : (
              <img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition:
                    (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin:
                    (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                  display: "block",
                }}
              />
            )}
          </div>
        )}
        {/* Vignette so the rim reads as a lens rather than a pasted circle */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse, transparent 45%, rgba(10,10,26,0.55) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Shutter blades: six wedges that close over the aperture and sweep
            clear as it opens. This is the bulk of the "shutter firing" read. */}
        {bladeSweep > 0.001 &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                // Blades rotate about the centre, so they must be square on the
                // WIDEST axis or a rotated wedge would fall short of the oval's
                // horizontal extremes and leave the rim uncovered.
                width: RING_W,
                height: RING_W,
                marginLeft: -RING_W / 2,
                marginTop: -RING_W / 2,
                transform: `rotate(${i * 60 + bladeSweep * 46}deg) translateY(${
                  (1 - bladeSweep) * -RING_W * 0.62
                }px)`,
                transformOrigin: "50% 50%",
                clipPath: "polygon(50% 50%, 6% 0, 94% 0)",
                background: `linear-gradient(180deg, ${accentColor}2E 0%, rgba(6,6,20,0.94) 60%)`,
                opacity: bladeSweep,
                pointerEvents: "none",
              }}
            />
          ))}
      </div>

      {/* Shockwave thrown off as the iris hits full bore */}
      {shockOpacity > 0.001 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: RING_W,
            height: RING_H,
            marginLeft: -RING_W / 2,
            marginTop: -RING_H / 2,
            transform: `translateY(${ringCentreY}px) scale(${1 + shockProgress * 1.5})`,
            borderRadius: "50%",
            border: `2px solid ${accentColor}`,
            opacity: shockOpacity,
            filter: `blur(${shockProgress * 3}px)`,
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Inner hairline ring */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: RING_W + 26,
          height: RING_H + 26,
          transform: `translate(-50%, calc(-50% + ${ringCentreY}px)) scale(${irisScale})`,
          borderRadius: "50%",
          border: `1px solid ${accentColor}33`,
          opacity: irisOpacity,
          zIndex: 2,
        }}
      />

      {/* ── Orbit paths: faint traces so the bodies follow something visible ── */}
      {PLANETS.map((pl, i) => (
        <div
          key={`path-${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: (RING_W + pl.pad * 2) * irisScale,
            height: (RING_H + pl.pad * 2) * irisScale,
            marginLeft: (-(RING_W + pl.pad * 2) * irisScale) / 2,
            marginTop: (-(RING_H + pl.pad * 2) * irisScale) / 2,
            transform: `translateY(${ringCentreY}px) rotate(${pl.tilt}rad)`,
            borderRadius: "50%",
            border: `1px solid ${pl.color}1F`,
            opacity: pathOpacity,
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ── Orbiting bodies, each with a comet trail ── */}
      {PLANETS.map((pl, i) => {
        const rx = RING_W / 2 + pl.pad;
        const ry = RING_H / 2 + pl.pad;

        // Position on the tilted ellipse at an arbitrary angle. Shared by the
        // body and every trail segment, so the trail lies exactly on the path.
        const at = (a: number) => {
          const ux = Math.cos(a) * rx;
          const uy = Math.sin(a) * ry;
          return {
            x: (ux * Math.cos(pl.tilt) - uy * Math.sin(pl.tilt)) * irisScale,
            y: (ux * Math.sin(pl.tilt) + uy * Math.cos(pl.tilt)) * irisScale,
            // depth: +1 nearest the viewer, -1 farthest.
            depth: Math.sin(a),
          };
        };

        const angle = (frame / pl.period) * Math.PI * 2 + pl.phase;
        const appear = interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" });

        // Trail sampled BACKWARDS along the path — each segment smaller and
        // fainter, giving motion direction without any blur filter.
        const TRAIL = 7;
        const segs = Array.from({ length: TRAIL }, (_, s) => {
          const t = (s + 1) / TRAIL;
          const back = angle - Math.sign(pl.period) * t * (pl.trail / 360) * Math.PI * 2;
          const q = at(back);
          return {
            ...q,
            size: pl.size * (1 - t) * 0.5,
            alpha: (1 - t) * 0.42,
          };
        });

        const here = at(angle);
        const inFront = here.depth > 0;
        // Far pass recedes: smaller and dimmer.
        const scale = 0.76 + ((here.depth + 1) / 2) * 0.44;

        return (
          <React.Fragment key={i}>
            {segs.map((s, si) =>
              s.size < 0.6 ? null : (
                <div
                  key={si}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: s.size,
                    height: s.size,
                    borderRadius: "50%",
                    backgroundColor: pl.color,
                    transform: `translate(-50%, calc(-50% + ${ringCentreY}px)) translate(${s.x}px, ${s.y}px)`,
                    opacity: appear * s.alpha * (s.depth > 0 ? 1 : 0.45),
                    filter: "blur(1px)",
                    zIndex: s.depth > 0 ? 4 : 2,
                    pointerEvents: "none",
                  }}
                />
              ),
            )}

            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: pl.size,
                height: pl.size,
                borderRadius: "50%",
                // Lit from the upper-left so it reads as a sphere, not a flat disc.
                background: `radial-gradient(circle at 32% 28%, #FFFFFF 0%, ${pl.color} 44%, ${pl.color}66 100%)`,
                boxShadow: `0 0 ${pl.size * 1.4}px ${pl.color}, 0 0 ${pl.size * 3.2}px ${pl.color}70`,
                transform: `translate(-50%, calc(-50% + ${ringCentreY}px)) translate(${here.x}px, ${here.y}px) scale(${scale})`,
                opacity: appear * (inFront ? 1 : 0.55),
                zIndex: inFront ? 4 : 2,
                pointerEvents: "none",
              }}
            />
          </React.Fragment>
        );
      })}

      {/* ── Copy, masked so the title rises from behind the aperture ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          // Mask top edge sits on the oval's bottom edge — vertical extent, so
          // this tracks RING_H and is unaffected by widening.
          top: `calc(50% + ${ringCentreY}px + ${(RING_H / 2) * irisScale}px)`,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: p ? "0 48px" : "0 100px",
          overflow: "hidden",
          zIndex: 5,
        }}
      >
        {/* Graphic divider under the aperture: hairlines growing out from a centre
            diamond, matching the template's rule-plus-marker idiom. Deliberately
            wordless — there is no kicker field on the props, and hardcoding the
            template name would read as a watermark on every video. The diamond
            echoes the starfield's sparkle motif. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: p ? 12 : 14,
            marginTop: p ? 58 : 44,
            opacity: eyebrowOpacity,
          }}
        >
          <div
            style={{
              width: (p ? 54 : 66) * eyebrowOpacity,
              height: 1,
              background: `linear-gradient(90deg, transparent 0%, ${accentColor} 100%)`,
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              backgroundColor: accentColor,
              transform: `rotate(45deg) scale(${eyebrowOpacity})`,
              boxShadow: `0 0 12px ${accentColor}`,
            }}
          />
          <div
            style={{
              width: (p ? 54 : 66) * eyebrowOpacity,
              height: 1,
              background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
            }}
          />
        </div>

        <h1
          style={{
            fontSize: titleFontSize ?? (p ? 92 : 86),
            fontWeight: 800,
            color: "#FFFFFF",
            fontFamily: font,
            textAlign: "center",
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            maxWidth: "94%",
            margin: 0,
            // Gap below the divider. The divider's own marginTop now carries most
            // of the offset from the oval's lower edge, so this is the tighter
            // title-to-divider relationship.
            marginTop: p ? 34 : 28,
            opacity: titleOpacity,
            // Starts fully below the mask edge, settles into place.
            transform: `translateY(${(1 - titleRise) * 130}px)`,
            textShadow: `0 0 70px ${accentColor}40`,
          }}
        >
          {title}
        </h1>

        {narration && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: p ? 16 : 24,
              marginTop: p ? 26 : 22,
              maxWidth: p ? "92%" : 980,
              opacity: subOpacity,
            }}
          >
            <div
              style={{
                width: (p ? 40 : 70) * bracketW,
                height: 1,
                backgroundColor: `${accentColor}`,
                boxShadow: `0 0 12px ${accentColor}80`,
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontSize: descriptionFontSize ?? (p ? 38 : 33),
                fontWeight: 400,
                color: `${textColor}A6`,
                fontFamily: font,
                textAlign: "center",
                lineHeight: 1.45,
                letterSpacing: "0.01em",
                margin: 0,
              }}
            >
              {narration}
            </p>
            <div
              style={{
                width: (p ? 40 : 70) * bracketW,
                height: 1,
                backgroundColor: `${accentColor}`,
                boxShadow: `0 0 12px ${accentColor}80`,
                flexShrink: 0,
              }}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
