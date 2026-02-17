import { useState, useEffect } from "react";
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
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const { user } = useAuth();

  const isPro = user?.plan === "pro";
  const aiUsageCount = project.ai_assisted_editing_count || 0;
  const canUseAI = isPro || aiUsageCount < 3;

  useEffect(() => {
    if (!open) return;
    setTitle(scene.title);
    setDescription("");
    setSelectedLayout("");
    setSelectedImageFile(null);
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
        await updateScene(project.id, scene.id, { title });
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to update title";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (editMode === "ai") {
      if (!description.trim()) {
        setError("Please provide a description for AI editing.");
        return;
      }
      setLoading(true);
      try {
        // Update title first, then run AI regeneration
        await updateScene(project.id, scene.id, { title });
        await regenerateScene(
          project.id,
          scene.id,
          description,
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

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
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

          {/* Title — editable in both modes; in AI mode it is saved first, then regeneration runs */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {manualOnly && (
              <p className="mt-1 text-xs text-gray-500">In manual mode only the title can be changed.</p>
            )}
            {editMode === "ai" && (
              <p className="mt-1 text-xs text-gray-500">Title is saved first, then AI applies your description and options.</p>
            )}
          </div>

          {/* Description — AI only */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Description of editing
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={manualOnly}
              placeholder="Describe how you want this scene to be..."
              rows={3}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${
                manualOnly
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300"
              }`}
            />
          </div>

          {/* Layout — AI only */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Layout
            </label>
            <select
              value={selectedLayout}
              onChange={(e) => setSelectedLayout(e.target.value)}
              disabled={manualOnly}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                manualOnly
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300"
              }`}
            >
              <option value="">Auto (Let AI choose)</option>
              {layouts?.layouts.map((layoutId) => (
                <option key={layoutId} value={layoutId}>
                  {layouts.layout_names[layoutId] || layoutId}
                </option>
              ))}
            </select>
          </div>

          {/* Images — AI only; each with remove (X), plus add new */}
          <div>
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
                    disabled={manualOnly || removingAssetId === asset.id}
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
            </div>
            {!manualOnly && (
              <div className="mt-2">
                <label className="block text-[11px] text-gray-500 mb-1">Add image (optional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={(e) => setSelectedImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                {selectedImageFile && (
                  <p className="mt-1 text-xs text-gray-500">New: {selectedImageFile.name}</p>
                )}
              </div>
            )}
          </div>

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
            disabled={loading || (editMode === "ai" && !description.trim())}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : editMode === "manual" ? "Save title" : "Apply AI edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
