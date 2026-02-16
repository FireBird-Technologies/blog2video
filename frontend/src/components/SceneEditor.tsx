import { useState, useEffect } from "react";
import {
  Scene,
  Project,
  updateScene,
  reorderScenes,
  regenerateScene,
  getValidLayouts,
  LayoutInfo,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";

interface Props {
  project: Project;
  scenes: Scene[];
  onScenesUpdated: () => void;
}

type EditMode = "none" | "manual" | "ai";

export default function SceneEditor({
  project,
  scenes,
  onScenesUpdated,
}: Props) {
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [sceneOrders, setSceneOrders] = useState<{ scene_id: number; order: number }[]>([]);
  
  // AI editing state
  const [aiDescription, setAiDescription] = useState("");
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const isPro = user?.plan === "pro";
  const aiUsageCount = project.ai_assisted_editing_count || 0;
  const canUseAI = isPro || aiUsageCount < 3;
  const remainingAI = isPro ? "Unlimited" : `${3 - aiUsageCount} remaining`;

  // Load layouts when entering AI edit mode
  useEffect(() => {
    if (editMode === "ai" && !layouts) {
      getValidLayouts(project.id)
        .then((res) => setLayouts(res.data))
        .catch((err) => {
          console.error("Failed to load layouts:", err);
          setError("Failed to load layouts");
        });
    }
  }, [editMode, project.id, layouts]);

  const handleStartManualEdit = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setEditingTitle(scene.title);
    setEditMode("manual");
  };

  const handleSaveTitle = async () => {
    if (!editingSceneId) return;
    try {
      await updateScene(project.id, editingSceneId, { title: editingTitle });
      setEditingSceneId(null);
      setEditMode("none");
      onScenesUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update title");
    }
  };

  const handleStartReorder = () => {
    setReorderMode(true);
    setSceneOrders(
      scenes.map((s) => ({ scene_id: s.id, order: s.order }))
    );
  };

  const handleReorder = async () => {
    try {
      await reorderScenes(project.id, sceneOrders);
      setReorderMode(false);
      onScenesUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to reorder scenes");
    }
  };

  const handleStartAIEdit = (scene: Scene) => {
    if (!canUseAI) {
      setError("AI editing limit reached. Upgrade to Pro for unlimited edits.");
      return;
    }
    setEditingSceneId(scene.id);
    setAiDescription("");
    setSelectedLayout("");
    setSelectedImage(null);
    setEditMode("ai");
  };

  const handleRegenerate = async () => {
    if (!editingSceneId || !aiDescription.trim()) {
      setError("Please provide a description");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await regenerateScene(
        project.id,
        editingSceneId,
        aiDescription,
        selectedLayout || undefined,
        selectedImage || undefined
      );
      setEditMode("none");
      setEditingSceneId(null);
      setAiDescription("");
      setSelectedLayout("");
      setSelectedImage(null);
      onScenesUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to regenerate scene");
    } finally {
      setLoading(false);
    }
  };

  const handleOrderChange = (sceneId: number, newOrder: number) => {
    setSceneOrders((prev) =>
      prev.map((item) =>
        item.scene_id === sceneId ? { ...item, order: newOrder } : item
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with mode toggle and usage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditMode("none");
              setReorderMode(false);
              setEditingSceneId(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editMode === "none"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            View
          </button>
          <button
            onClick={() => {
              setEditMode("manual");
              setReorderMode(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editMode === "manual"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Manual Edit
          </button>
          <button
            onClick={() => {
              setEditMode("ai");
              setReorderMode(false);
            }}
            disabled={!canUseAI}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editMode === "ai"
                ? "bg-purple-100 text-purple-700"
                : canUseAI
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-gray-50 text-gray-400 cursor-not-allowed"
            }`}
          >
            AI Edit
          </button>
        </div>
        {editMode === "ai" && (
          <div className="text-xs text-gray-500">
            AI edits: {remainingAI}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Manual Edit Mode */}
      {editMode === "manual" && (
        <div className="space-y-3">
          {!reorderMode ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Edit Scene Titles
                </h3>
                <button
                  onClick={handleStartReorder}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                >
                  Reorder Scenes
                </button>
              </div>
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="glass-card p-4 border-l-2 border-l-purple-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                      {scene.order}
                    </span>
                    {editingSceneId === scene.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTitle}
                          className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingSceneId(null);
                            setEditingTitle("");
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="flex-1 text-sm font-medium text-gray-900">
                          {scene.title}
                        </h3>
                        <button
                          onClick={() => handleStartManualEdit(scene)}
                          className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Reorder Scenes
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleReorder}
                    className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                  >
                    Save Order
                  </button>
                  <button
                    onClick={() => {
                      setReorderMode(false);
                      setSceneOrders([]);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              {scenes
                .sort((a, b) => {
                  const orderA =
                    sceneOrders.find((o) => o.scene_id === a.id)?.order || a.order;
                  const orderB =
                    sceneOrders.find((o) => o.scene_id === b.id)?.order || b.order;
                  return orderA - orderB;
                })
                .map((scene, idx) => {
                  const currentOrder =
                    sceneOrders.find((o) => o.scene_id === scene.id)?.order ||
                    scene.order;
                  return (
                    <div
                      key={scene.id}
                      className="glass-card p-4 border-l-2 border-l-purple-200"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={scenes.length}
                          value={currentOrder}
                          onChange={(e) =>
                            handleOrderChange(
                              scene.id,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-16 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <h3 className="flex-1 text-sm font-medium text-gray-900">
                          {scene.title}
                        </h3>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* AI Edit Mode */}
      {editMode === "ai" && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">
            AI-Assisted Scene Editing
          </h3>
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className="glass-card p-4 border-l-2 border-l-purple-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                  {scene.order}
                </span>
                <h3 className="flex-1 text-sm font-medium text-gray-900">
                  {scene.title}
                </h3>
                <button
                  onClick={() => handleStartAIEdit(scene)}
                  disabled={loading || !canUseAI}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit with AI
                </button>
              </div>

              {editingSceneId === scene.id && (
                <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Description *
                    </label>
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder="Describe how you want this scene to be..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={3}
                    />
                  </div>

                  {layouts && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Layout (Optional)
                      </label>
                      <select
                        value={selectedLayout}
                        onChange={(e) => setSelectedLayout(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Auto (Let AI choose)</option>
                        {layouts.layouts.map((layoutId) => (
                          <option key={layoutId} value={layoutId}>
                            {layouts.layout_names[layoutId] || layoutId}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Image (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={(e) =>
                        setSelectedImage(e.target.files?.[0] || null)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {selectedImage && (
                      <p className="mt-1 text-xs text-gray-500">
                        Selected: {selectedImage.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={loading || !aiDescription.trim()}
                      className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Regenerating..." : "Regenerate Scene"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingSceneId(null);
                        setAiDescription("");
                        setSelectedLayout("");
                        setSelectedImage(null);
                      }}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
