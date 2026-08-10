import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./hooks/useAuth";
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
import HelpHub from "./pages/HelpHub";
import NotFoundPage from "./pages/NotFoundPage";
import { marketingPages } from "./content/siteContent";
import ScrollToTop from "./components/layout/ScrollToTop";
import EmbedPreviewPage from "./pages/EmbedPreviewPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { trackPageView } from "./gtag";

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
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    trackPageView(path);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ScrollToTop />

      <Routes>
        <Route path="/" element={<PdfLanding />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        {/* PDF2Video's own blog — see content/blogPosts.ts. Currently empty;
            new posts go here, never a copy of a blog2video.app article. */}
        <Route path="/blogs" element={<Blog />} />
        <Route path="/blogs/:slug" element={<BlogPostPage />} />
        {/* /tools and /help exist ONLY as empty, noindex hub pages so the nav
            items resolve instead of 404ing. They deliberately render no article
            or tool content and link out to blog2video.app instead: this
            deployment must never serve the same long-form content that's
            indexed there, or Google can flag it as duplicate content across two
            domains. Add PDF2Video-original content here before removing
            noindex. */}
        <Route path="/tools" element={<ToolsHub />} />
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
