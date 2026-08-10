import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { topNavLinks } from "../../content/siteContent";
import { useAuth } from "../../hooks/useAuth";

const LOGO_TEXT = "P2V";
const SITE_NAME = "PDF2Video";

/**
 * No dropdowns — this deployment has no per-template marketing pages (the
 * landing page's own carousel at PdfLanding.tsx#templates covers that), and
 * /tools is an intentionally empty hub, so a Tools menu would have nothing to
 * list. Every nav item is therefore a plain link/anchor. See
 * ../frontend/PublicHeader.tsx for the version with a Templates/Tools
 * dropdown, which this deployment doesn't need.
 */
export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (user) return null;

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
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
            {LOGO_TEXT}
          </div>
          <span className="text-xl font-semibold text-gray-900">{SITE_NAME}</span>
        </Link>

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
          <Link
            to="/contact"
            data-action="contact-link"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Contact
          </Link>
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
        </div>
      )}
    </nav>
  );
}
