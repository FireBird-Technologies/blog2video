import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassCode — Enhanced Professional Version
 * 
 * Improvements:
 * - Line-by-line typewriter effect
 * - Syntax highlighting colors
 * - Professional terminal chrome
 * - Blinking cursor animation
 * - Line numbers with proper spacing
 * - Copy button indication
 * - Language badge styling
 */

export const GlassCode: React.FC<NightfallLayoutProps> = (props) => {
  const {
    title,
    accentColor,
    bgColor,
    textColor,
    codeLines,
    codeLanguage = "",
    aspectRatio,
    titleFontSize,
    descriptionFontSize,
  } = props ?? {};

  const frame = useCurrentFrame();
  const { height: compHeight } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Portrait: code box height 240vh; below 600px composition height → grey bg
  const HEIGHT_BREAKPOINT = 600;
  const useGreyBg = compHeight < HEIGHT_BREAKPOINT;

  // Defensive defaults for colors (can be undefined from layoutProps spread)
  const safeAccentColor = accentColor && typeof accentColor === "string" ? accentColor : "#818CF8";
  const safeTextColor = textColor && typeof textColor === "string" ? textColor : "#E2E8F0";

  // Guard against null, undefined, or non-array (e.g. from project layoutProps)
  const safeCodeLines: string[] = Array.isArray(codeLines)
    ? codeLines.map((l) => (typeof l === "string" ? l : String(l ?? "")))
    : [];

  // Card entrance
  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 75 },
  });

  const cardOpacity = interpolate(
    frame,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Code lines reveal progress (guard: empty array would give [20,20] input range → division by zero)
  const lineCount = Math.max(1, safeCodeLines.length);
  const linesRevealed = interpolate(
    frame,
    [20, 20 + Math.min(lineCount * 10, 80)],
    [0, lineCount],
    { extrapolateRight: "clamp" }
  );

  // Cursor blink
  const cursorVisible = Math.floor(frame / 20) % 2 === 0;

  // Syntax highlighting helper (enhanced)
  const getTokenColor = (token: string, context: { inString?: boolean; inComment?: boolean } = {}): string => {
    if (token == null || typeof token !== "string") return safeTextColor;
    // Comments (highest priority)
    if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("*") || context.inComment) {
      return `${safeTextColor}60`;
    }
    // Strings
    if (/^["'`]/.test(token) || context.inString) {
      return "#50FA7B";
    }
    // Keywords
    const keywords = [
      "const", "let", "var", "function", "return", "if", "else", "for", "while", 
      "import", "export", "from", "class", "async", "await", "try", "catch", 
      "finally", "throw", "new", "this", "super", "extends", "implements", 
      "interface", "type", "enum", "namespace", "module", "declare", "public", 
      "private", "protected", "static", "readonly", "abstract", "get", "set",
      "true", "false", "null", "undefined", "break", "continue", "switch", "case",
      "default", "do", "with", "in", "of", "instanceof", "typeof", "void", "delete"
    ];
    if (keywords.includes(token.toLowerCase())) {
      return safeAccentColor;
    }
    // Numbers (including decimals and hex)
    if (/^\d+\.?\d*$/.test(token) || /^0x[\da-f]+$/i.test(token) || /^0b[01]+$/i.test(token)) {
      return "#BD93F9";
    }
    // Functions (word followed by opening parenthesis)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(token)) {
      return "#8BE9FD";
    }
    // Operators and punctuation
    if (/^[+\-*/%=<>!&|^~?:,;.()[\]{}]$/.test(token)) {
      return `${safeTextColor}80`;
    }
    return safeTextColor;
  };

  // Tokenize a line of code
  const tokenizeLine = (line: string): Array<{ text: string; color: string }> => {
    const tokens: Array<{ text: string; color: string }> = [];
    let currentToken = "";
    let inString = false;
    let stringChar = "";
    let inComment = false;
    let inSingleLineComment = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      // Handle single-line comments
      if (!inString && char === "/" && nextChar === "/") {
        if (currentToken) {
          tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString, inComment }) });
          currentToken = "";
        }
        inSingleLineComment = true;
        currentToken = line.substring(i);
        tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inComment: true }) });
        break;
      }
      
      // Handle multi-line comment start
      if (!inString && char === "/" && nextChar === "*") {
        if (currentToken) {
          tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString, inComment }) });
          currentToken = "";
        }
        inComment = true;
        currentToken = char;
        continue;
      }
      
      // Handle multi-line comment end
      if (inComment && char === "*" && nextChar === "/") {
        currentToken += char + nextChar;
        tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inComment: true }) });
        currentToken = "";
        inComment = false;
        i++; // Skip next char
        continue;
      }
      
      if (inComment) {
        currentToken += char;
        continue;
      }
      
      // Handle strings
      if ((char === '"' || char === "'" || char === "`") && (i === 0 || line[i - 1] !== "\\")) {
        if (!inString) {
          if (currentToken) {
            tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString, inComment }) });
            currentToken = "";
          }
          inString = true;
          stringChar = char;
          currentToken = char;
        } else if (char === stringChar) {
          currentToken += char;
          tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString: true, inComment }) });
          currentToken = "";
          inString = false;
          stringChar = "";
        } else {
          currentToken += char;
        }
        continue;
      }
      
      if (inString) {
        currentToken += char;
        continue;
      }
      
      // Handle whitespace and word boundaries
      if (/\s/.test(char)) {
        if (currentToken) {
          tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString, inComment }) });
          currentToken = "";
        }
        tokens.push({ text: char, color: safeTextColor });
      } else if (/[+\-*/%=<>!&|^~?:,;.()[\]{}]/.test(char)) {
        // Operators and punctuation
        if (currentToken) {
          tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString, inComment }) });
          currentToken = "";
        }
        tokens.push({ text: char, color: getTokenColor(char, { inString, inComment }) });
      } else {
        currentToken += char;
      }
    }
    
    // Add remaining token
    if (currentToken) {
      tokens.push({ text: currentToken, color: getTokenColor(currentToken, { inString, inComment }) });
    }
    
    return tokens;
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 100,
        }}
      >
        <div
          style={{
            ...glassCardStyle(safeAccentColor, 0.12),
            display: "flex",
            flexDirection: "column",
            width: p ? "98%" : "95%",
            maxWidth: 1200,
            height: p ? "200vh" : "auto",
            minHeight: p ? 240 : 500,
            overflow: "hidden",
            opacity: cardOpacity,
            transform: `translateY(${(1 - cardY) * 40}px)`,
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(255, 255, 255, 0.05)
            `,
          }}
        >
          {/* Terminal Header */}
          <div
            style={{
              padding: p ? "14px 20px" : "16px 24px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            {/* Traffic lights */}
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  width: p ? 10 : 12,
                  height: p ? 10 : 12,
                  borderRadius: "50%",
                  backgroundColor: "#FF5F57",
                  boxShadow: "0 0 8px #FF5F5740",
                }}
              />
              <div
                style={{
                  width: p ? 10 : 12,
                  height: p ? 10 : 12,
                  borderRadius: "50%",
                  backgroundColor: "#FEBC2E",
                  boxShadow: "0 0 8px #FEBC2E40",
                }}
              />
              <div
                style={{
                  width: p ? 10 : 12,
                  height: p ? 10 : 12,
                  borderRadius: "50%",
                  backgroundColor: "#28C840",
                  boxShadow: "0 0 8px #28C84040",
                }}
              />
            </div>

            {/* Language badge and title */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {title && (
                <span
                  style={{
                    fontSize: titleFontSize ?? (p ? 51 : 55),
                    color: safeTextColor,
                    opacity: 0.6,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {title}
                </span>
              )}
              {codeLanguage && (
                <span
                  style={{
                    fontSize: p ? 11 : 12,
                    color: safeAccentColor,
                    fontFamily: "'Fira Code', monospace",
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: `${safeAccentColor}25`,
                    border: `1px solid ${safeAccentColor}40`,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {codeLanguage}
                </span>
              )}
            </div>

            {/* Copy indicator */}
            <div
              style={{
                fontSize: p ? 11 : 12,
                color: `${safeTextColor}50`,
                fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
              }}
            >
              ⌘C
            </div>
          </div>

          {/* Code Content — grey when composition height below breakpoint */}
          <div
            style={{
              padding: p ? "20px 16px" : "24px 28px",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: descriptionFontSize ?? 22,
              lineHeight: 1.85,
              backgroundColor: useGreyBg ? "rgba(75, 85, 99, 0.4)" : "rgba(0, 0, 0, 0.2)",
              minHeight: p ? 240 : 300,
              flex: 1,
              overflow: "auto",
            }}
          >
            {safeCodeLines.map((line, i) => {
              const isRevealed = i < Math.floor(linesRevealed);
              const isCurrentLine = i === Math.floor(linesRevealed);
              
              return (
                <div
                  key={i}
                  style={{
                    color: isRevealed ? "#E2E8F0" : "rgba(255,255,255,0.15)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    opacity: isRevealed ? 1 : 0.3,
                    transition: "opacity 0.2s",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 0,
                  }}
                >
                  {/* Line number */}
                  <span
                    style={{
                      color: isRevealed ? `${safeAccentColor}60` : "rgba(255,255,255,0.2)",
                      marginRight: p ? 12 : 20,
                      minWidth: p ? 24 : 32,
                      textAlign: "right",
                      fontSize: p ? 12 : 14,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Code line with syntax highlighting — minWidth 0 so flex child can shrink and wrap */}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {(() => {
                      try {
                        const tokens = tokenizeLine(typeof line === "string" ? line : String(line ?? ""));
                        return tokens.map((token, tokenIdx) => (
                          <span
                            key={tokenIdx}
                            style={{
                              color: isRevealed ? token.color : `${token.color}30`,
                            }}
                          >
                            {token.text}
                          </span>
                        ));
                      } catch {
                        return <span style={{ color: safeTextColor }}>{String(line ?? "")}</span>;
                      }
                    })()}
                  </span>

                  {/* Blinking cursor on current line */}
                  {isCurrentLine && cursorVisible && (
                    <span
                      style={{
                        marginLeft: 4,
                        color: safeAccentColor,
                        fontWeight: 700,
                        fontSize: descriptionFontSize ?? (p ? 51 : 40),
                      }}
                    >
                      |
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
