from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UpdateEmail(Base):
    __tablename__ = "update_emails"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # "all" | "free" | "paid" | "standard" | "pro"
    user_filter: Mapped[str] = mapped_column(String(20), default="all")
    batch_size: Mapped[int] = mapped_column(Integer, default=50)
    # UTC hour (0-23) to run the daily batch; -1 means use settings default
    send_hour: Mapped[int] = mapped_column(Integer, default=-1)
    total_users: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    # "scheduled" | "running" | "completed"
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
