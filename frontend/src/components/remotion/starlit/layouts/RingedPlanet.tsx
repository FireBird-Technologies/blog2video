import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { StarlitPhoto } from "../components/StarlitPhoto";
import { FitText } from "../components/FitText";
import { SceneLayoutProps } from "../types";
import { getStarlitFontFamily, getStarlitTypography } from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

const BLUE = "#217cff";

/**
 * Ring Breach: a planet interrupts an enormous orbital ring while an energized
 * point races through the opening. It is deliberately an editorial scene,
 * not a floating dashboard or a decorative card.
 */
export const RingedPlanet: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const portrait = props.aspectRatio === "portrait";
  const p = portrait;
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 92 : 76),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 52 : 40),
  }, p);
  const font = getStarlitFontFamily(props);
  const accent = props.accentColor || BLUE;
  const duration = props.sceneDurationInFrames ?? 150;
  const heading = props.heading ?? props.title;
  const body = props.body ?? props.narration;
  const hasPhoto = Boolean(props.imageUrl || props.videoUrl);

  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [duration - 16, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const horizonIn = interpolate(frame, [7, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const copyIn = interpolate(frame, [28, 51], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleIn = interpolate(frame, [34, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bodyIn = interpolate(frame, [47, 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sidePadding = portrait ? 68 : 108;
  const planetX = portrait ? (hasPhoto ? W * .7 : W * .5) : (hasPhoto ? W * .6 : W * .58);
  const planetY = portrait ? (hasPhoto ? H * .49 : H * .69) : H * .56; // portrait + photo: centred on the plate's top edge so the upper half peeks out above the image
  // In portrait the outer ring is almost five planet radii wide. Size from
  // that full silhouette so both the sphere and its rings stay on-canvas.
  const planetR = portrait ? W * (hasPhoto ? .25 : .19) : H * (hasPhoto ? .38 : .4);
  const time = frame / fps;
  // The system drifts almost imperceptibly, but its viewing angle stays fixed.
  // Rotation is expressed by surface detail moving across the planet and by
  // material circulating within the rings—not by wobbling the whole graphic.
  const floatX = Math.sin(time * .34) * (portrait ? 2.5 : 4);
  const floatY = Math.cos(time * .28) * (portrait ? 2 : 3);
  const ringTilt = -11;
  const ringOpen = .92;
  const surfacePhase = (time * planetR * .055) % (planetR * 1.16);
  const ringPhase = time * 10;
  const ringGlow = .075 + (.5 + Math.sin(time * .9)) * .035;
  const rimGlow = .13 + (.5 + Math.cos(time * .72)) * .07;
  const photoIn = interpolate(frame, [10, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const photoScale = interpolate(photoIn, [0, 1], [.955, 1]);
  // The photograph fills the entire right edge (lower half in portrait) and is drawn above the
  // planet and its rings, so the planet reads as sitting behind the image.
  const plateLeft = portrait ? 0 : W * .47;
  const plateTop = portrait ? H * .48 : 0;
  const plateWidth = portrait ? W : W * .53;
  const plateHeight = portrait ? H * .52 : H;
  const ringBands = [
    { rx: 2.46, ry: .365, width: 1.1, backOpacity: .72, frontOpacity: .32, color: thPale },
    { rx: 2.39, ry: .352, width: 4.2, backOpacity: .17, frontOpacity: .10, color: accent },
    { rx: 2.29, ry: .336, width: 1.25, backOpacity: .42, frontOpacity: .22, color: thMid },
    { rx: 2.16, ry: .316, width: 5.4, backOpacity: .12, frontOpacity: .07, color: accent },
    { rx: 2.02, ry: .294, width: .9, backOpacity: .30, frontOpacity: .15, color: thTxt },
  ];

  return (
    <AbsoluteFill style={{ background: thBg, overflow: "hidden", opacity: enter * exit, fontFamily: font }}>
      <SpaceBackdrop seed={(props.seed ?? 42) + 29} density={70} brightness={.52}  accentColor={props.accentColor}  backgroundColor={props.bgColor}  textColor={props.textColor} />
      <svg width={W} height={H} style={{position: "absolute", inset: 0, opacity: horizonIn}}>
        <defs>
          <linearGradient id="ringed-atmosphere-rim" x1="5%" y1="0%" x2="92%" y2="100%">
            <stop offset="0%" stopColor={mixTheme(thAcc, thTxt, .45)} stopOpacity=".94" />
            <stop offset="28%" stopColor={accent} stopOpacity=".82" />
            <stop offset="62%" stopColor={accent} stopOpacity=".18" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="ringed-planet-surface" cx="27%" cy="24%" r="82%">
            <stop offset="0%" stopColor={accent} stopOpacity=".19" />
            <stop offset="44%" stopColor={mixTheme(thBg,thAcc,.1)} stopOpacity=".13" />
            <stop offset="78%" stopColor={mixTheme(thBg,thAcc,.1)} stopOpacity=".08" />
            <stop offset="100%" stopColor={thBg} stopOpacity={hasPhoto ? .46 : 1} />
          </radialGradient>
          <clipPath id="ringed-planet-clip"><circle r={planetR - 2} /></clipPath>
          <pattern id="ringed-planet-bands" width={planetR * 1.16} height={planetR * 2.2} patternUnits="userSpaceOnUse" patternTransform={`translate(${surfacePhase} 0)`}>
            <rect x={planetR * .06} y={planetR * .17} width={planetR * .58} height={planetR * .07} rx={planetR * .035} fill={accent} opacity=".07" />
            <rect x={planetR * .68} y={planetR * .46} width={planetR * .32} height={planetR * .045} rx={planetR * .023} fill={thPale} opacity=".045" />
            <rect x={planetR * .18} y={planetR * .76} width={planetR * .76} height={planetR * .09} rx={planetR * .045} fill={accent} opacity=".055" />
            <rect x={planetR * .52} y={planetR * 1.13} width={planetR * .46} height={planetR * .055} rx={planetR * .028} fill={thPale} opacity=".035" />
            <rect x={planetR * .04} y={planetR * 1.48} width={planetR * .68} height={planetR * .075} rx={planetR * .038} fill={accent} opacity=".06" />
            <rect x={planetR * .73} y={planetR * 1.82} width={planetR * .28} height={planetR * .04} rx={planetR * .02} fill={thPale} opacity=".04" />
          </pattern>
          <filter id="ringed-soft-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <g transform={`translate(${planetX + floatX} ${planetY + floatY}) rotate(${ringTilt})`}>
          {/* Soft backlight gathers around the ring plane without turning it
              into a neon UI stroke. */}
          <ellipse rx={planetR * 2.48} ry={planetR * .37 * ringOpen} fill="none" stroke={accent} strokeWidth={planetR * .025} strokeOpacity={ringGlow} filter="url(#ringed-soft-glow)" />
          {ringBands.map((band) => {
            const rx = planetR * band.rx;
            const ry = planetR * band.ry * ringOpen;
            const d = `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0`;
            return <path key={`back-${band.rx}`} d={d} fill="none" stroke={band.color} strokeWidth={band.width} strokeOpacity={band.backOpacity} strokeDasharray={band.width > 2 ? "34 12" : undefined} strokeDashoffset={band.width > 2 ? -ringPhase * band.rx : undefined} />;
          })}

        </g>

        <g transform={`translate(${planetX + floatX} ${planetY + floatY}) rotate(${ringTilt})`}>
          {/* Keep the sphere fully opaque so it masks the far half of the rings. With a photo the
              plate is painted after this group, so the planet sits behind the image. */}
          <circle r={planetR} fill={thBg} />

          {/* Faint moving surface detail makes the sphere's axial rotation
              readable without adding another object to the composition. */}
          <circle r={planetR} fill="url(#ringed-planet-surface)" />
          <rect x={-planetR} y={-planetR} width={planetR * 2} height={planetR * 2} fill="url(#ringed-planet-bands)" clipPath="url(#ringed-planet-clip)" />
          <circle r={planetR + 1} fill="none" stroke="url(#ringed-atmosphere-rim)" strokeWidth="2.2" />
          <circle r={planetR + 4} fill="none" stroke="url(#ringed-atmosphere-rim)" strokeWidth={planetR * .022} strokeOpacity={rimGlow} filter="url(#ringed-soft-glow)" />

          {/* Dimmer near-side bands pass in front of the disk. The brightness
              asymmetry is what makes the ring read as backlit material. */}
          {ringBands.map((band) => {
            const rx = planetR * band.rx;
            const ry = planetR * band.ry * ringOpen;
            const d = `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${-rx} 0`;
            return <path key={`front-${band.rx}`} d={d} fill="none" stroke={band.color} strokeWidth={band.width} strokeOpacity={Math.min(1, band.frontOpacity * (hasPhoto ? 1.8 : 1))} strokeDasharray={band.width > 2 ? "34 12" : undefined} strokeDashoffset={band.width > 2 ? ringPhase * band.rx : undefined} />;
          })}
        </g>

        {/* The photograph is the top layer: the planet and every ring sit behind it, and only the part
            that extends past the plate's left edge shows. */}
        {hasPhoto ? <foreignObject x={plateLeft} y={plateTop} width={plateWidth} height={plateHeight} style={{overflow: "visible", opacity: photoIn}}>
          <div style={{
            width: "100%", height: "100%", position: "relative", overflow: "hidden",
            background: thBg,
            transform: `translateY(${(1 - photoIn) * 24}px) scale(${photoScale})`,
            transformOrigin: portrait ? "70% 100%" : "100% 50%",
          }}>
            <StarlitPhoto scene={props} />
            <div style={{position: "absolute", inset: 0, background: portrait
              ? `linear-gradient(180deg, ${withOpacity(thBg,.72)} 0%, ${withOpacity(thBg,.16)} 20%, transparent 48%, ${withOpacity(thBg,.18)} 100%)`
              : `linear-gradient(90deg, ${withOpacity(thBg,.88)} 0%, ${withOpacity(thBg,.34)} 24%, transparent 52%)`}} />
            {props.imageCaption ? <div style={{position: "absolute", left: portrait ? 24 : "auto", right: 28, bottom: 22, color: withOpacity(thTxt,.8), fontSize: portrait ? 25 : 19, lineHeight: 1.25, letterSpacing: ".01em", textAlign: portrait ? "left" : "right", textShadow: `0 2px 12px ${withOpacity(thBg,.9)}`}}>{props.imageCaption}</div> : null}
          </div>
        </foreignObject> : null}
      </svg>

      <div style={{
        position: "absolute", left: 0, top: 0, width: portrait ? "100%" : "43%",
        height: portrait ? "56%" : "100%", padding: portrait ? `${H * .18}px ${sidePadding}px 0` : `0 ${sidePadding}px`,
        paddingTop: portrait ? H * .18 : H * .13,
        boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "flex-start",
        opacity: copyIn, transform: `translateY(${interpolate(copyIn, [0, 1], [26, 0])}px)`,
      }}>
        <div style={{ width: 68 * titleIn, height: 1, background: accent, boxShadow: `0 0 7px ${accent}, 0 0 24px ${withOpacity(accent, .36)}`, marginBottom: 27 }} />
        <FitText targetPx={type.title} minPx={portrait ? 36 : 32} maxHeightPx={H * (portrait ? .15 : .25)} fitKey={`ring-title:${heading}:${portrait}`} exact={type.titleIsUserSet} style={{ color: props.textColor ?? "#fff", fontWeight: 600, letterSpacing: "-.045em", lineHeight: .99, maxWidth: portrait ? "100%" : 720, opacity: titleIn, transform: `translateY(${(1 - titleIn) * 18}px)` }}>
          {heading}
        </FitText>
        {body ? <FitText targetPx={type.body} minPx={portrait ? 24 : 21} maxHeightPx={H * (portrait ? .17 : .28)} fitKey={`ring-body:${body}:${portrait}`} exact={type.bodyIsUserSet} style={{ color: withOpacity(thTxt,.70), fontFamily: font, lineHeight: 1.48, marginTop: 31, maxWidth: portrait ? "100%" : 585, opacity: bodyIn, transform: `translateY(${(1 - bodyIn) * 12}px)` }}>
          {body}
        </FitText> : null}
      </div>
    </AbsoluteFill>
  );
};
