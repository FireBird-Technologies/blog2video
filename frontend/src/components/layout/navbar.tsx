import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import DiscountBanner from "../DiscountBanner";
import ExploreButton from "../ExploreButton";
import { notestackUrl } from "../../config/siblingSites";
import ChromeExtensionButton from "../ChromeExtensionButton";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const goToDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/dashboard?show_form=0", { replace: false });
  };

  return (
    <nav className="border-b border-white/20 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
      {/* Discount banner — only for free tier users, aligned with navbar width */}
      {/* <DiscountBanner containerClassName="max-w-7xl" visible={user.plan === "free"} /> */}

      <div className="max-w-7xl mx-auto px-6 pt-5 pb-3 flex items-center justify-between gap-4">
        <Link
          to="/dashboard?show_form=0"
          onClick={goToDashboard}
          className="group flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[11px]">
            B2V
          </div>
          <span className="text-lg font-semibold text-gray-900">Blog2Video</span>
          <span className="text-xs text-gray-400 group-hover:text-purple-600 transition-colors">Dashboard</span>
        </Link>
        <div className="flex items-center gap-4">

          {/* Templates link */}
          <Link
            to="/template-showcase"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Templates
          </Link>

          {/* Billing link */}
          <Link
            to="/subscription"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Billing
          </Link>

          {/* API docs link */}
          <Link
            to="/api-docs"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            API docs
          </Link>
{/*
          <Link
            to="/template-studio"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Template Studio
          </Link> */}

          {/* Chrome extension CTA — next to Explore; hidden in Safari/Firefox/mobile */}
          <ChromeExtensionButton className="hidden sm:inline-flex" />

          {/* Explore (notestack.ai) */}
          <ExploreButton href={notestackUrl("app_navbar")} className="text-sm px-3.5 py-1.5" />

          {/* Usage */}
          <span className="hidden sm:block text-xs text-gray-400">
            {user.videos_used_this_period}/{user.video_limit} videos
          </span>

          {/* Mobile hamburger */}
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-900 rounded-lg transition-colors"
              aria-expanded={menuOpen}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 py-1.5 w-64 bg-white rounded-xl border border-gray-200/80 shadow-lg z-50">
                  <ChromeExtensionButton variant="row" onClick={() => setMenuOpen(false)} />
                  <Link to="/template-showcase" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">Templates</Link>
                  <Link to="/subscription" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">Billing</Link>
                  <Link to="/api-docs" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">API docs</Link>
                  <div className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100 mt-1">
                    {user.videos_used_this_period}/{user.video_limit} videos used
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User avatar */}
          <div className="flex items-center gap-3" data-tour="account-menu">
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

