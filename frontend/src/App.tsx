import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { CraftedTemplatesProvider } from "./contexts/CraftedTemplatesContext";
import { ErrorModalProvider } from "./contexts/ErrorModalContext";
import { NoticeModalProvider } from "./contexts/NoticeModalContext";
import { SupportTourProvider } from "./components/support/SupportTourContext";
import { SupportWidget } from "./components/support/SupportWidget";
import { UIHighlightOverlay } from "./components/support/UIHighlightOverlay";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import Subscription from "./pages/Subscription";
import InviteOthers from "./pages/InviteOthers";
import AcceptInvite from "./pages/AcceptInvite";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    trackPageView(path);
  }, [location.pathname, location.search]);

  // Resume a collaboration invite the user opened before signing in.
  useEffect(() => {
    if (!user) return;
    const pending = localStorage.getItem("b2v_pending_invite");
    if (pending && !location.pathname.startsWith("/invite/")) {
      localStorage.removeItem("b2v_pending_invite");
      navigate(`/invite/${pending}`, { replace: true });
    }
  }, [user, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ScrollToTop />
      {user && <Navbar />}

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
        {/* Public */}
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <Landing />}
        />
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
            <SupportWidget />
            <UIHighlightOverlay />
          </SupportTourProvider>
          </NoticeModalProvider>
        </ErrorModalProvider>
      </CraftedTemplatesProvider>
    </AuthProvider>
  );
}

export default App;
