import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered in place of the preview when it throws. Defaults to a neutral box. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Wraps a single template preview. A Remotion <Player> that fails to
 * initialise (common on memory-constrained mobile browsers) throws during
 * render; without a boundary that error unwinds the whole React tree and the
 * page goes blank ("page can't load"). Catching it here keeps the failure
 * scoped to the one card so the carousel — and the rest of the page — stays up.
 */
export default class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Unknown error" };
  }

  componentDidCatch(error: Error) {
    // The default fallback used to be a bare grey box with NO message, so a
    // scene that threw in the browser looked identical to one that simply had
    // nothing to show — a broken template gave no diagnostic at all, and
    // tracking one down took a live HTTP probe. Log it and show it.
    console.error("[PreviewErrorBoundary] preview threw:", error);
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 16,
              textAlign: "center",
            }}
          >
            <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
              Preview failed to render
            </span>
            <span
              style={{
                color: "#6b7280",
                fontSize: 11,
                maxWidth: "90%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {this.state.message}
            </span>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
