import type { ComponentProps } from "react";
import ProjectVoiceSettingsCard from "./ProjectVoiceSettingsCard";
import ProjectLanguageSettingsCard from "./ProjectLanguageSettingsCard";

type VoiceProps = ComponentProps<typeof ProjectVoiceSettingsCard>;
type LanguageProps = ComponentProps<typeof ProjectLanguageSettingsCard>;

interface Props {
  voice: VoiceProps;
  language: LanguageProps;
}

/**
 * Settings-tab card holding Voice (left) and Language (right) side by side in a single
 * `.glass-card`. Each column renders its own bare body; the shell and the section heading
 * live here so the two stay the same height.
 */
export default function ProjectVoiceLanguageSettingsCard({ voice, language }: Props) {
  return (
    <div>
      <h2 className="text-base font-medium text-gray-900 mb-1">Voice &amp; Language</h2>
      <p className="text-xs text-gray-400 mb-3">
        The narration voice and the language of this video.
      </p>

      <div className="glass-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:divide-x md:divide-gray-200/60">
          <div className="min-w-0">
            <ProjectVoiceSettingsCard {...voice} />
          </div>
          <div className="min-w-0 md:pl-5">
            <ProjectLanguageSettingsCard {...language} />
          </div>
        </div>
      </div>
    </div>
  );
}
