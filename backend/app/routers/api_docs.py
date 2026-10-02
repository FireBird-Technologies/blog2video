"""The public API reference, only for users whose plan includes API access."""
from fastapi import APIRouter, Depends, HTTPException

from app.api_docs.catalog import catalog
from app.auth import get_current_user
from app.models.user import User
from app.services.public_api_auth import user_has_api_access

router = APIRouter(prefix="/api/api-docs", tags=["api-docs"])


@router.get("")
def get_api_docs(user: User = Depends(get_current_user)):
    if not user_has_api_access(user):
        raise HTTPException(status_code=403, detail={"error": "paid_plan_required", "message": "The API is included with every paid plan."})
    return catalog()
