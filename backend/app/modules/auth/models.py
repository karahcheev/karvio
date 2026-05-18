from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc


class UserApiKey(Base):
    __tablename__ = "user_api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    key_prefix: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    key_hint: Mapped[str] = mapped_column(String(8), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_used_ip: Mapped[str | None] = mapped_column(String(64))
    last_used_user_agent: Mapped[str | None] = mapped_column(String(512))

    user = relationship("User")
    login_events: Mapped[list["UserApiKeyLogin"]] = relationship(
        back_populates="api_key",
        cascade="all, delete-orphan",
    )


class UserApiKeyLogin(Base):
    __tablename__ = "user_api_key_logins"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("user_api_keys.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    authenticated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    request_path: Mapped[str | None] = mapped_column(String(255))

    api_key: Mapped["UserApiKey"] = relationship(back_populates="login_events")
    user = relationship("User")
