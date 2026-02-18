import { useState, useEffect, useRef } from "react";
import {
  Scene,
  Project,
  Asset,
  updateScene,
  regenerateScene,
  getValidLayouts,
  deleteAsset,
  LayoutInfo,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";

// Auto-growing textarea component
function AutoGrowTextarea({ value, onChange, className, placeholder, minRows = 2 }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 20; // Approximate line height in pixels
      const minHeight = minRows * lineHeight + 16; // padding
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
    }
  }, [value, minRows]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={minRows}
    />
  );
}

export interface SceneImageItem {
  url: string;
  asset: Asset;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  project: Project;
  imageItems: SceneImageItem[];
  onSaved: () => void;
}

type EditMode = "manual" | "ai";

export default function SceneEditModal({
  open,
  onClose,
  scene,
  project,
  imageItems,
  onSaved,
}: Props) {
  const [editMode, setEditMode] = useState<EditMode>("manual");
  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [regenerateVoiceover, setRegenerateVoiceover] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const { user } = useAuth();

  // Cleanup image preview URL
  useEffect(() => {
    if (selectedImageFile) {
      const url = URL.createObjectURL(selectedImageFile);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [selectedImageFile]);

  const isPro = user?.plan === "pro";
  const aiUsageCount = project.ai_assisted_editing_count || 0;
  const canUseAI = isPro || aiUsageCount < 3;

  useEffect(() => {
    if (!open) return;
    setTitle(scene.title);
    setDescription("");
    setDisplayText(scene.narration_text || "");
    setSelectedLayout("");
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setError(null);
  }, [open, scene.id, scene.title]);

  useEffect(() => {
    if (open && editMode === "ai" && !layouts) {
      getValidLayouts(project.id)
        .then((res) => setLayouts(res.data))
        .catch(() => setError("Failed to load layouts"));
    }
  }, [open, editMode, project.id, layouts]);

  const handleSave = async () => {
    setError(null);
    if (editMode === "manual") {
      setLoading(true);
      try {
        await updateScene(project.id, scene.id, { 
          title,
          narration_text: displayText 
        });
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to update scene";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (editMode === "ai") {
      if (!displayText.trim()) {
        setError("Please provide display text.");
        return;
      }
      setLoading(true);
      try {
        // Update title and display text first
        await updateScene(project.id, scene.id, { 
          title,
          narration_text: displayText 
        });
        await regenerateScene(
          project.id,
          scene.id,
          description,
          displayText,
          regenerateVoiceover,
          selectedLayout || undefined,
          selectedImageFile || undefined
        );
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to regenerate scene";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveImage = async (assetId: number) => {
    setError(null);
    setRemovingAssetId(assetId);
    try {
      await deleteAsset(project.id, assetId);
      onSaved();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to remove image";
      setError(String(msg));
    } finally {
      setRemovingAssetId(null);
    }
  };

  if (!open) return null;

  const manualOnly = editMode === "manual";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Scene {scene.order}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Manual vs AI toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Editing mode
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode("manual")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "manual"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Manual editing
              </button>
              <button
                type="button"
                onClick={() => setEditMode("ai")}
                disabled={!canUseAI}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "ai"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : canUseAI
                    ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                }`}
              >
                AI-Assisted editing
              </button>
            </div>
            {editMode === "ai" && (
              <p className="mt-1 text-xs text-gray-600 font-medium">
                AI-Assisted-Editing limit: {isPro ? "Unlimited" : `${Math.max(0, 3 - aiUsageCount)} of 3 remaining this period`}
              </p>
            )}
          </div>

          {/* Title — editable in both modes */}
          <div className="mt-6">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Display Text — editable in both modes */}
          <div className="mt-6">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Display Text (shown on screen)
            </label>
            <AutoGrowTextarea
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder="Enter the text that will be displayed on screen..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
              minRows={2}
            />
            {manualOnly && (
              <p className="mt-1 text-xs text-gray-500">This text appears on screen. Changes are saved immediately.</p>
            )}
            {editMode === "ai" && (
              <p className="mt-1 text-xs text-gray-500">This text appears on screen. Use the toggle below to regenerate voiceover.</p>
            )}
          </div>

          {/* Description — AI only */}
          {editMode === "ai" && (
            <div className="mt-6">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Description (for visual changes) <span className="text-gray-400">(Optional)</span>
              </label>
              <AutoGrowTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how you want the visuals/layout to change..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                minRows={3}
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty to keep the current visual description. This will regenerate the visual description and layout if provided.</p>
            </div>
          )}

          {/* Voiceover regeneration toggle — AI only */}
          {editMode === "ai" && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                <label className="text-sm font-medium text-gray-700">
                  Regenerate voiceover based on display text
                </label>
              </div>
              <button
                type="button"
                onClick={() => setRegenerateVoiceover(!regenerateVoiceover)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  regenerateVoiceover ? "bg-purple-600" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={regenerateVoiceover}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    regenerateVoiceover ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Layout — AI only */}
          {editMode === "ai" && (
            <div className="mt-6">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Layout
              </label>
              <select
                value={selectedLayout}
                onChange={(e) => setSelectedLayout(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-purple-200 bg-purple-50 text-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Auto (Let AI choose)</option>
                {layouts?.layouts.map((layoutId) => (
                  <option key={layoutId} value={layoutId}>
                    {layouts.layout_names[layoutId] || layoutId}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Images — AI only; each with remove (X), plus add new */}
          {editMode === "ai" && (
            <div className="mt-6">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Images
              </label>
              <div className="flex flex-wrap gap-2">
                {imageItems.map(({ url, asset }) => (
                  <div
                    key={asset.id}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 flex-shrink-0"
                  >
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-auto object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(asset.id)}
                      disabled={removingAssetId === asset.id}
                      className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 shadow"
                    >
                      {removingAssetId === asset.id ? (
                        <span className="text-[10px]">…</span>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
                {selectedImageFile && imagePreviewUrl && (
                  <div className="relative group rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    <img
                      src={imagePreviewUrl}
                      alt="Preview"
                      className="h-20 w-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImageFile(null);
                        setImagePreviewUrl(null);
                      }}
                      className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <label className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50/50 hover:bg-purple-100/50 cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={(e) => setSelectedImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || (editMode === "ai" && !displayText.trim())}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : editMode === "manual" ? "Save title" : "Apply AI edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
