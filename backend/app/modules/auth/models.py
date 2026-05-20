from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import AuthProviderType, UserRole


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


class AuthProvider(Base):
    __tablename__ = "auth_providers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    type: Mapped[AuthProviderType] = mapped_column(
        Enum(AuthProviderType, name="auth_provider_type"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    login_label: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    # Provisioning policy
    auto_provision: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    new_user_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_email_linking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Local-only: restrict local login to system admins (break-glass path)
    local_admin_only: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Non-secret protocol configuration (LDAP/OIDC fields, claim mappings, ...)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    # Fernet-encrypted JSON map of secret values; never returned by the API
    secrets_encrypted: Mapped[str | None] = mapped_column(Text())
    # Optional group -> role/membership mapping (model present, enforcement deferred)
    group_mapping: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    full_group_sync: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Projects to auto-assign authenticated users to. Each entry is
    # {"project_id": str, "role": ProjectMemberRole}. Applied idempotently on
    # every successful login through the provider (never downgrades a role).
    auto_assign_projects: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_test_status: Mapped[str | None] = mapped_column(String(16))
    last_test_error: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    identities: Mapped[list["UserExternalIdentity"]] = relationship(
        back_populates="provider",
        cascade="all, delete-orphan",
    )


class UserExternalIdentity(Base):
    __tablename__ = "user_external_identities"
    __table_args__ = (
        UniqueConstraint("provider_id", "subject", name="uq_user_external_identity_provider_subject"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id: Mapped[str] = mapped_column(
        ForeignKey("auth_providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_type: Mapped[AuthProviderType] = mapped_column(
        Enum(AuthProviderType, name="auth_provider_type"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email_at_link_time: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    provider: Mapped["AuthProvider"] = relationship(back_populates="identities")
    user = relationship("User")
