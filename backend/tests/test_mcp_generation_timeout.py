from __future__ import annotations

from mcp_server import handlers
from mcp_server.tools import get_tool_definitions


class _GenerationClient:
    def __init__(self, response: dict | None = None):
        self.response = response or {"detail": "Pipeline started", "step": 0}
        self.started: list[int] = []

    def start_generation(self, project_id: int) -> dict:
        self.started.append(project_id)
        return self.response


def _tool(name: str):
    return next(tool for tool in get_tool_definitions() if tool.name == name)


def test_generate_video_returns_immediately_after_starting_pipeline():
    client = _GenerationClient()

    result = handlers._generate_video({"project_id": 2582}, client)

    assert client.started == [2582]
    assert "has started" in result[0].text
    assert "check_generation_status" in result[0].text
    assert "Do **not** call `generate_video` again" in result[0].text


def test_generate_video_retry_acknowledges_already_running_pipeline():
    client = _GenerationClient({"detail": "Pipeline already running", "step": 2})

    result = handlers._generate_video({"project_id": 2582}, client)

    assert client.started == [2582]
    assert "is already running" in result[0].text


def test_generation_tools_describe_non_blocking_poll_flow():
    generate_description = _tool("generate_video").description
    status_description = _tool("check_generation_status").description

    assert "return immediately" in generate_description
    assert "poll check_generation_status" in generate_description
    assert "Poll this after generate_video" in status_description


class _AwaitingReviewClient:
    def get_generation_status(self, project_id: int) -> dict:
        return {"status": "awaiting_script_review", "step": 2, "running": False}


def test_generation_status_returns_script_review_link_when_paused():
    result = handlers._check_generation_status({"project_id": 2582}, _AwaitingReviewClient())

    assert "Script ready for review" in result[0].text
    assert "https://blog2video.app/project/2582" in result[0].text
    assert "resumes after the script is approved" in result[0].text


class _GeneratedClient:
    preview_url = "https://blog2video.app/embed/real-preview-token"
    backend_preview_url = "http://localhost:5173/embed/real-preview-token"

    def start_generation(self, project_id: int) -> dict:
        return {"detail": "Already generated", "status": "generated"}

    def get_generation_status(self, project_id: int) -> dict:
        return {"status": "generated", "step": 4, "running": False}

    def get_project(self, project_id: int) -> dict:
        return {
            "id": project_id,
            "name": "Generated project",
            "status": "generated",
            "template": "starlit",
            "voice_gender": "male",
            "voice_accent": "british",
            "aspect_ratio": "landscape",
            "scenes": [{"order": 0, "title": "Opening", "narration_text": "Hello", "duration_seconds": 4}],
        }

    def generate_embed_token(self, project_id: int) -> dict:
        return {"embed_token": "real-preview-token", "preview_url": self.backend_preview_url}


def test_generation_complete_returns_actual_preview_url():
    client = _GeneratedClient()

    result = handlers._check_generation_status({"project_id": 2640}, client)

    assert client.preview_url in result[0].text
    assert "Actual playable preview" in result[0].text
    assert "do not substitute an illustrative image" in result[0].text


def test_get_generated_project_also_returns_actual_preview_url():
    client = _GeneratedClient()

    result = handlers._get_project({"project_id": 2640}, client)

    assert client.preview_url in result[0].text
    assert "Actual playable preview" in result[0].text


def test_generate_already_complete_returns_preview_without_polling():
    client = _GeneratedClient()

    result = handlers._generate_video({"project_id": 2640}, client)

    assert client.preview_url in result[0].text
    assert "already generated" in result[0].text


def test_get_preview_url_rewrites_local_frontend_to_public_origin():
    client = _GeneratedClient()

    result = handlers._get_preview_url({"project_id": 2640}, client)

    assert client.preview_url in result[0].text
    assert "localhost:5173" not in result[0].text
