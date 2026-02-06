import { Scene } from "../api/client";

interface Props {
  scene: Scene;
}

export default function SceneCard({ scene }: Props) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center">
          {scene.order}
        </span>
        <h3 className="text-sm font-medium text-gray-900">{scene.title}</h3>
        <span className="text-[11px] text-gray-300 ml-auto">{scene.duration_seconds}s</span>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-3">
        {scene.narration_text}
      </p>

      <p className="text-xs text-gray-400 leading-relaxed italic">
        {scene.visual_description}
      </p>
    </div>
  );
}
