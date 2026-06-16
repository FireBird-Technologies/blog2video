"""Background music tracks API."""

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models.user import User
from app.services.background_music import get_all_tracks

router = APIRouter(prefix="/api/background-music", tags=["background-music"])


@router.get("/tracks")
def list_tracks(_user: User = Depends(get_current_user)):
    return get_all_tracks()
