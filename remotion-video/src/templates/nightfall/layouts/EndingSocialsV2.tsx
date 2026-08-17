import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";

/**
 * EndingSocialsV2 — "Constellation"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * Base stacks title → glass card → socials → CTA columns, with a cursor gag on
 * the first link. This one drops the single card and the cursor: the title sits
 * inside a constellation of accent nodes — two COUNTER-ROTATING rings joined by
 * spokes and chords, ignited outward from the centre on entry, with a sweep
 * travelling the outer ring and brightening each node as it passes. Each CTA
 * becomes its own full-width glass bar below.
 *
 * `SocialIcons` still renders the icon cluster — the ring is drawn behind it, so
 * icon/label behaviour stays identical to every other ending scene rather than
 * forking the shared icon set.
 */

const NODE_COUNT = 14;
/** Chords drawn between ring nodes, so the field reads as a linked constellation
 *  rather than a bare spoked wheel. Index pairs into the node ring. */
const CHORDS: Array<[number, number]> = [
  [0, 3],
  [3, 7],
  [7, 11],
  [11, 0],
  [2, 9],
  [5, 12],
];

export const EndingSocialsV2: React.FC<NightfallLayoutProps> = ({
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
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const font = (fontFamily ?? "").trim() || "'Playfair Display', Georgia, serif";

  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );

  const subtext = (narration ?? "").trim();

  const titleOpacity = interpolate(frame, [4, 24], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [16, 38], [0, 1], { extrapolateRight: "clamp" });
  const ringOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  // Counter-rotating rings: the outer drifts one way, the inner the other, which
  // gives the field visible parallax instead of a single rigid spin.
  const ringRotation = (frame / 620) * 360;
  const innerRotation = -(frame / 900) * 360;
  // Kept inside the frame: the ring is drawn from the composition centre, so the
  // radius plus the y-squash must stay within half the shorter axis or nodes
  // clip off the edges.
  const ringRadius = p ? 330 : 420;

  // Accent pulse shared by the nodes and the CTA chevrons.
  const pulse = 0.55 + 0.45 * Math.sin((frame / 45) * Math.PI);

  // Ring ignition: the constellation snaps outward from the centre on entry.
  const ignite = spring({
    frame: frame - 2,
    fps: 30,
    config: { damping: 15, stiffness: 62, mass: 1.2 },
  });

  // A sweep travels the ring, brightening each node as it passes.
  const sweepAngle = (frame / 110) % 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      {/* Central bloom */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: p ? "34%" : "40%",
          width: ringRadius * 2.4,
          height: ringRadius * 2.4,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${accentColor}1F 0%, transparent 62%)`,
          filter: "blur(80px)",
          opacity: ringOpacity,
        }}
      />

      {/* ── Constellation: two counter-rotating rings of nodes, joined by spokes
             and chords, with a sweep travelling the outer ring ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: p ? "34%" : "40%",
          width: 0,
          height: 0,
          transform: `translate(-50%, -50%) rotate(${ringRotation}deg) scale(${ignite})`,
          opacity: ringOpacity,
        }}
      >
        {(() => {
          const pts = Array.from({ length: NODE_COUNT }).map((_, i) => {
            const a = (i / NODE_COUNT) * Math.PI * 2;
            return {
              x: Math.cos(a) * ringRadius,
              y: Math.sin(a) * ringRadius * (p ? 0.82 : 0.6),
            };
          });

          return (
            <>
              {/* Chords between non-adjacent nodes */}
              {CHORDS.map(([a, b], i) => {
                const A = pts[a % NODE_COUNT];
                const B = pts[b % NODE_COUNT];
                const dx = B.x - A.x;
                const dy = B.y - A.y;
                const len = Math.hypot(dx, dy);
                const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
                const draw = interpolate(frame, [10 + i * 4, 40 + i * 4], [0, 1], {
                  extrapolateRight: "clamp",
                });
                return (
                  <div
                    key={`c${i}`}
                    style={{
                      position: "absolute",
                      left: A.x,
                      top: A.y,
                      width: len * draw,
                      height: 1,
                      transformOrigin: "0 50%",
                      transform: `rotate(${ang}deg)`,
                      background: `linear-gradient(90deg, ${accentColor}00, ${accentColor}55, ${accentColor}00)`,
                      opacity: 0.75,
                    }}
                  />
                );
              })}

              {/* Spokes + nodes */}
              {pts.map((pt, i) => {
                const nodeIn = spring({
                  frame: frame - 4 - i * 2,
                  fps: 30,
                  config: { damping: 18, stiffness: 95 },
                });
                const dist = Math.hypot(pt.x, pt.y);
                const spokeAngle = (Math.atan2(pt.y, pt.x) * 180) / Math.PI;

                // Distance (in ring fraction) from the travelling sweep.
                const nodeFrac = i / NODE_COUNT;
                let d = Math.abs(nodeFrac - sweepAngle);
                if (d > 0.5) d = 1 - d;
                const lit = Math.max(0, 1 - d * 7);

                const size = (i % 3 === 0 ? 11 : 6) + lit * 7;

                return (
                  <React.Fragment key={i}>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: dist * nodeIn,
                        height: 1,
                        transformOrigin: "0 50%",
                        transform: `rotate(${spokeAngle}deg)`,
                        background: `linear-gradient(90deg, transparent 0%, ${accentColor}${
                          lit > 0.4 ? "55" : "26"
                        } 70%, ${accentColor}77 100%)`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: pt.x,
                        top: pt.y,
                        width: size,
                        height: size,
                        marginLeft: -size / 2,
                        marginTop: -size / 2,
                        borderRadius: "50%",
                        backgroundColor: accentColor,
                        boxShadow: `0 0 ${16 + pulse * 14 + lit * 40}px ${accentColor}`,
                        opacity: nodeIn * (0.45 + pulse * 0.35 + lit * 0.4),
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </>
          );
        })()}
      </div>

      {/* Inner counter-rotating ring — parallax against the outer field */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: p ? "34%" : "40%",
          width: 0,
          height: 0,
          transform: `translate(-50%, -50%) rotate(${innerRotation}deg) scale(${ignite})`,
          opacity: ringOpacity * 0.7,
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const a = (i / 7) * Math.PI * 2;
          const r = ringRadius * 0.54;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * (p ? 0.82 : 0.6);
          const nodeIn = spring({
            frame: frame - 14 - i * 3,
            fps: 30,
            config: { damping: 20, stiffness: 90 },
          });
          return (
            <div
              key={`i${i}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 4,
                height: 4,
                marginLeft: -2,
                marginTop: -2,
                borderRadius: "50%",
                backgroundColor: accentColor,
                boxShadow: `0 0 ${10 + pulse * 10}px ${accentColor}`,
                opacity: nodeIn * (0.35 + pulse * 0.35),
              }}
            />
          );
        })}
      </div>

      {/* ── Copy stack ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "56px 36px" : "70px 90px",
          zIndex: 3,
        }}
      >
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 82 : 76),
            fontWeight: 800,
            color: textColor || "#E2E8F0",
            fontFamily: font,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            opacity: titleOpacity,
            transform: `translateY(${(1 - titleOpacity) * -18}px)`,
            textShadow: `0 0 60px ${accentColor}35`,
          }}
        >
          {title}
        </div>

        {subtext ? (
          <div
            style={{
              fontSize: descriptionFontSize ?? (p ? 32 : 30),
              fontWeight: 400,
              color: `${textColor || "#E2E8F0"}A8`,
              fontFamily: font,
              textAlign: "center",
              lineHeight: 1.45,
              maxWidth: p ? "90%" : 720,
              marginTop: p ? 18 : 22,
              opacity: subOpacity,
            }}
          >
            {subtext}
          </div>
        ) : null}

        {/* Social cluster — shared renderer, sitting inside the ring */}
        <div style={{ marginTop: p ? 34 : 40, opacity: subOpacity, width: "100%", display: "flex", justifyContent: "center" }}>
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={textColor || "#E2E8F0"}
            maxPerRow={p ? 3 : 5}
            fontFamily={font}
            aspectRatio={aspectRatio}
          />
        </div>

        {/* ── CTA bars: one wide glass bar per CTA ── */}
        {cards.length > 0 && (
          <div
            style={{
              marginTop: p ? 32 : 40,
              display: "flex",
              flexDirection: "column",
              gap: p ? 12 : 14,
              width: "100%",
              maxWidth: p ? "94%" : 760,
            }}
          >
            {cards.map((card, idx) => {
              const barIn = spring({
                frame: frame - 34 - idx * 7,
                fps: 30,
                config: { damping: 22, stiffness: 80 },
              });
              return (
                <div
                  key={idx}
                  style={{
                    ...glassCardStyle(accentColor, 0.07),
                    borderRadius: 14,
                    borderColor: `${accentColor}38`,
                    padding: p ? "16px 20px" : "18px 26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 18,
                    opacity: barIn,
                    transform: `translateY(${(1 - barIn) * 22}px)`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: p ? 30 : 28,
                        fontWeight: 800,
                        color: accentColor,
                        fontFamily: font,
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.15,
                      }}
                    >
                      {card.ctaButtonText.trim() || "Get started"}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: p ? 20 : 18,
                        fontWeight: 500,
                        color: `${textColor || "#E2E8F0"}B3`,
                        fontFamily: font,
                        wordBreak: "break-word",
                      }}
                    >
                      {card.websiteLink}
                    </div>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      width: p ? 40 : 44,
                      height: p ? 40 : 44,
                      borderRadius: "50%",
                      border: `1px solid ${accentColor}66`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: accentColor,
                      fontSize: p ? 22 : 24,
                      boxShadow: `0 0 ${10 + pulse * 14}px ${accentColor}44`,
                    }}
                  >
                    →
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
