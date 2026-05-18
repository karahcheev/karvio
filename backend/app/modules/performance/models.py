from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.domain_strings import (
    FK_PERFORMANCE_RUNS_ID,
    FK_USERS_ID,
    ON_DELETE_CASCADE,
    ON_DELETE_SET_NULL,
    RELATIONSHIP_CASCADE_DELETE_ORPHAN,
)
from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.modules.projects.models import Project, User


class PerformanceRun(Base):
    __tablename__ = "performance_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service: Mapped[str] = mapped_column(String(255), nullable=False)
    env: Mapped[str] = mapped_column(String(128), nullable=False)
    scenario: Mapped[str] = mapped_column(String(255), nullable=False)
    load_profile: Mapped[str] = mapped_column(String(255), nullable=False)
    branch: Mapped[str] = mapped_column(String(255), nullable=False)
    commit: Mapped[str] = mapped_column(String(128), nullable=False)
    build: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(255), nullable=False)
    tool: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running", index=True)
    verdict: Mapped[str] = mapped_column(String(32), nullable=False, default="yellow", index=True)
    load_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="http", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    baseline_ref: Mapped[str | None] = mapped_column(String(64))
    baseline_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    baseline_label: Mapped[str] = mapped_column(String(255), nullable=False, default="Manual baseline")

    summary: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    regressions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    metrics_comparison: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    environment_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_by: Mapped[str | None] = mapped_column(ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc
    )

    project: Mapped[Project] = relationship()
    created_by_user: Mapped[User | None] = relationship(
        foreign_keys="[PerformanceRun.created_by]",
        primaryjoin="PerformanceRun.created_by == User.id",
        lazy="selectin",
    )
    transactions: Mapped[list["PerformanceRunTransaction"]] = relationship(
        back_populates="run",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="PerformanceRunTransaction.position",
    )
    errors: Mapped[list["PerformanceRunError"]] = relationship(
        back_populates="run",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="PerformanceRunError.created_at",
    )
    artifacts: Mapped[list["PerformanceRunArtifact"]] = relationship(
        back_populates="run",
        cascade=RELATIONSHIP_CASCADE_DELETE_ORPHAN,
        order_by="PerformanceRunArtifact.created_at",
    )
    imports: Mapped[list["PerformanceImport"]] = relationship(back_populates="run")


class PerformanceRunTransaction(Base):
    __tablename__ = "performance_run_transactions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey(FK_PERFORMANCE_RUNS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    tx_group: Mapped[str] = mapped_column(String(64), nullable=False, default="General")
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    throughput_rps: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    p95_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rate_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    delta_p95_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    delta_error_rate_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    description: Mapped[str | None] = mapped_column(Text())
    run_command: Mapped[str | None] = mapped_column(Text())
    generators: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    system_load: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    logs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    artifacts: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)

    run: Mapped[PerformanceRun] = relationship(back_populates="transactions")


class PerformanceRunError(Base):
    __tablename__ = "performance_run_errors"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey(FK_PERFORMANCE_RUNS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    error_type: Mapped[str] = mapped_column(String(255), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rate_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hint: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)

    run: Mapped[PerformanceRun] = relationship(back_populates="errors")


class PerformanceRunArtifact(Base):
    __tablename__ = "performance_run_artifacts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey(FK_PERFORMANCE_RUNS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(32), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ready")
    storage_backend: Mapped[str | None] = mapped_column(String(64))
    storage_key: Mapped[str | None] = mapped_column(String(512))
    content_type: Mapped[str | None] = mapped_column(String(255))
    filename: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)

    run: Mapped[PerformanceRun] = relationship(back_populates="artifacts")


class PerformanceComparison(Base):
    """Saved snapshot of a multi-run comparison with optional public-share token."""

    __tablename__ = "performance_comparisons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete=ON_DELETE_CASCADE), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(255))
    base_run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    compare_run_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    metric_key: Mapped[str] = mapped_column(String(64), nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    public_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

    created_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc
    )

    project: Mapped[Project] = relationship()
    created_by_user: Mapped[User | None] = relationship(
        foreign_keys="[PerformanceComparison.created_by]",
        primaryjoin="PerformanceComparison.created_by == User.id",
        lazy="selectin",
    )


class PerformanceImport(Base):
    __tablename__ = "performance_imports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(
        ForeignKey(FK_PERFORMANCE_RUNS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    parse_status: Mapped[str] = mapped_column(String(32), nullable=False, default="partial")

    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_content_type: Mapped[str | None] = mapped_column(String(255))
    source_storage_backend: Mapped[str] = mapped_column(String(64), nullable=False)
    source_storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    source_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    adapter: Mapped[str | None] = mapped_column(String(64))
    adapter_version: Mapped[str | None] = mapped_column(String(64))
    confidence: Mapped[float | None] = mapped_column(Float)
    found: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    missing: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    issues: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    error_detail: Mapped[str | None] = mapped_column(Text())

    started_processing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_processing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[str | None] = mapped_column(ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc
    )

    run: Mapped[PerformanceRun] = relationship(back_populates="imports")
    created_by_user: Mapped[User | None] = relationship(
        foreign_keys="[PerformanceImport.created_by]",
        primaryjoin="PerformanceImport.created_by == User.id",
        lazy="selectin",
    )
