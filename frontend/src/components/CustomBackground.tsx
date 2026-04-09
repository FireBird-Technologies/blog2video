import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { random } from "remotion";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const SCENE_DURATION = 90; // 3 seconds at 30 fps
const TOTAL_SCENES = 3;
const TRANSITION_FRAMES = 12; // ~0.4s cross-fade overlap

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface BrandColors {
  primary?: string;
  background?: string;
  text?: string;
  secondary?: string;
}

interface SceneProps {
  displayText?: string;
  narrationText?: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  brandColors?: BrandColors;
  titleFontSize?: number;
  descriptionFontSize?: number;
  /** Injected by SceneSequence — always starts at 0 for each scene */
  localFrame: number;
}

interface TransitionSlideProps {
  sceneIndex: number;
  localFrame: number;
  sceneDuration: number;
  props: SceneProps;
}

// ─────────────────────────────────────────────
// SCENE 1 — Green / White brand
// ─────────────────────────────────────────────
const Scene1: React.FC<SceneProps> = (props) => {
  const frame = props.localFrame;
  const { fps, width, height } = useVideoConfig();

  const {
    displayText = "",
    narrationText = "",
    imageUrl,
    logoUrl,
    brandColors = {},
    titleFontSize,
    descriptionFontSize,
  } = props;

  const primary = brandColors.primary ?? "#00eb79";
  const textColor = brandColors.text ?? "#000000";

  const hasImage = !!(imageUrl && typeof imageUrl === "string");
  const hasLogo = !!(logoUrl && typeof logoUrl === "string");

  // Exit animation
  const exitStart = SCENE_DURATION - 22;
  const exitProgress = interpolate(frame, [exitStart, SCENE_DURATION], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 220, mass: 1.1 },
    from: 0,
    to: 1,
  });

  const barSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 22, stiffness: 140, mass: 1.2 },
    from: 0,
    to: 1,
  });

  const subtitleSpring = spring({
    frame: frame - 35,
    fps,
    config: { damping: 20, stiffness: 70 },
    from: 0,
    to: 1,
  });

  const words = displayText ? displayText.split(" ") : [];
  const wordAnimations = words.map((_, i) => {
    const delay = 14 + i * 9;
    return spring({
      frame: frame - delay,
      fps,
      config: { damping: 18, stiffness: 160, mass: 1.1 },
      from: 0,
      to: 1,
    });
  });

  const numParticles = 18;
  const particles = Array.from({ length: numParticles }, (_, i) => {
    const seedX = random(`px-${i}`) * (width - 60);
    const seedY = random(`py-${i}`) * (height - 60);
    const seedR = 4 + random(`pr-${i}`) * 18;
    const seedSpeed = 0.4 + random(`ps-${i}`) * 0.8;
    const seedPhase = random(`pp-${i}`) * Math.PI * 2;
    const opacity = 0.08 + random(`po-${i}`) * 0.12;
    const floatY = Math.sin(frame * seedSpeed * 0.04 + seedPhase) * 12;
    const floatX = Math.cos(frame * seedSpeed * 0.03 + seedPhase) * 8;
    const isGreen = i % 3 === 0;
    return {
      x: seedX + floatX,
      y: seedY + floatY,
      r: seedR,
      opacity,
      color: isGreen ? primary : "#cccccc",
    };
  });

  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.4, 0.9]);

  const kbScale = interpolate(frame, [0, SCENE_DURATION], [1, 1.07], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const heroFontSize = titleFontSize ?? 88;
  const subFontSize = descriptionFontSize ?? 44;

  const imageSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 22, stiffness: 100 },
    from: 0,
    to: 1,
  });

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background:
          "linear-gradient(135deg, #ffffff 0%, #e8f5ee 50%, #e0e0e0 100%)",
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
      }}
    >
      {/* Floating particles */}
      <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: "50%",
              background: p.color,
              opacity: p.opacity,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* Decorative circle — top right */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,235,121,0.18) 0%, transparent 70%)`,
          transform: `scale(${logoSpring})`,
          pointerEvents: "none",
        }}
      />

      {/* Decorative circle — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -100,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,235,121,0.12) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          overflow: "hidden",
        }}
      >
        {/* Text side */}
        <div
          style={{
            width: hasImage ? "55%" : "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: hasImage ? "flex-start" : "center",
            padding: hasImage ? "80px 60px 80px 100px" : "80px 120px",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Logo */}
          {hasLogo && (
            <div
              style={{
                marginBottom: 32,
                transform: `scale(${logoSpring}) translateY(${interpolate(logoSpring, [0, 1], [-30, 0])}px)`,
                opacity: logoSpring,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <Img
                src={logoUrl as string}
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "contain",
                  borderRadius: 12,
                  filter: `drop-shadow(0 4px 16px rgba(0,235,121,${glowPulse}))`,
                }}
              />
            </div>
          )}

          {/* Accent bar */}
          <div
            style={{
              width: interpolate(barSpring, [0, 1], [0, 120]),
              height: 6,
              borderRadius: 3,
              background: `linear-gradient(90deg, ${primary} 0%, #00c965 100%)`,
              marginBottom: 28,
              boxShadow: `0 0 20px rgba(0,235,121,${glowPulse * 0.8})`,
            }}
          />

          {/* Title — word by word */}
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: heroFontSize,
              fontWeight: 700,
              color: textColor,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              marginBottom: 32,
              textAlign: hasImage ? "left" : "center",
              maxWidth: hasImage ? "100%" : 1100,
              display: "flex",
              flexWrap: "wrap",
              gap: "0 14px",
              justifyContent: hasImage ? "flex-start" : "center",
            }}
          >
            {words.map((word, i) => {
              const anim = wordAnimations[i];
              const isAccentWord =
                i === 0 || (words.length > 2 && i === words.length - 1);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: anim,
                    transform: `translateY(${interpolate(anim, [0, 1], [40, 0])}px) scale(${interpolate(anim, [0, 1], [0.88, 1])})`,
                    color: isAccentWord ? primary : textColor,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Subtitle */}
          {narrationText && (
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: subFontSize,
                fontWeight: 400,
                color: "#4a4a4a",
                lineHeight: 1.5,
                opacity: subtitleSpring,
                transform: `translateY(${interpolate(subtitleSpring, [0, 1], [20, 0])}px)`,
                textAlign: hasImage ? "left" : "center",
                maxWidth: hasImage ? "100%" : 900,
              }}
            >
              {narrationText}
            </div>
          )}

          {/* Bottom accent dots */}
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: subtitleSpring,
            }}
          >
            {[
              { w: 48, opacity: 1, bg: primary },
              { w: 24, opacity: 0.4, bg: `rgba(0,235,121,0.4)` },
              { w: 12, opacity: 0.2, bg: `rgba(0,235,121,0.2)` },
            ].map((dot, i) => (
              <div
                key={i}
                style={{
                  width: interpolate(barSpring, [0, 1], [0, dot.w]),
                  height: 3,
                  borderRadius: 2,
                  background: dot.bg,
                }}
              />
            ))}
          </div>
        </div>

        {/* Image side */}
        {hasImage && (
          <div
            style={{
              width: "45%",
              position: "relative",
              overflow: "hidden",
              borderRadius: "32px 0 0 32px",
              margin: "40px 0 40px 0",
              boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
              opacity: imageSpring,
              transform: `translateX(${interpolate(imageSpring, [0, 1], [80, 0])}px)`,
            }}
          >
            <Img
              src={imageUrl as string}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${kbScale})`,
                transformOrigin: "center center",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to left, transparent 40%, rgba(255,255,255,0.15) 100%), linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 30% 70%, rgba(0,235,121,0.18) 0%, transparent 60%)`,
                mixBlendMode: "overlay",
              }}
            />
          </div>
        )}
      </AbsoluteFill>

      {/* Bottom glow strip */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, transparent 0%, ${primary} 40%, ${primary} 60%, transparent 100%)`,
          opacity: interpolate(frame, [20, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          boxShadow: `0 0 24px rgba(0,235,121,0.8)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// SCENE 2 — Red brand panel (Coca-Cola style)
// ─────────────────────────────────────────────
const Scene2: React.FC<SceneProps> = (props) => {
  const frame = props.localFrame;
  const { fps, width, height } = useVideoConfig();

  const {
    displayText = "",
    narrationText = "",
    logoUrl,
    imageUrl,
    titleFontSize,
    descriptionFontSize,
  } = props;

  const hasImage = !!(imageUrl && typeof imageUrl === "string");

  const exitStart = SCENE_DURATION - 22;
  const globalOpacity =
    frame >= exitStart
      ? interpolate(frame, [exitStart, SCENE_DURATION - 4], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  const panelSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1.1 },
  });
  const panelX = interpolate(panelSpring, [0, 1], [-width * 0.48, 0]);

  const logoSpring = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 14, stiffness: 180, mass: 1.0 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.4, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const rightPanelOpacity = interpolate(frame, [14, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightPanelX = interpolate(
    spring({
      frame: Math.max(0, frame - 14),
      fps,
      config: { damping: 20, stiffness: 80 },
    }),
    [0, 1],
    [60, 0]
  );

  const accentLineProgress = interpolate(
    spring({
      frame: Math.max(0, frame - 28),
      fps,
      config: { damping: 20, stiffness: 100 },
    }),
    [0, 1],
    [0, 1]
  );

  const words = displayText ? displayText.split(" ") : [];

  const narrationOpacity = interpolate(frame, [40, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationY = interpolate(
    spring({
      frame: Math.max(0, frame - 40),
      fps,
      config: { damping: 20, stiffness: 90 },
    }),
    [0, 1],
    [18, 0]
  );

  const glowPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 0.8),
    [-1, 1],
    [0.18, 0.32]
  );

  interface CircleConfig {
    seed: number;
    size: number;
    x: number;
    y: number;
    speed: number;
  }

  const circles: CircleConfig[] = [
    { seed: 10, size: 180, x: 0.15, y: 0.72, speed: 0.28 },
    { seed: 20, size: 100, x: 0.72, y: 0.15, speed: 0.18 },
    { seed: 30, size: 60, x: 0.85, y: 0.8, speed: 0.22 },
    { seed: 40, size: 130, x: 0.4, y: 0.9, speed: 0.14 },
    { seed: 50, size: 45, x: 0.92, y: 0.45, speed: 0.3 },
  ];

  const kbScale = interpolate(frame, [0, SCENE_DURATION], [1, 1.07], {
    extrapolateRight: "clamp",
  });
  const kbX = interpolate(frame, [0, SCENE_DURATION], [0, -12], {
    extrapolateRight: "clamp",
  });

  const panelW = width * 0.5;

  interface PanelCircle {
    r: number;
    cx: string;
    cy: string;
    op: number;
  }

  const panelCircles: PanelCircle[] = [
    { r: 220, cx: "10%", cy: "85%", op: 0.08 },
    { r: 140, cx: "80%", cy: "10%", op: 0.1 },
    { r: 80, cx: "60%", cy: "80%", op: 0.07 },
  ];

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background:
          "linear-gradient(160deg, #FFFFFF 0%, #F5F5F5 60%, #E8E8E8 100%)",
        opacity: globalOpacity,
      }}
    >
      {/* Red brand panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: panelX,
          width: panelW + 80,
          height: height,
          background:
            "linear-gradient(135deg, #E31937 0%, #B8102A 55%, #8C0D20 100%)",
          clipPath: "polygon(0 0, calc(100% - 80px) 0, 100% 100%, 0 100%)",
          zIndex: 2,
          boxShadow: `8px 0 48px rgba(227,25,55,${glowPulse})`,
          overflow: "hidden",
        }}
      >
        {/* Inner glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 40% 40%, rgba(255,255,255,0.12) 0%, transparent 65%)`,
            zIndex: 1,
          }}
        />

        {/* Decorative circles inside panel */}
        {panelCircles.map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: c.r * 2,
              height: c.r * 2,
              borderRadius: "50%",
              border: `2px solid rgba(255,255,255,${c.op * 2})`,
              background: `rgba(255,255,255,${c.op})`,
              left: c.cx,
              top: c.cy,
              transform: "translate(-50%, -50%)",
              zIndex: 1,
            }}
          />
        ))}

        {/* Logo area */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${logoScale})`,
            opacity: logoOpacity,
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {logoUrl && typeof logoUrl === "string" && (
            <Img
              src={logoUrl}
              style={{
                width: 160,
                height: 160,
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }}
            />
          )}
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.28)",
              borderRadius: 999,
              padding: "8px 28px",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Coca-Cola
          </div>
        </div>
      </div>

      {/* Right content panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: width - panelW + 40,
          height: height,
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {hasImage ? (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <Img
              src={imageUrl as string}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${kbScale}) translateX(${kbX}px)`,
                transformOrigin: "center center",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.60) 55%, rgba(255,255,255,0.20) 100%)",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(160deg, #FFFFFF 0%, #FFF5F5 60%, #F5F5F5 100%)",
            }}
          >
            {circles.map((c, i) => {
              const floatY = interpolate(
                frame,
                [0, SCENE_DURATION],
                [0, -c.speed * 60]
              );
              const floatOpacity = interpolate(frame, [8, 24], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: c.size,
                    height: c.size,
                    borderRadius: "50%",
                    background:
                      i % 2 === 0
                        ? `rgba(227,25,55,${0.05 + random(c.seed) * 0.06})`
                        : `rgba(227,25,55,${0.03 + random(c.seed + 1) * 0.04})`,
                    border: `1.5px solid rgba(227,25,55,${0.08 + random(c.seed + 2) * 0.06})`,
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    transform: `translate(-50%, calc(-50% + ${floatY}px))`,
                    opacity: floatOpacity,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Text content */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: hasImage ? "8%" : "10%",
            right: "6%",
            transform: `translateY(-50%) translateX(${rightPanelX}px)`,
            opacity: rightPanelOpacity,
            zIndex: 2,
          }}
        >
          {/* Accent line */}
          <div
            style={{
              width: `${accentLineProgress * 72}px`,
              height: 4,
              background: "#E31937",
              borderRadius: 999,
              marginBottom: 20,
            }}
          />

          {/* Title — word by word */}
          <div
            style={{
              fontWeight: 700,
              fontSize: titleFontSize ?? 68,
              lineHeight: 1.15,
              color: "#1A1A1A",
              marginBottom: 28,
              letterSpacing: "-0.01em",
            }}
          >
            {words.map((word, i) => {
              const wordSpring = spring({
                frame: Math.max(0, frame - 18 - i * 6),
                fps,
                config: { damping: 20, stiffness: 110, mass: 1.0 },
              });
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: interpolate(wordSpring, [0, 1], [0, 1]),
                    transform: `translateX(${interpolate(wordSpring, [0, 1], [32, 0])}px) translateY(${interpolate(wordSpring, [0, 1], [16, 0])}px)`,
                    marginRight: "0.28em",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Narration */}
          {narrationText && (
            <div
              style={{
                fontWeight: 400,
                fontSize: descriptionFontSize ?? 34,
                lineHeight: 1.6,
                color: "#4A4A4A",
                opacity: narrationOpacity,
                transform: `translateY(${narrationY}px)`,
                maxWidth: 560,
              }}
            >
              {narrationText}
            </div>
          )}

          {/* Dot row */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 36,
              opacity: interpolate(frame, [55, 70], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {([0, 1, 2] as const).map((i) => (
              <div
                key={i}
                style={{
                  width: i === 0 ? 28 : 10,
                  height: 10,
                  borderRadius: 999,
                  background: i === 0 ? "#E31937" : "rgba(227,25,55,0.28)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Diagonal shine */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: panelX + panelW - 8,
          width: 3,
          height: height,
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0.80) 60%, rgba(255,255,255,0) 100%)",
          transform: "skewX(-8deg)",
          zIndex: 5,
          opacity: interpolate(frame, [8, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// SCENE 3 — Dark / FireBird Tech
// ─────────────────────────────────────────────
const Scene3: React.FC<SceneProps> = (props) => {
  const frame = props.localFrame;
  const { fps, width, height } = useVideoConfig();

  const {
    displayText = "",
    narrationText = "",
    logoUrl,
    imageUrl,
    brandColors = {},
    titleFontSize,
    descriptionFontSize,
  } = props;

  const primary = brandColors.primary ?? "#FF6B35";
  const hasImage = !!(imageUrl && typeof imageUrl === "string");
  const hasLogo = !!(logoUrl && typeof logoUrl === "string");

  const exitStart = SCENE_DURATION - 22;
  const exitProgress = interpolate(
    frame,
    [exitStart, SCENE_DURATION - 2],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const globalOpacity = 1 - exitProgress;

  const bgPulse = interpolate(
    Math.sin((frame / fps) * 1.2),
    [-1, 1],
    [0, 0.04],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const accentBarWidth = interpolate(
    spring({ frame: frame - 2, fps, config: { damping: 22, stiffness: 90, mass: 1 } }),
    [0, 1],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const accentBarBottomWidth = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 90, mass: 1 } }),
    [0, 1],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const logoSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 220, mass: 1.1 },
  });

  const titleWords = displayText ? displayText.split(" ") : [];

  const narrationSpring = spring({
    frame: frame - 50,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1.2 },
  });

  const glowPulse = interpolate(
    Math.sin((frame / fps) * 2.4),
    [-1, 1],
    [0.3, 0.7],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const particleCount = 18;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const seedX = random(`px-${i}`);
    const seedY = random(`py-${i}`);
    const seedSize = random(`ps-${i}`);
    const seedSpeed = random(`psp-${i}`);
    const seedDelay = random(`pd-${i}`);
    const x = seedX * width;
    const baseY = seedY * height;
    const size = 3 + seedSize * 8;
    const speed = 0.3 + seedSpeed * 0.8;
    const delay = seedDelay * 40;
    const yOffset = interpolate(
      frame - delay,
      [0, SCENE_DURATION],
      [0, -height * speed],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const opacity = interpolate(
      frame - delay,
      [0, 15, SCENE_DURATION - 20, SCENE_DURATION],
      [0, 0.25 + seedSize * 0.15, 0.15, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { x, y: baseY + yOffset, size, opacity, idx: i };
  });

  const ringSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.5 },
  });
  const ringScale = interpolate(ringSpring, [0, 1], [0.5, 1]);
  const ringOpacity = interpolate(ringSpring, [0, 1], [0, 0.12]);

  const imageReveal = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 80, mass: 1.2 },
  });

  const heroFontSize = titleFontSize ?? 88;
  const subFontSize = descriptionFontSize ?? 44;

  const labelSpring = spring({
    frame: frame - 18,
    fps,
    config: { damping: 20, stiffness: 110, mass: 1 },
  });
  const pillSpring = spring({
    frame: frame - 65,
    fps,
    config: { damping: 20, stiffness: 100, mass: 1 },
  });
  const cornerSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const cornerSpring2 = spring({
    frame: frame - 12,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #1A1A1A 0%, #2A1A0F 55%, #1A1A1A 100%)`,
        overflow: "hidden",
        opacity: globalOpacity,
      }}
    >
      {/* Animated bg tint */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, rgba(255,107,53,${0.08 + bgPulse}) 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.idx}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: primary,
            opacity: p.opacity,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Decorative rings */}
      <div
        style={{
          position: "absolute",
          left: hasImage ? "30%" : "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          width: 680,
          height: 680,
          borderRadius: "50%",
          border: `2px solid rgba(255,107,53,${ringOpacity * 6})`,
          opacity: ringOpacity,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: hasImage ? "30%" : "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${ringScale * 0.75})`,
          width: 480,
          height: 480,
          borderRadius: "50%",
          border: `1px solid rgba(255,107,53,${ringOpacity * 4})`,
          opacity: ringOpacity * 1.5,
          pointerEvents: "none",
        }}
      />

      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${accentBarWidth}%`,
          height: 5,
          background: `linear-gradient(90deg, ${primary} 0%, #FF8C5A 100%)`,
          boxShadow: `0 0 18px rgba(255,107,53,0.6)`,
        }}
      />

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: `${accentBarBottomWidth}%`,
          height: 3,
          background: `linear-gradient(270deg, ${primary} 0%, #FF8C5A 100%)`,
          opacity: 0.7,
        }}
      />

      {/* Main layout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          gap: 60,
        }}
      >
        {/* Left content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: hasImage ? "flex-start" : "center",
            justifyContent: "center",
            gap: 32,
          }}
        >
          {/* Logo */}
          {hasLogo && (
            <div
              style={{
                transform: `scale(${interpolate(logoSpring, [0, 1], [0.3, 1])})`,
                opacity: interpolate(logoSpring, [0, 1], [0, 1]),
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div
                style={{
                  background: `rgba(255,107,53,0.12)`,
                  borderRadius: 16,
                  padding: 12,
                  boxShadow: `0 0 32px rgba(255,107,53,${glowPulse * 0.5})`,
                  border: `1.5px solid rgba(255,107,53,0.25)`,
                }}
              >
                <Img
                  src={logoUrl as string}
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: primary,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: 0.9,
                }}
              >
                FireBirdTech
              </div>
            </div>
          )}

          {/* Tagline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              transform: `translateX(${interpolate(labelSpring, [0, 1], [-60, 0])}px)`,
              opacity: interpolate(labelSpring, [0, 1], [0, 1]),
            }}
          >
            {[0, 1].map((side) => (
              <div
                key={side}
                style={{
                  width: 40,
                  height: 3,
                  background: primary,
                  borderRadius: 2,
                  boxShadow: `0 0 10px rgba(255,107,53,0.6)`,
                  order: side === 0 ? 0 : 2,
                }}
              />
            ))}
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: primary,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                order: 1,
              }}
            >
              AI · Tech · Fire
            </span>
          </div>

          {/* Title — word by word */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0 16px",
              justifyContent: hasImage ? "flex-start" : "center",
              maxWidth: hasImage ? 780 : 1100,
            }}
          >
            {titleWords.map((word, i) => {
              const wordSpring = spring({
                frame: frame - (22 + i * 8),
                fps,
                config: { damping: 14, stiffness: 200, mass: 1.0 },
              });
              const isAccent = i === 0 || i === titleWords.length - 1;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontSize: heroFontSize,
                    fontWeight: 800,
                    color: isAccent ? primary : "#F5F5F5",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    transform: `translateY(${interpolate(wordSpring, [0, 1], [50, 0])}px) scale(${interpolate(wordSpring, [0, 1], [0.85, 1])})`,
                    opacity: interpolate(wordSpring, [0, 1], [0, 1]),
                    textShadow: isAccent
                      ? `0 0 40px rgba(255,107,53,${glowPulse})`
                      : `0 2px 20px rgba(0,0,0,0.4)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Narration */}
          {narrationText && (
            <div
              style={{
                transform: `translateY(${interpolate(narrationSpring, [0, 1], [40, 0])}px)`,
                opacity: interpolate(narrationSpring, [0, 1], [0, 1]),
                maxWidth: hasImage ? 720 : 900,
                textAlign: hasImage ? "left" : "center",
              }}
            >
              <p
                style={{
                  fontSize: subFontSize,
                  fontWeight: 400,
                  color: "rgba(245,245,245,0.75)",
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {narrationText}
              </p>
            </div>
          )}

          {/* CTA pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: interpolate(pillSpring, [0, 1], [0, 1]),
              transform: `scale(${interpolate(pillSpring, [0, 1], [0.8, 1])})`,
              marginTop: 4,
            }}
          >
            <div
              style={{
                background: `linear-gradient(90deg, ${primary} 0%, #FF8C5A 100%)`,
                borderRadius: 24,
                padding: "10px 24px",
                fontSize: 20,
                fontWeight: 600,
                color: "#FFFFFF",
                letterSpacing: "0.04em",
                boxShadow: `0 4px 20px rgba(255,107,53,0.45)`,
              }}
            >
              firebird-technologies.com
            </div>
          </div>
        </div>

        {/* Right image panel */}
        {hasImage && (
          <div
            style={{
              width: 480,
              height: 580,
              borderRadius: 20,
              overflow: "hidden",
              flexShrink: 0,
              transform: `translateX(${interpolate(imageReveal, [0, 1], [120, 0])}px)`,
              opacity: interpolate(imageReveal, [0, 1], [0, 1]),
              boxShadow: `0 16px 60px rgba(255,107,53,0.2), 0 4px 20px rgba(0,0,0,0.4)`,
              border: `2px solid rgba(255,107,53,0.3)`,
              position: "relative",
            }}
          >
            <Img
              src={imageUrl as string}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${interpolate(frame, [0, SCENE_DURATION], [1, 1.07], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, rgba(26,26,26,0.75) 0%, transparent 60%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `rgba(255,107,53,0.08)`,
                mixBlendMode: "overlay",
              }}
            />
          </div>
        )}
      </div>

      {/* Corner accent — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 40,
          transform: `scale(${interpolate(cornerSpring, [0, 1], [0, 1])})`,
          transformOrigin: "bottom right",
          opacity: 0.35,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRight: `3px solid ${primary}`,
            borderBottom: `3px solid ${primary}`,
            borderRadius: "0 0 8px 0",
          }}
        />
      </div>

      {/* Corner accent — top left */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 40,
          transform: `scale(${interpolate(cornerSpring2, [0, 1], [0, 1])})`,
          transformOrigin: "top left",
          opacity: 0.35,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderLeft: `3px solid ${primary}`,
            borderTop: `3px solid ${primary}`,
            borderRadius: "8px 0 0 0",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// SCENE REGISTRY
// ─────────────────────────────────────────────
const SCENE_COMPONENTS: React.FC<SceneProps>[] = [Scene1, Scene2, Scene3];

// ─────────────────────────────────────────────
// CROSS-FADE TRANSITION WRAPPER
// ─────────────────────────────────────────────
const TransitionSlide: React.FC<TransitionSlideProps> = ({
  sceneIndex,
  localFrame,
  sceneDuration,
  props,
}) => {
  const ActiveScene = SCENE_COMPONENTS[sceneIndex % TOTAL_SCENES];
  const NextScene = SCENE_COMPONENTS[(sceneIndex + 1) % TOTAL_SCENES];

  const isTransitioning = localFrame > sceneDuration - TRANSITION_FRAMES;
  const transitionProgress = isTransitioning
    ? interpolate(
        localFrame,
        [sceneDuration - TRANSITION_FRAMES, sceneDuration],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - transitionProgress }}>
        <ActiveScene {...props} localFrame={localFrame} />
      </AbsoluteFill>
      {isTransitioning && (
        <AbsoluteFill style={{ opacity: transitionProgress }}>
          <NextScene {...props} localFrame={0} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// ROOT COMPOSITION  — export this to Remotion
// ─────────────────────────────────────────────

/** Props exposed to the Remotion composition (localFrame is injected internally) */
export type SceneSequenceProps = Omit<SceneProps, "localFrame">;

export const SceneSequence: React.FC<SceneSequenceProps> = (props) => {
  const frame = useCurrentFrame();

  const sceneIndex = Math.min(
    Math.floor(frame / SCENE_DURATION),
    TOTAL_SCENES - 1
  );
  const localFrame = frame % SCENE_DURATION;

  return (
    <TransitionSlide
      sceneIndex={sceneIndex}
      localFrame={localFrame}
      sceneDuration={SCENE_DURATION}
      props={{ ...props, localFrame }}
    />
  );
};

// ─────────────────────────────────────────────
// REMOTION ROOT  (register in your Root.tsx)
// ─────────────────────────────────────────────
//
// import { Composition } from "remotion";
// import { SceneSequence, type SceneSequenceProps } from "./SceneSequence";
//
// export const RemotionRoot: React.FC = () => (
//   <Composition
//     id="SceneSequence"
//     component={SceneSequence}
//     durationInFrames={SCENE_DURATION * TOTAL_SCENES}  // 270 frames = 9s @ 30fps
//     fps={30}
//     width={1920}
//     height={1080}
//     defaultProps={{
//       displayText: "Launch your brand",
//       narrationText: "Grow faster with smart, animated video storytelling.",
//       brandColors: { primary: "#00eb79", text: "#000000" },
//       imageUrl: null,
//       logoUrl: null,
//       titleFontSize: 88,
//       descriptionFontSize: 44,
//     } satisfies SceneSequenceProps}
//   />
// );