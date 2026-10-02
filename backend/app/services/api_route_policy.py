"""Which web-app endpoints an API key may call.

``get_current_user`` (app/auth.py) accepts two credentials. A blog2video
session JWT reaches everything, as before. An API key reaches every
video-creation and editing feature listed in ``API_KEY_ROUTES``: projects,
generation, scenes, images, voiceovers, templates (including creating custom
templates), video styles, music, avatars, rendering and downloads.
``API_KEY_NEVER`` lists what stays app-only (API keys, account, billing,
collaboration, publishing, content sources, template studio, free tools...),
and those answer 403.

Matching is on the route TEMPLATE FastAPI resolved for the request
(``/api/projects/{project_id}/scenes/{scene_id}``) plus the HTTP method, never
on the raw URL, so path tricks cannot widen the list.

The public API docs (frontend/src/content/apiDocs.ts) document exactly this
list; tests/test_api_docs.py keeps the two in step.
"""
from __future__ import annotations

from fastapi import HTTPException, Request

P = "/api/projects/{project_id}"
CT = "/api/custom-templates/{template_id}"

# (method, route template) pairs an API key may call.
API_KEY_ROUTES: frozenset[tuple[str, str]] = frozenset({
    # Account
    ("GET", "/api/auth/me"),
    # Projects
    ("GET", "/api/projects"),
    ("POST", "/api/projects/upload"),
    ("GET", "/api/projects/template-availability"),
    ("GET", P),
    ("PATCH", P),
    ("DELETE", P),
    ("PATCH", f"{P}/update-project"),
    ("POST", f"{P}/logo"),
    ("DELETE", f"{P}/logo"),
    ("PATCH", f"{P}/assets/{{asset_id}}/exclude"),
    ("DELETE", f"{P}/assets/{{asset_id}}"),
    ("GET", f"{P}/layouts"),
    # Generation & status
    ("POST", f"{P}/generate"),
    ("GET", f"{P}/status"),
    ("POST", f"{P}/scrape"),
    ("POST", f"{P}/generate-script"),
    ("POST", f"{P}/generate-scenes"),
    ("POST", f"{P}/script-review/approve"),
    ("POST", f"{P}/script-review/scenes/{{scene_id}}/narration-preview"),
    ("POST", f"{P}/regenerate-script"),
    ("GET", f"{P}/regenerate-script-status"),
    ("GET", f"{P}/regenerate-script/preview"),
    ("POST", f"{P}/regenerate-script/verify"),
    ("POST", f"{P}/regenerate-script/regenerate"),
    # Scenes
    ("PUT", f"{P}/scenes/{{scene_id}}"),
    ("DELETE", f"{P}/scenes/{{scene_id}}"),
    ("PUT", f"{P}/bulk-update-scenes"),
    ("POST", f"{P}/scenes/reorder"),
    ("POST", f"{P}/scenes/{{scene_id}}/regenerate"),
    ("POST", f"{P}/scenes/add"),
    ("GET", f"{P}/scenes/add-status"),
    # Images & stock footage
    ("POST", f"{P}/scenes/{{scene_id}}/image"),
    ("POST", f"{P}/scenes/{{scene_id}}/generate-image"),
    ("PATCH", f"{P}/scenes/{{scene_id}}/image-focus"),
    ("POST", f"{P}/images/move"),
    ("POST", f"{P}/images/swap"),
    ("POST", f"{P}/images/duplicate"),
    ("POST", f"{P}/images/assign-existing"),
    ("GET", f"{P}/stock-footage/search"),
    ("POST", f"{P}/scenes/{{scene_id}}/stock-footage"),
    ("GET", f"{P}/stock-footage/pending"),
    ("POST", f"{P}/stock-footage/link"),
    ("POST", f"{P}/stock-footage/approve"),
    ("POST", f"{P}/stock-footage/reject"),
    # Voiceovers & language
    ("POST", f"{P}/scenes/{{scene_id}}/voiceover"),
    ("POST", f"{P}/delete-voiceover"),
    ("POST", f"{P}/change-voice"),
    ("GET", f"{P}/voice-change-status"),
    ("POST", f"{P}/change-language"),
    ("GET", f"{P}/language-change-status"),
    # Templates
    ("POST", f"{P}/change-template-regenerate-layouts"),
    ("GET", f"{P}/template-change-status"),
    # Avatars
    ("POST", f"{P}/avatar-batch/authorize"),
    ("POST", f"{P}/scenes/{{scene_id}}/avatar"),
    ("GET", f"{P}/scenes/{{scene_id}}/avatar-status"),
    ("DELETE", f"{P}/scenes/{{scene_id}}/avatar"),
    ("POST", f"{P}/scenes/{{scene_id}}/avatar-matte"),
    ("POST", f"{P}/avatar-matte-all"),
    ("POST", f"{P}/avatar-retry-failed"),
    ("GET", f"{P}/avatar-progress"),
    ("POST", f"{P}/avatar-portrait"),
    ("DELETE", f"{P}/avatar-portrait"),
    ("PATCH", f"{P}/scenes/{{scene_id}}/avatar-focus"),
    ("PATCH", f"{P}/scenes/{{scene_id}}/avatar-appearance"),
    # Render, download & preview
    ("POST", f"{P}/render"),
    ("GET", f"{P}/render-status"),
    ("POST", f"{P}/cancel-render"),
    ("GET", f"{P}/download-url"),
    ("GET", f"{P}/download"),
    ("GET", f"{P}/render-still"),
    ("POST", f"{P}/render-stills"),
    ("POST", "/api/embed/token/{project_id}"),
    # Catalog: templates, voices, styles, music
    ("GET", "/api/crafted-templates"),
    ("GET", "/api/crafted-templates/{template_id}"),
    ("GET", "/api/custom-templates"),
    ("GET", "/api/custom-templates/{template_id}"),
    ("GET", "/api/voices/saved"),
    ("POST", "/api/voices/saved"),
    ("DELETE", "/api/voices/saved/{voice_id}"),
    ("GET", "/api/voices/custom"),
    ("POST", "/api/voices/custom"),
    ("DELETE", "/api/voices/custom/{custom_voice_id}"),
    ("GET", "/api/voices/custom/{custom_voice_id}/preview"),
    ("POST", "/api/voices/clone"),
    ("POST", "/api/voice/preview"),
    ("POST", "/api/voices/design-from-preset"),
    ("POST", "/api/voices/design-from-prompt"),
    ("GET", "/api/video-styles"),
    ("PUT", "/api/video-styles/selection"),
    ("GET", "/api/background-music/tracks"),
    # Custom templates: create (from a URL, document or prompt), generate, edit
    ("POST", "/api/custom-templates"),
    ("POST", "/api/custom-templates/extract-theme"),
    ("POST", "/api/custom-templates/extract-theme-from-doc"),
    ("POST", "/api/custom-templates/extract-theme-from-prompt"),
    ("PUT", f"{CT}"),
    ("DELETE", f"{CT}"),
    ("GET", f"{CT}/code"),
    ("POST", f"{CT}/generate-code"),
    ("GET", f"{CT}/generation-status"),
    ("POST", f"{CT}/regenerate-code"),
    ("POST", f"{CT}/resume-generation"),
    ("POST", f"{CT}/rating"),
    ("POST", f"{CT}/upload-logo"),
    ("GET", f"{CT}/versions"),
    ("POST", f"{CT}/versions/{{version_id}}/rollback"),
    ("GET", f"{CT}/scene-drafts"),
    ("PATCH", f"{CT}/scenes/font-defaults"),
    ("POST", f"{CT}/scenes/{{scene_key}}/ai-edit"),
    ("GET", f"{CT}/scenes/{{scene_key}}/ai-edit/status"),
    ("PATCH", f"{CT}/scenes/{{scene_key}}/chart"),
    ("GET", f"{CT}/scenes/{{scene_key}}/draft"),
    ("POST", f"{CT}/scenes/{{scene_key}}/draft/apply"),
    ("POST", f"{CT}/scenes/{{scene_key}}/draft/discard"),
    ("PATCH", f"{CT}/scenes/{{scene_key}}/font-defaults"),
    # Video styles
    ("POST", "/api/video-styles/ai-draft"),
    ("POST", "/api/video-styles/custom"),
    ("PATCH", "/api/video-styles/custom/{style_id}"),
    ("DELETE", "/api/video-styles/custom/{style_id}"),
    ("PATCH", "/api/video-styles/builtin/{style_key}"),
    ("DELETE", "/api/video-styles/builtin/{style_key}"),
    ("PUT", "/api/video-styles/pin"),
    ("PATCH", "/api/video-styles/your-style"),
    ("DELETE", "/api/video-styles/your-style"),
    # Downloads
    ("GET", f"{P}/download-studio"),
    ("GET", "/api/templates/free-download/{slug}"),
    ("GET", "/api/templates/free-download-all"),
})

# Signed-in endpoints an API key may NEVER call. They stay app-only. Every
# signed-in route must be in exactly one of API_KEY_ROUTES and this set; a test
# enforces it, so adding an endpoint forces a decision about keys.
API_KEY_NEVER: frozenset[tuple[str, str]] = frozenset({
    # Credentials and access: a key must not mint, reveal or delegate access.
    ("GET", "/api/api-keys"),
    ("POST", "/api/api-keys"),
    ("DELETE", "/api/api-keys/{key_id}"),
    ("GET", "/api/api-keys/{key_id}/reveal"),
    ("POST", "/api/api-keys/{key_id}/rotate"),
    ("POST", "/api/integrations/extension/v1/connections/approve"),
    ("POST", "/api/integrations/wordpress/v1/connections/approve"),
    # Account lifecycle
    ("POST", "/api/auth/delete-account"),
    ("POST", "/api/auth/logout"),
    # Billing
    ("POST", "/api/billing/cancel"),
    ("POST", "/api/billing/cancel-scheduled-change"),
    ("POST", "/api/billing/change-plan"),
    ("POST", "/api/billing/change-plan-preview"),
    ("POST", "/api/billing/checkout"),
    ("POST", "/api/billing/checkout-bulk-credits"),
    ("POST", "/api/billing/checkout-custom-template"),
    ("POST", "/api/billing/checkout-per-video"),
    ("GET", "/api/billing/data-summary"),
    ("GET", "/api/billing/invoices"),
    ("POST", "/api/billing/portal"),
    ("POST", "/api/billing/resume"),
    ("POST", "/api/billing/retention-offer/accept"),
    ("POST", "/api/billing/retention-offer/impression"),
    ("GET", "/api/billing/status"),
    ("GET", "/api/billing/subscription"),
    # Collaboration: members, invites, comments and edit history
    ("GET", "/api/collab/invites"),
    ("POST", "/api/collab/invites/{token}/accept"),
    ("POST", "/api/collab/invites/{token}/reject"),
    ("GET", f"{P}/members"),
    ("POST", f"{P}/members"),
    ("DELETE", f"{P}/members/me"),
    ("DELETE", f"{P}/members/{{member_id}}"),
    ("GET", f"{P}/comments"),
    ("DELETE", f"{P}/comments/{{comment_id}}"),
    ("POST", f"{P}/scenes/{{scene_id}}/comments"),
    ("GET", f"{P}/history"),
    ("POST", f"{P}/history/revert"),
    ("GET", f"{P}/scenes/{{scene_id}}/history"),
    # Social publishing
    ("GET", "/api/integrations/connections"),
    ("GET", "/api/integrations/{platform}/connect-url"),
    ("DELETE", "/api/integrations/{platform}"),
    ("POST", "/api/integrations/projects/{project_id}/publish"),
    ("GET", "/api/integrations/projects/{project_id}/publish-status"),
    ("POST", "/api/integrations/projects/{project_id}/publish/{job_id}/cancel"),
    ("POST", "/api/integrations/projects/{project_id}/publish/{job_id}/retry"),
    # Content sources (WordPress / Ghost / Beehiiv)
    ("GET", "/api/sources/connections"),
    ("GET", "/api/sources/projects/{project_id}/newsletter-snippet"),
    ("GET", "/api/sources/wordpress/connect-url"),
    ("DELETE", "/api/sources/{platform}"),
    ("POST", "/api/sources/{platform}/connect"),
    ("POST", "/api/sources/{platform}/import"),
    ("GET", "/api/sources/{platform}/posts"),
    ("GET", "/api/sources/{platform}/publish-check"),
    # Template studio
    ("POST", "/api/template-studio/ai-edit/apply"),
    ("POST", "/api/template-studio/ai-edit/preview"),
    ("POST", "/api/template-studio/ai-edit/preview-apply"),
    ("POST", "/api/template-studio/ai-edit/preview-discard"),
    ("POST", "/api/template-studio/ai-edit/preview-file"),
    ("POST", "/api/template-studio/ai-edit/preview-switch"),
    ("POST", "/api/template-studio/ai-edit/propose"),
    ("POST", "/api/template-studio/ai-edit/versions"),
    ("POST", "/api/template-studio/ai-layout/create"),
    ("POST", "/api/template-studio/ai-layout/create-file"),
    ("POST", "/api/template-studio/ai-layout/rebuild"),
    ("POST", "/api/template-studio/ai-layout/rebuild-file"),
    ("POST", "/api/template-studio/render-layout"),
    ("POST", "/api/template-studio/save-source"),
    ("POST", "/api/template-studio/template/create"),
    ("POST", "/api/template-studio/template/extract-doc"),
    ("POST", "/api/template-studio/template/plan"),
    # Free tools
    ("POST", "/api/free-tools/book-cover"),
    ("POST", "/api/free-tools/extract-document"),
    ("POST", "/api/free-tools/pdf-narration"),
    ("POST", "/api/free-tools/pdf-storyboard"),
    ("POST", "/api/free-tools/pdf-summary"),
    ("POST", "/api/free-tools/pdf-video-script"),
    ("GET", "/api/free-tools/quota"),
    ("POST", "/api/free-tools/thumbnail-text"),
    ("POST", "/api/free-tools/video-script"),
    ("POST", "/api/free-tools/youtube-description"),
    # Project creation that is unsafe for API use: same-URL requests within 10
    # minutes return the in-progress project instead of a new one, and there is
    # no idempotency key. API callers create with POST /api/v1/videos instead.
    ("POST", "/api/projects"),
    ("POST", "/api/projects/bulk"),
    # Attaches documents to an empty (status `created`) project, which a key can't
    # produce: /upload extracts at once and /api/v1/videos starts generating.
    ("POST", f"{P}/upload-documents"),
    # Legacy alias of DELETE /api/video-styles/your-style, which keys use instead.
    ("DELETE", "/api/auth/me/script-preferences"),
    # AI editing by instruction (chat) and AI scene rewrites during script review.
    ("POST", f"{P}/chat"),
    ("GET", f"{P}/chat/history"),
    ("POST", f"{P}/script-review/scenes/{{scene_id}}/ai-preview"),
    # Collaborator views of the project owner's templates and voices. A key only
    # reaches its owner's projects, so the direct /api/custom-templates,
    # /api/crafted-templates and /api/voices/saved routes cover these.
    ("GET", f"{P}/custom-templates"),
    ("GET", f"{P}/custom-templates/{{template_id}}/code"),
    ("GET", f"{P}/crafted-templates"),
    ("GET", f"{P}/crafted-templates/{{template_id}}"),
    ("GET", f"{P}/voices"),
    # Not product features: feedback that emails the team, onboarding, internal
    # observability, and a local-dev-only Remotion launcher.
    ("POST", f"{P}/review"),
    ("POST", f"{P}/avatar-review"),
    ("POST", "/api/contact/custom-template-request"),
    ("POST", "/api/affiliate/survey"),
    ("GET", "/api/crafted-templates/cache-stats"),
    ("POST", f"{P}/launch-studio"),
})

def route_key(request: Request) -> tuple[str, str] | None:
    route = request.scope.get("route")
    path = getattr(route, "path_format", None) or getattr(route, "path", None)
    if not path:
        return None
    return request.method.upper(), path


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={
            "error": "endpoint_not_available_with_api_key",
            "message": "This endpoint can't be called with an API key. See the API docs for the supported endpoints.",
        },
    )


def enforce_api_key(request: Request) -> None:
    if route_key(request) not in API_KEY_ROUTES:
        raise _forbidden()
