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
        print(f"{OK} YouTube client        {mask(yt_id)}  via YOUTUBE_CLIENT_ID")
    else:
        # Not a problem to fix — an unset upload client is how you turn YouTube
        # publishing off, so report it the same way X and LinkedIn are reported.
        print(
            f"{WARN} YouTube client        not set  (intentionally off — set "
            "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to enable)"
        )

    enabled = social_oauth.platform_enabled("youtube")
    print(
        f"{OK if enabled else WARN} YouTube enabled       {enabled}"
        f"{'' if enabled else '  (the icon will not appear)'}"
    )

    # ─── X ───────────────────────────────────────────────────
    x_on = social_oauth.platform_enabled("x")
    print(
        f"{OK if x_on else WARN} X enabled             {x_on}"
        f"{'' if x_on else '  (intentionally off — set X_CLIENT_ID to enable)'}"
    )

    # ─── LinkedIn ────────────────────────────────────────────
    li_on = social_oauth.platform_enabled("linkedin")
    print(
        f"{OK if li_on else WARN} LinkedIn enabled      {li_on}"
        f"{'' if li_on else '  (intentionally off — set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable)'}"
    )
    if li_on:
        print(f"   LinkedIn-Version      {settings.LINKEDIN_API_VERSION or '202509'}")

    # ─── Redirect URIs ───────────────────────────────────────
    if backend:
        print("\n\033[1mAuthorised redirect URIs\033[0m (paste into each provider's console):")
        if enabled:
            print(f"   {backend}/api/integrations/youtube/callback")
        if social_oauth.platform_enabled("x"):
            print(f"   {backend}/api/integrations/x/callback")
        if li_on:
            print(f"   {backend}/api/integrations/linkedin/callback")

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
