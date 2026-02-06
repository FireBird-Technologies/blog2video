import { Scene } from "../api/client";

interface Props {
  scenes: Scene[];
  projectName: string;
}

export default function ScriptPanel({ scenes, projectName }: Props) {
  if (scenes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No script generated yet.</p>
        <p className="text-sm mt-1">
          Click "Generate Script" to create your video script.
        </p>
      </div>
    );
  }

  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-5">
        <h2 className="text-xl font-bold text-white mb-2">{projectName}</h2>
        <div className="flex gap-6 text-sm text-gray-400">
          <span>{scenes.length} scenes</span>
          <span>{Math.round(totalDuration)}s total</span>
          <span>~{Math.ceil(totalDuration / 60)} min</span>
        </div>
      </div>

      {/* Script timeline */}
      <div className="space-y-3">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className="flex gap-4 items-start group"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {scene.order}
              </div>
              {index < scenes.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-700 my-1 min-h-[20px]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-white">{scene.title}</h3>
                <span className="text-xs text-gray-500">
                  {scene.duration_seconds}s
                </span>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                <p className="text-sm text-gray-300 leading-relaxed mb-3">
                  {scene.narration_text}
                </p>
                <p className="text-xs text-gray-500 italic">
                  Visual: {scene.visual_description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
