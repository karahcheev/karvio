from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.errors import DomainError
from app.models.enums import UserRole
from app.modules.notifications.schemas.settings import SmtpSettingsCreate, SmtpSettingsUpdate
from app.modules.notifications.services import smtp as service


def _smtp_payload(**overrides):
    data = {
        "enabled": True,
        "host": "smtp.example.com",
        "port": 587,
        "username": "user",
        "password": "secret",
        "from_email": "noreply@example.com",
        "from_name": "Karvio",
        "reply_to": None,
        "use_tls": False,
        "use_starttls": True,
        "timeout_seconds": 30,
    }
    data.update(overrides)
    return SmtpSettingsCreate(**data)


def _smtp_settings(**overrides):
    now = datetime.now(timezone.utc)
    data = {
        "enabled": True,
        "host": "smtp.example.com",
        "port": 587,
        "username": "u",
        "password": "p",
        "from_email": "noreply@example.com",
        "from_name": "Karvio",
        "reply_to": None,
        "use_tls": False,
        "use_starttls": True,
        "timeout_seconds": 30,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_mask_smtp_hides_password_and_keeps_metadata() -> None:
    masked = service.mask_smtp(_smtp_settings(password="secret"))
    assert masked.password_configured is True
    assert masked.host == "smtp.example.com"


def test_smtp_from_test_payload_maps_fields() -> None:
    payload = _smtp_payload(reply_to="reply@example.com")
    model = service.smtp_from_test_payload(payload)
    assert model.id == "test"
    assert model.reply_to == "reply@example.com"


@pytest.mark.asyncio
async def test_get_smtp_settings_non_admin_returns_only_enabled() -> None:
    db = AsyncMock()
    user = SimpleNamespace(role=UserRole.user)
    with patch(
        "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
        new_callable=AsyncMock,
        return_value=_smtp_settings(enabled=True),
    ):
        out = await service.get_smtp_settings(db, current_user=user)
    assert out.enabled is True


@pytest.mark.asyncio
async def test_get_smtp_settings_admin_not_found() -> None:
    db = AsyncMock()
    user = SimpleNamespace(role=UserRole.admin)
    with patch(
        "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(DomainError) as exc:
            await service.get_smtp_settings(db, current_user=user)
    assert exc.value.code == "smtp_settings_not_found"


@pytest.mark.asyncio
async def test_get_smtp_settings_admin_returns_masked_settings() -> None:
    db = AsyncMock()
    user = SimpleNamespace(role=UserRole.admin)
    settings = _smtp_settings(password="secret")
    with patch(
        "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
        new_callable=AsyncMock,
        return_value=settings,
    ):
        out = await service.get_smtp_settings(db, current_user=user)
    assert out.password_configured is True


@pytest.mark.asyncio
async def test_create_smtp_settings_conflict_when_exists() -> None:
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    user = SimpleNamespace(role=UserRole.admin)
    with (
        patch("app.modules.notifications.services.smtp.ensure_admin", new_callable=AsyncMock),
        patch(
            "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
            new_callable=AsyncMock,
            return_value=_smtp_settings(),
        ),
    ):
        with pytest.raises(DomainError) as exc:
            await service.create_smtp_settings(db, payload=_smtp_payload(), current_user=user)
    assert exc.value.code == "smtp_settings_already_exist"


@pytest.mark.asyncio
async def test_create_smtp_settings_success() -> None:
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    user = SimpleNamespace(role=UserRole.admin)

    async def _refresh(obj) -> None:
        obj.created_at = datetime.now(timezone.utc)
        obj.updated_at = datetime.now(timezone.utc)

    with (
        patch("app.modules.notifications.services.smtp.ensure_admin", new_callable=AsyncMock),
        patch(
            "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        db.refresh.side_effect = _refresh
        out = await service.create_smtp_settings(db, payload=_smtp_payload(), current_user=user)

    assert out.host == "smtp.example.com"
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_update_smtp_settings_keeps_existing_password_when_none() -> None:
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    user = SimpleNamespace(role=UserRole.admin)
    settings = _smtp_settings(password="existing")
    payload = SmtpSettingsUpdate(**_smtp_payload(password=None).model_dump())

    with (
        patch("app.modules.notifications.services.smtp.ensure_admin", new_callable=AsyncMock),
        patch(
            "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
            new_callable=AsyncMock,
            return_value=settings,
        ),
    ):
        out = await service.update_smtp_settings(db, payload=payload, current_user=user)

    assert settings.password == "existing"
    assert out.password_configured is True


@pytest.mark.asyncio
async def test_update_smtp_settings_not_found() -> None:
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    user = SimpleNamespace(role=UserRole.admin)
    payload = SmtpSettingsUpdate(**_smtp_payload(password=None).model_dump())

    with (
        patch("app.modules.notifications.services.smtp.ensure_admin", new_callable=AsyncMock),
        patch(
            "app.modules.notifications.services.smtp.notification_repo.get_smtp_settings",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        with pytest.raises(DomainError) as exc:
            await service.update_smtp_settings(db, payload=payload, current_user=user)
    assert exc.value.code == "smtp_settings_not_found"
