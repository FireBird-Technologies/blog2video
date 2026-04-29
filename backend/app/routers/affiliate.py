"""
Affiliate / referral program endpoints.
"""
import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.referral import Referral, REFERRAL_BONUS_VIDEOS, REFERRAL_MAX_SIGNUPS
from app.services.email import EmailService

router = APIRouter(prefix="/api/affiliate", tags=["affiliate"])
_email_service = EmailService()


class AffiliateStats(BaseModel):
    link: str
    signups_count: int
    bonus_earned: int
    max_signups: int = REFERRAL_MAX_SIGNUPS
    bonus_per_signup: int = REFERRAL_BONUS_VIDEOS


class InviteRequest(BaseModel):
    emails: List[str]


class InviteResponse(BaseModel):
    sent: int
    failed: int


def _build_referral_code(user: User) -> str:
    """
    Build stable referral code using username + user id (e.g. mehdi12).
    Keeps code <= 36 chars to fit DB column.
    """
    user_id = str(user.id)
    raw_name = (user.name or user.email.split("@")[0] if user.email else "user").strip().lower()
    normalized_name = re.sub(r"[^a-z0-9]+", "", raw_name)
    if not normalized_name:
        normalized_name = "user"
    max_name_len = max(1, 36 - len(user_id))
    return f"{normalized_name[:max_name_len]}{user_id}"


def _get_or_create_referral(user: User, db: Session) -> Referral:
    expected_code = _build_referral_code(user)
    referral = db.query(Referral).filter_by(referrer_id=user.id, is_active=True).first()
    if not referral:
        referral = Referral(
            referrer_id=user.id,
            code=expected_code,
            is_active=True,
        )
        db.add(referral)
        db.commit()
        db.refresh(referral)
    elif referral.code != expected_code:
        # Auto-upgrade older UUID style codes to username+id format.
        referral.code = expected_code
        db.commit()
        db.refresh(referral)
    return referral


def _build_referral_link(code: str) -> str:
    return f"{settings.FRONTEND_URL}/?ref={code}"


@router.get("/link")
def get_referral_link(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    referral = _get_or_create_referral(user, db)
    return {"link": _build_referral_link(referral.code)}


@router.get("/stats", response_model=AffiliateStats)
def get_affiliate_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    referral = _get_or_create_referral(user, db)
    signups_count = user.referrals_given or 0
    bonus_earned = user.referral_video_bonus or 0
    return AffiliateStats(
        link=_build_referral_link(referral.code),
        signups_count=signups_count,
        bonus_earned=bonus_earned,
    )


@router.post("/invite", response_model=InviteResponse)
def send_invites(
    body: InviteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.emails:
        raise HTTPException(status_code=400, detail="No emails provided")
    if len(body.emails) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 invites per request")

    referral = _get_or_create_referral(user, db)
    link = _build_referral_link(referral.code)

    sent = 0
    failed = 0
    for email in body.emails:
        try:
            _email_service.send_referral_invite_email(
                to_email=str(email),
                referrer_name=user.name,
                referral_link=link,
            )
            sent += 1
        except Exception:
            failed += 1

    return InviteResponse(sent=sent, failed=failed)
