/**
 * Entry for the standalone video player (embed/index.html), served at
 * /embed/<token> and the older /preview/<token>.
 *
 * Deliberately NOT the web app: no router, auth, navbar, popups, analytics or
 * telemetry. A viewer who is signed in to blog2video in the same browser must
 * still see only the video, and the page should load as little as possible.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import EmbedPreviewPage from "../pages/EmbedPreviewPage";

function tokenFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/(?:embed|preview)\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EmbedPreviewPage token={tokenFromPath(window.location.pathname)} />
  </React.StrictMode>,
);
