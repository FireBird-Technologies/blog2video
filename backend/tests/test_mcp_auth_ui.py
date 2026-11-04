from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.routers import mcp_auth_ui
from app.services import mcp_provider


SITE = "https://blog2video.app"
BACKEND = "https://api.blog2video.app"
GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth?example=1"


def _signup(**overrides) -> str:
    return mcp_auth_ui.signup_page(
        code="pending-code",
        backend=BACKEND,
        google_url=GOOGLE,
        site_url=SITE,
        **overrides,
    )


def test_signup_matches_public_blog2video_auth_surface():
    html = _signup()

    assert "Create your Blog2Video account" in html
    assert "Choose how you'd like to get started." in html
    assert "Continue with Google" in html
    assert 'placeholder="you@example.com"' in html
    assert '>Continue</span>' in html
    assert "Already have an account?" in html
    assert f'href="{BACKEND}/mcp/google-start?code=pending-code">Sign in</a>' in html
    assert "By continuing you agree to our" in html


def test_auth_surface_uses_the_same_layout_tokens_as_the_web_app():
    html = _signup()

    assert ".topbar-inner{width:100%;max-width:1152px;margin:auto;padding:12px 24px" in html
    assert ".logo{width:36px;height:36px;border-radius:8px;background:#9333ea" in html
    assert ".stack{width:100%;max-width:512px;border-radius:16px;background:#fff;padding:32px 40px}" in html
    assert ".column{width:340px;max-width:100%}" in html
    assert "h1{font-size:24px;line-height:32px" in html
    assert "border-top:4px solid" not in html
    assert 'class="auth-body"' in html
    assert 'class="column" method="post"' in html
    assert "form[data-email-stage]" in html
    assert "submit.disabled=!email.value.trim()||!email.checkValidity()" in html
    assert ".btn.primary{min-height:40px;padding:10px 16px;border:0;background:#9333ea" in html
    assert ".btn[disabled]{opacity:.5" in html
    assert 'font:16px/1.5 "Plus Jakarta Sans","Inter"' in html
    assert "h1{font-size:24px;line-height:32px;margin:0;text-align:center;letter-spacing:normal;font-weight:600;color:#111827}" in html
    assert '.btn.google{position:relative;width:300px;min-height:44px' in html
    assert 'color:#3c4043;\nfont-family:"Roboto",Arial,sans-serif;font-size:14px;line-height:20px;font-weight:400' in html
    assert '.btn.google svg{position:absolute;left:12px}' in html
    assert '.foot a{color:inherit;text-decoration:underline}' in html
    assert 'id="menu-toggle"' in html
    assert 'id="mobile-nav"' in html


def test_auth_shell_has_reference_navigation_and_no_old_mcp_card_chrome():
    html = _signup()

    for path, label in (
        ("/blog-to-video", "Blog to Video"),
        ("/for-technical-bloggers", "Use Cases"),
        ("/templates/nightfall", "Templates"),
        ("/tools", "Tools"),
        ("/help", "Help"),
        ("/blogs", "Blog"),
        ("/api-docs", "API docs"),
        ("/pricing", "Pricing"),
        ("/contact", "Contact"),
    ):
        assert f'href="{SITE}{path}"' in html
        assert label in html

    assert "MCP connection" not in html
    assert "Secure authorization powered by Blog2Video" not in html
    assert 'class="tabs"' not in html
    assert "linear-gradient(180deg,#faf7ff" not in html


def test_signup_reveals_name_and_password_after_email_continue():
    first = _signup()
    retry = _signup(error="Password needs an uppercase letter.", email="person@example.com")

    assert "<div data-auth-details hidden>" in first
    assert 'data-next-label="Send verification code"' in first
    assert 'name="password" required disabled' in first
    assert "i.disabled=false" in first
    assert 'placeholder="Your name (optional)"' in first
    assert 'placeholder="Create a password"' in first
    assert "<div data-auth-details>" in retry
    assert 'name="password" required disabled' not in retry
    assert "Password needs an uppercase letter." in retry
    assert 'value="person@example.com"' in retry


def test_login_uses_matching_copy_and_create_account_toggle():
    html = mcp_auth_ui.login_page(
        code="pending-code",
        backend=BACKEND,
        google_url=GOOGLE,
        site_url=SITE,
    )

    assert "Sign in to Blog2Video" in html
    assert "Choose how you'd like to continue." in html
    assert "Don't have an account?" in html
    assert f'href="{BACKEND}/mcp/signup?code=pending-code">Create account</a>' in html
    assert "<div data-auth-details hidden>" in html


@pytest.mark.asyncio
async def test_new_mcp_connections_open_on_create_account(monkeypatch):
    class _Session:
        def add(self, _row):
            pass

        def commit(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(mcp_provider, "SessionLocal", lambda: _Session())
    monkeypatch.setattr(mcp_provider.settings, "BACKEND_URL", BACKEND)
    provider = mcp_provider.BlogVideoOAuthProvider()

    url = await provider.authorize(
        SimpleNamespace(client_id="client", client_name="Client"),
        SimpleNamespace(
            redirect_uri="https://chat.example/callback",
            code_challenge="challenge",
            scopes=[],
            state="state",
        ),
    )

    assert url.startswith(f"{BACKEND}/mcp/signup?code=")
