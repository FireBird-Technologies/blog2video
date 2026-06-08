"""
Blog2Video MCP server — local stdio entry point.

Reads B2V_JWT_TOKEN from the environment and exposes the same 10 tools that
the hosted HTTP/SSE server exposes. Tool definitions and handlers are shared
via mcp_server.tools and mcp_server.handlers, so any change here propagates
to both transports.

Usage:
    B2V_JWT_TOKEN=<token> python -m mcp_server.server
"""
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_server.client import Blog2VideoClient
from mcp_server.config import get_config
from mcp_server.handlers import dispatch
from mcp_server.tools import get_tool_definitions

server = Server("blog2video")
_client: Blog2VideoClient | None = None


def _get_client() -> Blog2VideoClient:
    global _client
    if _client is None:
        _client = Blog2VideoClient()  # reads B2V_* env vars
    return _client


@server.list_tools()
async def list_tools() -> list[Tool]:
    return get_tool_definitions()


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    cfg = get_config()
    return dispatch(
        name,
        arguments,
        _get_client(),
        poll_interval=cfg.poll_interval,
        poll_timeout_generate=cfg.poll_timeout_generate,
        poll_timeout_render=cfg.poll_timeout_render,
    )


async def _main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main():
    import asyncio
    asyncio.run(_main())


if __name__ == "__main__":
    main()
