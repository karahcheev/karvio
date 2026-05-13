from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship

from app.core.domain_strings import (
    FK_RUN_CASE_ROWS_ID,
    FK_RUN_ITEMS_ID,
    FK_USERS_ID,
    ON_DELETE_CASCADE,
    ON_DELETE_SET_NULL,
    RELATIONSHIP_CASCADE_DELETE_ORPHAN,
)
from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import RunItemStatus, TestCasePriority, TestRunStatus
from app.modules.projects.models import Project, User
from app.modules.test_cases.models import TestCase


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    environment_id: Mapped[str | None] = mapped_column(
        ForeignKey("environments.id", ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    environment_revision_id: Mapped[str | None] = mapped_column(
        ForeignKey("environment_revisions.id", ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    environment_revision_number: Mapped[int | None] = mapped_column(Integer)
    environment_name_snapshot: Mapped[str | None] = mapped_column(String(255))
    environment_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    milestone_id: Mapped[str | None] = mapped_column(
        ForeignKey("milestones.id", ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    build: Mapped[str | None] = mapped_column(String(128))
    assignee: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    status: Mapped[TestRunStatus] = mapped_column(
        Enum(TestRunStatus, name="test_run_status"), default=TestRunStatus.not_started, nullable=False
    )
    planned_item_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    project: Mapped["Project"] = relationship()
    assignee_user: Mapped["User | None"] = relationship(
        foreign_keys="[TestRun.assignee]",
        primaryjoin="TestRun.assignee == User.id",
        lazy="selectin",
    )
    created_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[TestRun.created_by]",
        primaryjoin="TestRun.created_by == User.id",
        lazy="selectin",
    )
    run_items: Mapped[list["RunItem"]] = relationship(back_populates="test_run")


class RunItem(Base):
    __tablename__ = "run_items"
    __table_args__ = (
        UniqueConstraint("test_run_id", "test_case_id", name="uq_run_item_test_case"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    test_case_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # Legacy column kept nullable for smooth model bootstrap and report-import compatibility.
    dataset_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    dataset_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    test_case_key_snapshot: Mapped[str | None] = mapped_column(String(100))
    test_case_title_snapshot: Mapped[str | None] = mapped_column(String(500))
    test_case_priority_snapshot: Mapped[TestCasePriority | None] = mapped_column(
        Enum(TestCasePriority, name="test_case_priority"),
        nullable=True,
    )
    test_case_tags_snapshot: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    suite_name_snapshot: Mapped[str | None] = mapped_column(String(255))
    assignee_id: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    time: Mapped[str | None] = mapped_column(String(64))
    comment: Mapped[str | None] = mapped_column(Text())
    defect_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    actual_result: Mapped[str | None] = mapped_column(Text())
    system_out: Mapped[str | None] = mapped_column(Text())
    system_err: Mapped[str | None] = mapped_column(Text())
    executed_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    status: Mapped[RunItemStatus] = mapped_column(
        Enum(RunItemStatus, name="run_item_status"), default=RunItemStatus.untested, nullable=False
    )
    rows_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    execution_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    test_run: Mapped[TestRun] = relationship(back_populates="run_items")
    test_case: Mapped["TestCase | None"] = relationship(
        primaryjoin=lambda: foreign(RunItem.test_case_id) == TestCase.id,
        viewonly=True,
    )
    dataset = relationship("TestDataset", primaryjoin="foreign(RunItem.dataset_id) == TestDataset.id", viewonly=True)
    assignee_user: Mapped["User | None"] = relationship(
        foreign_keys="[RunItem.assignee_id]",
        primaryjoin="RunItem.assignee_id == User.id",
        lazy="selectin",
    )
    executed_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[RunItem.executed_by]",
        primaryjoin="RunItem.executed_by == User.id",
        lazy="selectin",
    )
    results: Mapped[list["RunResult"]] = relationship(back_populates="run_item", order_by="RunResult.sequence")
    rows: Mapped[list["RunCaseRow"]] = relationship(
        back_populates="run_case",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="RunCaseRow.row_order.asc()",
    )
    history: Mapped[list["RunCaseHistory"]] = relationship(
        back_populates="run_case",
        order_by="RunCaseHistory.changed_at.desc()",
    )


class RunCaseRow(Base):
    __tablename__ = "run_case_rows"
    __table_args__ = (
        UniqueConstraint("run_case_id", "row_order", name="uq_run_case_row_order"),
        Index("ix_run_case_rows_run_case_status", "run_case_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_case_id: Mapped[str] = mapped_column(
        ForeignKey(FK_RUN_ITEMS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )
    parent_row_id: Mapped[str | None] = mapped_column(
        ForeignKey(FK_RUN_CASE_ROWS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    row_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scenario_label: Mapped[str] = mapped_column(String(255), nullable=False)
    row_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text())
    defect_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    actual_result: Mapped[str | None] = mapped_column(Text())
    system_out: Mapped[str | None] = mapped_column(Text())
    system_err: Mapped[str | None] = mapped_column(Text())
    executed_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    status: Mapped[RunItemStatus] = mapped_column(
        Enum(RunItemStatus, name="run_item_status"),
        default=RunItemStatus.untested,
        nullable=False,
    )
    execution_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    run_case: Mapped["RunItem"] = relationship(back_populates="rows")
    parent_row: Mapped["RunCaseRow | None"] = relationship(remote_side="RunCaseRow.id")
    executed_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[RunCaseRow.executed_by]",
        primaryjoin="RunCaseRow.executed_by == User.id",
        lazy="selectin",
    )


class RunResult(Base):
    __tablename__ = "run_results"
    __table_args__ = (UniqueConstraint("run_item_id", "sequence", name="uq_run_result_sequence"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_item_id: Mapped[str] = mapped_column(
        ForeignKey(FK_RUN_ITEMS_ID, ondelete=ON_DELETE_CASCADE), nullable=False, index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[RunItemStatus] = mapped_column(
        Enum(RunItemStatus, name="run_item_status"), nullable=False
    )
    time: Mapped[str | None] = mapped_column(String(64))
    comment: Mapped[str | None] = mapped_column(Text())
    defect_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    executed_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    run_item: Mapped[RunItem] = relationship(back_populates="results")
    executed_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[RunResult.executed_by]",
        primaryjoin="RunResult.executed_by == User.id",
        lazy="selectin",
    )

    @property
    def test_run_id(self) -> str:
        return self.run_item.test_run_id

    @property
    def test_case_id(self) -> str:
        return self.run_item.test_case_id


class RunItemStatusChangeLog(Base):
    __tablename__ = "run_item_status_change_log"
    __table_args__ = (
        UniqueConstraint("run_item_id", "idempotency_key", name="uq_run_item_idempotency"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_item_id: Mapped[str] = mapped_column(
        ForeignKey(FK_RUN_ITEMS_ID, ondelete=ON_DELETE_CASCADE), nullable=False, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    response_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class RunCaseHistory(Base):
    """Append-only history of run-case execution changes."""

    __tablename__ = "run_case_history"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_case_id: Mapped[str] = mapped_column(
        ForeignKey(FK_RUN_ITEMS_ID, ondelete=ON_DELETE_CASCADE), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    time: Mapped[str | None] = mapped_column(String(64))
    comment: Mapped[str | None] = mapped_column(Text())
    defect_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    actual_result: Mapped[str | None] = mapped_column(Text())
    system_out: Mapped[str | None] = mapped_column(Text())
    system_err: Mapped[str | None] = mapped_column(Text())
    executed_by_id: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    changed_by_id: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), nullable=True, index=True
    )
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    run_case: Mapped["RunItem"] = relationship(
        back_populates="history",
        foreign_keys="[RunCaseHistory.run_case_id]",
    )


class TestRunImport(Base):
    __tablename__ = "test_run_imports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), index=True)
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_content_type: Mapped[str | None] = mapped_column(String(255))
    source_xml: Mapped[str] = mapped_column(Text(), nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    test_run: Mapped[TestRun] = relationship()
    created_by_user: Mapped[User | None] = relationship(
        foreign_keys="[TestRunImport.created_by]",
        primaryjoin="TestRunImport.created_by == User.id",
        lazy="selectin",
    )
