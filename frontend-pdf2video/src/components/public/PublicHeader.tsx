import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { topNavLinks } from "../../content/siteContent";
import { useAuth } from "../../hooks/useAuth";
import { buildBlog2VideoHandoffUrl } from "../../config/urls";

const LOGO_TEXT = "P2V";
const SITE_NAME = "PDF2Video";

/** Initial shown when a user has no Google avatar (or it fails to load). */
function initialOf(user: { name?: string; email?: string }): string {
  return (user.name?.trim() || user.email || "?").charAt(0).toUpperCase();
}

/**
 * Avatar + sign out for a signed-in visitor.
 *
 * Only the /tools widgets ever produce a session on this domain (everywhere else
 * signs in and immediately hands off to blog2video.app), so without this the
 * header gave a signed-in user no sign they were signed in and no way out.
 * Deliberately mirrors ../frontend/src/components/layout/navbar.tsx's account
 * corner — avatar beside a quiet text button, no dropdown — so the two
 * properties feel like one product. The route into the app lives on the logo.
 */
function AccountControl() {
  const { user, logout } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {user.picture && !imageFailed ? (
        <img
          src={user.picture}
          alt={user.name}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
          {initialOf(user)}
        </div>
      )}
      <button
        type="button"
        onClick={logout}
        className="text-xs text-gray-400 transition-colors hover:text-gray-900"
      >
        Sign out
      </button>
    </div>
  );
}

/**
 * No dropdowns — this deployment has no per-template marketing pages (the
 * landing page's own carousel at PdfLanding.tsx#templates covers that), and
 * /tools is an intentionally empty hub, so a Tools menu would have nothing to
 * list. Every nav item is therefore a plain link/anchor. See
 * ../frontend/PublicHeader.tsx for the version with a Templates/Tools
 * dropdown, which this deployment doesn't need.
 *
 * RENDERS FOR SIGNED-IN USERS TOO — deliberately. This used to bail out on
 * `if (user) return null`, which was safe only while every sign-in on this
 * domain immediately handed the JWT to blog2video.app and left (see
 * PdfLanding.handleGoogleSuccess): nobody was ever signed in *here*. The /tools
 * widgets broke that assumption on purpose — they call /api/free-tools/* on this
 * origin, so LoginGate signs the user in and stays put — and the old guard then
 * unmounted the nav mid-session, leaving those pages with no header at all
 * (unlike ../frontend, this deployment has no app Navbar to take over).
 * Restoring the guard would reintroduce that bug.
 */
export default function PublicHeader() {
  const location = useLocation();
  const { user, token, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /**
   * "/#templates" is an on-page anchor, so it never equals a pathname and is
   * only ever active on the landing page itself. Everything else highlights on
   * its own path plus nested children (e.g. /for-researchers/pdf-to-video keeps
   * "Use Cases" lit).
   */
  const isLinkActive = (href: string) => {
    if (href.startsWith("/#")) {
      return location.pathname === "/" && location.hash === href.slice(1);
    }
    // "Templates" points at one specific template page, but must stay lit on
    // every /templates/* page reached through the strip.
    if (href.startsWith("/templates/")) {
      return location.pathname.startsWith("/templates/");
    }
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="bg-white/70 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/60">
      {/* ── Row 1: main nav ── */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* The brand always stays PDF2Video — this is still that site. Signed in,
            a separate /dashboard link sits beside it and carries the JWT (the same
            handoff the landing page performs), so it opens the app authenticated
            rather than bouncing off a sign-in screen. */}
        <div className="flex items-center gap-3">
          {/* Signed in, the logo goes where Dashboard goes. Sending it to "/"
              instead would drop the user on the marketing landing page, which
              runs its own header showing "Sign in" — reading, wrongly, as having
              been logged out. Signed out it is the ordinary home link. */}
          {user && token ? (
            <a href={buildBlog2VideoHandoffUrl(token)} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
                {LOGO_TEXT}
              </div>
              <span className="text-xl font-semibold text-gray-900">{SITE_NAME}</span>
            </a>
          ) : (
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
                {LOGO_TEXT}
              </div>
              <span className="text-xl font-semibold text-gray-900">{SITE_NAME}</span>
            </Link>
          )}
          {user && token ? (
            <a
              href={buildBlog2VideoHandoffUrl(token)}
              className="rounded-lg px-1 py-1 pt-3 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-purple-700"
            >
              Dashboard
            </a>
          ) : null}
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 md:flex">
          {topNavLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`text-sm transition-colors ${
                isLinkActive(link.href)
                  ? "text-purple-700 font-medium"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {/* Signed in only ever happens via the /tools widgets on this domain;
              the account control replaces the Contact CTA so the header actually
              reflects that state. */}
          {user ? (
            <AccountControl />
          ) : (
            <Link
              to="/contact"
              data-action="contact-link"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              Contact
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 pb-6 pt-4 md:hidden">
          {topNavLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-sm ${
                isLinkActive(link.href)
                  ? "font-medium text-purple-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/contact"
            className="mt-3 block rounded-lg bg-purple-600 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            Contact
          </Link>

          {/* The header's /dashboard link is desktop-only, so repeat it here. */}
          {user && token ? (
            <a
              href={buildBlog2VideoHandoffUrl(token)}
              className="mt-3 block rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-gray-700"
            >
              /dashboard
            </a>
          ) : null}

          {user ? (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {user.name || "Signed in"}
                </p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="ml-3 flex-shrink-0 text-xs text-gray-400 transition-colors hover:text-gray-900"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      )}
    </nav>
  );
}
