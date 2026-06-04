import logging
import time
import requests

logger = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


class Blog2VideoClient:
    """HTTP client for the Blog2Video FastAPI backend.

    Two construction modes:
      - Explicit: Blog2VideoClient(jwt_token=..., base_url=...) — used by the
        hosted HTTP/SSE MCP server, which passes the per-request user JWT.
      - Default: Blog2VideoClient() — falls back to B2V_* env vars via
        mcp_server.config.get_config(). Used by the local stdio server.
    """

    def __init__(self, jwt_token: str | None = None, base_url: str | None = None):
        if jwt_token is None or base_url is None:
            # Lazy import so the hosted server doesn't need pydantic-settings
            # validation against env vars on every request.
            from mcp_server.config import get_config
            cfg = get_config()
            jwt_token = jwt_token or cfg.jwt_token
            base_url = base_url or cfg.api_base_url

        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {jwt_token}"
        self.base = base_url.rstrip("/")

    def _raise(self, resp: requests.Response) -> None:
        if resp.status_code == 401:
            raise APIError(401, "Unauthorized — rotate B2V_JWT_TOKEN (JWT may have expired).")
        if not resp.ok:
            try:
                detail = resp.json().get("detail", resp.text)
            except Exception:
                detail = resp.text
            raise APIError(resp.status_code, str(detail))

    def _log(self, method: str, path: str, status: int, ms: float) -> None:
        logger.info("MCP_HTTP %s %s -> %d (%.0fms)", method, path, status, ms)

    def _get(self, path: str, **params) -> dict:
        t0 = time.time()
        resp = self.session.get(f"{self.base}{path}", params=params or None)
        self._log("GET", path, resp.status_code, (time.time() - t0) * 1000)
        self._raise(resp)
        return resp.json()

    def _post(self, path: str, json: dict | None = None, **params) -> dict:
        t0 = time.time()
        resp = self.session.post(f"{self.base}{path}", json=json, params=params or None)
        self._log("POST", path, resp.status_code, (time.time() - t0) * 1000)
        self._raise(resp)
        return resp.json()

    def _put(self, path: str, json: dict | None = None) -> dict:
        t0 = time.time()
        resp = self.session.put(f"{self.base}{path}", json=json)
        self._log("PUT", path, resp.status_code, (time.time() - t0) * 1000)
        self._raise(resp)
        return resp.json()

    def _patch(self, path: str, json: dict | None = None) -> dict:
        t0 = time.time()
        resp = self.session.patch(f"{self.base}{path}", json=json)
        self._log("PATCH", path, resp.status_code, (time.time() - t0) * 1000)
        self._raise(resp)
        return resp.json()

    # --- Projects ---

    def create_project(self, **fields) -> dict:
        return self._post("/api/projects", json=fields)

    def list_projects(self) -> list:
        return self._get("/api/projects")

    def get_project(self, project_id: int) -> dict:
        return self._get(f"/api/projects/{project_id}")

    # --- Pipeline ---

    def start_generation(self, project_id: int) -> dict:
        return self._post(f"/api/projects/{project_id}/generate")

    def get_generation_status(self, project_id: int) -> dict:
        return self._get(f"/api/projects/{project_id}/status")

    # --- Scenes ---

    def update_scene(self, project_id: int, scene_id: int, **fields) -> dict:
        return self._put(f"/api/projects/{project_id}/scenes/{scene_id}", json=fields)

    # --- Render ---

    def start_render(self, project_id: int, force_render: bool = False) -> dict:
        return self._post(
            f"/api/projects/{project_id}/render",
            force_render="true" if force_render else "false",
        )

    def get_render_status(self, project_id: int) -> dict:
        return self._get(f"/api/projects/{project_id}/render-status")

    # --- Reference data ---

    def list_templates(self) -> list:
        return self._get("/api/templates")

    def list_voices(self) -> list:
        return self._get("/api/voices/prebuilt")

    def get_me(self) -> dict:
        """Current user record — {id, email, plan, ...}.

        Used by MCP tool handlers that need user_id (e.g. to call
        ensure_free_voices_for_user when seeding on first MCP login).
        """
        return self._get("/api/auth/me")

    def list_saved_voices(self) -> list:
        """Per-user saved voices — same source the frontend Step 3 picker uses.

        New users have 4 free voices seeded (Rachel, Bill, Alice, Daniel) by
        ensure_free_voices_for_user() on first login.
        """
        return self._get("/api/voices/saved")

    # --- New edit endpoints (Rich-UX MCP tools) ---

    def change_template(self, project_id: int, template: str) -> dict:
        """POST /api/projects/{id}/change-template-regenerate-layouts.
        Returns ProjectTemplateChangeJobOut (async job)."""
        return self._post(
            f"/api/projects/{project_id}/change-template-regenerate-layouts",
            json={"template": template},
        )

    def get_template_change_status(self, project_id: int) -> dict | None:
        """GET /api/projects/{id}/template-change-status. May return null."""
        resp = self.session.get(f"{self.base}/api/projects/{project_id}/template-change-status")
        self._raise(resp)
        # Endpoint returns null if no job exists
        try:
            return resp.json()
        except Exception:
            return None

    def update_project_settings(self, project_id: int, **fields) -> dict:
        """PATCH /api/projects/{id}/update-project."""
        return self._patch(f"/api/projects/{project_id}/update-project", json=fields)

    def regenerate_scene(
        self,
        project_id: int,
        scene_id: int,
        description: str | None = None,
        narration_text: str | None = None,
        layout: str | None = None,
        regenerate_voiceover: bool = False,
    ) -> dict:
        """POST /api/projects/{id}/scenes/{scene_id}/regenerate.
        This endpoint uses multipart/form-data (Form fields, not JSON)."""
        data = {"regenerate_voiceover": "true" if regenerate_voiceover else "false"}
        if description is not None:
            data["description"] = description
        if narration_text is not None:
            data["narration_text"] = narration_text
        if layout is not None:
            data["layout"] = layout
        resp = self.session.post(
            f"{self.base}/api/projects/{project_id}/scenes/{scene_id}/regenerate",
            data=data,
        )
        self._raise(resp)
        return resp.json()

    def reorder_scenes(self, project_id: int, ordered_scene_ids: list[int]) -> list:
        """POST /api/projects/{id}/scenes/reorder.
        Accepts a flat list of scene IDs in desired order; we translate to the
        {scene_orders: [{scene_id, order}]} body the API expects."""
        scene_orders = [
            {"scene_id": int(sid), "order": idx}
            for idx, sid in enumerate(ordered_scene_ids)
        ]
        return self._post(
            f"/api/projects/{project_id}/scenes/reorder",
            json={"scene_orders": scene_orders},
        )

    def swap_scene_images(self, project_id: int, first_scene_id: int, second_scene_id: int) -> dict:
        """POST /api/projects/{id}/images/swap."""
        return self._post(
            f"/api/projects/{project_id}/images/swap",
            json={"first_scene_id": first_scene_id, "second_scene_id": second_scene_id},
        )

    def move_scene_image(self, project_id: int, from_scene_id: int, to_scene_id: int) -> dict:
        """POST /api/projects/{id}/images/move."""
        return self._post(
            f"/api/projects/{project_id}/images/move",
            json={"from_scene_id": from_scene_id, "to_scene_id": to_scene_id},
        )

    # --- Custom-template creation flow (guided in-chat) ---

    def extract_template_theme(self, url: str) -> dict:
        """POST /api/custom-templates/extract-theme.
        Returns {extractable, reason, theme, template_name, logo_urls, og_image, screenshot_url}.
        Sync, ~10–20s (web scrape + LLM extraction)."""
        return self._post("/api/custom-templates/extract-theme", json={"url": url})

    def create_custom_template(
        self,
        name: str,
        theme: dict,
        source_url: str | None = None,
        logo_urls: list[str] | None = None,
        og_image: str | None = None,
        screenshot_url: str | None = None,
        reason: str | None = None,
    ) -> dict:
        """POST /api/custom-templates.
        Persists the template + auto-creates a linked BrandKit. Returns the
        full CustomTemplateOut with id but no generated code yet."""
        body: dict = {"name": name, "theme": theme}
        if source_url is not None:
            body["source_url"] = source_url
        if logo_urls is not None:
            body["logo_urls"] = logo_urls
        if og_image is not None:
            body["og_image"] = og_image
        if screenshot_url is not None:
            body["screenshot_url"] = screenshot_url
        if reason is not None:
            body["reason"] = reason
        return self._post("/api/custom-templates", json=body)

    def list_custom_templates(self) -> list:
        """GET /api/custom-templates."""
        return self._get("/api/custom-templates")

    def get_custom_template(self, template_id: int) -> dict:
        """GET /api/custom-templates/{id}."""
        return self._get(f"/api/custom-templates/{template_id}")

    def start_template_code_generation(self, template_id: int) -> dict:
        """POST /api/custom-templates/{id}/generate-code.
        Returns 202 Accepted; codegen runs in background (~5–7 minutes)."""
        return self._post(f"/api/custom-templates/{template_id}/generate-code")

    def get_template_code_generation_status(self, template_id: int) -> dict:
        """GET /api/custom-templates/{id}/generation-status.
        Returns {status, step, running, error}."""
        return self._get(f"/api/custom-templates/{template_id}/generation-status")


