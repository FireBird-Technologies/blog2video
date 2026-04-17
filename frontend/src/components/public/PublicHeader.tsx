import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { templateMenuLinks, toolsMenuLinks, topNavLinks } from "../../content/siteContent";
import { useAuth } from "../../hooks/useAuth";
import DiscountBanner from "../DiscountBanner";

export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const templatesDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTemplatesOpen(false);
    setToolsOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (templatesDropdownRef.current && !templatesDropdownRef.current.contains(e.target as Node)) {
        setTemplatesOpen(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (user) return null;

  const isTemplatesActive =
    location.pathname.startsWith("/templates") ||
    location.pathname === "/custom-branded-video-templates";
  const isToolsActive = location.pathname === "/tools" || location.pathname.startsWith("/tools/");

  return (
    <nav className="bg-white/70 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/60">
      {/* Banner above navbar so it appears first on scroll */}
      {/* <DiscountBanner containerClassName="max-w-6xl" /> */}

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
            B2V
          </div>
          <span className="text-xl font-semibold text-gray-900">Blog2Video</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 md:flex">
          {/* Main links */}
          {!user && (
            <>
          {topNavLinks.map((link) =>
            link.label === "Templates" ? (
              <div key={link.href} ref={templatesDropdownRef} className="relative">
                <button
                  onClick={() => {
                    setTemplatesOpen(!templatesOpen);
                    setToolsOpen(false);
                  }}
                  className={`flex items-center gap-1 text-sm transition-colors ${
                    isTemplatesActive ? "text-purple-700 font-medium" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Templates
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${templatesOpen ? "rotate-180" : ""}`}
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

                {templatesOpen && (
                  <div className="absolute left-1/2 top-full mt-3 w-80 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    {templateMenuLinks.map((t) => (
                      <Link
                        key={t.href}
                        to={t.href}
                        className={`block rounded-lg px-3 py-2.5 transition-colors ${
                          location.pathname === t.href
                            ? "bg-purple-50 text-purple-700"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{t.label}</p>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : link.label === "Tools" ? (
              <div key={link.href} ref={toolsDropdownRef} className="relative">
                <button
                  onClick={() => {
                    setToolsOpen(!toolsOpen);
                    setTemplatesOpen(false);
                  }}
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
                  <div className="absolute left-1/2 top-full mt-3 w-96 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    {toolsMenuLinks.map((tool) => (
                      <Link
                        key={tool.href}
                        to={tool.href}
                        className={`block rounded-lg px-3 py-2.5 transition-colors ${
                          location.pathname === tool.href
                            ? "bg-purple-50 text-purple-700"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{tool.label}</p>
                        <p className="text-xs text-gray-500">{tool.description}</p>
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
            <Link
              to="/contact"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              Contact
            </Link>
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
              <div key={link.href} className="py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-600">
                  Templates
                </p>
                <div className="space-y-1 pl-2">
                  {templateMenuLinks.map((t) => (
                    <Link
                      key={t.href}
                      to={t.href}
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
              </div>
            ) : link.label === "Tools" ? (
              <div key={link.href} className="py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-600">
                  Tools
                </p>
                <div className="space-y-1 pl-2">
                  {toolsMenuLinks.map((tool) => (
                    <Link
                      key={tool.href}
                      to={tool.href}
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
              </div>
            ) : (
              <Link
                key={link.href}
                to={link.href}
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
        </div>
      )}
    </nav>
  );
}
