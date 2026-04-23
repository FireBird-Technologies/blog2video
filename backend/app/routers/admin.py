import asyncio
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User, PlanTier
from app.models.blast_campaign import BlastCampaign
from app.services.email import email_service

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_PASSWORD = "blog2video-44"
# Resend rate limit: 5 emails/sec. Sleep 0.25s between each send → 4/sec, safe headroom.
PER_EMAIL_SLEEP = 0.25


class BlastEmailRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=20000)
    password: str
    user_filter: Literal["all", "free", "paid"] = "all"
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


def _build_user_query(db: Session, user_filter: str):
    q = db.query(User).filter(
        User.is_active == True,
        User.email.isnot(None),
        User.email != "",
        User.email_unsubscribed == False,
    )
    if user_filter == "free":
        q = q.filter(User.plan == PlanTier.FREE)
    elif user_filter == "paid":
        q = q.filter(User.plan != PlanTier.FREE)
    return q


def _get_users(db: Session, limit: int, offset: int, user_filter: str) -> list[User]:
    return (
        _build_user_query(db, user_filter)
        .order_by(User.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


async def _run_blast(campaign_id: int, subject: str, body: str, limit: int, offset: int, user_filter: str):
    db: Session = SessionLocal()
    try:
        campaign = db.get(BlastCampaign, campaign_id)
        if not campaign:
            return

        campaign.status = "running"
        campaign.updated_at = datetime.utcnow()
        db.commit()

        users = _get_users(db, limit, offset, user_filter)
        campaign.total_users = _build_user_query(db, user_filter).count()
        db.commit()

        print(f"[BLAST] campaign_id={campaign_id} filter={user_filter} offset={offset} limit={limit} matched={len(users)}")

        for i, user in enumerate(users):
            print(f"[BLAST] Sending {i+1}/{len(users)} → {user.email}")
            try:
                email_service.send_blast_email(user.email, user.name or "", subject, body)
                campaign.sent_count += 1
                print(f"[BLAST] ✓ {user.email}")
            except Exception as exc:
                campaign.failed_count += 1
                print(f"[BLAST] ✗ {user.email}: {exc}")

            campaign.updated_at = datetime.utcnow()
            db.commit()

            # Throttle to stay under Resend's 5/sec limit.
            if i + 1 < len(users):
                await asyncio.sleep(PER_EMAIL_SLEEP)

        campaign.status = "done"
        campaign.updated_at = datetime.utcnow()
        db.commit()
        print(f"[BLAST] campaign_id={campaign_id} done — sent={campaign.sent_count}, failed={campaign.failed_count}")

    except Exception as exc:
        print(f"[BLAST] campaign_id={campaign_id} crashed: {exc}")
        db.rollback()
        campaign = db.get(BlastCampaign, campaign_id)
        if campaign:
            campaign.status = "done"
            db.commit()
    finally:
        db.close()


@router.get("/preview-users")
async def preview_users(
    password: str,
    user_filter: str = "all",
    limit: int = 50,
    offset: int = 0,
):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="limit must be 1–500")

    db: Session = SessionLocal()
    try:
        users = (
            _build_user_query(db, user_filter)
            .order_by(User.created_at.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        total = _build_user_query(db, user_filter).count()
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "users": [
                {"id": u.id, "email": u.email, "name": u.name, "plan": u.plan.value}
                for u in users
            ],
        }
    finally:
        db.close()


@router.post("/send-blast-email")
async def send_blast_email(payload: BlastEmailRequest, background_tasks: BackgroundTasks):
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    db: Session = SessionLocal()
    try:
        total_users = _build_user_query(db, payload.user_filter).count()
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
        _run_blast, campaign_id, payload.subject, payload.body,
        payload.limit, payload.offset, payload.user_filter,
    )

    return {"campaign_id": campaign_id, "total_users": total_users, "status": "pending"}


@router.get("/blast-status/{campaign_id}")
async def blast_status(campaign_id: int, password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    db: Session = SessionLocal()
    try:
        campaign = db.get(BlastCampaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        return {
            "campaign_id": campaign_id,
            "subject": campaign.subject,
            "status": campaign.status,
            "total_users": campaign.total_users,
            "sent_count": campaign.sent_count,
            "failed_count": campaign.failed_count,
            "errors": [],
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        }
    finally:
        db.close()


@router.delete("/blast-campaigns/{campaign_id}")
async def delete_campaign(campaign_id: int, password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")
    db: Session = SessionLocal()
    try:
        campaign = db.get(BlastCampaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        db.delete(campaign)
        db.commit()
        return {"deleted": campaign_id}
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
        result = [
            {
                "campaign_id": c.id,
                "subject": c.subject,
                "body": c.body,
                "status": c.status,
                "sent_count": c.sent_count,
                "failed_count": c.failed_count,
                "total_users": c.total_users,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in campaigns
        ]
        return {"campaigns": result, "total_users": 0}
    finally:
        db.close()
