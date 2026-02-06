import { Scene } from "../api/client";

interface Props {
  scene: Scene;
  onEdit?: (scene: Scene) => void;
}

export default function SceneCard({ scene, onEdit }: Props) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center text-sm font-bold">
            {scene.order}
          </span>
          <h3 className="text-lg font-semibold text-white">{scene.title}</h3>
        </div>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
          {scene.duration_seconds}s
        </span>
      </div>

      {/* Narration */}
      <div className="mb-3">
        <p className="text-sm text-gray-400 font-medium mb-1">Narration</p>
        <p className="text-sm text-gray-300 leading-relaxed">
          {scene.narration_text}
        </p>
      </div>

      {/* Visual Description */}
      <div className="mb-3">
        <p className="text-sm text-gray-400 font-medium mb-1">
          Visual Direction
        </p>
        <p className="text-sm text-gray-500 leading-relaxed">
          {scene.visual_description}
        </p>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-700/50">
        <span
          className={`text-xs px-2 py-1 rounded ${
            scene.remotion_code
              ? "bg-green-900/30 text-green-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          {scene.remotion_code ? "Code Generated" : "No Code"}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${
            scene.voiceover_path
              ? "bg-green-900/30 text-green-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          {scene.voiceover_path ? "Audio Ready" : "No Audio"}
        </span>

        {onEdit && (
          <button
            onClick={() => onEdit(scene)}
            className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
