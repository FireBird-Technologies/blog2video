"""Scheduled cleanup for support bot data.

Deletes anonymous (user_id IS NULL) conversations untouched for >30 days.
Authed conversations are kept indefinitely.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import delete

from app.database import SessionLocal
from app.models.support_conversation import SupportConversation, SupportMessage

logger = logging.getLogger(__name__)

ANONYMOUS_RETENTION_DAYS = 30
SLEEP_INTERVAL_SECONDS = 86400  # daily


def cleanup_once() -> int:
    """Delete stale anonymous conversations. Returns count deleted."""
    cutoff = datetime.utcnow() - timedelta(days=ANONYMOUS_RETENTION_DAYS)
    db = SessionLocal()
    try:
        # Find target conversation IDs.
        target_ids = [
            row.id
            for row in db.query(SupportConversation.id)
            .filter(SupportConversation.user_id.is_(None))
            .filter(SupportConversation.last_seen_at < cutoff)
            .all()
        ]
        if not target_ids:
            return 0
        # Delete messages first (FK), then conversations.
        db.execute(
            delete(SupportMessage).where(
                SupportMessage.conversation_id.in_(target_ids)
            )
        )
        db.execute(
            delete(SupportConversation).where(
                SupportConversation.id.in_(target_ids)
            )
        )
        db.commit()
        return len(target_ids)
    except Exception as exc:
        db.rollback()
        logger.exception("Support cleanup failed: %s", exc)
        return 0
    finally:
        db.close()


async def periodic_support_cleanup() -> None:
    """Background task: run cleanup_once daily, forever."""
    # Wait one minute on boot so DB init completes before we touch it.
    await asyncio.sleep(60)
    while True:
        try:
            n = cleanup_once()
            if n:
                logger.info("Support cleanup deleted %d anonymous conversations", n)
        except Exception as exc:
            logger.exception("Support cleanup tick failed: %s", exc)
        await asyncio.sleep(SLEEP_INTERVAL_SECONDS)
