from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import MilestoneStatus
from app.modules.projects.models import Project, User


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus, name="milestone_status"),
        default=MilestoneStatus.planned,
        nullable=False,
    )
    start_date: Mapped[date | None] = mapped_column(Date())
    target_date: Mapped[date | None] = mapped_column(Date())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    release_label: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    project: Mapped["Project"] = relationship()
    owner: Mapped["User | None"] = relationship(
        foreign_keys="[Milestone.owner_id]",
        primaryjoin="Milestone.owner_id == User.id",
        lazy="selectin",
    )
