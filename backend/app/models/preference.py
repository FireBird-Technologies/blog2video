from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Preference(Base):
    """User-saved style preference: a named guide document (text/markdown) whose
    content is used as the script-generation user_instruction when selected in the
    blog-URL form's style row (value ``manual_guide_<preference_id>``).

    ``style_name`` is unique per user, not globally: two users may each have a
    "Brand Voice". Selections travel by ``id``, so a rename never orphans a project.
    """

    __tablename__ = "preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "style_name", name="uq_preferences_user_id_style_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    style_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # extracted document text
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="preferences")
