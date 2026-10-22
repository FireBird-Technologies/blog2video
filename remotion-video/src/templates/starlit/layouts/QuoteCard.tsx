import {StarlitPhoto} from "../components/StarlitPhoto";
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { FitText } from "../components/FitText";
import { SceneLayoutProps } from "../types";
import { getStarlitFontFamily, getStarlitTypography } from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

export const QuoteCard: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const {
    title,
    narration,
    imageUrl,
    videoUrl,
    imageObjectPosition,
    imageZoom,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 92 : 76),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 52 : 40),
  }, p);
  const font = getStarlitFontFamily(props);

  const quote = (props as any).quote ?? title ?? "";
  const attribution = (props as any).attribution ?? narration ?? "";
  const seed = (props as any).seed ?? 42;

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const dur = sceneDurationInFrames ?? 150;

  // Card entrance: opacity 0→1 + scale(0.94)→scale(1) over frames 0–28
  const cardOpacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardScale = interpolate(frame, [0, 28], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card exit: opacity 1→0 over last 20 frames
  const exitOpacity = interpolate(frame, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const combinedOpacity = Math.min(cardOpacity, exitOpacity);

  // Quote mark: scale 0.5→1 over frames 5–25
  const quoteMarkScale = interpolate(frame, [5, 25], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Word-by-word reveal starting at frame 20. Long quotes compress the
  // stagger so every word appears before the attribution and exit.
  const words: string[] = String(quote).split(" ");
  const wordStep = Math.min(3, Math.max(.35, (dur - 68) / Math.max(1, words.length)));
  const lastWordFrame = 20 + Math.max(0, words.length - 1) * wordStep;

  // Closing quote settles into the lower-right as the final words appear.
  const closingQuoteOpacity = interpolate(frame, [lastWordFrame - 4, lastWordFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const closingQuoteScale = interpolate(frame, [lastWordFrame - 4, lastWordFrame + 12], [0.55, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Attribution fades in after last word + 10 frames
  const attributionStartFrame = lastWordFrame + 10;
  const attributionOpacity = interpolate(
    frame,
    [attributionStartFrame, attributionStartFrame + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Typography sizes
  const titlePx = type.title;
  const descPx = type.body;

  // Card dimensions
  const hasPhoto = Boolean(imageUrl || videoUrl);
  // Half-card portrait: the photo fills one half of the glass card as a clean full-bleed panel with a diagonal
  // edge (left half in landscape, top band in portrait); the card's border and glow wrap both halves as one shape.
  const panelFrac = .42;
  const panelH = p ? 400 : 0;
  const colIn = interpolate(frame, [6, 38], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const quoteShift = hasPhoto && !p ? 1320 * panelFrac * .5 : 0;
  const cardWidth = hasPhoto ? (p ? 900 : 1320) : p ? 860 : 1080;
  const cardPaddingH = p ? 56 : 80;
  const cardPaddingV = p ? 56 : 72;
  const photoBottomPad = hasPhoto ? 36 : 0;

  const accent = accentColor ?? "#217cff";
  const bg = bgColor ?? "#000000";
  const text = textColor ?? "#ffffff";

  if (!String(quote).trim()) return <AbsoluteFill style={{ background: bg }} />; // no quote supplied: render empty

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: font }}>
      {/* Sky Canvas */}
      <SpaceBackdrop seed={seed} density={180} accentColor={accent} backgroundColor={bg} textColor={text} />

      {/* Centred card */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: combinedOpacity,
            transform: `scale(${cardScale})`,
            width: cardWidth,
            maxHeight: height * .88,
            boxSizing: "border-box",
            background: `linear-gradient(145deg, ${withOpacity(accent, .09)} 0%, ${withOpacity(thBg,.94)} 34%, ${withOpacity(thBg,.98)} 100%)`,
            border: `1.5px solid ${withOpacity(accent, .85)}`,
            borderRadius: 28,
            padding: hasPhoto ? (p ? `${panelH + 28}px ${cardPaddingH}px ${cardPaddingV + photoBottomPad}px` : `${cardPaddingV}px ${cardPaddingH}px ${cardPaddingV + photoBottomPad}px ${cardWidth * panelFrac + 48}px`) : `${cardPaddingV}px ${cardPaddingH}px`,
            position: "relative",
            boxShadow: `0 0 0 1px ${withOpacity(accent, .26)} inset, 0 0 18px ${withOpacity(accent, .56)}, 0 0 48px ${withOpacity(accent, .32)}, 0 0 96px ${withOpacity(accent, .16)}, 0 20px 70px ${withOpacity(thBg,.72)}`,
            overflow: "hidden",
          }}
        >
          {hasPhoto ? <>
            <div style={{position: "absolute", left: 0, top: 0, ...(p ? {right: 0, height: panelH} : {bottom: 0, width: `${panelFrac * 100}%`}), opacity: colIn, clipPath: p ? "polygon(0 0, 100% 0, 100% 84%, 0 100%)" : "polygon(0 0, 100% 0, 86% 100%, 0 100%)", background: thBg}}>
              <StarlitPhoto scene={props} />
              <div style={{position: "absolute", inset: 0, background: p ? `linear-gradient(180deg, transparent 55%, ${withOpacity(accent, .19)} 100%)` : `linear-gradient(90deg, transparent 55%, ${withOpacity(accent, .19)} 100%)`}} />
            </div>
            <svg style={{position: "absolute", left: 0, top: 0, ...(p ? {width: "100%", height: panelH} : {height: "100%", width: `${panelFrac * 100}%`}), pointerEvents: "none", opacity: colIn, overflow: "visible"}} viewBox="0 0 100 100" preserveAspectRatio="none">
              {p
                ? <line x1="0" y1="100" x2="100" y2="84" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" opacity=".9" />
                : <line x1="100" y1="0" x2="86" y2="100" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" opacity=".9" />}
            </svg>
          </> : null}
          {/* Card top edge glow line */}
          <div
            style={{
              position: "absolute",
              top: -1,
              left: "10%",
              width: "80%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${accent} 20%, ${thPale} 50%, ${accent} 80%, transparent)`,
              boxShadow: `0 0 12px ${accent}, 0 0 32px ${withOpacity(accent, .72)}, 0 0 64px ${withOpacity(accent, .44)}`,
            }}
          />

          {/* SVG layer for quotation mark */}
          <svg
            style={{
              position: "absolute",
              top: hasPhoto && p ? panelH : 0,
              left: 0,
              width: "100%",
              height: 200,
              overflow: "visible",
              pointerEvents: "none",
            }}
            viewBox={`0 0 ${cardWidth} 200`}
            preserveAspectRatio="none"
          >
            <text
              x={80 + quoteShift * 2}
              y="160"
              fontFamily={font}
              fontSize={type.titleRelative(160)}
              fill={withOpacity(accent, .35)}
              fontWeight="700"
              style={{
                transformOrigin: `${80 + quoteShift * 2}px 160px`,
                transform: `scale(${quoteMarkScale})`,
              }}
            >
              &ldquo;
            </text>
          </svg>

          {/* Closing quotation mark */}
          <div
            style={{
              position: "absolute",
              right: p ? 42 : 62,
              bottom: p ? 22 : 28,
              color: withOpacity(accent, .35),
              fontFamily: font,
              fontSize: type.titleRelative(p ? 132 : 148),
              fontWeight: 700,
              lineHeight: 0.5,
              opacity: closingQuoteOpacity,
              transform: `scale(${closingQuoteScale})`,
              transformOrigin: "right bottom",
              pointerEvents: "none",
            }}
          >
            &rdquo;
          </div>

          {/* Quote text — word by word */}
          <FitText
            targetPx={titlePx}
            minPx={p ? 30 : 27}
            maxHeightPx={height * (p ? (hasPhoto ? .34 : .48) : .50)}
            fitKey={`quote:${String(quote)}:${p}:${hasPhoto}`}
            exact={type.titleIsUserSet}
            style={{
              marginTop: hasPhoto && !p ? 84 : 120,
              textAlign: "center",
              fontFamily: font,
              fontWeight: 500,
              lineHeight: 1.4,
              color: text,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0 0.28em",
            }}
          >
            {words.map((word, i) => {
              const wordStart = 20 + i * wordStep;
              const revealDuration = Math.min(10, Math.max(4, wordStep * 3));
              const wordOpacity = interpolate(frame, [wordStart, wordStart + revealDuration], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const wordY = interpolate(frame, [wordStart, wordStart + revealDuration], [8, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={i}
                  style={{
                    opacity: wordOpacity,
                    transform: `translateY(${wordY}px)`,
                    display: "inline-block",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </FitText>

          {/* Attribution */}
          {attribution ? (
            <FitText
              targetPx={descPx}
              minPx={p ? 20 : 18}
              maxHeightPx={height * .10}
              fitKey={`quote-attribution:${String(attribution)}:${p}:${hasPhoto}`}
              exact={type.bodyIsUserSet}
              style={{
                marginTop: 40,
                paddingRight: hasPhoto ? (p ? 60 : 110) : 0,
                textAlign: "center",
                fontFamily: font,
                fontWeight: 400,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: withOpacity(thTxt,0.56),
                opacity: attributionOpacity,
              }}
            >
              — {attribution}
            </FitText>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
