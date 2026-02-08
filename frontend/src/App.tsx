import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import Subscription from "./pages/Subscription";

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

function AppNavbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="border-b border-white/20 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[11px]">
            B2V
          </div>
          <span className="text-lg font-semibold text-gray-900">Blog2Video</span>
        </a>
        <div className="flex items-center gap-4">
          {/* Pricing link */}
          <a href="/pricing" className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors">
            Pricing
          </a>

          {/* Billing link */}
          <a href="/subscription" className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors">
            Billing
          </a>

          {/* Usage */}
          <span className="hidden sm:block text-xs text-gray-400">
            {user.videos_used_this_period}/{user.video_limit} videos
          </span>

          {/* User avatar */}
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-500">
                {user.name[0]}
              </div>
            )}
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
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
      <AppNavbar />

      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <Landing />}
        />
        <Route path="/pricing" element={<Pricing />} />

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

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
