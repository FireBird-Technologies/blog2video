import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ErrorModalProvider } from "./contexts/ErrorModalContext";
import { NoticeModalProvider } from "./contexts/NoticeModalContext";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import Subscription from "./pages/Subscription";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import BlogPostPage from "./pages/BlogPostPage";
import ToolsHub from "./pages/ToolsHub";
import ToolPage from "./pages/ToolPage";
import SubstackDirectoryNichePage from "./pages/SubstackDirectoryNichePage";
import SubstackPublicationPage from "./pages/SubstackPublicationPage";
import TemplateStudio from "./pages/TemplateStudio";
import Navbar from "./components/layout/navbar";
import MarketingPageView from "./pages/MarketingPageView";
import TemplatePageView from "./pages/TemplatePageView";
import NotFoundPage from "./pages/NotFoundPage";
import { marketingPages } from "./content/siteContent";
import PasswordProtectedRoute from "./components/layout/PasswordProtectedRoute";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {user && <Navbar />}

      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <Landing />}
        />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/blogs" element={<Blog />} />
        <Route path="/blogs/:slug" element={<BlogPostPage />} />
        <Route path="/tools" element={<ToolsHub />} />
        <Route
          path="/tools/substack-directory/publication/:publicationSlug"
          element={<SubstackPublicationPage />}
        />
        <Route
          path="/tools/substack-directory/:nicheSlug/pricing/:pricingSlug"
          element={<SubstackDirectoryNichePage />}
        />
        <Route
          path="/tools/substack-directory/:nicheSlug"
          element={<SubstackDirectoryNichePage />}
        />
        <Route path="/tools/:slug" element={<ToolPage />} />
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
          path="/template-studio-editing-feature"
          element={
            <ProtectedRoute>
              <PasswordProtectedRoute redirectTo="/">
                <TemplateStudio />
              </PasswordProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ErrorModalProvider>
        <NoticeModalProvider>
          <AppRoutes />
        </NoticeModalProvider>
      </ErrorModalProvider>
    </AuthProvider>
  );
}

export default App;
