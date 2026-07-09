r"""Standalone email-blast script — send one email to every address in a CSV.

Reads the ``email`` column from a CSV and sends every address the SAME subject
and body via Resend. Plain-text style, sent from Arslan, with an Unsubscribe
link in the footer. Self-contained: it does NOT import the Blog2Video ``app``
package — it only needs the ``resend`` pip package and a RESEND_API_KEY.


═══════════════════════════════════════════════════════════════════════════
HOW TO SEND AN EMAIL — step by step (reuse this for any future blast)
═══════════════════════════════════════════════════════════════════════════

This script lives in  backend/scripts/  along with two files you edit:
    recipients.csv   ← who to send to
    body.txt         ← the subject + message

--- STEP 1: Edit the recipient list -------------------------------------
Open  recipients.csv  and put ONE email address per line, under an "email"
header. No names needed. Example:

    email
    alice@example.com
    bob@example.com

(Duplicates and blank/invalid rows are skipped automatically.)

--- STEP 2: Write the email --------------------------------------------
Open  body.txt . The FIRST line is the subject if it starts with "Subject:".
Everything after is the message. Blank lines make paragraph breaks. Example:

    Subject: Get your first month free (today only)
    Hi there,

    Use code FIRSTMONTHFREE and get your first month free.

    Regards,
    Arslan

--- STEP 3: Activate the Python environment ----------------------------
    source /Users/humeraraheel/firebird/blog2vid/bin/activate

--- STEP 4: cd into THIS folder (important!) ---------------------------
The script only runs from the folder it lives in, or via a full path.
    cd /Users/humeraraheel/firebird/blog2video/backend/scripts

--- STEP 5: DRY RUN first (sends nothing — always do this) -------------
    python send_csv_blast.py recipients.csv --body-file body.txt

  Check the printout: "Recipients : N" is how many will be emailed, the
  Subject and Body look right, and "API key : set". Nothing is sent yet.

--- STEP 6: SEND for real (add --send) --------------------------------
    python send_csv_blast.py recipients.csv --body-file body.txt --send

  It asks "Send this email to N recipients? [y/N]" — type y and Enter.
  (Add --yes to skip that confirmation.)


═══════════════════════════════════════════════════════════════════════════
NOTES
═══════════════════════════════════════════════════════════════════════════
• "Recipients : N" = the REAL count (everyone still on the list is emailed).
  "Preview : ..." only shows the first 5 addresses — it is NOT a limit.
• Unsubscribes are honoured: before sending, every CSV address is checked
  against the app's `users` table and anyone with email_unsubscribed = true is
  dropped ("Unsub skip : N" shows how many). This needs DATABASE_URL in
  backend/.env (already there). If the DB can't be reached the script ABORTS
  rather than risk emailing opted-out users. Addresses NOT in the users table
  (cold leads) are still emailed. Use --skip-unsub-check to bypass this entirely
  (only for pure cold-lead lists with no existing app users).
• The API key is read from backend/.env (RESEND_API_KEY). Override the file
  with  --env-file /path/to/.env  if needed.
• Test safely first: put only your own email in recipients.csv and --send,
  or use  --limit 1  to email just the first address.
• Give the subject/body other ways if you prefer:
      --subject "..." --body "..."            (inline)
      --subject-file s.txt --body-file b.txt  (separate files)
      (no flags)                              (prompts you to paste it)
• Slow down / speed up sends with  --delay SECONDS  (default 0.5).

Handy one-liners:
    python send_csv_blast.py recipients.csv --body-file body.txt            # dry run
    python send_csv_blast.py recipients.csv --body-file body.txt --send     # send
    python send_csv_blast.py recipients.csv --body-file body.txt --limit 1 --send  # test to 1st
"""

from __future__ import annotations

import csv
import hashlib
import hmac
import html
import os
import re
import sys
import time
import urllib.parse
from argparse import ArgumentParser

# ─── Config (override via flags or environment) ──────────────────────────────
DEFAULT_ENV_FILE = os.path.join(os.path.dirname(__file__), os.pardir, ".env")
FROM_EMAIL = "Arslan Shahid <arslan@blog2video.app>"
DEFAULT_BACKEND_URL = "https://blog2video.app"

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


# ─── Environment loading (no dependency on the app) ──────────────────────────


def load_env(env_file: str) -> None:
    """Load KEY=VALUE pairs from `env_file` into os.environ (existing vars win).

    Uses python-dotenv if installed; otherwise a minimal built-in parser that
    handles simple `KEY=VALUE` lines with optional surrounding quotes.
    """
    if not env_file or not os.path.isfile(env_file):
        return
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(env_file, override=False)
        return
    except ImportError:
        pass

    with open(env_file, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


# ─── CSV parsing ─────────────────────────────────────────────────────────────


def _find_column(fieldnames: list[str], wanted: str) -> str | None:
    """Case-insensitive, whitespace-tolerant lookup of a column name."""
    target = wanted.strip().lower()
    for name in fieldnames:
        if name and name.strip().lower() == target:
            return name
    return None


def read_recipients(csv_path: str, email_column: str) -> list[str]:
    """Parse the CSV → list of email addresses. Skips bad rows; de-dupes by email."""
    recipients: list[str] = []
    seen: set[str] = set()
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise SystemExit(f"CSV '{csv_path}' has no header row.")

        email_col = _find_column(reader.fieldnames, email_column)
        if not email_col:
            raise SystemExit(
                f"No '{email_column}' column in {csv_path}. "
                f"Columns found: {', '.join(reader.fieldnames)}"
            )

        skipped = 0
        for row in reader:
            email = (row.get(email_col) or "").strip()
            if not email or not _EMAIL_RE.match(email):
                skipped += 1
                continue
            key = email.lower()
            if key in seen:
                continue
            seen.add(key)
            recipients.append(email)

        if skipped:
            print(f"  ({skipped} row(s) skipped — missing or malformed email)")
    return recipients


# ─── Unsubscribe suppression (query the app's users table directly) ──────────


def fetch_unsubscribed(emails: list[str]) -> set[str]:
    """Return the lowercased subset of `emails` whose user has unsubscribed.

    Opens its own short-lived SQLAlchemy connection to DATABASE_URL (already
    loaded from backend/.env by load_env) and runs ONE query against the
    `users` table — it does NOT import the Blog2Video app package, matching this
    script's self-contained design.

    Only addresses that exist in `users` AND have email_unsubscribed = true are
    returned. Addresses not in the table are absent from the result (so the
    caller still sends to them — cold leads who were never app users).

    Aborts (SystemExit) if DATABASE_URL is unset or the DB can't be reached, so
    the suppression check can never silently be skipped and re-email opted-out
    users.
    """
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        raise SystemExit(
            "DATABASE_URL is not set — cannot check for unsubscribed users. "
            "Set it in backend/.env, or pass --skip-unsub-check to send without "
            "the suppression check (only for pure cold leads)."
        )

    # Lazy imports so --help / dry-run without the packages still work, matching
    # the lazy `import resend` in send_one().
    from sqlalchemy import bindparam, create_engine, text  # type: ignore

    # Mirror database.py: Neon (postgres) requires SSL when the URL omits it.
    connect_args: dict = {}
    if db_url.startswith("postgres") and "sslmode" not in db_url:
        connect_args["sslmode"] = "require"

    lowered = {e.strip().lower() for e in emails}
    engine = None
    try:
        engine = create_engine(db_url, connect_args=connect_args)
        query = text(
            "SELECT lower(email) FROM users "
            "WHERE email_unsubscribed = true AND lower(email) IN :emails"
        ).bindparams(bindparam("emails", expanding=True))
        with engine.connect() as conn:
            rows = conn.execute(query, {"emails": list(lowered)}).fetchall()
        return {row[0] for row in rows}
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 — never send if the check couldn't run
        raise SystemExit(
            f"Could not reach the database to check unsubscribes: {exc}. "
            "Aborting so opted-out users are not emailed. "
            "(Pass --skip-unsub-check to send without the check.)"
        )
    finally:
        if engine is not None:
            engine.dispose()


# ─── Subject / body resolution ───────────────────────────────────────────────


def _read_text_arg(inline: str | None, path: str | None) -> str | None:
    if inline is not None:
        return inline
    if path is not None:
        with open(path, encoding="utf-8") as f:
            return f.read()
    return None


def _prompt_multiline(prompt: str) -> str:
    """Read a multi-line block from stdin; terminated by a line with only '.'."""
    print(prompt)
    print("  (paste your content; finish with a single line containing only a period '.')")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == ".":
            break
        lines.append(line)
    return "\n".join(lines)


def resolve_subject_and_body(args) -> tuple[str, str]:
    """Resolve subject + body from flags, files, or interactive input.

    If the body begins with a 'Subject: ...' line and no subject was supplied
    separately, that line becomes the subject and is stripped from the body.
    """
    subject = _read_text_arg(args.subject, args.subject_file)
    body = _read_text_arg(args.body, args.body_file)

    if body is None:
        body = _prompt_multiline("Enter the EMAIL BODY:")
    if subject is None:
        stripped = body.lstrip("\n")
        first, _, rest = stripped.partition("\n")
        if first.lower().startswith("subject:"):
            subject = first.split(":", 1)[1].strip()
            body = rest.lstrip("\n")
        else:
            subject = input("Enter the SUBJECT line: ").strip()

    subject = (subject or "").strip()
    body = (body or "").strip()
    if not subject:
        raise SystemExit("Subject is empty — aborting.")
    if not body:
        raise SystemExit("Body is empty — aborting.")
    return subject, body


# ─── Email building (mirrors app's send_blast_email styling) ─────────────────


def make_unsubscribe_url(email: str) -> str:
    """HMAC-signed unsubscribe link, matching the app's /unsubscribe endpoint.

    Only meaningful if JWT_SECRET matches the running backend; if it's unset the
    token won't validate, but the footer link is still rendered.
    """
    secret = os.environ.get("JWT_SECRET", "")
    token = hmac.new(
        secret.encode(), email.strip().lower().encode(), hashlib.sha256
    ).hexdigest()
    api_base = os.environ.get("BACKEND_URL", DEFAULT_BACKEND_URL).rstrip("/")
    return f"{api_base}/unsubscribe?email={urllib.parse.quote(email.strip().lower())}&token={token}"


def build_email(email: str, body: str) -> tuple[str, str]:
    """Return (text_content, html_content) for one recipient.

    Plain style — no greeting, no card/header/colours. The body is sent as-is,
    with each blank line separating paragraphs, plus a small unsubscribe line.
    """
    unsubscribe_url = make_unsubscribe_url(email)

    text_content = f"{body}\n\n" f"To unsubscribe, visit: {unsubscribe_url}\n"

    # One <p> per blank-line-separated block; single newlines become <br>.
    paragraphs = "".join(
        "<p style='margin:0 0 16px;'>"
        + "<br>".join(html.escape(line) for line in block.split("\n"))
        + "</p>"
        for block in body.split("\n\n")
        if block.strip()
    )
    html_content = (
        "<div style=\"font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"
        'font-size:15px;line-height:1.6;color:#111;">'
        f"{paragraphs}"
        "<p style='margin:24px 0 0;font-size:12px;color:#888;'>"
        f"<a href='{unsubscribe_url}' style='color:#888;'>Unsubscribe</a>"
        "</p>"
        "</div>"
    )
    return text_content, html_content


def send_one(
    api_key: str, from_email: str, to: str, subject: str, html_content: str, text_content: str
) -> None:
    """Send a single email via the Resend SDK. Raises on failure."""
    import resend  # lazy import so --help / dry-run works without the package

    resend.api_key = api_key
    resend.Emails.send(
        {
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html_content,
            "text": text_content,
        }
    )


# ─── Main ────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = ArgumentParser(description="Send an email blast to every address in a CSV via Resend.")
    parser.add_argument("csv_path", help="Path to the CSV file containing recipients.")
    parser.add_argument(
        "--email-column", default="email", help="Header of the email column (default: email)."
    )
    parser.add_argument("--subject", help="Subject line (inline).")
    parser.add_argument("--subject-file", help="Read the subject from this file.")
    parser.add_argument("--body", help="Email body (inline).")
    parser.add_argument("--body-file", help="Read the body from this file.")
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        help="Path to the .env file to load RESEND_API_KEY from (default: backend/.env).",
    )
    parser.add_argument(
        "--from-email",
        default=FROM_EMAIL,
        help=f"Override the From address (default: {FROM_EMAIL!r}).",
    )
    parser.add_argument(
        "--send",
        action="store_true",
        help="Actually send. Without this flag the script does a DRY RUN and sends nothing.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Seconds to pause between sends, to stay under rate limits (default: 0.5).",
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Only send to the first N recipients (0 = all)."
    )
    parser.add_argument(
        "--yes", action="store_true", help="Skip the final confirmation prompt (with --send)."
    )
    parser.add_argument(
        "--skip-unsub-check",
        action="store_true",
        help="Do NOT check the database for unsubscribed users before sending. "
        "Only for blasting pure cold leads with no DB access — never use this "
        "for a list that may contain existing app users.",
    )
    args = parser.parse_args()

    from_email = args.from_email
    load_env(args.env_file)

    if not os.path.isfile(args.csv_path):
        raise SystemExit(f"CSV file not found: {args.csv_path}")

    recipients = read_recipients(args.csv_path, args.email_column)
    if not recipients:
        raise SystemExit("No valid recipients found in the CSV.")
    if args.limit > 0:
        recipients = recipients[: args.limit]

    # Drop anyone who has unsubscribed (checked against the app's users table).
    # Runs on dry-run too, so the printed counts are accurate and connectivity
    # is verified before any real send. Aborts if the DB can't be reached.
    unsub_skipped = 0
    if args.skip_unsub_check:
        print("⚠ --skip-unsub-check: NOT checking the database for unsubscribed users.")
    else:
        unsubscribed = fetch_unsubscribed(recipients)
        if unsubscribed:
            recipients = [e for e in recipients if e.strip().lower() not in unsubscribed]
            unsub_skipped = len(unsubscribed)
        if not recipients:
            raise SystemExit("All recipients are unsubscribed — nothing to send.")

    subject, body = resolve_subject_and_body(args)

    api_key = os.environ.get("RESEND_API_KEY", "")

    print("\n" + "=" * 64)
    print(f"Recipients : {len(recipients)}")
    if not args.skip_unsub_check:
        print(f"Unsub skip : {unsub_skipped}")
    print(f"From       : {from_email}")
    print(f"Subject    : {subject}")
    print("Body       :")
    for line in body.splitlines():
        print(f"    {line}")
    preview = ", ".join(recipients[:5])
    if len(recipients) > 5:
        preview += f", … (+{len(recipients) - 5} more)"
    print(f"Preview    : {preview}")
    print(f"API key    : {'set' if api_key else 'MISSING — set RESEND_API_KEY'}")
    print("=" * 64 + "\n")

    if not args.send:
        print("DRY RUN — nothing was sent. Re-run with --send to dispatch these emails.")
        return

    if not api_key:
        raise SystemExit("RESEND_API_KEY is not set — cannot send. Aborting.")

    if not args.yes:
        confirm = (
            input(f"Send this email to {len(recipients)} recipients? [y/N] ").strip().lower()
        )
        if confirm not in ("y", "yes"):
            print("Aborted — nothing sent.")
            return

    sent = 0
    failed: list[tuple[str, str]] = []
    for i, email in enumerate(recipients, start=1):
        text_content, html_content = build_email(email, body)
        try:
            send_one(api_key, from_email, email, subject, html_content, text_content)
            sent += 1
            print(f"[{i}/{len(recipients)}] sent → {email}")
        except Exception as exc:  # noqa: BLE001 — keep the blast going on any error
            failed.append((email, str(exc)))
            print(f"[{i}/{len(recipients)}] FAILED → {email}: {exc}")
        if args.delay and i < len(recipients):
            time.sleep(args.delay)

    print("\n" + "=" * 64)
    print(f"Done. Sent {sent}/{len(recipients)}. Failed: {len(failed)}.")
    for email, err in failed:
        print(f"  ✗ {email}: {err}")
    print("=" * 64)


if __name__ == "__main__":
    main()
