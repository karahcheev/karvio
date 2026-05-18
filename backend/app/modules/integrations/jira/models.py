from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import ExternalIssueOwnerType, ExternalIssueProvider
from app.modules.projects.models import Project, User


class JiraConnection(Base):
    __tablename__ = "jira_connections"
    __table_args__ = (UniqueConstraint("workspace_id", "cloud_id", name="uq_jira_connection_workspace_cloud"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    cloud_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    site_url: Mapped[str] = mapped_column(String(512), nullable=False)
    account_id: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    access_token_encrypted: Mapped[str] = mapped_column(Text(), nullable=False)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_error: Mapped[str | None] = mapped_column(Text())
    last_sync_retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    mappings: Mapped[list["JiraProjectMapping"]] = relationship(
        back_populates="connection",
        cascade="all, delete-orphan",
    )


class SystemJiraSettings(Base):
    __tablename__ = "system_jira_settings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default="default")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    api_token_site_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    api_token_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    api_token_encrypted: Mapped[str | None] = mapped_column(Text())
    api_base_url: Mapped[str] = mapped_column(String(512), nullable=False, default="https://api.atlassian.com")
    http_timeout_seconds: Mapped[float] = mapped_column(nullable=False, default=20.0)
    http_max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    sync_default_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )


class JiraProjectMapping(Base):
    __tablename__ = "jira_project_mappings"
    __table_args__ = (UniqueConstraint("project_id", name="uq_jira_project_mapping_project"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    jira_connection_id: Mapped[str] = mapped_column(
        ForeignKey("jira_connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jira_project_key: Mapped[str] = mapped_column(String(32), nullable=False)
    default_issue_type_id: Mapped[str | None] = mapped_column(String(64))
    default_labels: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    default_components: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    project: Mapped["Project"] = relationship()
    connection: Mapped["JiraConnection"] = relationship(back_populates="mappings")


class ExternalIssueLink(Base):
    __tablename__ = "external_issue_links"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "owner_type",
            "owner_id",
            "external_key",
            name="uq_external_issue_link_owner_issue",
        ),
        UniqueConstraint(
            "provider",
            "owner_type",
            "owner_id",
            "creation_idempotency_key",
            name="uq_external_issue_link_owner_idempotency",
        ),
        Index("ix_external_issue_link_provider_key", "provider", "external_key"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    provider: Mapped[ExternalIssueProvider] = mapped_column(
        Enum(ExternalIssueProvider, name="external_issue_provider"),
        nullable=False,
    )
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_type: Mapped[ExternalIssueOwnerType] = mapped_column(
        Enum(ExternalIssueOwnerType, name="external_issue_owner_type"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_key: Mapped[str] = mapped_column(String(64), nullable=False)
    external_url: Mapped[str] = mapped_column(String(512), nullable=False)
    snapshot_status: Mapped[str | None] = mapped_column(String(128))
    snapshot_summary: Mapped[str | None] = mapped_column(String(1024))
    snapshot_priority: Mapped[str | None] = mapped_column(String(128))
    snapshot_assignee: Mapped[str | None] = mapped_column(String(255))
    snapshot_assignee_account_id: Mapped[str | None] = mapped_column(String(128))
    snapshot_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_invalid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invalid_reason: Mapped[str | None] = mapped_column(Text())
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    creation_idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    project: Mapped["Project"] = relationship()
    created_by_user: Mapped["User | None"] = relationship(
        foreign_keys="[ExternalIssueLink.created_by]",
        primaryjoin="ExternalIssueLink.created_by == User.id",
        lazy="selectin",
    )
