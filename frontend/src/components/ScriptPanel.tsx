import { Scene } from "../api/client";

interface Props {
  scenes: Scene[];
  projectName: string;
}

export default function ScriptPanel({ scenes, projectName }: Props) {
  if (scenes.length === 0) {
    return (
      <p className="text-center py-16 text-xs text-gray-400">
        Script is generating.
      </p>
    );
  }

  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-baseline gap-4 mb-2">
        <h2 className="text-base font-medium text-gray-900">{projectName}</h2>
        <span className="text-xs text-gray-400">
          {scenes.length} scenes -- ~{Math.ceil(totalDuration / 60)} min
        </span>
      </div>

      {/* Scene blocks */}
      <div className="space-y-2">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="glass-card p-5 border-l-2 border-l-purple-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-medium text-gray-900">{scene.title}</h3>
              <span className="text-[11px] text-gray-300">{scene.duration_seconds}s</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              {scene.narration_text}
            </p>
            <p className="text-xs text-gray-400 italic">
              {scene.visual_description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
