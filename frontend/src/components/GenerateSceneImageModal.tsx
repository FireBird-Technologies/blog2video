import { useEffect, useMemo, useState } from "react";
import type { Project, Scene } from "../api/client";
import { generateSceneImage } from "../api/client";

export interface GenerateSceneImageModalProps {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  project: Project;
  isPro: boolean;
  onUpgrade: () => void;
  onImageReady: (imageBase64: string, refinedPrompt: string) => void;
}

export default function GenerateSceneImageModal({
  open,
  onClose,
  scene,
  project,
  isPro,
  onUpgrade,
  onImageReady,
}: GenerateSceneImageModalProps) {
  const [imageDescription, setImageDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholderHint = useMemo(() => {
    const v = (scene.visual_description || "").trim();
    if (!v) return "Describe the image you want (subject, style, mood, colors)…";
    const first = v.split("\n").find((line) => line.trim())?.trim() ?? v;
    return first.length > 120 ? `${first.slice(0, 120)}…` : first;
  }, [scene.visual_description]);

  useEffect(() => {
    if (!open) return;
    setImageDescription("");
    setError(null);
    setGenerating(false);
  }, [open, scene.id]);

  if (!open) return null;

  const handleGenerate = async () => {
    const desc = imageDescription.trim();
    if (desc.length < 3) {
      setError("Image description must be at least 3 characters.");
      return;
    }
    if (!isPro) {
      onUpgrade();
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await generateSceneImage(project.id, scene.id, {
        image_description: desc,
      });
      onImageReady(res.data.image_base64, res.data.refined_prompt);
      onClose();
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : 0;
      if (status === 403) {
        onUpgrade();
        return;
      }
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : "Image generation failed";
      setError(String(msg || "Image generation failed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={generating ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="generate-scene-image-title"
      >
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h3 id="generate-scene-image-title" className="text-lg font-semibold text-gray-900">
            Generate image with AI
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Describe the image you want. Your description is the main input.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          <div>
            <label
              htmlFor="scene-image-description"
              className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5"
            >
              Image description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="scene-image-description"
              value={imageDescription}
              onChange={(e) => setImageDescription(e.target.value)}
              placeholder={placeholderHint}
              rows={4}
              autoFocus
              disabled={generating}
              className="w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y leading-relaxed"
            />
            <p className="text-xs text-gray-500 mt-2">
              The scene description will also be incorporated into your prompt to generate the
              image.
            </p>
          </div>

          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || imageDescription.trim().length < 3}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
