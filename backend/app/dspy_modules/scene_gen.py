import json
import dspy

from app.config import settings


REMOTION_EXAMPLE = """
// Example Remotion scene component:
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const ExampleScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({
  title, narration, imageUrl
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e", padding: 60 }}>
      {imageUrl && (
        <Img src={imageUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>
        <h1 style={{ color: "white", fontSize: 48, opacity: titleOpacity }}>{title}</h1>
        <p style={{ color: "#e0e0e0", fontSize: 24, marginTop: 20, opacity: textOpacity, lineHeight: 1.6 }}>{narration}</p>
      </div>
    </AbsoluteFill>
  );
};
"""


class SceneToRemotion(dspy.Signature):
    """
    Generate valid Remotion (React) component code for a single video scene.

    The component must:
    - Use Remotion hooks (useCurrentFrame, useVideoConfig) for animations
    - Use interpolate() for smooth transitions
    - Use AbsoluteFill as the root container
    - Use Img from remotion for images (not HTML img)
    - Be a default-exported functional React component
    - Accept props: { title: string, narration: string, imageUrl?: string }
    - Have engaging animations and professional styling
    - NOT import React (it's available globally with JSX transform)

    Output ONLY the complete TypeScript/JSX code, no markdown fences.
    """

    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text for this scene")
    visual_description: str = dspy.InputField(desc="Description of what should be shown visually")
    available_images: str = dspy.InputField(desc="JSON array of available image paths/URLs")
    scene_index: int = dspy.InputField(desc="Index of this scene (0-based)")
    total_scenes: int = dspy.InputField(desc="Total number of scenes in the video")
    example_code: str = dspy.InputField(desc="Example Remotion component for reference")

    remotion_jsx: str = dspy.OutputField(
        desc="Complete, valid Remotion React component code (TypeScript/JSX). "
        "Must be a single default-exported component. No markdown fences."
    )


class SceneCodeGenerator:
    """Service that uses DSPy to generate Remotion component code for each scene."""

    def __init__(self):
        self._configure_dspy()
        self.generator = dspy.ChainOfThought(SceneToRemotion)

    def _configure_dspy(self):
        lm = dspy.LM(
            "anthropic/claude-sonnet-4-20250514",
            api_key=settings.ANTHROPIC_API_KEY,
        )
        dspy.configure(lm=lm)

    def generate_scene_code(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
        available_images: list[str],
        scene_index: int,
        total_scenes: int,
    ) -> str:
        """
        Generate Remotion component code for a single scene.

        Returns:
            str: Valid Remotion React component code
        """
        result = self.generator(
            scene_title=scene_title,
            narration=narration,
            visual_description=visual_description,
            available_images=json.dumps(available_images),
            scene_index=scene_index,
            total_scenes=total_scenes,
            example_code=REMOTION_EXAMPLE,
        )

        return self._clean_code(result.remotion_jsx)

    def _clean_code(self, code: str) -> str:
        """Remove any markdown fences and clean up the generated code."""
        code = code.strip()

        # Remove markdown code fences if present
        if code.startswith("```"):
            lines = code.split("\n")
            # Remove first and last lines (the fences)
            if lines[-1].strip() == "```":
                lines = lines[1:-1]
            else:
                lines = lines[1:]
            code = "\n".join(lines)

        return code.strip()
