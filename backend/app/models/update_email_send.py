from datetime import datetime
from sqlalchemy import String, DateTime, Integer, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UpdateEmailSend(Base):
    __tablename__ = "update_email_sends"
    __table_args__ = (
        UniqueConstraint("update_email_id", "user_id", name="uq_update_email_sends_email_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    update_email_id: Mapped[int] = mapped_column(Integer, ForeignKey("update_emails.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # "sent" | "failed"
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="sent")
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
