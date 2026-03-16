import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import DiscountBanner from "../DiscountBanner";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const goToDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/dashboard?show_form=0", { replace: false });
  };

  return (
    <nav className="border-b border-white/20 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
      {/* Discount banner — only for free tier users, aligned with navbar width */}
      <DiscountBanner containerClassName="max-w-7xl" visible={user.plan === "free"} />

      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link
          to="/dashboard?show_form=0"
          onClick={goToDashboard}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[11px]">
            B2V
          </div>
          <span className="text-lg font-semibold text-gray-900">Blog2Video</span>
        </Link>
        <div className="flex items-center gap-4">
          {/* Pricing link */}
          <Link
            to="/pricing"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Pricing
          </Link>

          {/* Blogs link */}
          <Link
            to="/blogs"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Blogs
          </Link>

          {/* Billing link */}
          <Link
            to="/subscription"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Billing
          </Link>
{/* 
          <Link
            to="/template-studio"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Template Studio
          </Link> */}

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

