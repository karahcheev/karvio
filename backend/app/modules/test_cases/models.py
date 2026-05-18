from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.domain_strings import (
    FK_SUITES_ID,
    FK_USERS_ID,
    ON_DELETE_SET_NULL,
    RELATIONSHIP_CASCADE_DELETE_ORPHAN,
)
from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import (
    DatasetBindingMode,
    DatasetRowSelectionType,
    DatasetStatus,
    DatasetSourceType,
    TestCasePriority,
    TestCaseStatus,
    TestCaseTemplateType,
    TestCaseType,
)
from app.modules.projects.models import Project, Suite, User

if TYPE_CHECKING:
    from app.modules.products.models import TestCaseComponentCoverage


class TestCase(Base):
    __tablename__ = "test_cases"
    __table_args__ = (
        Index(
            "uq_test_cases_project_automation_id",
            "project_id",
            "automation_id",
            unique=True,
            postgresql_where=text("automation_id IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    suite_id: Mapped[str | None] = mapped_column(ForeignKey(FK_SUITES_ID, ondelete=ON_DELETE_SET_NULL), index=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), index=True)
    primary_product_id: Mapped[str | None] = mapped_column(
        ForeignKey("products.id", ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    automation_id: Mapped[str | None] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    preconditions: Mapped[str | None] = mapped_column(Text())
    template_type: Mapped[TestCaseTemplateType] = mapped_column(
        Enum(TestCaseTemplateType, name="test_case_template_type"),
        default=TestCaseTemplateType.steps,
        nullable=False,
    )
    template_payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    time: Mapped[str | None] = mapped_column(String(64))
    priority: Mapped[TestCasePriority | None] = mapped_column(
        Enum(TestCasePriority, name="test_case_priority"), nullable=True
    )
    status: Mapped[TestCaseStatus] = mapped_column(
        Enum(TestCaseStatus, name="test_case_status"), default=TestCaseStatus.draft, nullable=False
    )
    test_case_type: Mapped[TestCaseType] = mapped_column(
        Enum(TestCaseType, name="test_case_type"), default=TestCaseType.manual, nullable=False
    )
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
    project: Mapped["Project"] = relationship()
    suite: Mapped["Suite | None"] = relationship()
    owner: Mapped["User | None"] = relationship()
    dataset_links: Mapped[list["TestCaseDataset"]] = relationship(
        "TestCaseDatasetBinding",
        back_populates="test_case",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
    )
    component_coverages: Mapped[list["TestCaseComponentCoverage"]] = relationship(
        "TestCaseComponentCoverage",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
    )


class TestCaseStep(Base):
    __tablename__ = "test_case_steps"
    __table_args__ = (UniqueConstraint("test_case_id", "position", name="uq_test_case_step_position"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_case_id: Mapped[str] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    expected_result: Mapped[str] = mapped_column(Text, nullable=False)
    test_case: Mapped["TestCase"] = relationship()


class TestDataset(Base):
    __tablename__ = "test_datasets"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_test_dataset_project_name"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    status: Mapped[DatasetStatus] = mapped_column(
        Enum(DatasetStatus, name="dataset_status"),
        default=DatasetStatus.active,
        nullable=False,
    )
    source_type: Mapped[DatasetSourceType] = mapped_column(
        Enum(DatasetSourceType, name="dataset_source_type"),
        default=DatasetSourceType.manual,
        nullable=False,
    )
    source_ref: Mapped[str | None] = mapped_column(String(512))
    current_revision_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_revision_id: Mapped[str | None] = mapped_column(String(64), index=True)
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project"] = relationship()
    created_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[TestDataset.created_by]",
        primaryjoin="TestDataset.created_by == User.id",
        lazy="selectin",
    )
    case_links: Mapped[list["TestCaseDatasetBinding"]] = relationship(
        back_populates="dataset",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
    )
    revisions: Mapped[list["DatasetRevision"]] = relationship(
        back_populates="dataset",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="DatasetRevision.revision_number.desc()",
    )


class DatasetRevision(Base):
    __tablename__ = "dataset_revisions"
    __table_args__ = (UniqueConstraint("dataset_id", "revision_number", name="uq_dataset_revision_number"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    dataset_id: Mapped[str] = mapped_column(
        ForeignKey("test_datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    rows_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text())
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    dataset: Mapped["TestDataset"] = relationship(back_populates="revisions")
    columns: Mapped[list["DatasetColumn"]] = relationship(
        back_populates="revision",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="DatasetColumn.order_index.asc()",
    )
    rows: Mapped[list["DatasetRow"]] = relationship(
        back_populates="revision",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="DatasetRow.order_index.asc()",
    )


class DatasetColumn(Base):
    __tablename__ = "dataset_columns"
    __table_args__ = (UniqueConstraint("dataset_revision_id", "column_key", name="uq_dataset_column_key"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    dataset_revision_id: Mapped[str] = mapped_column(
        ForeignKey("dataset_revisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_key: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[str] = mapped_column(String(32), default="string", nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_value: Mapped[str | None] = mapped_column(Text())
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_scenario_label: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    revision: Mapped["DatasetRevision"] = relationship(back_populates="columns")


class DatasetRow(Base):
    __tablename__ = "dataset_rows"
    __table_args__ = (UniqueConstraint("dataset_revision_id", "row_key", name="uq_dataset_row_key"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    dataset_revision_id: Mapped[str] = mapped_column(
        ForeignKey("dataset_revisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_key: Mapped[str] = mapped_column(String(128), nullable=False)
    scenario_label: Mapped[str | None] = mapped_column(String(255))
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    values_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    revision: Mapped["DatasetRevision"] = relationship(back_populates="rows")


class TestCaseDatasetBinding(Base):
    __tablename__ = "test_case_dataset_bindings"
    __table_args__ = (
        UniqueConstraint("test_case_id", "dataset_id", name="uq_test_case_dataset_binding"),
        UniqueConstraint("test_case_id", "dataset_alias", name="uq_test_case_dataset_alias"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_case_id: Mapped[str] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dataset_id: Mapped[str] = mapped_column(
        ForeignKey("test_datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dataset_alias: Mapped[str] = mapped_column(String(128), nullable=False)
    mode: Mapped[DatasetBindingMode] = mapped_column(
        Enum(DatasetBindingMode, name="dataset_binding_mode"),
        default=DatasetBindingMode.follow_latest,
        nullable=False,
    )
    pinned_revision_number: Mapped[int | None] = mapped_column(Integer)
    row_selection_type: Mapped[DatasetRowSelectionType] = mapped_column(
        Enum(DatasetRowSelectionType, name="dataset_row_selection_type"),
        default=DatasetRowSelectionType.all,
        nullable=False,
    )
    selected_row_keys: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    test_case = relationship("TestCase", back_populates="dataset_links")
    dataset: Mapped["TestDataset"] = relationship(back_populates="case_links")


# Backward-compatible symbol for old imports in untouched modules.
TestCaseDataset = TestCaseDatasetBinding
