"""
Send a product email to all users on the free plan (User.plan == FREE).

Uses Resend via app email settings (.env: RESEND_API_KEY, NOREPLY_EMAIL, FRONTEND_URL).

Default is dry-run (lists recipients only). Pass --send to actually deliver.

Run from repo root or backend:

  cd backend
  python scripts/notify_free_users_video_limit.py
  python scripts/notify_free_users_video_limit.py --send
  python scripts/notify_free_users_video_limit.py --send --sleep 0.25
  python scripts/notify_free_users_video_limit.py --limit 5 --send
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.user import PlanTier, User
from app.services.email import EmailServiceError, email_service

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _iter_free_users(db: Session, limit: int | None):
    q = (
        db.query(User)
        .filter(User.plan == PlanTier.FREE, User.is_active.is_(True))
        .order_by(User.id)
    )
    if limit is not None:
        q = q.limit(limit)
    return q.all()


def main() -> int:
    parser = argparse.ArgumentParser(description="Email free-plan users about the higher free video limit.")
    parser.add_argument(
        "--send",
        action="store_true",
        help="Actually send via Resend (default: dry-run only).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Only process the first N users (ordered by id). Useful for a test batch.",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.15,
        metavar="SEC",
        help="Seconds to wait between sends (default: 0.15).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        users = _iter_free_users(db, args.limit)
    finally:
        db.close()

    if not users:
        logger.info("No active free-plan users found.")
        return 0

    logger.info("Matched %s active free-plan user(s).", len(users))
    for u in users[:10]:
        logger.info("  id=%s email=%s name=%r", u.id, u.email, u.name)
    if len(users) > 10:
        logger.info("  ... and %s more", len(users) - 10)

    if not args.send:
        logger.info("Dry-run only. Re-run with --send to deliver (requires RESEND_API_KEY).")
        return 0

    ok = 0
    failed: list[tuple[int, str, str]] = []
    for u in users:
        try:
            email_service.send_free_tier_video_limit_announcement(
                user_email=u.email,
                user_name=u.name,
                free_video_limit=3,
            )
            ok += 1
        except EmailServiceError as e:
            failed.append((u.id, u.email, str(e)))
            logger.error("Failed user id=%s %s: %s", u.id, u.email, e)
        if args.sleep > 0:
            time.sleep(args.sleep)

    logger.info("Done. Sent: %s  Failed: %s", ok, len(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
