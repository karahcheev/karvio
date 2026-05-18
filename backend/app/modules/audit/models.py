from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import AuditActorType, AuditQueueStatus, AuditResult


class AuditLog(Base):
    __tablename__ = "audit_logs"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    timestamp_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(64), index=True)
    actor_type: Mapped[AuditActorType] = mapped_column(
        Enum(AuditActorType, name="audit_actor_type"),
        default=AuditActorType.system,
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(64), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), index=True)
    result: Mapped[AuditResult] = mapped_column(
        Enum(AuditResult, name="audit_result"),
        nullable=False,
        default=AuditResult.success,
        index=True,
    )
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    request_id: Mapped[str | None] = mapped_column(String(128), index=True)
    tenant_id: Mapped[str | None] = mapped_column(String(64), index=True)
    before_state: Mapped[dict | list | None] = mapped_column(JSON)
    after_state: Mapped[dict | list | None] = mapped_column(JSON)
    event_metadata: Mapped[dict | list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class AuditLogQueueEntry(Base):
    __tablename__ = "audit_log_queue"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[AuditQueueStatus] = mapped_column(
        Enum(AuditQueueStatus, name="audit_queue_status"),
        nullable=False,
        default=AuditQueueStatus.pending,
        index=True,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    next_retry_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    last_error: Mapped[str | None] = mapped_column(Text())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
