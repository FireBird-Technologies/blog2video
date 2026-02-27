import { useState } from "react";
import {
  updateCustomTemplate,
  type CustomTemplateItem,
} from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";

interface Props {
  template: CustomTemplateItem;
  onSaved: (template: CustomTemplateItem) => void;
  onCancel: () => void;
}

export default function CustomTemplateEditor({ template, onSaved, onCancel }: Props) {
  const [name, setName] = useState(template.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = template.theme;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateCustomTemplate(template.id, {
        name: name.trim(),
      });
      onSaved(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Template</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Live preview */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <CustomPreview theme={theme} name={name || undefined} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Extracted colors (read-only) */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Theme Colors
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {(["accent", "bg", "text", "surface", "muted"] as const).map((key) => (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm"
                    style={{ backgroundColor: theme.colors[key] }}
                  />
                  <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info pills */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
              {theme.fonts.heading}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
              {theme.style}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
              {theme.animationPreset}
            </span>
          </div>

          {/* Visual patterns (read-only) */}
          {theme.patterns && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Visual Patterns
              </label>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                  {theme.patterns.cards?.corners || "rounded"} cards
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                  {theme.patterns.spacing?.density || "balanced"} spacing
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                  {theme.patterns.images?.treatment || "rounded"} images
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                  {theme.patterns.layout?.direction || "centered"}
                </span>
              </div>
            </div>
          )}

          {/* Source URL */}
          {template.source_url && (
            <p className="text-[11px] text-gray-400 truncate">
              Source: {template.source_url}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
