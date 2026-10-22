import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {SpaceBackdrop} from "../components/SpaceBackdrop";
import {FitText} from "../components/FitText";
import type {SceneLayoutProps} from "../types";
import {getStarlitFontFamily, getStarlitTypography} from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

const clamp = {extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const};

const seeded = (seed: number, index: number, salt: number) => {
  const value = Math.sin(seed * 97.31 + index * 67.17 + salt * 191.93) * 43758.5453;
  return value - Math.floor(value);
};

/** A dense dust vortex that resolves into an editorial data readout. */
export const RocketLaunch: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const portrait = props.aspectRatio === "portrait";
  const p = portrait;
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 92 : 76),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 52 : 40),
  }, p);
  const font = getStarlitFontFamily(props);
  const duration = props.sceneDurationInFrames ?? 150;
  const accent = props.accentColor;
  const background = props.bgColor;
  const text = props.textColor;
  const seed = props.seed ?? 42;
  const entrance = interpolate(frame, [0, 18], [0, 1], clamp);
  const exit = interpolate(frame, [duration - 18, duration], [1, 0], clamp);
  const copyIn = interpolate(frame, [68, 92], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const bodyIn = interpolate(frame, [80, 104], [0, 1], clamp);
  const galaxyX = W * .5;
  const galaxyY = H * .5;
  const galaxyRadius = portrait ? W * .53 : H * .62;
  const galaxyScale = interpolate(frame, [0, 64], [1.08, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  // Keep the incoming galaxy subdued while the black aperture is opening,
  // then restore the existing full-bright scene once the transition clears.
  const galaxyBrightness = interpolate(frame, [0, 42], [.34, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  // The dust streams flow through a fixed galactic plane. Inner particles move
  // a little faster than the rim, so the vortex remains alive without spinning
  // like a single flat illustration.
  // Spin speed starts high during the transition and decays exponentially to a
  // slow drift by the time the copy fades in. armFlow is the closed-form
  // integral of that speed, so rotation stays continuous.
  const SPIN_FAST = .42;
  const SPIN_SLOW = .012;
  const SPIN_TAU = 26;
  const armFlow = SPIN_FAST * SPIN_TAU * (1 - Math.exp(-frame / SPIN_TAU)) + SPIN_SLOW * frame;
  const heading = props.heading ?? props.title ?? "";
  const body = props.body ?? props.narration;

  const dustParticles = useMemo(() => Array.from({length: portrait ? 3400 : 4700}, (_, index) => {
    const arm = index % 6;
    const randomProgress = seeded(seed + 17, index, 1);
    const progress = Math.pow(randomProgress, .72) * 1.06;
    const radialScatter = (seeded(seed + 17, index, 2) - .5) * galaxyRadius * (.055 + progress * .09);
    const angleScatter = (seeded(seed + 17, index, 3) - .5) * (.54 + progress * .74);
    return {
      progress,
      radius: galaxyRadius * (.025 + progress * .93) + radialScatter,
      angle: arm * Math.PI * 2 / 6 + progress * Math.PI * 3.15 + angleScatter,
      size: .24 + Math.pow(seeded(seed + 17, index, 4), 3.5) * 2.1,
      opacity: .2 + Math.pow(seeded(seed + 17, index, 5), .72) * .8,
      phase: seeded(seed + 17, index, 6) * Math.PI * 2,
      twinkleSpeed: .025 + seeded(seed + 17, index, 7) * .065,
      accent: index % 7 < 3,
      highlight: index % 83 === 0,
    };
  }), [galaxyRadius, portrait, seed]);

  const cloudParticles = useMemo(() => Array.from({length: portrait ? 280 : 420}, (_, index) => {
    const arm = index % 6;
    const progress = Math.pow(seeded(seed + 91, index, 1), .78) * 1.04;
    const radius = galaxyRadius * (.04 + progress * .9)
      + (seeded(seed + 91, index, 2) - .5) * galaxyRadius * (.07 + progress * .1);
    const angle = arm * Math.PI * 2 / 6
      + progress * Math.PI * 3.12
      + (seeded(seed + 91, index, 3) - .5) * (.72 + progress * .68);
    return {
      progress,
      radius,
      angle,
      size: galaxyRadius * (.012 + seeded(seed + 91, index, 4) * .038),
      opacity: .04 + seeded(seed + 91, index, 5) * .12,
      phase: seeded(seed + 91, index, 6) * Math.PI * 2,
      accent: index % 4 !== 0,
    };
  }), [galaxyRadius, portrait, seed]);

  return (
    <AbsoluteFill style={{background, overflow: "hidden", opacity: entrance * exit, fontFamily: font}}>
      <AbsoluteFill style={{opacity: galaxyBrightness}}>
        <SpaceBackdrop
          seed={seed + 71}
          density={portrait ? 120 : 145}
          brightness={.72}
          accentColor={accent}
          backgroundColor={background}
          textColor={text}
          transparent
        />

        <svg width={W} height={H} style={{position: "absolute", inset: 0, overflow: "visible"}}>
          <defs>
            <radialGradient id="vortex-haze">
              <stop offset="0%" stopColor={text} stopOpacity=".42" />
              <stop offset="18%" stopColor={accent} stopOpacity=".44" />
              <stop offset="58%" stopColor={accent} stopOpacity=".18" />
              <stop offset="100%" stopColor={background} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="vortex-core">
              <stop offset="0%" stopColor={thTxt} stopOpacity=".95" />
              <stop offset="14%" stopColor={text} stopOpacity=".62" />
              <stop offset="38%" stopColor={accent} stopOpacity=".5" />
              <stop offset="70%" stopColor={accent} stopOpacity=".16" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <filter id="vortex-soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="15" /></filter>
            <filter id="vortex-cloud-blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10" /></filter>
            <filter id="vortex-accent-glow" x="-500%" y="-500%" width="1000%" height="1000%">
              <feGaussianBlur stdDeviation="4.8" result="accent-blur" />
              <feMerge><feMergeNode in="accent-blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g transform={`translate(${galaxyX} ${galaxyY}) rotate(${-18 + frame * .018}) scale(${galaxyScale})`}>
            <ellipse rx={galaxyRadius * 1.22} ry={galaxyRadius * .68} fill="none" stroke={accent} strokeWidth="1" strokeOpacity=".10" />
            <ellipse rx={galaxyRadius * 1.16} ry={galaxyRadius * .66} fill="url(#vortex-haze)" filter="url(#vortex-soft)" opacity=".94" />
            <g filter="url(#vortex-cloud-blur)">
              {cloudParticles.map((particle, index) => {
                const angle = particle.angle + armFlow * (.12 + (1 - particle.progress) * .34);
                const x = Math.cos(angle) * particle.radius;
                const y = Math.sin(angle) * particle.radius * .56;
                const breathe = .84 + Math.sin(frame * .018 + particle.phase) * .16;
                return <ellipse
                  key={`cloud-${index}`}
                  cx={x}
                  cy={y}
                  rx={particle.size * (1.3 + particle.progress * .5)}
                  ry={particle.size * .42}
                  fill={particle.accent ? accent : text}
                  opacity={particle.opacity * breathe}
                  transform={`rotate(${angle * 180 / Math.PI + 72} ${x} ${y})`}
                />;
              })}
            </g>
            {dustParticles.map((particle, index) => {
              const angle = particle.angle + armFlow * (.12 + (1 - particle.progress) * .34);
              const x = Math.cos(angle) * particle.radius;
              const y = Math.sin(angle) * particle.radius * .56;
              const shimmer = .7 + Math.sin(frame * particle.twinkleSpeed + particle.phase) * .3;
              const glint = particle.highlight
                ? .12 + Math.pow(Math.max(0, Math.sin(frame * particle.twinkleSpeed * .72 + particle.phase)), 8) * .88
                : 0;
              const accentParticle = particle.accent || particle.highlight;
              const color = accentParticle ? accent : text;
              const size = particle.size * (particle.highlight ? 1.45 : 1);
              const flare = 4 + size * 4.5;
              return <g key={`dust-${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={size * (.8 + glint * .45)}
                  fill={color}
                  opacity={particle.opacity * shimmer}
                  filter={particle.highlight ? "url(#vortex-accent-glow)" : undefined}
                />
                {particle.highlight ? <g opacity={glint * particle.opacity} transform={`rotate(${particle.phase * 180 / Math.PI} ${x} ${y})`}>
                  <line x1={x - flare} y1={y} x2={x + flare} y2={y} stroke={color} strokeWidth={Math.max(.45, size * .28)} />
                  <line x1={x} y1={y - flare * .72} x2={x} y2={y + flare * .72} stroke={color} strokeWidth={Math.max(.45, size * .28)} />
                </g> : null}
              </g>;
            })}
            <ellipse rx={galaxyRadius * .18} ry={galaxyRadius * .1} fill={text} opacity=".3" filter="url(#vortex-soft)" />
            <ellipse rx={galaxyRadius * .32} ry={galaxyRadius * .18} fill={accent} opacity=".38" filter="url(#vortex-soft)" />
            {/* a brighter galactic core: a soft luminous bulge at the centre of the swirl */}
            <ellipse rx={galaxyRadius * .46} ry={galaxyRadius * .27} fill="url(#vortex-core)" opacity=".9" />
          </g>
        </svg>
      </AbsoluteFill>

      <AbsoluteFill style={{background: `radial-gradient(ellipse 42% 34% at 50% 50%, color-mix(in srgb, ${background} 46%, transparent) 0%, color-mix(in srgb, ${background} 34%, transparent) 58%, transparent 100%)`, pointerEvents: "none", opacity: copyIn}} />

      <div style={{position: "absolute", left: "50%", top: "50%", width: portrait ? "86%" : "60%", opacity: copyIn, textAlign: "center", transform: `translate(-50%, calc(-50% + ${(1 - copyIn) * 28}px))`}}>
        <FitText targetPx={type.title} minPx={portrait ? 38 : 34} maxHeightPx={H * .27} fitKey={`rocket-title:${heading}:${portrait}`} exact={type.titleIsUserSet} style={{color: text, fontFamily: font, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1.02, textShadow: `0 4px 38px ${background}, 0 0 46px ${accent}`}}>{heading}</FitText>
        <div style={{width: 76 * bodyIn, height: 2, margin: "26px auto 0", borderRadius: 2, background: accent, boxShadow: `0 0 14px ${accent}, 0 0 34px color-mix(in srgb, ${accent} 40%, transparent)`}} />
        {body ? <FitText targetPx={type.body} minPx={portrait ? 24 : 21} maxHeightPx={H * .26} fitKey={`rocket-body:${body}:${portrait}`} exact={type.bodyIsUserSet} style={{color: text, textShadow: `0 2px 22px ${background}`, fontFamily: font, lineHeight: 1.45, margin: "24px auto 0", maxWidth: portrait ? "100%" : 760, opacity: bodyIn * .88, transform: `translateY(${(1 - bodyIn) * 14}px)`}}>{body}</FitText> : null}
      </div>
    </AbsoluteFill>
  );
};
