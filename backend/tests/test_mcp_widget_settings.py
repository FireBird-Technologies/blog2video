from __future__ import annotations

from pathlib import Path

import pytest

from mcp_server.tools import get_tool_definitions


BACKEND = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    "relative_path",
    [
        "mcp_server/ui_src/settings_panel.html",
        "mcp_server/ui_src/setup_gallery.html",
        "mcp_server/ui/views/settings_panel.html",
        "mcp_server/ui/views/setup_gallery.html",
    ],
)
def test_widget_uses_explicit_length_and_style_defaults(relative_path: str):
    html = (BACKEND / relative_path).read_text(encoding="utf-8")

    assert "Auto (recommended)" not in html
    assert '<option value="short" selected>Short · 4–5 scenes</option>' in html
    assert '<option value="explainer" selected>Explainer</option>' in html


def test_widget_resource_versions_are_bumped_for_cached_hosts():
    tools = (BACKEND / "mcp_server/tools.py").read_text(encoding="utf-8")
    transport = (BACKEND / "app/routers/mcp_transport.py").read_text(encoding="utf-8")

    assert "ui://blog2video/setup_gallery_v26" in tools
    assert "ui://blog2video/settings_panel_v5" in tools
    assert '_SETTINGS_URI = "ui://blog2video/settings_panel_v5"' in transport


@pytest.mark.parametrize(
    "relative_path",
    [
        "mcp_server/ui_src/setup_gallery.html",
        "mcp_server/ui/views/setup_gallery.html",
    ],
)
def test_setup_widget_is_a_three_step_form(relative_path: str):
    html = (BACKEND / relative_path).read_text(encoding="utf-8")

    assert html.count('data-step-panel="1"') == 1
    assert html.count('data-step-panel="2"') == 1
    assert html.count('data-step-panel="3"') == 1
    assert 'id="back"' in html
    assert 'id="next"' in html
    assert 'id="create"' in html
    assert 'id="source-card"' in html
    assert 'id="source-text"' in html
    assert '<span class="step-text">Project</span>' in html
    assert '<span class="step-text">Template</span>' in html
    assert '<span class="step-text">Voice</span>' in html
    assert '<span class="step-text">Finish</span>' not in html
    assert 'id="s-review"' not in html
    assert 'data-key="script_review_enabled"' not in html
    assert 'data-source-mode="link"' in html
    assert 'data-source-mode="upload"' in html
    assert 'data-source-mode="bulk"' in html
    assert 'id="document-input"' in html
    assert 'id="bulk-rows"' in html
    assert 'id="bulk-template-tabs"' in html
    assert 'id="bulk-template-all"' in html
    assert 'data-media-tab="music"' in html
    assert 'id="bgm-tracks"' in html
    assert 'font-family: "Plus Jakarta Sans"' in html


def test_setup_widget_performs_mcp_apps_handshake():
    source = (BACKEND / "mcp_server/ui_src/setup_gallery.html").read_text(encoding="utf-8")

    assert 'from "@modelcontextprotocol/ext-apps"' in source
    assert "mcpApp.connect()" in source


def test_bulk_widget_submits_each_rows_selected_template():
    html = (BACKEND / "mcp_server/ui_src/setup_gallery.html").read_text(encoding="utf-8")

    assert 'template: bulkTemplateIds[row.index] || selTemplate' in html


@pytest.mark.parametrize(
    "relative_path",
    [
        "mcp_server/ui_src/setup_gallery.html",
        "mcp_server/ui/views/setup_gallery.html",
    ],
)
def test_bulk_widget_renders_voice_tabs_per_video(relative_path: str):
    html = (BACKEND / relative_path).read_text(encoding="utf-8")

    assert 'id="bulk-voice-tabs"' in html
    assert 'id="bulk-voice-all"' in html
    assert "Apply settings to all videos" in html
    assert 'id="bulk-language"' in html
    assert 'id="bulk-no-voice"' in html
    assert 'class="premium-pill"' in html


def test_bulk_widget_submits_each_rows_selected_voice():
    html = (BACKEND / "mcp_server/ui_src/setup_gallery.html").read_text(encoding="utf-8")

    assert "bulkVoiceForRow(row.index)" in html
    assert "projectArgs.custom_voice_id = rowVoice.voice_id" in html
    assert "projectArgs.content_language = rowLanguage" in html
    assert 'rowGender !== "none"' in html


def test_bulk_tool_accepts_language_and_no_voiceover():
    bulk = next(tool for tool in get_tool_definitions() if tool.name == "create_projects_bulk")
    properties = bulk.inputSchema["properties"]["projects"]["items"]["properties"]

    assert properties["content_language"]["type"] == "string"
    assert properties["voice_emotion"]["type"] == "string"
    assert "none" in properties["voice_gender"]["enum"]


@pytest.mark.parametrize(
    "relative_path",
    [
        "mcp_server/ui_src/setup_gallery.html",
        "mcp_server/ui/views/setup_gallery.html",
        "mcp_server/ui/views/template_gallery.html",
        "mcp_server/ui/views/voice_gallery.html",
        "mcp_server/ui/views/settings_panel.html",
    ],
)
def test_mcp_widgets_bundle_the_main_app_font(relative_path: str):
    html = (BACKEND / relative_path).read_text(encoding="utf-8")

    assert "Plus Jakarta Sans" in html
    assert "@font-face" in html


def test_setup_url_source_is_prefilled_into_an_editable_input():
    html = (BACKEND / "mcp_server/ui_src/setup_gallery.html").read_text(encoding="utf-8")

    assert 'linkInput.value = source.url;' in html
    assert 'card.hidden = true;' in html
    assert 'linkField.hidden = false;' in html
    assert 'value.trim() || data.blog_url' not in html
