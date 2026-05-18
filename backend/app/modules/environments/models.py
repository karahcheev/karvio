from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.domain_strings import (
    FK_ENVIRONMENT_REVISIONS_ID,
    FK_USERS_ID,
    ON_DELETE_CASCADE,
    ON_DELETE_SET_NULL,
)
from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.modules.projects.models import Project, User


class Environment(Base):
    __tablename__ = "environments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), default="custom", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    use_cases: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    topology: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    meta: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    extra: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    current_revision_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    updated_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    project: Mapped["Project"] = relationship()
    revisions: Mapped[list["EnvironmentRevision"]] = relationship(
        back_populates="environment",
        order_by="EnvironmentRevision.revision_number.desc()",
    )
    created_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[Environment.created_by]",
        primaryjoin="Environment.created_by == User.id",
        lazy="selectin",
    )
    updated_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[Environment.updated_by]",
        primaryjoin="Environment.updated_by == User.id",
        lazy="selectin",
    )


class EnvironmentRevision(Base):
    __tablename__ = "environment_revisions"
    __table_args__ = (
        UniqueConstraint("environment_id", "revision_number", name="uq_environment_revision_number"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    environment_id: Mapped[str] = mapped_column(
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    revision_note: Mapped[str | None] = mapped_column(Text())
    full_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    extra: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey(FK_USERS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    environment: Mapped["Environment"] = relationship(back_populates="revisions")
    entities: Mapped[list["EnvironmentEntity"]] = relationship(
        back_populates="revision",
        order_by="EnvironmentEntity.created_at.asc()",
    )
    edges: Mapped[list["EnvironmentEdge"]] = relationship(
        back_populates="revision",
        order_by="EnvironmentEdge.created_at.asc()",
    )
    created_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[EnvironmentRevision.created_by]",
        primaryjoin="EnvironmentRevision.created_by == User.id",
        lazy="selectin",
    )


class EnvironmentEntity(Base):
    __tablename__ = "environment_entities"
    __table_args__ = (
        UniqueConstraint("environment_revision_id", "entity_key", name="uq_environment_entity_key"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    environment_revision_id: Mapped[str] = mapped_column(
        ForeignKey(FK_ENVIRONMENT_REVISIONS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )
    entity_key: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(64))
    spec: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    extra: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    revision: Mapped["EnvironmentRevision"] = relationship(back_populates="entities")


class EnvironmentEdge(Base):
    __tablename__ = "environment_edges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    environment_revision_id: Mapped[str] = mapped_column(
        ForeignKey(FK_ENVIRONMENT_REVISIONS_ID, ondelete=ON_DELETE_CASCADE),
        nullable=False,
        index=True,
    )
    from_entity_key: Mapped[str] = mapped_column(String(255), nullable=False)
    to_entity_key: Mapped[str] = mapped_column(String(255), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    spec: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    extra: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    revision: Mapped["EnvironmentRevision"] = relationship(back_populates="edges")


class RunEnvironmentSnapshot(Base):
    __tablename__ = "run_environment_snapshots"
    __table_args__ = (
        UniqueConstraint("run_ref_type", "run_ref_id", name="uq_run_environment_snapshot_ref"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    run_ref_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    run_ref_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    environment_id: Mapped[str | None] = mapped_column(
        ForeignKey("environments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    environment_revision_id: Mapped[str | None] = mapped_column(
        ForeignKey(FK_ENVIRONMENT_REVISIONS_ID, ondelete=ON_DELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    extra: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
