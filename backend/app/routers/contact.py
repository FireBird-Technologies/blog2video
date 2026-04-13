from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.email import email_service, EmailServiceError

router = APIRouter(prefix="/api/contact", tags=["contact"])


class EnterpriseContact(BaseModel):
    name: str = Field(..., max_length=200)
    company: str = Field(..., max_length=200)
    contact_details: str = Field(..., max_length=500)
    message: str = Field(..., max_length=4000)


class CustomTemplateRequest(BaseModel):
    description: str = Field(..., max_length=3000)
    alternate_contact: str | None = Field(None, max_length=300)


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


@router.post("/custom-template-request", status_code=status.HTTP_202_ACCEPTED)
async def custom_template_request(
    payload: CustomTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Receive custom template requests from logged-in users and forward them via email."""
    raw_plan = getattr(user.plan, "value", str(user.plan)) if user.plan else "free"
    plan_label = raw_plan.capitalize()
    user_name = " ".join(w.capitalize() for w in (user.name or "Unknown").split())
    try:
        email_service.send_custom_template_request_email(
            user_name=user_name,
            user_email=user.email,
            user_plan=plan_label,
            description=payload.description,
            alternate_contact=payload.alternate_contact or None,
        )
    except EmailServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    return {"ok": True}
