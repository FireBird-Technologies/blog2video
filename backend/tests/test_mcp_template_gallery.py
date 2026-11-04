from __future__ import annotations

from mcp_server import handlers


def test_gallery_templates_match_web_app_badge_order():
    raw = [
        {"id": "regular-a", "name": "Regular A"},
        {"id": "popular", "name": "Popular", "popular_template": True},
        {"id": "new-scenes", "name": "New Scenes", "new_scenes": True},
        {"id": "new-a", "name": "New A", "new_template": True, "preview_colors": {"accent": "#112233", "bg": "#ffffff", "text": "#000000"}},
        {"id": "regular-b", "name": "Regular B"},
        {"id": "new-b", "name": "New B", "new_template": True},
    ]

    items = handlers._built_in_gallery_templates(raw)

    assert [item["id"] for item in items] == [
        "new-a",
        "new-b",
        "new-scenes",
        "popular",
        "regular-a",
        "regular-b",
    ]
    assert items[0]["new_template"] is True
    assert items[0]["colors"]["accent"] == "#112233"
    assert items[2]["new_scenes"] is True
    assert items[3]["popular_template"] is True


def test_list_templates_sends_sorted_badge_metadata_to_widget():
    class Client:
        def list_templates(self):
            return [
                {"id": "regular", "name": "Regular"},
                {"id": "new", "name": "New", "new_template": True},
            ]

        def list_custom_templates(self):
            return []

    result = handlers._list_templates(Client())

    assert [item["id"] for item in result.structuredContent["templates"]] == [
        "new",
        "regular",
    ]
    assert result.structuredContent["templates"][0]["new_template"] is True
