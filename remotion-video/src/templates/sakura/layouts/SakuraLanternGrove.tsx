import React from "react";
import { useVideoConfig, interpolate, spring, Img } from "remotion";
import { SakuraClip } from "../components/SakuraClip";
import { SceneLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  sakuraRand,
  SoftPetal,
  PaperLantern,
  BrushUnderline,
  KomorebiLight,
  hexToRgba,
  readableTextColor,
} from "../sakuraStyle";

export const SakuraLanternGrove: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSizeIsUserSet,
    fontFamily,
  } = props;
  const hasVisual = !!(imageUrl || videoUrl);

  const p = aspectRatio === "portrait";
  const frame = useSakuraFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const eyebrow = (props as any).eyebrow ?? "";
  const headline = (props as any).headline ?? title ?? "";
  const bodyRaw = (props as any).body ?? narration ?? "";

  const crimson = accentColor || SAKURA.crimson;
  // Dark night ground — text must read as light-on-dark, illuminated by the
  // lantern, so fall back to washi rather than the user's (likely dark) ink.
  const ink = readableTextColor(textColor, "dark");
  const glow = "#FFD6E7";
  const lanternPink = "#F4AFC5";

  const paragraphs = React.useMemo(() => {
    const byBlank = String(bodyRaw).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    if (byBlank.length > 1) return byBlank;
    const byLine = String(bodyRaw).split(/\n/).map((s) => s.trim()).filter(Boolean);
    return byLine.length > 0 ? byLine : [String(bodyRaw)];
  }, [bodyRaw]);

  const titleTargetPx = titleFontSize ?? (p ? 84 : 87);
  const bodyTargetPx = descriptionFontSize ?? (p ? 42 : 39);
  const headlineRef = React.useRef<HTMLHeadingElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    headlineRef,
    titleTargetPx,
    Math.max(26, Math.round(titleTargetPx * 0.55)),
    [headline, titleTargetPx, titleFontSizeIsUserSet, p, height, hasVisual],
    Math.round(height * (p ? 0.2 : 0.28)),
  );
  const { px: bodyPx } = useFitText(
    bodyRef,
    bodyTargetPx,
    Math.max(18, Math.round(bodyTargetPx * 0.58)),
    [paragraphs, bodyTargetPx, descriptionFontSizeIsUserSet, titlePx, p, height, hasVisual],
    Math.round(height * (p ? 0.3 : 0.42)),
  );
  const eyebrowPx = Math.max(14, Math.round(bodyPx * 0.71));

  const eyebrowSpring = spring({ frame, fps, config: { damping: 9, stiffness: 130 }, from: 0, to: 1 });
  const headlineOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineRise = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const underlineStart = 22;
  const litProgress = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Lantern position: asymmetric, hung above/beside the text — text sits in
  // the pool of its light, mirroring the reference photo's lantern-in-frame
  // composition rather than a centered hero object.
  const lanternCx = p ? width * 0.24 : width * 0.16;
  const lanternCy = p ? height * 0.2 : height * 0.24;
  const lanternW = p ? 110 : 130;
  const lanternH = p ? 150 : 176;

  // Dense overhanging blossom canopy across the top edge (and right edge in
  // landscape), built from clustered SoftPetals at deterministic positions —
  // reads as branches heavy with bloom draping into frame, like the photo's
  // canopy over the water. Static composition; only a slow collective sway.
  const canopyClusters = React.useMemo(() => {
    const n = p ? 26 : 34;
    return Array.from({ length: n }, (_, i) => {
      const s = 210 + i * 11.3;
      const edge = sakuraRand(s, 1); // which edge this cluster hangs from
      const alongEdge = sakuraRand(s, 2);
      const fromTop = edge < (p ? 0.7 : 0.55);
      const x = fromTop ? alongEdge * width : width * (1 - sakuraRand(s, 3) * 0.22);
      const y = fromTop ? height * sakuraRand(s, 3) * 0.16 : alongEdge * height * 0.55;
      return {
        cx: x,
        cy: y,
        r: 16 + sakuraRand(s, 4) * 20,
        rot: sakuraRand(s, 5) * 360,
        depth: sakuraRand(s, 6),
        phase: sakuraRand(s, 7) * Math.PI * 2,
      };
    });
  }, [p, width, height]);
  const canopySway = Math.sin(frame * 0.012) * 3;

  const featherMask =
    "radial-gradient(120% 120% at 50% 45%, #000 55%, rgba(0,0,0,0.55) 78%, transparent 100%)";

  // Landscape: a feathered vertical panel on the right, behind the copy.
  // Portrait: there's no spare column for a side panel without colliding
  // with the text block, so the photo instead sits as a full-bleed backdrop
  // LAYER behind everything (like sakura_intro's hero image), heavily washed
  // dark so it reads as night-lit scenery rather than a competing block.
  const portraitWash = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imagePanel = hasVisual ? (
    p ? (
      <div style={{ position: "absolute", inset: 0, opacity: portraitWash }}>
        {(() => {
          const visualStyle: React.CSSProperties = {
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: imageObjectPosition ?? "50% 50%",
            transform: `scale(${Math.max(imageZoom ?? 1, 1)})`,
            transformOrigin: imageObjectPosition ?? "50% 50%",
          };
          return videoUrl ? (
            <SakuraClip
              src={videoUrl}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              muted={videoMuted ?? true}
              volume={videoVolume ?? 0.35}
              durationInFrames={videoDurationInFrames}
              startInFrames={videoStartInFrames}
              style={visualStyle}
            />
          ) : (
            <Img src={imageUrl!} style={visualStyle} />
          );
        })()}
        {/* Heavy dark wash so the copy stays legible over the full photo,
            not just a masked corner. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(180deg, ${hexToRgba(SAKURA.void, 0.55)} 0%, ${hexToRgba(SAKURA.void, 0.72)} 45%, ${hexToRgba(SAKURA.void, 0.88)} 100%)`,
          }}
        />
      </div>
    ) : (
      <div
        style={{
          position: "absolute",
          right: 0,
          top: height * 0.14,
          width: width * 0.4,
          height: height * 0.72,
          opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            maskImage: featherMask,
            WebkitMaskImage: featherMask,
          }}
        >
          {(() => {
            const visualStyle: React.CSSProperties = {
              width: "100%",
              height: "100%",
              objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
              objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
              transform: `scale(${imageZoom ?? 1})`,
              transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
            };
            return videoUrl ? (
              <SakuraClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={visualStyle}
              />
            ) : (
              <Img src={imageUrl!} style={visualStyle} />
            );
          })()}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(135deg, ${hexToRgba(SAKURA.void, 0.35)}, transparent 45%)`,
            mixBlendMode: "multiply",
            maskImage: featherMask,
            WebkitMaskImage: featherMask,
          }}
        />
      </div>
    )
  ) : null;

  return (
    <SakuraScene
      backdrop="plum_radial"
      entranceLayout="sakura_text_narration__v2"
      bgColor={bgColor}
      accentColor={crimson}
      side="left"
      dur={dur}
      petals={p ? 14 : 20}
      petalIntensity={0.7}
      petalSeed={48}
      petalMode="settle"
      petalsBehind
      ambient="komorebi"
      chrome={
        <>
          {/* Portrait full-bleed photo backdrop (if any) paints first, behind
              the canopy and lantern, so those chrome elements stay visible on
              top of it instead of being covered by an opaque image layer. */}
          {p ? imagePanel : null}
          {/* Overhanging blossom canopy — dense clustered petals along the
              top/side edges, gently swaying, lit warm where near the lantern. */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <g transform={`translate(0, ${canopySway})`}>
              {canopyClusters.map((c, i) => {
                const distToLantern = Math.hypot(c.cx - lanternCx, c.cy - lanternCy);
                const warmth = Math.max(0, 1 - distToLantern / (width * 0.5));
                const col = warmth > 0.35 ? glow : SAKURA.blush;
                return (
                  <SoftPetal
                    key={i}
                    cx={c.cx}
                    cy={c.cy}
                    r={c.r}
                    rotation={c.rot + Math.sin(frame * 0.02 + c.phase) * 4}
                    color={col}
                    centerColor={SAKURA.deepBlush}
                    opacity={0.55 + c.depth * 0.35}
                  />
                );
              })}
            </g>
          </svg>
          <PaperLantern
            cx={lanternCx}
            cy={lanternCy}
            width={lanternW}
            height={lanternH}
            litProgress={litProgress}
            glowColor={glow}
            color={lanternPink}
            ribColor="#FFE5EE"
            glowStrength={1.28}
            haloScale={2.35}
          />
        </>
      }
    >
      {/* Landscape side panel stays in children (paints above chrome, below
          the entrance-animated text — matches other layouts' image-panel
          layering). Portrait's full-bleed version is already in chrome. */}
      {p ? null : imagePanel}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: p ? "0 90px" : hasVisual ? "0 110px 0 130px" : "0 160px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: p ? "100%" : hasVisual ? "56%" : "62%" }}>
          {eyebrow ? (
            <div
              style={{
                fontFamily: fontFamily ?? SAKURA_BODY_FONT,
                fontSize: eyebrowPx,
                color: glow,
                letterSpacing: "0.5em",
                textTransform: "uppercase",
                textIndent: "0.5em",
                marginBottom: 22,
                opacity: Math.min(1, eyebrowSpring * 1.4),
                transform: `scale(${eyebrowSpring})`,
                transformOrigin: "0% 50%",
                textShadow: `0 0 18px ${hexToRgba(glow, 0.5)}`,
              }}
            >
              {eyebrow}
            </div>
          ) : null}

          <h1
            ref={headlineRef}
            style={{
              fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
              fontWeight: 700,
              fontSize: titlePx,
              color: ink,
              lineHeight: 1.2,
              margin: "0 0 24px 0",
              opacity: headlineOpacity,
              transform: `translateY(${(1 - headlineRise) * 22}px)`,
              textShadow: `0 0 30px ${hexToRgba(glow, 0.25)}, 0 2px 12px ${hexToRgba(SAKURA.void, 0.6)}`,
            }}
          >
            {headline}
          </h1>

          <div style={{ marginBottom: 28 }}>
            <BrushUnderline width={p ? 200 : 240} color={crimson} startFrame={underlineStart} durationFrames={14} />
          </div>

          <div ref={bodyRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {paragraphs.map((para, i) => {
              const start = 28 + i * 10;
              const reveal = interpolate(frame, [start, start + 16], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: (t) => 1 - Math.pow(1 - t, 2),
              });
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: fontFamily ?? SAKURA_BODY_FONT,
                    fontSize: bodyPx,
                    color: hexToRgba(ink, 0.82),
                    lineHeight: 1.75,
                    letterSpacing: "0.01em",
                    margin: 0,
                    opacity: reveal,
                    transform: `translateY(${(1 - reveal) * 14}px)`,
                  }}
                >
                  {para}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </SakuraScene>
  );
};
