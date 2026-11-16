/**
 * Crumpled Paper — browser preview entry (frontend only).
 * Wraps the shared CrumpledVideoComposition (byte-identical with remotion-video)
 * with the project-wide overlays VideoPreview passes in: captions, logo,
 * background music and the talking-head avatar.
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AvatarOverlay } from "../AvatarOverlay";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { resolveFontFamily } from "../../../fonts/registry";
import { getSceneDurationFrames } from "../playbackSpeed";
import {
  CrumpledVideoComposition,
  computeCrumpledTimeline,
  type CrumpledScene,
} from "./CrumpledVideoComposition";
import { CRUMPLED_DEFAULTS } from "./crumpledStyle";

const FPS = 30;

export type CrumpledPreviewScene = CrumpledScene & {
  narrationText?: string;
  speechDurationSeconds?: number;
  avatarUrl?: string;
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
};

export interface CrumpledPreviewProps {
  scenes: CrumpledPreviewScene[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  bgmUrl?: string | null;
  bgmVolume?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: number;
  captionOffset?: number;
}

export const CrumpledPreviewComposition: React.FC<CrumpledPreviewProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  playbackSpeed,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  bgmUrl,
  bgmVolume,
  captionsEnabled,
  captionPosition,
  captionFontFamily,
  captionFontSize,
  captionOffset,
}) => {
  const ratio = aspectRatio || "landscape";
  const { entries } = computeCrumpledTimeline(scenes, playbackSpeed);
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || CRUMPLED_DEFAULTS.bg }}>
      <CrumpledVideoComposition
        scenes={scenes}
        accentColor={accentColor}
        bgColor={bgColor}
        textColor={textColor}
        aspectRatio={ratio}
        fontFamily={fontFamily}
        playbackSpeed={playbackSpeed}
      />

      {scenes.map((scene, index) => {
        const entry = entries[index];
        const text = scene.narrationText || scene.narration;
        return (
          <React.Fragment key={`overlay-${scene.id}-${index}`}>
            {scene.avatarUrl ? (
              <Sequence from={entry.start} durationInFrames={entry.durationFrames}>
                <AvatarOverlay
                  src={scene.avatarUrl}
                  aspectRatio={ratio}
                  shape={scene.avatarShape}
                  size={scene.avatarSize}
                  position={scene.avatarPosition}
                  bg={scene.avatarBg}
                  opacity={scene.avatarOpacity}
                  focusX={scene.avatarFocusX}
                  focusY={scene.avatarFocusY}
                  zoom={scene.avatarZoom}
                />
              </Sequence>
            ) : null}
            {captionsEnabled && text ? (
              <Sequence from={entry.start} durationInFrames={entry.durationFrames}>
                <CaptionTrack
                  text={text}
                  position={captionPosition || "bottom_center"}
                  aspectRatio={ratio}
                  fontFamily={captionFontFamily ? resolveFontFamily(captionFontFamily) || captionFontFamily : fontFamily || undefined}
                  fontSize={captionFontSize || undefined}
                  offset={captionOffset ?? 0}
                  speechDurationFrames={
                    scene.speechDurationSeconds ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, playbackSpeed ?? 1) : undefined
                  }
                />
              </Sequence>
            ) : null}
          </React.Fragment>
        );
      })}

      {logo ? (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={ratio}
        />
      ) : null}

      {bgmUrl ? <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.1} scenes={scenes} /> : null}
    </AbsoluteFill>
  );
};
