"""MCP-UI / MCP Apps resources for Blog2Video tools.

Built HTML lives in ``views/`` and is produced by the Vite project at
``backend/mcp_server/ui_src/`` (see ``ui_src/package.json``). Each handler
that wants a rich in-chat UI loads its bundled HTML via :func:`load_html`
and wraps it in a :class:`mcp_ui_server.UIResource` returned from the tool
call (alongside the existing markdown fallback content).
"""
from mcp_server.ui.resources import load_html

__all__ = ["load_html"]
