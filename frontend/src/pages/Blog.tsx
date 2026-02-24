import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Blog() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav — for logged-out visitors; logged-in users get main Navbar */}
      {!user && (
        <nav className="border-b border-gray-200/50 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                B2V
              </div>
              <span className="text-xl font-semibold text-gray-900">
                Blog2Video
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/pricing"
                className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
              >
                Pricing
              </Link>
              <Link
                to="/blogs"
                className="text-sm text-gray-900 font-medium transition-colors"
              >
                Blogs
              </Link>
            </div>
          </div>
        </nav>
      )}

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <header className="mb-12">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              Blog
            </h1>
            <p className="text-gray-500 max-w-xl">
                Blog Content!
            </p>
          </header>

          <section className="space-y-6">
            <p className="text-sm text-gray-500">
              Posts will appear here. Check back soon or{" "}
              <Link to="/contact" className="text-purple-600 hover:underline">
                get in touch
              </Link>{" "}
              if you have a topic you’d like us to cover.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
