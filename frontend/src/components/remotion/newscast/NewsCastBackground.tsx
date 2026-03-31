import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from "three";

const DEFAULT_BG = "#060614";

const GLOBE_TEXTURE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 512">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#E8F0FF" stop-opacity="0.72"/>
      <stop offset="28%" stop-color="#3B82F6" stop-opacity="0.52"/>
      <stop offset="55%" stop-color="#1E5FD4" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#060614" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="512" fill="url(#bg)"/>

  <!-- “Continent-ish” blobs (stylized, purely for look) -->
  <g fill="rgba(220,235,255,0.58)">
    <path d="M360 165 C415 120, 500 120, 540 170 C585 228, 520 262, 470 250 C430 240, 385 230, 360 210 Z"/>
    <path d="M570 275 C615 250, 690 255, 710 300 C733 353, 665 388, 615 365 C575 347, 540 320, 570 275 Z"/>
    <path d="M250 285 C285 250, 350 250, 375 295 C400 345, 350 385, 305 360 C270 342, 230 330, 250 285 Z"/>
  </g>

  <!-- Faint graticule -->
  <g fill="none" stroke="rgba(180,210,255,0.45)" stroke-width="2">
    <path d="M60 256 H964"/>
    <path d="M512 40 V472"/>
    <ellipse cx="512" cy="256" rx="460" ry="160" opacity="0.68"/>
    <ellipse cx="512" cy="256" rx="460" ry="95" opacity="0.48"/>
    <ellipse cx="512" cy="256" rx="230" ry="255" opacity="0.56"/>
    <ellipse cx="512" cy="256" rx="320" ry="255" opacity="0.32"/>
  </g>
</svg>
`;

const GLOBE_TEXTURE_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(GLOBE_TEXTURE_SVG)}`;

// Height-map for bump shading (higher contrast than the base texture).
const GLOBE_BUMP_TEXTURE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 512">
  <defs>
    <linearGradient id="term" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0a1630" stop-opacity="0.0"/>
      <stop offset="55%" stop-color="#0a1630" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#0a1630" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="soft">
      <feGaussianBlur stdDeviation="1.4" />
    </filter>
  </defs>

  <rect width="1024" height="512" fill="#060614" />
  <rect width="1024" height="512" fill="url(#term)" opacity="0.9"/>

  <g filter="url(#soft)" opacity="0.98">
    <!-- continents: strong highlights in the bump -->
    <path d="M360 165 C415 120, 500 120, 540 170 C585 228, 520 262, 470 250 C430 240, 385 230, 360 210 Z" fill="#E8F2FF" opacity="0.95"/>
    <path d="M570 275 C615 250, 690 255, 710 300 C733 353, 665 388, 615 365 C575 347, 540 320, 570 275 Z" fill="#E8F2FF" opacity="0.92"/>
    <path d="M250 285 C285 250, 350 250, 375 295 C400 345, 350 385, 305 360 C270 342, 230 330, 250 285 Z" fill="#E8F2FF" opacity="0.90"/>
  </g>

  <g fill="none" stroke="#ffffff" stroke-width="2" opacity="0.34">
    <path d="M60 256 H964"/>
    <path d="M512 40 V472"/>
    <ellipse cx="512" cy="256" rx="460" ry="160" opacity="0.55"/>
    <ellipse cx="512" cy="256" rx="460" ry="95" opacity="0.38"/>
    <ellipse cx="512" cy="256" rx="230" ry="255" opacity="0.42"/>
    <ellipse cx="512" cy="256" rx="320" ry="255" opacity="0.22"/>
  </g>
</svg>
`;

const GLOBE_BUMP_TEXTURE_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(GLOBE_BUMP_TEXTURE_SVG)}`;

/** NASA blue marble + topology bump — official `three-globe` example assets (used by react-globe.gl demos). */
const HERO_GLOBE_IMAGE_URL =
  "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg";
const HERO_BUMP_IMAGE_URL =
  "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-topology.png";

/** Camera target: Europe / North Africa — mostly land at scene start (avoids Pacific-heavy framing). Same every scene (frame 0). */
const GLOBE_POV = { lat: 28, lng: 18 } as const;

/** Degrees per second — applied via `pointOfView` longitude orbit (the main globe ignores `objectRotation`). */
const ROT_SPEED_HERO = 64;
const ROT_SPEED_DEFAULT = 46;

/** Inline SVG fallback: extra Y so stylized “continent” art faces the viewer at frame 0. */
const SVG_LAND_BIAS_DEG = 38;

export const NewsCastBackground: React.FC<{
  globeOpacity?: number;
  globePosition?: "center" | "right" | "left";
  /** `hero`: real Earth textures + graticules + Phong shading (NEWSCAST). `default`: lightweight inline SVG. */
  variant?: "hero" | "default";
  /**
   * When false, the root fill is transparent so a sibling image plate (e.g. `NewsCastLayoutImageBackground`) shows through.
   * Default true: opaque navy base `#060614`.
   */
  solidBackground?: boolean;
  /**
   * Composition timeline frame (e.g. `sequenceStartFrame + useCurrentFrame()`).
   * When set, rotation is continuous across all scenes; otherwise uses local `useCurrentFrame()`.
   */
  rotationFrame?: number;
  /** Extra globe translation (px) for entrance motion; applied to both WebGL + SVG fallback. */
  globeTranslateX?: number;
  /** Extra globe translation (px) for entrance motion; applied to both WebGL + SVG fallback. */
  globeTranslateY?: number;
}> = ({
  globeOpacity = 0.3,
  globePosition = "center",
  variant = "default",
  solidBackground = true,
  rotationFrame: rotationFrameProp,
  globeTranslateX = 0,
  globeTranslateY = 0,
}) => {
  const sequenceFrame = useCurrentFrame();
  const frame = rotationFrameProp ?? sequenceFrame;
  const { fps, width: videoW, height: videoH } = useVideoConfig();

  const isHero = variant === "hero";
  const globeImageUrl = isHero ? HERO_GLOBE_IMAGE_URL : GLOBE_TEXTURE_DATA_URL;
  const bumpImageUrl = isHero ? HERO_BUMP_IMAGE_URL : GLOBE_BUMP_TEXTURE_DATA_URL;

  const pos = globePosition ?? "center";
  const globeLeft = pos === "right" ? "68%" : pos === "left" ? "32%" : "50%";
  const globeTop = pos === "right" ? "52%" : pos === "left" ? "52%" : "50%";
  const globeSizePx = Math.min(videoW * (pos === "right" || pos === "left" ? 0.62 : 0.7), videoH * 0.85);

  // Orbit camera around the globe by advancing longitude (actual globe mesh does not use `objectRotation`).
  const rotSpeed = isHero ? ROT_SPEED_HERO : ROT_SPEED_DEFAULT;
  const spinDeg = (frame / fps) * rotSpeed;
  const rotX = isHero ? 12 + Math.sin(frame / fps) * 4 : 14 + Math.sin(frame / fps) * 5;
  const spinLat = GLOBE_POV.lat + (isHero ? Math.sin(frame / fps) * 3 : Math.sin(frame / fps) * 4);
  const spinLng = GLOBE_POV.lng + spinDeg;
  const spinLngWrapped = ((((spinLng + 180) % 360) + 360) % 360) - 180;
  /** SVG fallback: CSS rotateY in degrees (same spin as WebGL). */
  const rotYNorm = ((spinDeg % 360) + 360) % 360;

  const heroPhongMaterial = React.useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color(0xe8f2ff),
        specular: new Color(0x3a4f72),
        emissive: new Color(0x1a3a6a),
        emissiveIntensity: 0.06,
        shininess: 10,
        bumpScale: 0.22,
      }),
    [],
  );

  const canUseGlobe = React.useMemo(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      return !!gl;
    } catch {
      return false;
    }
  }, []);
  const globeRef = React.useRef<GlobeMethods | undefined>(undefined);
  const povRef = React.useRef({ lat: spinLat, lng: spinLngWrapped, alt: isHero ? 1.42 : 1.35 });
  povRef.current = { lat: spinLat, lng: spinLngWrapped, alt: isHero ? 1.42 : 1.35 };

  const onGlobeReady = React.useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    try {
      const ctrl = g.controls();
      ctrl.autoRotate = false;
      ctrl.enableRotate = false;
      ctrl.enableZoom = false;
      ctrl.enablePan = false;
    } catch {
      // ignore
    }
    try {
      const ambient = new AmbientLight(0x284878, isHero ? 1.05 : 0.98);
      const dir = new DirectionalLight(0x6ab0ff, isHero ? 1.15 : 1.05);
      dir.position.set(1.2, 1.0, 1.0);
      g.lights([ambient, dir]);
      const p = povRef.current;
      g.pointOfView({ lat: p.lat, lng: p.lng, altitude: p.alt }, 0);
    } catch {
      // ignore
    }
  }, [isHero]);

  useLayoutEffect(() => {
    if (!canUseGlobe || !globeRef.current) return;
    try {
      globeRef.current.pointOfView(
        { lat: spinLat, lng: spinLngWrapped, altitude: isHero ? 1.42 : 1.35 },
        0,
      );
    } catch {
      // ignore
    }
  }, [canUseGlobe, isHero, spinLat, spinLngWrapped]);

  return (
    <AbsoluteFill style={{ backgroundColor: solidBackground ? DEFAULT_BG : "transparent", overflow: "hidden" }}>
      {/* Starfield + fine grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)
          `,
          backgroundSize: 40,
          zIndex: 0,
          opacity: 0.9,
        }}
      />

      {/* Radial vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
          zIndex: 1,
        }}
      />

      {/* Globe watermark */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          pointerEvents: "none",
          zIndex: 2,
          opacity: globeOpacity,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: globeLeft,
            top: globeTop,
            transform: `translate(-50%,-50%) translate(${globeTranslateX}px, ${globeTranslateY}px)`,
            width: globeSizePx,
            height: globeSizePx,
            filter: "drop-shadow(0 0 22px rgba(0,0,0,0.45))",
            perspective: 900,
          }}
        >
          {canUseGlobe ? (
            <Globe
              ref={globeRef}
              width={globeSizePx}
              height={globeSizePx}
              globeImageUrl={globeImageUrl}
              bumpImageUrl={bumpImageUrl}
              globeMaterial={isHero ? heroPhongMaterial : undefined}
              backgroundColor="rgba(0,0,0,0)"
              backgroundImageUrl={null}
              showGlobe
              showGraticules={isHero}
              showAtmosphere={false}
              atmosphereColor={isHero ? "rgba(90,160,240,0.28)" : "rgba(55,130,255,0.32)"}
              atmosphereAltitude={isHero ? 0.18 : 0.2}
              enablePointerInteraction={false}
              onGlobeReady={onGlobeReady}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                transform: `rotateY(${rotYNorm + SVG_LAND_BIAS_DEG}deg) rotateX(${rotX}deg)`,
              }}
            >
              <svg className="globe-svg" viewBox="0 0 400 400" width="100%" height="100%">
                <defs>
                  <radialGradient id="globeFill" cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#E8F2FF" stopOpacity="0.36" />
                    <stop offset="38%" stopColor="#3B82F6" stopOpacity="0.24" />
                    <stop offset="72%" stopColor="#1E5FD4" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#060614" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="globeTerminator" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#060614" stopOpacity="0" />
                    <stop offset="55%" stopColor="#060614" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#060614" stopOpacity="0.28" />
                  </linearGradient>
                  <clipPath id="globeClip">
                    <circle cx="200" cy="200" r="180" />
                  </clipPath>
                </defs>

                {/* Soft sphere shading (behind wireframe) */}
                <circle cx="200" cy="200" r="180" fill="url(#globeFill)" opacity="1" />
                <g clipPath="url(#globeClip)">
                  <rect x="20" y="20" width="360" height="360" fill="url(#globeTerminator)" opacity="0.75" />
                </g>

                {/* Shell */}
                <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="1.5" />

                {/* Latitude parallels */}
                <ellipse cx="200" cy="200" rx="180" ry="50" fill="none" stroke="white" strokeWidth="0.8" opacity="0.72" />
                <ellipse cx="200" cy="200" rx="180" ry="110" fill="none" stroke="white" strokeWidth="0.8" opacity="0.66" />
                <ellipse cx="200" cy="200" rx="180" ry="160" fill="none" stroke="white" strokeWidth="0.5" opacity="0.50" />

                {/* Longitude meridians */}
                <ellipse cx="200" cy="200" rx="50" ry="180" fill="none" stroke="white" strokeWidth="0.8" opacity="0.72" />
                <ellipse cx="200" cy="200" rx="110" ry="180" fill="none" stroke="white" strokeWidth="0.8" opacity="0.66" />
                <ellipse cx="200" cy="200" rx="160" ry="180" fill="none" stroke="white" strokeWidth="0.5" opacity="0.50" />

                {/* Equator + prime meridian */}
                <line x1="20" y1="200" x2="380" y2="200" stroke="white" strokeWidth="1" opacity="0.55" />
                <line x1="200" y1="20" x2="200" y2="380" stroke="white" strokeWidth="1" opacity="0.55" />

                {/* Continent blobs (hand-drawn) */}
                <path
                  d="M140,120 Q160,100 185,115 Q200,105 215,120 Q230,110 240,130 Q250,150 240,170 Q225,185 210,180 Q195,195 175,185 Q155,180 145,165 Q130,145 140,120Z"
                  fill="#D8E8FF"
                  opacity="0.55"
                />
                <path
                  d="M155,195 Q170,190 185,200 Q195,215 180,230 Q165,240 150,228 Q138,215 145,202Z"
                  fill="#D8E8FF"
                  opacity="0.48"
                />
                <path
                  d="M250,155 Q265,145 280,155 Q295,170 285,185 Q270,195 255,185 Q240,172 250,155Z"
                  fill="#D8E8FF"
                  opacity="0.48"
                />
                <path
                  d="M190,240 Q210,235 225,248 Q235,260 225,270 Q210,278 197,268 Q185,255 190,240Z"
                  fill="#D8E8FF"
                  opacity="0.42"
                />

                {/* Orbit rings */}
                <ellipse
                  cx="200"
                  cy="200"
                  rx="200"
                  ry="55"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                  opacity="0.28"
                  transform="rotate(-20 200 200)"
                  strokeDasharray="6 4"
                />
                <ellipse
                  cx="200"
                  cy="200"
                  rx="200"
                  ry="40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.4"
                  opacity="0.2"
                  transform="rotate(30 200 200)"
                  strokeDasharray="4 8"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

