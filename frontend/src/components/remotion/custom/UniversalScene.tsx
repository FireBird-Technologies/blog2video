import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  UniversalSceneProps,
  SceneLayoutConfig,
  SceneElement,
  SceneDecoration,
  SceneArrangement,
  CustomTheme,
} from "./types";
import {
  getStyleDecorations,
  getAnimationConfig,
  getImageOverlayStyle,
  getDecorativeElements,
  type StyleDecorations,
  type AnimationConfig,
} from "./utils/styleEngine";

/* ═══════════════════════════════════════════════════════════════════
   ARRANGEMENT → CSS GRID/FLEX MAPPING
   ═══════════════════════════════════════════════════════════════════ */

function getArrangementStyle(
  arrangement: SceneArrangement,
  isPortrait: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "flex",
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  };

  switch (arrangement) {
    case "full-center":
      return {
        ...base,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      };

    case "split-left":
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "55% 45%",
        gridTemplateRows: isPortrait ? "45% 55%" : "1fr",
        alignItems: "center",
      };

    case "split-right":
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "45% 55%",
        gridTemplateRows: isPortrait ? "45% 55%" : "1fr",
        alignItems: "center",
      };

    case "top-bottom":
      return {
        ...base,
        flexDirection: "column",
        justifyContent: "flex-start",
      };

    case "grid-2x2":
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr",
        gridTemplateRows: isPortrait ? "repeat(4, 1fr)" : "1fr 1fr",
        alignItems: "stretch",
      };

    case "grid-3":
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr 1fr",
        alignItems: "center",
      };

    case "asymmetric-left":
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "60% 35%",
        gridTemplateRows: isPortrait ? "auto 1fr" : "1fr",
        gap: isPortrait ? 0 : "5%",
        alignItems: "center",
      };

    case "asymmetric-right":
      return {
        ...base,
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "35% 60%",
        gridTemplateRows: isPortrait ? "auto 1fr" : "1fr",
        gap: isPortrait ? 0 : "5%",
        alignItems: "center",
      };

    case "stacked":
      return {
        ...base,
        flexDirection: "column",
        justifyContent: "center",
        gap: isPortrait ? 12 : 20,
      };

    default:
      return {
        ...base,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      };
  }
}

function hasUsableImageUrl(url?: string | null): boolean {
  if (typeof url !== "string") return false;
  const normalized = url.trim();
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  return lower !== "null" && lower !== "undefined" && lower !== "about:blank";
}

/* ═══════════════════════════════════════════════════════════════════
   DECORATION RENDERER
   ═══════════════════════════════════════════════════════════════════ */

function renderDecorations(
  decorations: SceneDecoration[],
  theme: CustomTheme,
): React.ReactNode[] {
  const { colors, borderRadius } = theme;
  const nodes: React.ReactNode[] = [];

  decorations.forEach((dec, i) => {
    switch (dec) {
      case "accent-bar-top":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: 5,
              backgroundColor: colors.accent,
              zIndex: 5,
            }}
          />,
        );
        break;
      case "accent-bar-left":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              top: "10%",
              left: 0,
              width: 5,
              height: "80%",
              backgroundColor: colors.accent,
              borderRadius: 3,
              zIndex: 5,
            }}
          />,
        );
        break;
      case "accent-bar-bottom":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: 5,
              backgroundColor: colors.accent,
              zIndex: 5,
            }}
          />,
        );
        break;
      case "corner-accent":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 60,
              height: 60,
              borderTop: `3px solid ${colors.accent}`,
              borderRight: `3px solid ${colors.accent}`,
              borderRadius: `0 ${borderRadius}px 0 0`,
              zIndex: 5,
              pointerEvents: "none",
            }}
          />,
        );
        break;
      case "gradient-orb":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              top: "-15%",
              right: "-10%",
              width: "50%",
              height: "50%",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colors.accent}30 0%, transparent 70%)`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />,
        );
        break;
      case "dot-grid":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              top: "10%",
              right: "5%",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: `${colors.accent}55`,
              boxShadow: `20px 0 0 ${colors.accent}44, 40px 0 0 ${colors.accent}33, 0 20px 0 ${colors.accent}44, 20px 20px 0 ${colors.accent}33, 40px 20px 0 ${colors.accent}22, 0 40px 0 ${colors.accent}33, 20px 40px 0 ${colors.accent}22`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />,
        );
        break;
      case "diagonal-lines":
        nodes.push(
          <div
            key={`dec-${i}`}
            style={{
              position: "absolute",
              bottom: "8%",
              left: "5%",
              width: "35%",
              height: 3,
              backgroundColor: `${colors.accent}40`,
              transform: "rotate(-3deg)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />,
          <div
            key={`dec-${i}-b`}
            style={{
              position: "absolute",
              top: "12%",
              right: "8%",
              width: "25%",
              height: 2,
              backgroundColor: `${colors.accent}30`,
              transform: "rotate(2deg)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />,
        );
        break;
      case "none":
      default:
        break;
    }
  });

  return nodes;
}

/* ═══════════════════════════════════════════════════════════════════
   BACKGROUND RENDERER
   ═══════════════════════════════════════════════════════════════════ */

function renderBackground(
  config: SceneLayoutConfig,
  theme: CustomTheme,
  frame: number,
): React.ReactNode {
  const bg = config.background;
  if (!bg) return null;

  if (bg.type === "image" && bg.imageUrl) {
    const overlayStyle = getImageOverlayStyle(theme);
    const hasOverlay = Object.keys(overlayStyle).length > 0;
    return (
      <>
        <Img
          src={bg.imageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${interpolate(frame, [0, 90], [1.05, 1], { extrapolateRight: "clamp" })})`,
            zIndex: 0,
          }}
        />
        {hasOverlay && (
          <div style={{ position: "absolute", inset: 0, ...overlayStyle, zIndex: 1 }} />
        )}
        {!hasOverlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, ${theme.colors.bg}88 0%, ${theme.colors.bg}DD 60%, ${theme.colors.bg}FF 100%)`,
              zIndex: 1,
            }}
          />
        )}
      </>
    );
  }

  if (bg.type === "gradient") {
    const angle = bg.gradientAngle ?? 135;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${angle}deg, ${theme.colors.bg} 0%, ${theme.colors.surface} 50%, ${theme.colors.bg} 100%)`,
          zIndex: 0,
        }}
      />
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   ELEMENT RENDERERS
   ═══════════════════════════════════════════════════════════════════ */

interface ElementRenderCtx {
  theme: CustomTheme;
  deco: StyleDecorations;
  anim: AnimationConfig;
  frame: number;
  fps: number;
  isPortrait: boolean;
  elementIndex: number;
  titleFontSize?: number;
  descriptionFontSize?: number;
}

function animatedSpring(ctx: ElementRenderCtx, extraDelay = 0) {
  const delay = 3 + ctx.elementIndex * 8 + extraDelay;
  const s = spring({
    frame: ctx.frame - delay,
    fps: ctx.fps,
    config: ctx.anim.entrance,
  });
  return {
    opacity: interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(s, [0, 1], [ctx.anim.slideOffset || 20, 0])}px)`,
  };
}

function HeadingElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const anim = animatedSpring(ctx);
  const styleScale =
    theme.style === "bold" ? 1.15
    : theme.style === "minimal" ? 0.92
    : theme.style === "neon" ? 1.08
    : 1.0;
  const defaultSize =
    el.emphasis === "primary"
      ? Math.round((ctx.isPortrait ? 48 : 72) * styleScale)
      : Math.round((ctx.isPortrait ? 36 : 52) * styleScale);
  const fontSize = (el.emphasis === "primary" && ctx.titleFontSize)
    ? ctx.titleFontSize
    : defaultSize;

  return (
    <div style={{ ...anim, ...deco.contentPadding }}>
      <h1
        style={{
          fontFamily: `'${theme.fonts.heading}', sans-serif`,
          fontSize,
          fontWeight: 800,
          color: theme.colors.text,
          lineHeight: 1.1,
          margin: 0,
          textShadow: deco.headingShadow,
          letterSpacing: "-0.02em",
        }}
      >
        {el.content.text}
      </h1>
    </div>
  );
}

function BodyTextElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const anim = animatedSpring(ctx);
  const bodyScale = theme.style === "bold" ? 1.12 : theme.style === "minimal" ? 0.95 : 1.0;
  const defaultBodySize = Math.round((ctx.isPortrait ? 18 : 24) * bodyScale);

  return (
    <div style={{ ...anim, ...deco.contentPadding }}>
      <p
        style={{
          fontFamily: `'${theme.fonts.body}', sans-serif`,
          fontSize: ctx.descriptionFontSize || defaultBodySize,
          fontWeight: 400,
          color: el.emphasis === "subtle" ? theme.colors.muted : theme.colors.text,
          lineHeight: 1.6,
          margin: 0,
          maxWidth: ctx.isPortrait ? "100%" : "80%",
        }}
      >
        {el.content.text}
      </p>
    </div>
  );
}

function CardGridElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const items = el.content.items || [];
  const cols =
    ctx.isPortrait ? 1 : items.length <= 2 ? items.length : items.length <= 4 ? 2 : 3;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: deco.gridGap,
        width: "100%",
        ...deco.contentPadding,
      }}
    >
      {items.map((item, idx) => {
        const cardAnim = animatedSpring({
          ...ctx,
          elementIndex: ctx.elementIndex + idx,
        }, idx * 4);

        return (
          <div
            key={idx}
            style={{
              ...deco.card,
              padding: ctx.isPortrait ? 16 : 24,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              ...cardAnim,
            }}
          >
            {item.icon && (
              <span style={{ fontSize: ctx.isPortrait ? 24 : 32, lineHeight: 1 }}>
                {item.icon}
              </span>
            )}
            {item.imageUrl && (
              <Img
                src={item.imageUrl}
                style={{
                  ...deco.imageFrame,
                  width: "100%",
                  height: ctx.isPortrait ? 80 : 120,
                  objectFit: "cover",
                }}
              />
            )}
            <p
              style={{
                fontFamily: `'${theme.fonts.body}', sans-serif`,
                fontSize: ctx.isPortrait ? 15 : 19,
                fontWeight: 500,
                color: theme.colors.text,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {item.text}
            </p>
            {item.description && (
              <p
                style={{
                  fontFamily: `'${theme.fonts.body}', sans-serif`,
                  fontSize: ctx.isPortrait ? 12 : 14,
                  color: theme.colors.muted,
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {item.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CodeBlockElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const anim = animatedSpring(ctx);
  const lines = el.content.codeLines || [];

  return (
    <div style={{ ...anim, ...deco.contentPadding, width: "100%" }}>
      <div
        style={{
          ...deco.card,
          backgroundColor: theme.style === "neon" ? "#0a0a0a" : theme.colors.surface,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 14px",
            borderBottom: `1px solid ${theme.colors.muted}22`,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#28C840" }} />
          {el.content.codeLanguage && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: theme.colors.muted,
                fontFamily: `'${theme.fonts.mono}', monospace`,
              }}
            >
              {el.content.codeLanguage}
            </span>
          )}
        </div>
        {/* Code lines */}
        <div style={{ padding: ctx.isPortrait ? "12px 14px" : "16px 20px" }}>
          {lines.map((line, idx) => {
            const lineAnim = animatedSpring(
              { ...ctx, elementIndex: ctx.elementIndex + idx },
              idx * 3,
            );
            return (
              <div key={idx} style={{ ...lineAnim }}>
                <code
                  style={{
                    fontFamily: `'${theme.fonts.mono}', monospace`,
                    fontSize: ctx.isPortrait ? 13 : 17,
                    color: theme.style === "neon" ? theme.colors.accent : theme.colors.text,
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {line}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricRowElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const items = el.content.items || [];
  const cols = ctx.isPortrait ? 2 : Math.min(items.length, 4);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: deco.gridGap,
        width: "100%",
        ...deco.contentPadding,
      }}
    >
      {items.map((item, idx) => {
        const metricAnim = animatedSpring(
          { ...ctx, elementIndex: ctx.elementIndex + idx },
          idx * 5,
        );
        return (
          <div
            key={idx}
            style={{
              ...deco.card,
              padding: ctx.isPortrait ? 16 : 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 4,
              ...metricAnim,
            }}
          >
            <span
              style={{
                fontFamily: `'${theme.fonts.heading}', sans-serif`,
                fontSize: ctx.isPortrait ? 36 : 52,
                fontWeight: 800,
                color: theme.colors.accent,
                lineHeight: 1,
              }}
            >
              {item.value}
            </span>
            <span
              style={{
                fontFamily: `'${theme.fonts.body}', sans-serif`,
                fontSize: ctx.isPortrait ? 13 : 16,
                color: theme.colors.muted,
                fontWeight: 500,
              }}
            >
              {item.label || item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ImageElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { deco, theme } = ctx;
  const anim = animatedSpring(ctx);
  const imageUrl = el.content.imageUrl;
  if (!hasUsableImageUrl(imageUrl)) return null;
  const resolvedImageUrl = (imageUrl as string).trim();

  return (
    <div
      style={{
        ...anim,
        ...deco.contentPadding,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Img
        src={resolvedImageUrl}
        style={{
          ...deco.imageFrame,
          width: el.size === "full" ? "100%" : el.size === "large" ? "80%" : "60%",
          maxHeight: ctx.isPortrait ? 300 : 400,
          objectFit: "cover",
        }}
      />
      {el.content.caption && (
        <p
          style={{
            fontFamily: `'${theme.fonts.body}', sans-serif`,
            fontSize: 14,
            color: theme.colors.muted,
            margin: 0,
          }}
        >
          {el.content.caption}
        </p>
      )}
    </div>
  );
}

function QuoteElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const anim = animatedSpring(ctx);

  return (
    <div style={{ ...anim, ...deco.contentPadding, maxWidth: ctx.isPortrait ? "100%" : "80%" }}>
      {/* Accent quote mark */}
      <span
        style={{
          fontSize: ctx.isPortrait ? 48 : 72,
          lineHeight: 1,
          color: theme.colors.accent,
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          display: "block",
          marginBottom: -10,
        }}
      >
        &ldquo;
      </span>
      <blockquote
        style={{
          fontFamily: `'${theme.fonts.heading}', sans-serif`,
          fontSize: ctx.isPortrait ? 24 : 38,
          fontWeight: 700,
          color: theme.colors.text,
          lineHeight: 1.3,
          margin: 0,
          textShadow: deco.headingShadow,
        }}
      >
        {el.content.highlightPhrase && el.content.quote ? (
          <>
            {el.content.quote.split(el.content.highlightPhrase).map((part, i, arr) => (
              <React.Fragment key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span
                    style={{
                      backgroundColor: `${theme.colors.accent}25`,
                      padding: "2px 6px",
                      borderRadius: theme.borderRadius / 2,
                    }}
                  >
                    {el.content.highlightPhrase}
                  </span>
                )}
              </React.Fragment>
            ))}
          </>
        ) : (
          el.content.quote || el.content.text
        )}
      </blockquote>
      {el.content.author && (
        <p
          style={{
            fontFamily: `'${theme.fonts.body}', sans-serif`,
            fontSize: ctx.isPortrait ? 14 : 18,
            color: theme.colors.muted,
            marginTop: 16,
            margin: 0,
            paddingTop: 16,
          }}
        >
          — {el.content.author}
        </p>
      )}
    </div>
  );
}

function TimelineElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const items = el.content.items || [];
  const isHorizontal = !ctx.isPortrait;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHorizontal ? "row" : "column",
        gap: deco.gridGap,
        width: "100%",
        ...deco.contentPadding,
        position: "relative",
      }}
    >
      {/* Connecting line */}
      <div
        style={{
          position: "absolute",
          ...(isHorizontal
            ? { top: 16, left: "5%", width: "90%", height: 3 }
            : { left: 16, top: "5%", height: "90%", width: 3 }),
          backgroundColor: `${theme.colors.accent}40`,
          borderRadius: 2,
          zIndex: 0,
        }}
      />
      {items.map((item, idx) => {
        const itemAnim = animatedSpring(
          { ...ctx, elementIndex: ctx.elementIndex + idx },
          idx * 6,
        );
        return (
          <div
            key={idx}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: isHorizontal ? "center" : "flex-start",
              gap: 8,
              zIndex: 1,
              ...itemAnim,
              paddingLeft: isHorizontal ? 0 : 32,
            }}
          >
            {/* Dot */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                backgroundColor: theme.colors.accent,
                border: `3px solid ${theme.colors.bg}`,
                boxShadow: `0 0 0 2px ${theme.colors.accent}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: `'${theme.fonts.heading}', sans-serif`,
                fontSize: ctx.isPortrait ? 14 : 16,
                fontWeight: 700,
                color: theme.colors.accent,
              }}
            >
              {item.label || item.text}
            </span>
            {item.description && (
              <span
                style={{
                  fontFamily: `'${theme.fonts.body}', sans-serif`,
                  fontSize: ctx.isPortrait ? 12 : 14,
                  color: theme.colors.muted,
                  textAlign: isHorizontal ? "center" : "left",
                }}
              >
                {item.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepsElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const items = el.content.items || [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: deco.gridGap,
        width: "100%",
        ...deco.contentPadding,
      }}
    >
      {items.map((item, idx) => {
        const stepAnim = animatedSpring(
          { ...ctx, elementIndex: ctx.elementIndex + idx },
          idx * 5,
        );
        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: ctx.isPortrait ? 12 : 20,
              ...stepAnim,
            }}
          >
            {/* Step number */}
            <div
              style={{
                width: ctx.isPortrait ? 36 : 48,
                height: ctx.isPortrait ? 36 : 48,
                borderRadius: "50%",
                backgroundColor: theme.colors.accent,
                color: theme.colors.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: `'${theme.fonts.heading}', sans-serif`,
                fontSize: ctx.isPortrait ? 16 : 20,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </div>
            <div>
              <p
                style={{
                  fontFamily: `'${theme.fonts.body}', sans-serif`,
                  fontSize: ctx.isPortrait ? 16 : 20,
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {item.text}
              </p>
              {item.description && (
                <p
                  style={{
                    fontFamily: `'${theme.fonts.body}', sans-serif`,
                    fontSize: ctx.isPortrait ? 12 : 14,
                    color: theme.colors.muted,
                    margin: 0,
                    marginTop: 4,
                  }}
                >
                  {item.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconTextElement({ el, ctx }: { el: SceneElement; ctx: ElementRenderCtx }) {
  const { theme, deco } = ctx;
  const items = el.content.items || [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: ctx.isPortrait ? 10 : 14,
        ...deco.contentPadding,
      }}
    >
      {items.map((item, idx) => {
        const itemAnim = animatedSpring(
          { ...ctx, elementIndex: ctx.elementIndex + idx },
          idx * 4,
        );
        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              ...itemAnim,
            }}
          >
            {item.icon && (
              <span style={{ fontSize: ctx.isPortrait ? 20 : 28, lineHeight: 1 }}>
                {item.icon}
              </span>
            )}
            <span
              style={{
                fontFamily: `'${theme.fonts.body}', sans-serif`,
                fontSize: ctx.isPortrait ? 16 : 20,
                fontWeight: 500,
                color: theme.colors.text,
              }}
            >
              {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ELEMENT DISPATCHER
   ═══════════════════════════════════════════════════════════════════ */

function renderElement(el: SceneElement, ctx: ElementRenderCtx): React.ReactNode {
  switch (el.type) {
    case "heading":
      return <HeadingElement el={el} ctx={ctx} />;
    case "body-text":
      return <BodyTextElement el={el} ctx={ctx} />;
    case "card-grid":
      return <CardGridElement el={el} ctx={ctx} />;
    case "code-block":
      return <CodeBlockElement el={el} ctx={ctx} />;
    case "metric-row":
      return <MetricRowElement el={el} ctx={ctx} />;
    case "image":
      return <ImageElement el={el} ctx={ctx} />;
    case "quote":
      return <QuoteElement el={el} ctx={ctx} />;
    case "timeline":
      return <TimelineElement el={el} ctx={ctx} />;
    case "steps":
      return <StepsElement el={el} ctx={ctx} />;
    case "icon-text":
      return <IconTextElement el={el} ctx={ctx} />;
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN UNIVERSAL SCENE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export const UniversalScene: React.FC<UniversalSceneProps> = ({
  config,
  theme,
  title,
  narration,
  imageUrl,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isPortrait = aspectRatio === "9:16";
  const deco = getStyleDecorations(theme, isPortrait);
  const anim = getAnimationConfig(theme);

  // Debug: log what's being rendered (only on first frame to avoid spam)
  if (frame === 0) {
    console.log(`[UniversalScene] rendering: arrangement=${config.arrangement}, elements=${config.elements.length}, imageUrl=${imageUrl ? "yes" : "none"}, titleFontSize=${config.titleFontSize ?? "default"}, descFontSize=${config.descriptionFontSize ?? "default"}`);
    console.log(`[UniversalScene] theme: style=${theme.style}, density=${theme.patterns?.spacing?.density}, gridGap=${theme.patterns?.spacing?.gridGap}, contentPadding=${JSON.stringify(deco.contentPadding)}`);
  }

  const sceneImageUrl =
    typeof imageUrl === "string" && hasUsableImageUrl(imageUrl)
      ? imageUrl.trim()
      : undefined;

  // Inject title/narration/imageUrl into elements if not already present
  const elements = config.elements.map((el) => {
    if (el.type === "heading" && !el.content.text) {
      return { ...el, content: { ...el.content, text: title } };
    }
    if (el.type === "body-text" && !el.content.text) {
      return { ...el, content: { ...el.content, text: narration } };
    }
    if (el.type === "image" && sceneImageUrl && !hasUsableImageUrl(el.content.imageUrl)) {
      return { ...el, content: { ...el.content, imageUrl: sceneImageUrl } };
    }
    return el;
  });

  // Auto-inject image if available and not already used by any element or background
  let effectiveConfig = config;
  const hasImageElement = elements.some(
    (el) => el.type === "image" && hasUsableImageUrl(el.content.imageUrl),
  );
  const bgIsImage =
    config.background?.type === "image" &&
    hasUsableImageUrl(config.background.imageUrl);

  if (sceneImageUrl && !hasImageElement && !bgIsImage) {
    const splitArrangements = [
      "split-left",
      "split-right",
      "asymmetric-left",
      "asymmetric-right",
    ];
    if (splitArrangements.includes(config.arrangement)) {
      // Split layouts: add as panel element in second zone
      elements.push({
        type: "image",
        content: { imageUrl: sceneImageUrl },
        emphasis: "secondary",
      });
    } else if (["top-bottom", "stacked"].includes(config.arrangement)) {
      // Vertical layouts: insert image between heading and body text
      const insertIdx = Math.min(1, elements.length);
      elements.splice(insertIdx, 0, {
        type: "image",
        content: { imageUrl: sceneImageUrl },
        size: "large",
        emphasis: "secondary",
      });
    } else {
      // Center/grid: use as background with overlay
      effectiveConfig = {
        ...config,
        background: { type: "image" as const, imageUrl: sceneImageUrl },
      };
    }
  }

  // Also inject imageUrl into background if it references one but has no URL
  const resolvedConfig = {
    ...effectiveConfig,
    background:
      effectiveConfig.background?.type === "image" &&
      !hasUsableImageUrl(effectiveConfig.background.imageUrl) &&
      sceneImageUrl
        ? { ...effectiveConfig.background, imageUrl: sceneImageUrl }
        : effectiveConfig.background,
  };

  const ctx: ElementRenderCtx = {
    theme,
    deco,
    anim,
    frame,
    fps,
    isPortrait,
    elementIndex: 0,
    titleFontSize: config.titleFontSize,
    descriptionFontSize: config.descriptionFontSize,
  };

  // Style-specific container background
  const containerBg: React.CSSProperties =
    theme.style === "glass"
      ? { background: `linear-gradient(135deg, ${theme.colors.bg}ee, ${theme.colors.surface}cc)` }
      : theme.style === "neon"
        ? { background: theme.colors.bg, boxShadow: `inset 0 0 80px ${theme.colors.accent}15` }
        : theme.style === "soft"
          ? { background: `linear-gradient(180deg, ${theme.colors.bg}, ${theme.colors.surface})` }
          : { background: theme.colors.bg };

  return (
    <AbsoluteFill style={{ ...containerBg, ...deco.container }}>
      {/* Background layer */}
      {renderBackground(resolvedConfig, theme, frame)}

      {/* Decorations from AI-generated config */}
      {config.decorations && renderDecorations(config.decorations, theme)}

      {/* Pattern-based decorative elements from theme */}
      {getDecorativeElements(theme).map((dec, i) => (
        <div key={`pattern-dec-${i}`} style={dec.style} />
      ))}

      {/* Content area */}
      <div
        style={{
          ...getArrangementStyle(config.arrangement, isPortrait),
          position: "relative",
          zIndex: 2,
          ...deco.contentPadding,
          // Use theme-aware gap for vertical layouts
          ...(["stacked", "top-bottom"].includes(config.arrangement)
            ? { gap: deco.gridGap }
            : {}),
        }}
      >
        {elements.map((el, i) => (
          <div key={i}>
            {renderElement(el, { ...ctx, elementIndex: i })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
