import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { getMe } from "./api/client";
import { CraftedTemplatesProvider } from "./contexts/CraftedTemplatesContext";
import { ErrorModalProvider } from "./contexts/ErrorModalContext";
import { NoticeModalProvider } from "./contexts/NoticeModalContext";
import { SupportTourProvider } from "./components/support/SupportTourContext";
import { SupportWidget } from "./components/support/SupportWidget";
import { UIHighlightOverlay } from "./components/support/UIHighlightOverlay";
import Landing from "./pages/Landing";
import PdfLanding from "./pages/PdfLanding";
import { applyFavicon, isPdfBrand, useBrand, markPdfOrigin } from "./brand/brand";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import Subscription from "./pages/Subscription";
import InviteOthers from "./pages/InviteOthers";
import AcceptInvite from "./pages/AcceptInvite";
import InviteDecisionModal from "./components/InviteDecisionModal";
import MarketingDesignerPopup from "./components/MarketingDesignerPopup";
import MobileMemoryWarningPopup from "./components/MobileMemoryWarningPopup";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import BlogPostPage from "./pages/BlogPostPage";
import HelpIndex from "./pages/HelpIndex";
import HelpPostPage from "./pages/HelpPostPage";
import ToolsHub from "./pages/ToolsHub";
import ToolPage from "./pages/ToolPage";
import TemplateStudio from "./pages/TemplateStudio";
import TemplatesShowcasePage from "./pages/TemplatesShowcasePage";

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}
import Navbar from "./components/layout/navbar";
import MarketingPageView from "./pages/MarketingPageView";
import TemplatePageView from "./pages/TemplatePageView";
import NotFoundPage from "./pages/NotFoundPage";
import { marketingPages } from "./content/siteContent";
import PasswordProtectedRoute from "./components/layout/PasswordProtectedRoute";
import ScrollToTop from "./components/layout/ScrollToTop";
import EmbedPreviewPage from "./pages/EmbedPreviewPage";
import FreeTemplatesPage from "./pages/FreeTemplatesPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import MCPConnector from "./pages/MCPConnector";
import { trackPageView } from "./gtag";

// Hidden poster-capture route (used by scripts/capture-posters.ts). Lazy so it
// stays out of the main bundle.
const CapturePage = lazy(() => import("./pages/CapturePage"));

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );
}

function hasHandoffToken(search: string): boolean {
  return new URLSearchParams(search).has("token");
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const handoffPending = hasHandoffToken(location.search) && !user;

  if (loading || handoffPending) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, login, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Tab icon follows the active brand, including when PdfLanding pins the
  // session brand mid-navigation (useBrand re-renders this on that change).
  const activeBrand = useBrand();
  useEffect(() => {
    applyFavicon(activeBrand);
  }, [activeBrand]);

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    trackPageView(path);
  }, [location.pathname, location.search]);

  // Keep in sync with the same check in components/public/PublicHeader.tsx.
  const isToolsPath =
    location.pathname === "/tools" || location.pathname.startsWith("/tools/");

  // Cross-domain handoff from pdf2vid.com (frontend-pdf2video/, a
  // landing-page-only deployment with no dashboard of its own — see its
  // PdfLanding.tsx/Pricing.tsx handleGoogleSuccess). A token arriving via
  // ?token= means the user just signed in there; localStorage can't carry
  // over across origins, so the JWT travels as a one-time URL param instead.
  // Consumed once, scrubbed from the URL immediately either way.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const handoffToken = params.get("token");
    if (!handoffToken || user) return;
    (async () => {
      // getMe() takes no args — the axios interceptor (api/client.ts) reads
      // localStorage["b2v_token"] directly, so the token must be written
      // BEFORE this call or the request goes out unauthenticated.
      localStorage.setItem("b2v_token", handoffToken);
      try {
        const res = await getMe();
        login(handoffToken, res.data); // re-sets token/user in React state, harmless
        // Cross-origin handoff from pdf2video — localStorage origin flag doesn't
        // survive the redirect, so set it here for sticky Upload-tab defaults.
        markPdfOrigin();
      } catch {
        localStorage.removeItem("b2v_token"); // invalid/expired handoff token
      } finally {
        const next = new URLSearchParams(location.search);
        next.delete("token");
        const qs = next.toString();
        navigate(qs ? `${location.pathname}?${qs}` : location.pathname, { replace: true });
      }
    })();
  }, [location.search]);

  // Resume a collaboration invite the user opened before signing in.
  useEffect(() => {
    if (!user) return;
    const pending = localStorage.getItem("b2v_pending_invite");
    if (pending && !location.pathname.startsWith("/invite/")) {
      localStorage.removeItem("b2v_pending_invite");
      navigate(`/invite/${pending}`, { replace: true });
    }
  }, [user, location.pathname, navigate]);

  // Hold the route tree until the cross-domain ?token= handoff resolves.
  // Otherwise ProtectedRoute sees no user yet and bounces to "/" (landing)
  // for a frame before login() completes.
  const handoffPending = hasHandoffToken(location.search) && !user;

  if (loading || handoffPending) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ScrollToTop />
      {/* /tools keeps its marketing header even when signed in — those pages are
          public content a logged-in user still browses, and the app Navbar (which
          lists only /dashboard, /subscription, …) would read as the site nav
          disappearing. PublicHeader mirrors this exact condition; change one and
          you must change the other, or a tools page renders two headers or none. */}
      {user && !isToolsPath && <Navbar />}
      {user && <InviteDecisionModal />}
      {user && <MarketingDesignerPopup />}
      {user && <MobileMemoryWarningPopup />}

      <Routes>
        {/* Hidden: poster capture (scripts/capture-posters.ts) */}
        <Route
          path="/_capture"
          element={
            <Suspense fallback={null}>
              <CapturePage />
            </Suspense>
          }
        />
        {/* Public. "/" serves whichever brand this deployment is running as
            (see src/brand/brand.ts); everything past sign-in is shared. */}
        <Route
          path="/"
          element={
            user ? <Navigate to="/dashboard" replace /> : isPdfBrand ? <PdfLanding /> : <Landing />
          }
        />
        {/* Brand preview route: reachable on both domains so the pdf2video
            landing is testable before DNS is live. Deliberately NOT
            "/pdf-to-video" — that path is an existing Blog2Video SEO page
            (corePages.ts) with inbound links from several others. */}
        <Route path="/pdf2video" element={<PdfLanding />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/blogs" element={<Blog />} />
        <Route path="/blogs/:slug" element={<BlogPostPage />} />
        <Route path="/help" element={<HelpIndex />} />
        <Route path="/help/:slug" element={<HelpPostPage />} />
        <Route path="/tools" element={<ToolsHub />} />
        <Route path="/tools/substack-directory/*" element={<ExternalRedirect to="https://bloghub.app" />} />
        <Route path="/tools/substack-directory" element={<ExternalRedirect to="https://bloghub.app" />} />
        <Route path="/tools/free-remotion-templates" element={<FreeTemplatesPage />} />
        <Route
          path="/template-showcase"
          element={
            <ProtectedRoute>
              <TemplatesShowcasePage />
            </ProtectedRoute>
          }
        />
        <Route path="/tools/:slug" element={<ToolPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        {marketingPages.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={page.category === "template" ? <TemplatePageView /> : <MarketingPageView />}
          />
        ))}

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <main className="max-w-7xl mx-auto px-6 py-8">
                <Dashboard />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id"
          element={
            <ProtectedRoute>
              <main className="max-w-7xl mx-auto px-6 py-8">
                <ProjectView />
              </main>
            </ProtectedRoute>
          }
        />
        {/* Collaboration invite accept link — public so AcceptInvite can stash the
            token and redirect an unauthenticated user to sign in, then auto-accept
            on return. */}
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <main className="max-w-7xl mx-auto px-6 py-8">
                <Subscription />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/survey"
          element={
            <ProtectedRoute>
              <main className="max-w-7xl mx-auto px-6 py-8">
                <InviteOthers />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mcp-connector"
          element={
            <ProtectedRoute>
              <MCPConnector />
            </ProtectedRoute>
          }
        />
        <Route
          path="/template-studio-editing-feature"
          element={
            <ProtectedRoute>
              <PasswordProtectedRoute redirectTo="/">
                <TemplateStudio />
              </PasswordProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Public embed preview — no auth required */}
        <Route path="/preview/:token" element={<EmbedPreviewPage />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CraftedTemplatesProvider>
        <ErrorModalProvider>
          <NoticeModalProvider>
          <SupportTourProvider>
              <AppRoutes />
            {/* The hidden /_capture route is screenshotted for template posters —
                the support widget would otherwise be baked into every image. */}
            {!window.location.pathname.startsWith("/_capture") && <SupportWidget />}
            <UIHighlightOverlay />
          </SupportTourProvider>
          </NoticeModalProvider>
        </ErrorModalProvider>
      </CraftedTemplatesProvider>
    </AuthProvider>
  );
}

export default App;
