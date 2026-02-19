from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.email import email_service, EmailServiceError

router = APIRouter(prefix="/api/contact", tags=["contact"])


class EnterpriseContact(BaseModel):
    name: str = Field(..., max_length=200)
    company: str = Field(..., max_length=200)
    contact_details: str = Field(..., max_length=500)
    message: str = Field(..., max_length=4000)


@router.post("/enterprise", status_code=status.HTTP_202_ACCEPTED)
async def enterprise_contact(payload: EnterpriseContact):
    """Receive enterprise contact requests and forward them via email."""
    try:
        email_service.send_enterprise_contact_email(
            name=payload.name,
            company=payload.company,
            contact_details=payload.contact_details,
            message=payload.message,
        )
    except EmailServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    return {"ok": True}
