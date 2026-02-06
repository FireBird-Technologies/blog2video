import { useState } from "react";

interface Props {
  onSubmit: (url: string, name?: string) => Promise<void>;
  loading?: boolean;
}

export default function BlogUrlForm({ onSubmit, loading }: Props) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onSubmit(url.trim(), name.trim() || undefined);
    setUrl("");
    setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="blog-url"
          className="block text-sm font-medium text-gray-300 mb-1.5"
        >
          Blog URL
        </label>
        <input
          id="blog-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/blog/my-article"
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>
      <div>
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-gray-300 mb-1.5"
        >
          Project Name{" "}
          <span className="text-gray-500">(optional)</span>
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Explainer Video"
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating...
          </>
        ) : (
          "Create Project"
        )}
      </button>
    </form>
  );
}
