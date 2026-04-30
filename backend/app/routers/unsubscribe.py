import hashlib
import hmac

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

router = APIRouter(tags=["unsubscribe"])


def make_unsubscribe_token(email: str) -> str:
    return hmac.new(
        settings.JWT_SECRET.encode(),
        email.strip().lower().encode(),
        hashlib.sha256,
    ).hexdigest()


@router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe(
    email: str = Query(...),
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    expected = make_unsubscribe_token(email)
    if not hmac.compare_digest(expected, token):
        return HTMLResponse(
            _page("Invalid link", "This unsubscribe link is invalid or has expired."),
            status_code=400,
        )

    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if user and not user.email_unsubscribed:
        user.email_unsubscribed = True
        db.commit()

    return HTMLResponse(_page(
        "Unsubscribed",
        "You've been unsubscribed and won't receive product update emails from Blog2Video anymore.",
    ))


def _page(title: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{title} · Blog2Video</title>
  <style>
    body{{margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}}
    .wrap{{max-width:480px;margin:80px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;}}
    .head{{background:#9333EA;padding:28px 40px;text-align:center;}}
    .head span{{font-size:22px;font-weight:700;color:#fff;letter-spacing:-.5px;}}
    .head span em{{color:#c4b5fd;font-style:normal;}}
    .body{{padding:40px;}}
    h1{{margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;}}
    p{{margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;}}
    a.btn{{display:inline-block;padding:12px 28px;background:#9333EA;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;}}
    .foot{{background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head"><span>Blog<em>2</em>Video</span></div>
    <div class="body">
      <h1>{title}</h1>
      <p>{message}</p>
      <a class="btn" href="https://blog2video.app">Go to Blog2Video</a>
    </div>
    <div class="foot">&copy; 2026 Blog2Video &middot; All rights reserved.</div>
  </div>
</body>
</html>"""
