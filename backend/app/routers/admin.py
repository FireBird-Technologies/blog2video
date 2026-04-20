import asyncio
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.blast_campaign import BlastCampaign, BlastEmailSend
from app.services.email import email_service

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_PASSWORD = "blog2video-44"
BATCH_SIZE = 10
BATCH_SLEEP = 1.0  # seconds between batches to respect Resend rate limits
BLAST_BATCH_LIMIT = 50  # per run; align with Resend plan (e.g. free tier daily cap)


class BlastEmailRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=20000)
    password: str


class ResumeBlastRequest(BaseModel):
    password: str


def _get_unsent_users(db: Session, campaign_id: int, limit: int) -> list[User]:
    """Return up to `limit` active users who haven't received this campaign yet, newest first."""
    sent_user_ids = (
        db.query(BlastEmailSend.user_id)
        .filter(BlastEmailSend.campaign_id == campaign_id, BlastEmailSend.success == True)
        .subquery()
    )
    return (
        db.query(User)
        .filter(
            User.is_active == True,
            User.email.isnot(None),
            User.email != "",
            User.id.notin_(sent_user_ids),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )


async def _run_blast(campaign_id: int, subject: str, body: str, limit: int):
    db: Session = SessionLocal()
    try:
        campaign = db.get(BlastCampaign, campaign_id)
        if not campaign:
            return

        campaign.status = "running"
        campaign.updated_at = datetime.utcnow()
        db.commit()

        users = _get_unsent_users(db, campaign_id, limit)
        campaign.total_users = (
            db.query(User)
            .filter(User.is_active == True, User.email.isnot(None), User.email != "")
            .count()
        )
        db.commit()

        print(f"[F7-DEBUG] [BLAST] campaign_id={campaign_id}, subject='{subject}', total_users={campaign.total_users}, fetching up to {limit} unsent")

        for i, user in enumerate(users):
            success = False
            error_msg = None
            print(f"[F7-DEBUG] [BLAST] Sending {i+1} → {user.email} ({user.name or 'no name'})")
            try:
                email_service.send_blast_email(user.email, user.name or "", subject, body)
                success = True
                campaign.sent_count += 1
                print(f"[F7-DEBUG] [BLAST] ✓ Sent to {user.email}")
            except Exception as exc:
                error_msg = str(exc)[:500]
                campaign.failed_count += 1
                print(f"[F7-DEBUG] [BLAST] ✗ Failed {user.email}: {error_msg}")

            send_record = BlastEmailSend(
                campaign_id=campaign_id,
                user_id=user.id,
                email=user.email,
                success=success,
                error_message=error_msg,
                sent_at=datetime.utcnow(),
            )
            db.add(send_record)
            campaign.updated_at = datetime.utcnow()
            db.commit()

            if (i + 1) % BATCH_SIZE == 0:
                await asyncio.sleep(BATCH_SLEEP)

        campaign.status = "done"
        campaign.updated_at = datetime.utcnow()
        db.commit()
        print(f"[F7-DEBUG] [BLAST] campaign_id={campaign_id} done — sent={campaign.sent_count}, failed={campaign.failed_count}")

    except Exception as exc:
        print(f"[F7-DEBUG] [BLAST] campaign_id={campaign_id} crashed: {exc}")
        db.rollback()
        campaign = db.get(BlastCampaign, campaign_id)
        if campaign:
            campaign.status = "done"
            db.commit()
    finally:
        db.close()


@router.post("/send-blast-email")
async def send_blast_email(payload: BlastEmailRequest, background_tasks: BackgroundTasks):
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    db: Session = SessionLocal()
    try:
        total_users = (
            db.query(User)
            .filter(User.is_active == True, User.email.isnot(None), User.email != "")
            .count()
        )

        campaign = BlastCampaign(
            subject=payload.subject,
            body=payload.body,
            total_users=total_users,
            status="pending",
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        campaign_id = campaign.id
    finally:
        db.close()

    background_tasks.add_task(
        _run_blast, campaign_id, payload.subject, payload.body, BLAST_BATCH_LIMIT
    )

    return {
        "campaign_id": campaign_id,
        "total_users": total_users,
        "status": "pending",
    }


@router.get("/blast-status/{campaign_id}")
async def blast_status(campaign_id: int, password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    db: Session = SessionLocal()
    try:
        campaign = db.get(BlastCampaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        already_sent = (
            db.query(User.id)
            .join(BlastEmailSend, BlastEmailSend.user_id == User.id)
            .filter(
                BlastEmailSend.campaign_id == campaign_id,
                BlastEmailSend.success == True,
            )
            .count()
        )
        total_users = (
            db.query(User)
            .filter(User.is_active == True, User.email.isnot(None), User.email != "")
            .count()
        )
        remaining = max(0, total_users - already_sent)

        recent_errors = (
            db.query(BlastEmailSend.email, BlastEmailSend.error_message)
            .filter(
                BlastEmailSend.campaign_id == campaign_id,
                BlastEmailSend.success == False,
            )
            .order_by(BlastEmailSend.sent_at.desc())
            .limit(20)
            .all()
        )

        return {
            "campaign_id": campaign_id,
            "subject": campaign.subject,
            "status": campaign.status,
            "total_users": total_users,
            "sent_count": campaign.sent_count,
            "failed_count": campaign.failed_count,
            "already_reached": already_sent,
            "remaining": remaining,
            "errors": [f"{r.email}: {r.error_message}" for r in recent_errors],
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        }
    finally:
        db.close()


@router.get("/blast-campaigns")
async def list_campaigns(password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    db: Session = SessionLocal()
    try:
        campaigns = (
            db.query(BlastCampaign)
            .order_by(BlastCampaign.created_at.desc())
            .limit(20)
            .all()
        )
        total_users = (
            db.query(User)
            .filter(User.is_active == True, User.email.isnot(None), User.email != "")
            .count()
        )
        result = []
        for c in campaigns:
            already_sent = (
                db.query(BlastEmailSend)
                .filter(BlastEmailSend.campaign_id == c.id, BlastEmailSend.success == True)
                .count()
            )
            result.append({
                "campaign_id": c.id,
                "subject": c.subject,
                "status": c.status,
                "sent_count": c.sent_count,
                "failed_count": c.failed_count,
                "already_reached": already_sent,
                "remaining": max(0, total_users - already_sent),
                "total_users": total_users,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
        return {"campaigns": result, "total_users": total_users}
    finally:
        db.close()


@router.post("/blast-send-next/{campaign_id}")
async def send_next_batch(campaign_id: int, payload: ResumeBlastRequest, background_tasks: BackgroundTasks):
    """Resume sending the next batch of unsent users for an existing campaign."""
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    db: Session = SessionLocal()
    try:
        campaign = db.get(BlastCampaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        if campaign.status == "running":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign is already running")

        subject = campaign.subject
        body = campaign.body
        campaign.status = "pending"
        campaign.updated_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()

    background_tasks.add_task(
        _run_blast, campaign_id, subject, body, BLAST_BATCH_LIMIT
    )
    return {"campaign_id": campaign_id, "status": "pending"}
