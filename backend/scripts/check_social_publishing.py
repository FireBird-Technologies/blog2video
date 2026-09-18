"""Pre-flight check for the social publishing setup.

Reads your .env and reports what is configured, what is missing, and the exact
redirect URI to paste into the Google Cloud console. Read-only: it never calls a
provider, never touches the database, and never prints a secret.

    cd backend && ./venv/bin/python scripts/check_social_publishing.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings  # noqa: E402
from app.services import social_oauth, token_crypto  # noqa: E402

OK = "\033[92m✓\033[0m"
BAD = "\033[91m✗\033[0m"
WARN = "\033[93m!\033[0m"


def mask(value: str) -> str:
    """Show enough to identify a value without revealing it."""
    if not value:
        return "(unset)"
    if len(value) <= 8:
        return "********"
    return f"{value[:4]}…{value[-4:]}"


def main() -> int:
    print("\n\033[1mSocial publishing pre-flight\033[0m\n")
    problems: list[str] = []

    # ─── Encryption key ──────────────────────────────────────
    if token_crypto.is_configured():
        print(f"{OK} SOCIAL_TOKEN_ENC_KEY  {mask(settings.SOCIAL_TOKEN_ENC_KEY)}")
    else:
        print(f"{BAD} SOCIAL_TOKEN_ENC_KEY  not set or invalid")
        problems.append(
            "Generate one:\n"
            '     ./venv/bin/python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"\n'
            "   then add it to backend/.env as SOCIAL_TOKEN_ENC_KEY=..."
        )

    # ─── URLs ────────────────────────────────────────────────
    backend = (settings.BACKEND_URL or "").rstrip("/")
    frontend = settings.FRONTEND_URL or ""
    if backend:
        print(f"{OK} BACKEND_URL           {backend}")
        if backend.startswith("http://") and "localhost" not in backend:
            print(f"  {WARN} Google requires https for a non-localhost redirect URI.")
    else:
        print(f"{BAD} BACKEND_URL           not set")
        problems.append("Set BACKEND_URL — the OAuth redirect URI is built from it.")

    if frontend:
        print(f"{OK} FRONTEND_URL          {frontend}")
    else:
        print(f"{BAD} FRONTEND_URL          not set")
        problems.append(
            "Set FRONTEND_URL — the popup posts its result to this exact origin, "
            "and an unset value means the result never reaches the app."
        )

    # ─── YouTube ─────────────────────────────────────────────
    yt_id = social_oauth.youtube_client_id()
    yt_secret = social_oauth.youtube_client_secret()
    print()
    if yt_id and yt_secret:
        source = (
            "YOUTUBE_CLIENT_ID"
            if settings.YOUTUBE_CLIENT_ID
            else "GOOGLE_CLIENT_ID (fallback)"
        )
        print(f"{OK} YouTube client        {mask(yt_id)}  via {source}")
        if not settings.YOUTUBE_CLIENT_ID:
            print(
                f"  {WARN} Falling back to the SIGN-IN client. Fine for local testing,\n"
                "     but for production use a separate client: the restricted\n"
                "     youtube.upload scope drags whichever client carries it into\n"
                "     Google's audit, and an unaudited client shows a verification\n"
                "     warning to everyone who signs in."
            )
    else:
        print(f"{BAD} YouTube client        not configured")
        problems.append(
            "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env."
        )

    enabled = social_oauth.platform_enabled("youtube")
    print(
        f"{OK if enabled else BAD} YouTube enabled       {enabled}"
        f"{'' if enabled else '  (the menu item will not appear)'}"
    )

    # ─── X ───────────────────────────────────────────────────
    x_on = social_oauth.platform_enabled("x")
    print(
        f"{OK if x_on else WARN} X enabled             {x_on}"
        f"{'' if x_on else '  (intentionally off — set X_CLIENT_ID to enable)'}"
    )

    # ─── Redirect URIs ───────────────────────────────────────
    if backend:
        print("\n\033[1mAuthorised redirect URI\033[0m (paste into Google Cloud console):")
        print(f"   {backend}/api/integrations/youtube/callback")
        if social_oauth.platform_enabled("x"):
            print(f"   {backend}/api/integrations/x/callback")

    # ─── Summary ─────────────────────────────────────────────
    print()
    if problems:
        print("\033[1mTo finish setup:\033[0m")
        for i, problem in enumerate(problems, 1):
            print(f"  {i}. {problem}")
        print()
        return 1

    print(f"{OK} \033[1mReady.\033[0m Start the backend and open a project's Share menu.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
