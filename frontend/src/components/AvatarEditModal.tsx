import type { CraftedTemplateDetail, Project, Scene } from "../api/client";
import SceneAvatarSection from "./SceneAvatarSection";

interface Props {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  project: Project;
  onSaved: () => void;
  /** Pass-through VideoPreview props, so the real-scene preview matches the
   *  main player's owner-scoping / custom-template resolution — see VideoPreview.tsx. */
  ownerScopedProjectId?: number;
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  precompiledTemplateData?: {
    intro_code: string | null;
    content_codes: string[] | null;
    outro_code: string | null;
  };
}

/**
 * Standalone modal for a single scene's avatar — opened from the pencil icon
 * on the scene list's avatar row, only for a scene that already has a
 * rendered clip (the caller redirects to the project-wide Avatar tab
 * instead when a scene has none yet, since generating one is a whole-video
 * decision). Kept separate from SceneEditModal (rather than jumping into its
 * Avatar tab) so avatar editing isn't buried inside the much larger scene
 * editor.
 */
export default function AvatarEditModal({
  open,
  onClose,
  scene,
  project,
  onSaved,
  ownerScopedProjectId,
  precompiledCraftedDetail,
  precompiledTemplateData,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="avatar-edit-modal-title"
      >
        <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
          <div>
            <h3 id="avatar-edit-modal-title" className="text-lg font-semibold text-gray-900">
              Avatar — Scene {scene.order}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Choose a presenter, tune their appearance, and frame the clip for this scene only.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-[520px]">
          <SceneAvatarSection
            projectId={project.id}
            sceneId={scene.id}
            sceneOrder={scene.order}
            hasVoiceover={!!scene.voiceover_path}
            hasAvatar={!!scene.avatar_video_path}
            avatarPreset={scene.avatar_preset}
            hasMatte={!!scene.has_matte}
            customPortraitUrl={project.avatar_custom_image_url}
            aspectRatio={project.aspect_ratio}
            sceneFocus={{
              x: scene.avatar_focus_x,
              y: scene.avatar_focus_y,
              zoom: scene.avatar_zoom,
            }}
            sceneAppearance={{
              shape: scene.avatar_shape ?? null,
              size: scene.avatar_size ?? null,
              position: scene.avatar_position ?? null,
              bg: scene.avatar_bg ?? null,
              opacity: scene.avatar_opacity ?? null,
            }}
            projectAppearance={{
              shape: project.avatar_shape ?? "circle",
              size: project.avatar_size ?? 0.16,
              position: project.avatar_position ?? "bottom_left",
              bg: project.avatar_bg ?? null,
              opacity: project.avatar_opacity ?? 1,
            }}
            onChanged={onSaved}
            // NOTE the two are different things despite the names: this modal's
            // `onSaved` prop is the project REFETCH (passed down as onChanged),
            // while the section's `onSaved` fires only on a successful save.
            // Dismiss on that, so committing the edit closes the modal the way
            // every other modal in the app behaves — but a FAILED save leaves it
            // open with its error visible.
            onSaved={onClose}
            project={project}
            ownerScopedProjectId={ownerScopedProjectId}
            precompiledCraftedDetail={precompiledCraftedDetail}
            precompiledTemplateData={precompiledTemplateData}
          />
        </div>
      </div>
    </div>
  );
}
