import { useState, useEffect, useRef } from "react";
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
  const [editingDisplayText, setEditingDisplayText] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [sceneOrders, setSceneOrders] = useState<{ scene_id: number; order: number }[]>([]);
  
  // AI editing state
  const [aiDescription, setAiDescription] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [regenerateVoiceover, setRegenerateVoiceover] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Cleanup image preview URL
  useEffect(() => {
    if (selectedImage) {
      const url = URL.createObjectURL(selectedImage);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [selectedImage]);

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
    // Prefer dedicated display_text when available; otherwise fall back to narration_text.
    const initialDisplay = scene.display_text ?? scene.narration_text ?? "";
    setEditingDisplayText(initialDisplay);
    setEditMode("manual");
  };

  const handleSaveTitle = async () => {
    if (!editingSceneId) return;
    try {
      await updateScene(project.id, editingSceneId, { 
        title: editingTitle,
        // Update only on-screen display text here; narration_text remains the narration script.
        display_text: editingDisplayText, 
      });
      setEditingSceneId(null);
      setEditingTitle("");
      setEditingDisplayText("");
      setEditMode("none");
      onScenesUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update scene");
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
    // Prefer dedicated display_text when available; otherwise fall back to narration_text.
    const initialDisplay = scene.display_text ?? scene.narration_text ?? "";
    setDisplayText(initialDisplay);
    setRegenerateVoiceover(false);
    setSelectedLayout("");
    setSelectedImage(null);
    setEditMode("ai");
  };

  const handleRegenerate = async () => {
    if (!editingSceneId || !aiDescription.trim()) {
      setError("Please provide a description");
      return;
    }
    if (regenerateVoiceover && !displayText.trim()) {
      setError("Display text is required when regenerating voiceover");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await regenerateScene(
        project.id,
        editingSceneId,
        aiDescription,
        displayText,
        regenerateVoiceover,
        selectedLayout || undefined,
        selectedImage || undefined
      );
      setEditMode("none");
      setEditingSceneId(null);
      setAiDescription("");
      setDisplayText("");
      setRegenerateVoiceover(false);
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
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editMode === "ai"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            AI Edit
          </button>
        </div>
        {editMode === "ai" && canUseAI && (
          <div className="text-xs text-gray-500">
            AI edits: {remainingAI}
          </div>
        )}
        {editMode === "ai" && !canUseAI && (
          <div className="text-xs font-medium text-red-600">
            The limit for AI-Assisted Editing has been reached.
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
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          placeholder="Scene title"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          autoFocus
                        />
                        <AutoGrowTextarea
                          value={editingDisplayText}
                          onChange={(e) => setEditingDisplayText(e.target.value)}
                          placeholder="Display text (shown on screen)"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                          minRows={2}
                        />
                        <div className="flex items-center gap-2">
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
                              setEditingDisplayText("");
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {scene.title}
                          </h3>
                          {scene.narration_text && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {scene.narration_text}
                            </p>
                          )}
                        </div>
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
                      className="glass-card p-4 border-l-2 border-l-purple-200 bg-purple-50/30"
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
                          className="w-16 px-2 py-1 text-xs border border-purple-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
        <div className={`space-y-4 ${!canUseAI ? "pointer-events-none opacity-60" : ""}`}>
          <h3 className="text-sm font-medium text-gray-900">
            AI-Assisted Scene Editing
          </h3>
          {!canUseAI && (
            <p className="text-sm font-medium text-red-600">
              The limit for AI-Assisted Editing has been reached.
            </p>
          )}
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
                      Display Text (shown on screen)
                    </label>
                    <AutoGrowTextarea
                      value={displayText}
                      onChange={(e) => setDisplayText(e.target.value)}
                      placeholder="Enter the text that will be displayed on screen..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                      minRows={2}
                    />
                    <p className="mt-1 text-xs text-gray-500">This text appears on screen.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Description (for visual changes) *
                    </label>
                    <AutoGrowTextarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder="Describe how you want the visuals/layout to change..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                      minRows={3}
                    />
                    <p className="mt-1 text-xs text-gray-500">This will regenerate the visual description and layout.</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">
                      Regenerate voiceover based on display text
                    </label>
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

                  {layouts && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Layout (Optional)
                      </label>
                      <select
                        value={selectedLayout}
                        onChange={(e) => setSelectedLayout(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-purple-200 bg-purple-50 text-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    <div className="flex items-center gap-2">
                      {selectedImage && imagePreviewUrl && (
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="h-20 w-auto object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedImage(null)}
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
                          onChange={(e) =>
                            setSelectedImage(e.target.files?.[0] || null)
                          }
                          className="hidden"
                        />
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={loading || !aiDescription.trim() || (regenerateVoiceover && !displayText.trim())}
                      className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Regenerating..." : "Regenerate Scene"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingSceneId(null);
                        setAiDescription("");
                        setDisplayText("");
                        setRegenerateVoiceover(false);
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
