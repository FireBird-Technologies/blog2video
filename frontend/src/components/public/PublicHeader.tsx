import { Link } from "react-router-dom";
import { topNavLinks } from "../../content/siteContent";
import { useAuth } from "../../hooks/useAuth";

export default function PublicHeader() {
  const { user } = useAuth();

  if (user) return null;

  return (
    <nav className="border-b border-gray-200/60 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
            B2V
          </div>
          <span className="text-xl font-semibold text-gray-900">Blog2Video</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {topNavLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/contact"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Contact
          </Link>
        </div>
      </div>
    </nav>
  );
}
