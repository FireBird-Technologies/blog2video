import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { CraftedTemplatesProvider } from "./contexts/CraftedTemplatesContext";
import { ErrorModalProvider } from "./contexts/ErrorModalContext";
import { NoticeModalProvider } from "./contexts/NoticeModalContext";
import { SupportTourProvider } from "./components/support/SupportTourContext";
import { SupportWidget } from "./components/support/SupportWidget";
import { UIHighlightOverlay } from "./components/support/UIHighlightOverlay";
import PdfLanding from "./pages/PdfLanding";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import BlogPostPage from "./pages/BlogPostPage";
import MarketingPageView from "./pages/MarketingPageView";
import TemplatePageView from "./pages/TemplatePageView";
import ToolsHub from "./pages/ToolsHub";
import ToolPage from "./pages/ToolPage";
import HelpHub from "./pages/HelpHub";
import NotFoundPage from "./pages/NotFoundPage";
import { marketingPages } from "./content/siteContent";
import ScrollToTop from "./components/layout/ScrollToTop";
import EmbedPreviewPage from "./pages/EmbedPreviewPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { trackPageView } from "./gtag";
import { trackMetaPageView } from "./meta-pixel";
import ConsentBanner from "./components/ConsentBanner";

/**
 * This deployment is landing-page-only: pdf2vid.com sells the product and
 * signs users in, but the actual app (dashboard, project editor, everything
 * post-login) only ever runs on blog2video.app. See PdfLanding.tsx's
 * handleGoogleSuccess for the cross-domain token handoff, and
 * ../frontend/src/App.tsx's AppRoutes for the receiving side.
 *
 * There is deliberately no ProtectedRoute, no /dashboard, /project/:id,
 * /subscription, /survey, /mcp-connector, /template-studio-editing-feature,
 * or /invite/:token here — none of that exists on this domain.
 */
function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    trackPageView(path);
    trackMetaPageView();
  }, [location.pathname, location.search]);

  // Cookie consent banner only shows on the landing page, not on every route.
  const isLandingPath = location.pathname === "/";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ScrollToTop />
      {isLandingPath && <ConsentBanner isLoggedIn={Boolean(user)} />}

      <Routes>
        <Route path="/" element={<PdfLanding />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        {/* PDF2Video's own blog — see content/blogPosts.ts. Currently empty;
            new posts go here, never a copy of a blog2video.app article. */}
        <Route path="/blogs" element={<Blog />} />
        <Route path="/blogs/:slug" element={<BlogPostPage />} />
        {/* /tools is PDF2Video's own — five widgets that exist only on this
            domain, with original copy (content/tools.ts,
            components/tools/). It is indexable for that reason.
            /help is still an empty, noindex hub so its nav item resolves
            instead of 404ing: those articles ARE a copy of blog2video.app's,
            and a second indexed copy across two domains is the duplicate
            content risk this deployment exists to avoid. */}
        <Route path="/tools" element={<ToolsHub />} />
        <Route path="/tools/:slug" element={<ToolPage />} />
        <Route path="/help" element={<HelpHub />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        {/* No "template" category pages exist in this deployment's
            marketingPages (individual /templates/:slug pages were removed —
            see siteContent.ts), so every entry renders as MarketingPageView. */}
        {/* Template pages get their own view (strip + live preview + layout
            list); everything else renders as a standard marketing page. Same
            split as ../frontend/src/App.tsx. */}
        {marketingPages.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={page.category === "template" ? <TemplatePageView /> : <MarketingPageView />}
          />
        ))}

        {/* Public embed preview — no auth required, and no dependency on the
            (removed) post-login app, so it's safe to keep here. */}
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
