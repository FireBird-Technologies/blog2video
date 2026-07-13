import { Component, type ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import type { GeneratedSceneProps } from "./types";

interface Props {
  children: ReactNode;
  /** Scene colours, used to paint an on-brand fallback instead of a white void. */
  brandColors: GeneratedSceneProps["brandColors"];
  /** Text shown in the fallback (scene title / display text). */
  fallbackText?: string;
  /** Font applied to the fallback text so it matches the rest of the video. */
  fontFamily?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps a single AI-generated content variant. A variant that throws while
 * rendering (bad interpolate range, undefined access, etc.) would otherwise
 * unwind the entire <TransitionSeries> and blank the WHOLE video ("white broken
 * screen"). Catching it here scopes the failure to the one scene: the rest of
 * the video still renders, and this scene shows a neutral on-brand card.
 *
 * NOTE: this only catches RUNTIME render errors. A generated variant with a
 * SYNTAX error fails at esbuild bundle time (the module never compiles) and no
 * React boundary can help — that must be prevented at generation time.
 */
export default class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Surface it in render logs so a broken variant is diagnosable, not silent.
    console.error("[SceneErrorBoundary] generated scene threw:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AbsoluteFill
          style={{
            backgroundColor: this.props.brandColors.background,
            color: this.props.brandColors.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8%",
            textAlign: "center",
            fontFamily: this.props.fontFamily,
          }}
        >
          {this.props.fallbackText ? (
            <p style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
              {this.props.fallbackText}
            </p>
          ) : null}
        </AbsoluteFill>
      );
    }
    return this.props.children;
  }
}
