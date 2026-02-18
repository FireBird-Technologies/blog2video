from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings


router = APIRouter(prefix="/api/contact", tags=["contact"])


class EnterpriseContact(BaseModel):
    name: str = Field(..., max_length=200)
    company: str = Field(..., max_length=200)
    contact_details: str = Field(..., max_length=500)
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

    print("1")
    # Lazy import so the app can still start if resend isn't installed in some environments
    try:
        import resend
    except Exception:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email provider not available on this server.",
        )

    resend.api_key = api_key

    subject = f"[Enterprise] Contact from {payload.name} ({payload.company})"
    text_body = (
        f"New enterprise contact request:\n\n"
        f"Name: {payload.name}\n"
        f"Company: {payload.company}\n"
        f"Contact details: {payload.contact_details}\n\n"
        f"Message:\n{payload.message}\n"
    )

    try:
        resend.Emails.send(
            {
                "from": "sales@blog2video.app",
                "to": ["arslan@firebird-technologies.com"],
                "subject": subject,
                "text": text_body,
            }
        )
    except Exception as e:
        print("Error:", e)
        # Don't leak provider errors to the client; treat as best-effort in dev
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send your message. Please verify your RESEND_API_KEY and from address.",
        )

    return {"ok": True}

