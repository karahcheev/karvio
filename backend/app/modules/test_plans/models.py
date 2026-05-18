from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import TestPlanGenerationSource
from app.modules.projects.models import Project, Suite, User
from app.modules.test_cases.models import TestCase


class TestPlan(Base):
    __tablename__ = "test_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    generation_source: Mapped[TestPlanGenerationSource] = mapped_column(
        Enum(TestPlanGenerationSource, name="test_plan_generation_source"),
        default=TestPlanGenerationSource.manual,
        nullable=False,
    )
    generation_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    generation_summary: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    milestone_id: Mapped[str | None] = mapped_column(
        ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    project: Mapped["Project"] = relationship()
    created_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[TestPlan.created_by]",
        primaryjoin="TestPlan.created_by == User.id",
        lazy="selectin",
    )
    suites: Mapped[list["TestPlanSuite"]] = relationship(
        back_populates="test_plan",
        cascade="all, delete-orphan",
    )
    cases: Mapped[list["TestPlanCase"]] = relationship(
        back_populates="test_plan",
        cascade="all, delete-orphan",
    )


class TestPlanSuite(Base):
    __tablename__ = "test_plan_suites"
    __table_args__ = (UniqueConstraint("test_plan_id", "suite_id", name="uq_test_plan_suite"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_plan_id: Mapped[str] = mapped_column(
        ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    suite_id: Mapped[str] = mapped_column(
        ForeignKey("suites.id", ondelete="CASCADE"), nullable=False, index=True
    )

    test_plan: Mapped["TestPlan"] = relationship(back_populates="suites")
    suite: Mapped["Suite"] = relationship()


class TestPlanCase(Base):
    __tablename__ = "test_plan_cases"
    __table_args__ = (UniqueConstraint("test_plan_id", "test_case_id", name="uq_test_plan_case"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_plan_id: Mapped[str] = mapped_column(
        ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_case_id: Mapped[str] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )

    test_plan: Mapped["TestPlan"] = relationship(back_populates="cases")
    test_case: Mapped["TestCase"] = relationship()
