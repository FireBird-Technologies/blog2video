import json
import dspy

from app.dspy_modules import ensure_dspy_configured


class EditScript(dspy.Signature):
    """
    Edit a video script based on user instructions. You are a helpful video editing
    assistant that modifies explainer video scripts.

    Given the current script (as JSON), user's edit request, and conversation history,
    produce ONLY the scenes that need to change. Return the updated scene(s) as a
    JSON array. Each scene MUST include an "order" field (1-based) so the system
    knows which scene to update.

    CRITICAL RULES:
    - Only return scenes that you actually changed.
    - Do NOT return unchanged scenes.
    - Preserve the "order" field exactly to match the original scene.
    - Never add or remove scenes -- only modify existing ones.
    - Do NOT touch Scene 1 (the title/intro scene) unless explicitly asked.
    """

    current_script: str = dspy.InputField(
        desc="Current video script as JSON array of scenes (each has 'order', 'title', 'narration', 'visual_description', 'duration_seconds')"
    )
    user_request: str = dspy.InputField(
        desc="The user's edit request in natural language"
    )
    conversation_history: str = dspy.InputField(
        desc="Previous chat messages for context"
    )

    updated_scenes: str = dspy.OutputField(
        desc='JSON array of ONLY the modified scenes. Each MUST include "order" (int), '
        '"title" (str), "narration" (str), "visual_description" (str), "duration_seconds" (int). '
        'Return ONLY changed scenes, not the entire script.'
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

    Also verify that ONLY the requested scenes were changed and no others were modified.

    If the edit has problems, describe them. If it's good, say so.
    """

    original_script: str = dspy.InputField(desc="The original script before editing")
    edited_scenes: str = dspy.InputField(desc="The modified scenes (partial, not full script)")
    user_request: str = dspy.InputField(desc="What the user asked for")

    is_good: bool = dspy.OutputField(desc="True if the edit is satisfactory, False if it needs improvement")
    critique: str = dspy.OutputField(
        desc="Detailed critique of the edit. What's good, what's wrong, what should be fixed."
    )


class ScriptEditor:
    """
    DSPy-based script editor with reflexion (async).
    Returns ONLY changed scenes to preserve voiceover and Remotion code for untouched ones.
    """

    MAX_RETRIES = 2

    def __init__(self):
        ensure_dspy_configured()
        self._editor = dspy.ChainOfThought(EditScript)
        self._critic = dspy.ChainOfThought(CritiqueEdit)
        self.editor = dspy.asyncify(self._editor)
        self.critic = dspy.asyncify(self._critic)

    async def edit(
        self,
        current_scenes: list[dict],
        user_request: str,
        conversation_history: list[dict] | None = None,
    ) -> dict:
        """
        Edit the script with reflexion loop (async).
        Returns ONLY the changed scenes with their 'order' field intact.

        Returns:
            dict with 'changed_scenes' (list of dicts with 'order'), 'changes_made', 'explanation'
        """
        current_script_json = json.dumps(current_scenes, indent=2)
        history_str = self._format_history(conversation_history or [])

        # Initial edit
        edit_result = await self.editor(
            current_script=current_script_json,
            user_request=user_request,
            conversation_history=history_str,
        )

        updated_scenes_json = edit_result.updated_scenes
        changes_made = edit_result.changes_made
        explanation = edit_result.explanation

        # Reflexion loop: critique and retry if needed
        for attempt in range(self.MAX_RETRIES):
            critique_result = await self.critic(
                original_script=current_script_json,
                edited_scenes=updated_scenes_json,
                user_request=user_request,
            )

            if critique_result.is_good:
                break

            enhanced_request = (
                f"Original request: {user_request}\n\n"
                f"Previous attempt had issues: {critique_result.critique}\n\n"
                f"Please fix these issues while fulfilling the original request. "
                f"Remember: only return the scenes you changed, with their 'order' field."
            )

            edit_result = await self.editor(
                current_script=current_script_json,
                user_request=enhanced_request,
                conversation_history=history_str,
            )
            updated_scenes_json = edit_result.updated_scenes
            changes_made = edit_result.changes_made
            explanation = edit_result.explanation

        # Parse the changed scenes
        changed_scenes = self._parse_scenes(updated_scenes_json)

        return {
            "changed_scenes": changed_scenes,
            "changes_made": changes_made,
            "explanation": explanation,
        }

    def _format_history(self, history: list[dict]) -> str:
        """Format conversation history for the prompt."""
        if not history:
            return "No previous conversation."

        lines = []
        for msg in history[-10:]:
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
            return [{"order": 1, "title": "Modified Content", "narration": scenes_json[:500],
                      "visual_description": "Updated content", "suggested_images": [],
                      "duration_seconds": 15}]
