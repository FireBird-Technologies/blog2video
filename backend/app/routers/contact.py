from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings


router = APIRouter(prefix="/api/contact", tags=["contact"])


class EnterpriseContact(BaseModel):
    name: str = Field(..., max_length=200)
    company: str = Field(..., max_length=200)
    message: str = Field(..., max_length=4000)


@router.post("/enterprise", status_code=status.HTTP_202_ACCEPTED)
async def enterprise_contact(payload: EnterpriseContact):
    """
    Receive enterprise contact requests and forward them via email using Resend.
    """
    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured.",
        )

    # Lazy import so the app can still start if resend isn't installed in some environments
    try:
        from resend import Emails, Resend
    except Exception:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email provider not available on this server.",
        )

    client = Resend(api_key=api_key)

    subject = f"[Enterprise] Contact from {payload.name} ({payload.company})"
    text_body = (
        f"New enterprise contact request:\n\n"
        f"Name: {payload.name}\n"
        f"Company: {payload.company}\n\n"
        f"Message:\n{payload.message}\n"
    )

    try:
        await Emails.send(
            client=client,
            from_="Blog2Video <25100313@lums.edu.pk>",
            to=["Mehdichangazi135@gmail.com"],
            subject=subject,
            text=text_body,
        )
        
    except Exception:
        # Don't leak provider errors to the client
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send your message. Please try again later.",
        )

    return {"ok": True}

