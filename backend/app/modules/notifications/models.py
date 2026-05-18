from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import NotificationChannel, NotificationEventType, NotificationQueueStatus


class SystemSmtpSettings(Base):
    __tablename__ = "system_smtp_settings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default="default")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=587)
    username: Mapped[str | None] = mapped_column(String(255))
    password: Mapped[str | None] = mapped_column(Text())
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255))
    reply_to: Mapped[str | None] = mapped_column(String(255))
    use_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    use_starttls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )


class ProjectNotificationSettings(Base):
    __tablename__ = "project_notification_settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    test_run_report: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    alerting: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
    project = relationship("Project")


class NotificationQueueEntry(Base):
    __tablename__ = "notification_queue"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[NotificationEventType] = mapped_column(
        Enum(NotificationEventType, name="notification_event_type"),
        nullable=False,
        index=True,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel"),
        nullable=False,
        index=True,
    )
    target: Mapped[dict] = mapped_column(JSON, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[NotificationQueueStatus] = mapped_column(
        Enum(NotificationQueueStatus, name="notification_queue_status"),
        nullable=False,
        default=NotificationQueueStatus.pending,
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
    project = relationship("Project")
