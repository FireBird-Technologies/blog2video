from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("user_id", name="uq_survey_responses_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # Q1: Overall experience rating (1-5, stored as free text)
    rating: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Q2: Problem / use case and how well it's solved
    use_case: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    # Q3: Platforms and audience being targeted
    target_audience: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    # Q4: Feature or improvement that would help most
    desired_feature: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    # Q5: Where they first heard about us
    heard_from: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
