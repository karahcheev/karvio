from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import UserRole
from app.modules.notifications.models import SystemSmtpSettings
from app.modules.projects.models import User
from app.modules.notifications.repositories import settings as notification_repo
from app.modules.notifications.schemas.settings import SmtpSettingsCreate, SmtpSettingsRead, SmtpSettingsUpdate, SmtpEnabledRead
from app.services.access import ensure_admin


def mask_smtp(settings: SystemSmtpSettings) -> SmtpSettingsRead:
    return SmtpSettingsRead(
        enabled=settings.enabled,
        host=settings.host,
        port=settings.port,
        username=settings.username,
        password_configured=bool(settings.password),
        from_email=settings.from_email,
        from_name=settings.from_name,
        reply_to=settings.reply_to,
        use_tls=settings.use_tls,
        use_starttls=settings.use_starttls,
        timeout_seconds=settings.timeout_seconds,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


def smtp_from_test_payload(payload: SmtpSettingsCreate) -> SystemSmtpSettings:
    return SystemSmtpSettings(
        id="test",
        enabled=payload.enabled,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        password=payload.password,
        from_email=str(payload.from_email),
        from_name=payload.from_name,
        reply_to=str(payload.reply_to) if payload.reply_to is not None else None,
        use_tls=payload.use_tls,
        use_starttls=payload.use_starttls,
        timeout_seconds=payload.timeout_seconds,
    )


async def get_smtp_settings(db: AsyncSession, *, current_user: User) -> SmtpSettingsRead | SmtpEnabledRead:
    settings = await notification_repo.get_smtp_settings(db)
    if current_user.role != UserRole.admin:
        return SmtpEnabledRead(enabled=bool(settings and settings.enabled))
    if settings is None:
        raise not_found("smtp_settings")
    return mask_smtp(settings)


async def create_smtp_settings(db: AsyncSession, *, payload: SmtpSettingsCreate, current_user: User) -> SmtpSettingsRead:
    await ensure_admin(current_user, action="settings.smtp.create")
    existing = await notification_repo.get_smtp_settings(db)
    if existing is not None:
        raise DomainError(
            status_code=409,
            code="smtp_settings_already_exist",
            title="Conflict",
            detail="SMTP settings already exist. Use PUT to update them.",
        )
    settings = SystemSmtpSettings(id="default", **payload.model_dump())
    db.add(settings)
    await db.flush()
    await db.refresh(settings)
    return mask_smtp(settings)


async def update_smtp_settings(db: AsyncSession, *, payload: SmtpSettingsUpdate, current_user: User) -> SmtpSettingsRead:
    await ensure_admin(current_user, action="settings.smtp.update")
    settings = await notification_repo.get_smtp_settings(db)
    if settings is None:
        raise not_found("smtp_settings")
    changes = payload.model_dump()
    if changes.get("password") is None:
        changes.pop("password", None)
    for key, value in changes.items():
        setattr(settings, key, value)
    await db.flush()
    await db.refresh(settings)
    return mask_smtp(settings)
