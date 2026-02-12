import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const Navbar = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="border-b border-white/20 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[11px]">
            B2V
          </div>
          <span className="text-lg font-semibold text-gray-900">Blog2Video</span>
        </Link>
        <div className="flex items-center gap-4">
          {/* Pricing link */}

          <Link
            to="/contact"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Contact
          </Link>

          <Link
            to="/pricing"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Pricing
          </Link>

          {/* Billing link */}
          <Link
            to="/subscription"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Billing
          </Link>

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
};

export default Navbar;

