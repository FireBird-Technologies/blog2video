import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered in place of the preview when it throws. Defaults to a neutral box. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps a single template preview. A Remotion <Player> that fails to
 * initialise (common on memory-constrained mobile browsers) throws during
 * render; without a boundary that error unwinds the whole React tree and the
 * page goes blank ("page can't load"). Catching it here keeps the failure
 * scoped to the one card so the carousel — and the rest of the page — stays up.
 */
export default class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#f3f4f6",
              borderRadius: 12,
            }}
          />
        )
      );
    }
    return this.props.children;
  }
}
