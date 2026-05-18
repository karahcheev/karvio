from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc


class ProjectAiSettings(Base):
    __tablename__ = "project_ai_settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str | None] = mapped_column(String(255))
    api_key_encrypted: Mapped[str | None] = mapped_column(Text())
    timeout_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=30000)
    http_max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    duplicate_high_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.88)
    duplicate_medium_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.72)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    project = relationship("Project")


GLOBAL_AI_SETTINGS_ID = "global"


class GlobalAiSettings(Base):
    """Singleton row (id=GLOBAL_AI_SETTINGS_ID) storing instance-wide AI defaults.

    When a project has no ``ProjectAiSettings`` row, these values are used
    before falling back to env-var ``Settings``.
    """

    __tablename__ = "global_ai_settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: GLOBAL_AI_SETTINGS_ID)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str | None] = mapped_column(String(255))
    api_key_encrypted: Mapped[str | None] = mapped_column(Text())
    timeout_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=30000)
    http_max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    duplicate_high_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.88)
    duplicate_medium_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.72)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

