import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import DiscountBanner from "../DiscountBanner";

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
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[11px]">
            B2V
          </div>
          <span className="text-lg font-semibold text-gray-900">Blog2Video</span>
        </Link>
        <div className="flex items-center gap-4">

          <Link
            to="/invite-others"
            className="hidden sm:relative sm:inline-flex items-center gap-1.5 mr-2 mt-1 text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
            Share B2V
            <span className="absolute -top-4 -right-5 bg-purple-600 text-white text-[9px] font-semibold leading-none px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
              Get 3 free videos
            </span>
          </Link>

          {/* MCP Connector link */}
          <Link
            to="/mcp-connector"
            className="hidden sm:block text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            MCP Connector
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
                <div className="absolute right-0 top-full mt-2 py-1.5 w-52 bg-white rounded-xl border border-gray-200/80 shadow-lg z-50">
                  <Link to="/invite-others" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                    </svg>
                    Share B2V
                    <span className="ml-auto text-[9px] font-semibold bg-purple-600 text-white px-1.5 rounded-full">3 free videos</span>
                  </Link>
                  <Link to="/mcp-connector" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">MCP Connector</Link>
                  <Link to="/subscription" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">Billing</Link>
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

