import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
import { getTemplateConfig } from "../../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DemoScene {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
}

const OLD_DOCUMENTARY_REEL_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "The Investigation Begins",
    narration:
      "Every case starts with a single frame, a name, a date, and the quiet certainty that something here was never fully explained.",
    layout: "docreel_slate",
    layoutProps: {
      slateScene: "1",
      slateTake: "3",
      slateDate: "07.14.86",
      slateDirector: "M. HALLORAN",
      slateProduction: "COLD CASE FILES",
      titleFontSize: 80,
      descriptionFontSize: 31,
    },
    durationSeconds: 8,
  },
  {
    id: 2,
    order: 2,
    title: "A Town Divided",
    narration:
      "Some places carry their history in plain sight, written into the storefronts and the silences of people who still remember exactly what happened.",
    layout: "docreel_title_card",
    layoutProps: {
      chapterTitle: "A Town Divided",
      titleFontSize: 66,
      descriptionFontSize: 32,
    },
    durationSeconds: 9,
  },
  {
    id: 3,
    order: 3,
    title: "Field Report",
    narration:
      "The paperwork tells its own version of events, one filled with gaps, crossed-out names, and a timeline that never quite adds up.",
    layout: "docreel_dossier",
    layoutProps: {
      dossierHeading: "Incident Summary",
      dossierBody:
        "Subject was last confirmed seen departing the north gate at approximately 22:40. Security logs show no further contact after that point, and no forced entry was recorded at the residence.",
      dossierStamp: "UNRESOLVED",
      dossierClassification: "Incident Report",
      titleFontSize: 51,
      descriptionFontSize: 24,
    },
    durationSeconds: 10,
  },
  {
    id: 4,
    order: 4,
    title: "By the numbers",
    narration:
      "The scale of it only becomes clear once the individual files are laid side by side against the record investigators kept for nearly forty years.",
    layout: "docreel_statistic",
    layoutProps: {
      statValue: "47",
      statLabel: "Cases Reopened",
      statContext:
        "Each file was cross-referenced against the original 1986 archive, revealing a pattern of missed connections investigators had overlooked for nearly a decade.",
    },
    durationSeconds: 7,
  },
  {
    id: 5,
    order: 5,
    title: "Eyewitness",
    narration:
      "She remembers it like it was yesterday, the sound before the sirens, and the strange quiet that followed for the rest of that week.",
    layout: "docreel_interview",
    layoutProps: {
      interviewQuote:
        "I heard the sirens before I saw anything at all, and by the time I got to the window, half the street was already outside.",
      interviewSubject: "Margaret Doyle",
      interviewRole: "Former Resident",
      titleFontSize: 23,
      descriptionFontSize: 14,
    },
    durationSeconds: 12,
  },
  {
    id: 6,
    order: 6,
    title: "THE END",
    narration: "",
    layout: "ending_socials",
    layoutProps: {
      brandName: "Cold Case Files",
    },
    durationSeconds: 10,
  },
];

export default function OldDocumentaryReelPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("old-documentary-reel");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Play the WHOLE timeline continuously (scene 1 → 2 → … → loop), exactly like the
  // real video, instead of mounting one isolated scene per Player window. The dots
  // just seek to a scene's start; auto-advance is driven by playback, not a timer.
  const sceneFrames = useMemo(
    () =>
      OLD_DOCUMENTARY_REEL_PREVIEW_SCENES.map((s) =>
        Math.max(1, Math.round((Number(s.durationSeconds) || 5) * fps)),
      ),
    [fps],
  );
  const sceneStartFrames = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const f of sceneFrames) {
      starts.push(acc);
      acc += f;
    }
    return starts;
  }, [sceneFrames]);
  const durationInFrames = useMemo(
    () => Math.max(1, sceneFrames.reduce((a, b) => a + b, 0)),
    [sceneFrames],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const inputProps = useMemo(
    () => ({
      scenes: OLD_DOCUMENTARY_REEL_PREVIEW_SCENES,
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "portrait",
    }),
    [accentColor, bgColor, textColor],
  );

  // Side cards are static: the moment a card is not the center card it pauses
  // and locks to the thumbnail frame, so only the centered card ever animates.
  // This fires both on initial mount as a side card and when a card is moved
  // away from center, freezing it immediately rather than letting it keep
  // rendering.
  useEffect(() => {
    if (!thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    pl.pause();
    pl.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame]);

  // When the card reaches center, restart the timeline from the top so the
  // animation plays fresh — and stop it (the thumbnail effect above pauses it)
  // the moment it moves away.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    setActiveSceneIndex(0);
    pl.seekTo(0);
    pl.play();
  }, [thumbnailMode]);

  // Keep the active-dot highlight in sync with which scene is currently playing.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    const onFrame = () => {
      const f = pl.getCurrentFrame();
      let idx = 0;
      for (let i = sceneStartFrames.length - 1; i >= 0; i--) {
        if (f >= sceneStartFrames[i]) {
          idx = i;
          break;
        }
      }
      setActiveSceneIndex((prev) => (prev === idx ? prev : idx));
    };
    pl.addEventListener("frameupdate", onFrame);
    return () => pl.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, sceneStartFrames]);

  // Clicking a dot seeks the continuous timeline to that scene's start.
  const seekToScene = (index: number) => {
    setActiveSceneIndex(index);
    const pl = playerRef.current;
    if (pl) {
      pl.seekTo(sceneStartFrames[index] ?? 0);
      if (!thumbnailMode) pl.play();
    }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      <PlayerScaledCanvas internalWidth={270} internalHeight={480}>
        <Player
          ref={playerRef}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          initialFrame={thumbnailMode ? thumbnailFrame : 0}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={fps}
          controls={false}
          autoPlay={!thumbnailMode}
          loop={!thumbnailMode}
          acknowledgeRemotionLicense
          style={{ width: 270, height: 480, display: "block" }}
        />
      </PlayerScaledCanvas>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {OLD_DOCUMENTARY_REEL_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => seekToScene(index)}
                disabled={thumbnailMode}
                className={`h-1.5 rounded-full transition-all ${isActive ? "w-5" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
                style={isActive ? { background: accentColor } : undefined}
                aria-label={`Preview ${scene.title} layout`}
                title={scene.title}
                type="button"
              />
            );
          })}
        </div>
    </div>
  );
}
