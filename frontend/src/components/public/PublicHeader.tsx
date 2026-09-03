import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { templateMenuLinks, toolsMenuLinks, topNavLinks } from "../../content/siteContent";
import { useAuth } from "../../hooks/useAuth";
import { useBrand } from "../../brand/brand";
import DiscountBanner from "../DiscountBanner";

export default function PublicHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const activeBrand = useBrand();
  // On the blog2video domain the pdf2video landing lives at /pdf2video, so the
  // logo must return there rather than to the blog2video hero.
  const homePath =
    activeBrand.id === "pdf2video" && !window.location.hostname.includes("pdf2vid")
      ? "/pdf2video"
      : "/";
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileTemplatesOpen, setMobileTemplatesOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToolsOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isToolsActive = location.pathname === "/tools" || location.pathname.startsWith("/tools/");

  /**
   * Signing in from a /tools page keeps the visitor on that page, so keep the
   * marketing header rather than swapping to the app Navbar mid-session — the
   * app nav lists only /dashboard, /subscription and friends, so on a tools page
   * it reads as the site nav having vanished.
   *
   * Everywhere else the old behaviour stands: a signed-in user belongs in the
   * app, and App.tsx renders <Navbar /> for them. That file suppresses the app
   * Navbar on exactly this path check, so the two must stay in agreement or the
   * page renders two headers (or none).
   */
  if (user && !isToolsActive) return null;

  return (
    <nav className="bg-white/70 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/60">
      {/* Banner above navbar so it appears first on scroll */}
      {/* <DiscountBanner containerClassName="max-w-6xl" /> */}

      {/* ── Row 1: main nav ── */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Signed in (only reachable on /tools — see the guard above), the logo
            is the way out of the marketing site and into the app, which is where
            a logged-in user's "home" actually is, with an explicit Dashboard link
            beside it so the destination is not left to guesswork. Same origin, so
            a plain route change: App.tsx swaps in the app Navbar once the path is
            no longer under /tools. (pdf2vid.com needs a JWT handoff for the same
            jump — see ../../../frontend-pdf2video PublicHeader.) */}
        <div className="flex items-center gap-3">
          <Link to={user ? "/dashboard" : homePath} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
              {activeBrand.logoText}
            </div>
            <span className="text-xl font-semibold text-gray-900">{activeBrand.siteName}</span>
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-lg px-1 py-1 pt-3 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-purple-700"
            >
              Dashboard
            </Link>
          ) : null}
        </div>

        {/* Desktop nav. The links render for signed-in users too now that this
            header survives on /tools — otherwise that page would show a bare
            logo. Only the trailing CTA differs by auth state. */}
        <div className="hidden items-center gap-4 md:flex">
          {(
            <>
              {topNavLinks.map((link) =>
                link.label === "Templates" ? (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`text-sm transition-colors ${
                      location.pathname.startsWith("/templates") || location.pathname === "/custom-branded-video-templates"
                        ? "text-purple-700 font-medium"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Templates
                  </Link>
                ) : link.label === "Tools" ? (
                  <div key={link.href} ref={toolsDropdownRef} className="relative">
                    <button
                      onClick={() => setToolsOpen(!toolsOpen)}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        isToolsActive ? "text-purple-700 font-medium" : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Tools
                      <svg
                        className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {toolsOpen && (
                      <div className="absolute left-1/2 top-full mt-3 max-h-[70vh] w-56 -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                        {toolsMenuLinks.map((tool) => (
                          <Link
                            key={tool.href}
                            to={tool.href}
                            className={`block rounded-xl px-4 py-2.5 text-sm transition-colors ${
                              location.pathname === tool.href
                                ? "bg-purple-50 font-medium text-purple-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {tool.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`text-sm transition-colors ${
                      location.pathname === link.href
                        ? "text-purple-700 font-medium"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              )}
              {user ? (
                /* Mirrors the account corner in components/layout/navbar.tsx so
                   the two headers feel like one product. */
                <div className="flex items-center gap-3">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                      {user.name?.[0] ?? "?"}
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="text-xs text-gray-400 transition-colors hover:text-gray-900"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  to="/contact"
                  data-action="contact-link"
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
                >
                  Contact
                </Link>
              )}
            </>
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
          {topNavLinks.map((link) =>
            link.label === "Templates" ? (
              <div key={link.href} className="py-1">
                <button
                  type="button"
                  onClick={() => setMobileTemplatesOpen((o) => !o)}
                  className="flex w-full items-center justify-between py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <span className="font-medium">Templates</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${mobileTemplatesOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {mobileTemplatesOpen && (
                  <div className="max-h-[50vh] space-y-1 overflow-y-auto overscroll-contain pl-2 pb-1">
                    {templateMenuLinks.map((t) => (
                      <Link
                        key={t.href}
                        to={t.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block rounded-lg px-3 py-2 text-sm ${
                          location.pathname === t.href
                            ? "bg-purple-50 font-medium text-purple-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {t.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : link.label === "Tools" ? (
              <div key={link.href} className="py-1">
                <button
                  type="button"
                  onClick={() => setMobileToolsOpen((o) => !o)}
                  className="flex w-full items-center justify-between py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <span className="font-medium">Tools</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${mobileToolsOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {mobileToolsOpen && (
                  <div className="max-h-[50vh] space-y-1 overflow-y-auto overscroll-contain pl-2 pb-1">
                    {toolsMenuLinks.map((tool) => (
                      <Link
                        key={tool.href}
                        to={tool.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block rounded-lg px-3 py-2 text-sm ${
                          location.pathname === tool.href
                            ? "bg-purple-50 font-medium text-purple-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {tool.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block py-2 text-sm ${
                  location.pathname === link.href
                    ? "font-medium text-purple-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            )
          )}
          <Link
            to="/contact"
            className="mt-3 block rounded-lg bg-purple-600 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            Contact
          </Link>

          {/* The header's Dashboard link and account corner are desktop-only, so
              repeat them here — otherwise a signed-in visitor on a phone has no
              way into the app and no way to sign out. */}
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="mt-3 block rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-gray-700"
              >
                Dashboard
              </Link>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {user.name || "Signed in"}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="ml-3 flex-shrink-0 text-xs text-gray-400 transition-colors hover:text-gray-900"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </nav>
  );
}
