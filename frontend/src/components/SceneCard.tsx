import { Scene } from "../api/client";

interface Props {
  scene: Scene;
  images?: string[];
}

export default function SceneCard({ scene, images }: Props) {
  const hasAudio = !!scene.voiceover_path;
  const hasVideo = !!scene.remotion_code;

  return (
    <div className="glass-card p-5 border-l-2 border-l-purple-200">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
          {scene.order}
        </span>
        <h3 className="text-sm font-medium text-gray-900">{scene.title}</h3>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              hasVideo
                ? "bg-green-50 text-green-600"
                : "bg-gray-50 text-gray-300"
            }`}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {hasVideo ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              )}
            </svg>
            Scene
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              hasAudio
                ? "bg-green-50 text-green-600"
                : "bg-gray-50 text-gray-300"
            }`}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {hasAudio ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
            Audio
          </span>
          <span className="text-[11px] text-gray-300 ml-1">
            {scene.duration_seconds}s
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-2">
        {scene.narration_text}
      </p>

      <p className="text-xs text-gray-400 italic mb-3">
        {scene.visual_description}
      </p>

      {/* Scene images */}
      {images && images.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Scene ${scene.order} image ${i + 1}`}
              className="h-20 w-auto rounded-lg object-cover border border-gray-200/40 flex-shrink-0"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
