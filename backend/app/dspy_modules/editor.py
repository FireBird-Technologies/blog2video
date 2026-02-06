import json
import dspy

from app.config import settings


class EditScript(dspy.Signature):
    """
    Edit a video script based on user instructions. You are a helpful video editing
    assistant that modifies explainer video scripts.

    Given the current script (as JSON), user's edit request, and conversation history,
    produce an updated script that accurately reflects the requested changes.

    Be precise: only change what the user asks for. Maintain the overall structure
    and coherence of the video.
    """

    current_script: str = dspy.InputField(
        desc="Current video script as JSON array of scenes"
    )
    user_request: str = dspy.InputField(
        desc="The user's edit request in natural language"
    )
    conversation_history: str = dspy.InputField(
        desc="Previous chat messages for context"
    )

    updated_script: str = dspy.OutputField(
        desc="Updated script as JSON array of scenes (same format as input)"
    )
    changes_made: str = dspy.OutputField(
        desc="Brief summary of what changes were made"
    )
    explanation: str = dspy.OutputField(
        desc="Explanation of why these changes were made and how they improve the video"
    )


class CritiqueEdit(dspy.Signature):
    """
    Review an edit made to a video script. Check if the edit is coherent, factually
    consistent with the original blog content, and accurately fulfills the user's request.

    If the edit has problems, describe them. If it's good, say so.
    """

    original_script: str = dspy.InputField(desc="The original script before editing")
    edited_script: str = dspy.InputField(desc="The script after editing")
    user_request: str = dspy.InputField(desc="What the user asked for")

    is_good: bool = dspy.OutputField(desc="True if the edit is satisfactory, False if it needs improvement")
    critique: str = dspy.OutputField(
        desc="Detailed critique of the edit. What's good, what's wrong, what should be fixed."
    )


class ScriptEditor:
    """
    DSPy-based script editor with reflexion.
    Uses a generate-then-critique loop to ensure high quality edits.
    """

    MAX_RETRIES = 2

    def __init__(self):
        self._configure_dspy()
        self.editor = dspy.ChainOfThought(EditScript)
        self.critic = dspy.ChainOfThought(CritiqueEdit)

    def _configure_dspy(self):
        lm = dspy.LM(
            "anthropic/claude-sonnet-4-20250514",
            api_key=settings.ANTHROPIC_API_KEY,
        )
        dspy.configure(lm=lm)

    def edit(
        self,
        current_scenes: list[dict],
        user_request: str,
        conversation_history: list[dict] | None = None,
    ) -> dict:
        """
        Edit the script with reflexion loop.

        Returns:
            dict with 'scenes', 'changes_made', 'explanation'
        """
        current_script_json = json.dumps(current_scenes, indent=2)
        history_str = self._format_history(conversation_history or [])

        # Initial edit
        edit_result = self.editor(
            current_script=current_script_json,
            user_request=user_request,
            conversation_history=history_str,
        )

        updated_script = edit_result.updated_script
        changes_made = edit_result.changes_made
        explanation = edit_result.explanation

        # Reflexion loop: critique and retry if needed
        for attempt in range(self.MAX_RETRIES):
            critique_result = self.critic(
                original_script=current_script_json,
                edited_script=updated_script,
                user_request=user_request,
            )

            if critique_result.is_good:
                break

            # Retry with the critique feedback
            enhanced_request = (
                f"Original request: {user_request}\n\n"
                f"Previous attempt had issues: {critique_result.critique}\n\n"
                f"Please fix these issues while fulfilling the original request."
            )

            edit_result = self.editor(
                current_script=current_script_json,
                user_request=enhanced_request,
                conversation_history=history_str,
            )
            updated_script = edit_result.updated_script
            changes_made = edit_result.changes_made
            explanation = edit_result.explanation

        # Parse the updated scenes
        scenes = self._parse_scenes(updated_script)

        return {
            "scenes": scenes,
            "changes_made": changes_made,
            "explanation": explanation,
        }

    def _format_history(self, history: list[dict]) -> str:
        """Format conversation history for the prompt."""
        if not history:
            return "No previous conversation."

        lines = []
        for msg in history[-10:]:  # Last 10 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    def _parse_scenes(self, scenes_json: str) -> list[dict]:
        """Parse scenes JSON, handling potential formatting issues."""
        try:
            cleaned = scenes_json.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])

            scenes = json.loads(cleaned)
            if not isinstance(scenes, list):
                scenes = [scenes]
            return scenes
        except json.JSONDecodeError:
            # Return as a single modified scene
            return [{"title": "Modified Content", "narration": scenes_json[:500],
                      "visual_description": "Updated content", "suggested_images": [],
                      "duration_seconds": 15}]
