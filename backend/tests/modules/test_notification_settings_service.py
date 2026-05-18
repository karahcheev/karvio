from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.errors import DomainError
from app.modules.notifications.schemas.settings import SmtpSettingsCreate, SmtpTestRequest
from app.modules.notifications.services import settings as service


@pytest.mark.asyncio
async def test_test_smtp_settings_uses_stored_settings_when_payload_smtp_missing() -> None:
    db = AsyncMock()
    current_user = SimpleNamespace(id="u_admin")
    stored = SimpleNamespace(host="smtp.local")
    payload = SmtpTestRequest(recipient_email="qa@example.com", smtp=None)

    with (
        patch("app.modules.notifications.services.settings.ensure_admin", new_callable=AsyncMock),
        patch("app.modules.notifications.services.settings.notification_repo.get_smtp_settings", new_callable=AsyncMock, return_value=stored),
        patch("app.modules.notifications.services.settings.send_email") as send_email,
    ):
        result = await service.test_smtp_settings(db, payload=payload, current_user=current_user)

    assert result.message == "Test email sent successfully"
    send_email.assert_called_once()


@pytest.mark.asyncio
async def test_test_smtp_settings_uses_payload_override() -> None:
    db = AsyncMock()
    current_user = SimpleNamespace(id="u_admin")
    payload = SmtpTestRequest(
        recipient_email="qa@example.com",
        smtp=SmtpSettingsCreate(
            enabled=True,
            host="smtp.test",
            port=587,
            username="u",
            password="p",
            from_email="noreply@example.com",
            from_name="QA",
            reply_to=None,
            use_tls=False,
            use_starttls=True,
            timeout_seconds=30,
        ),
    )
    materialized = SimpleNamespace(host="smtp.test")

    with (
        patch("app.modules.notifications.services.settings.ensure_admin", new_callable=AsyncMock),
        patch("app.modules.notifications.services.settings.smtp_from_test_payload", return_value=materialized) as from_payload,
        patch("app.modules.notifications.services.settings.send_email") as send_email,
    ):
        await service.test_smtp_settings(db, payload=payload, current_user=current_user)

    from_payload.assert_called_once_with(payload.smtp)
    send_email.assert_called_once()


@pytest.mark.asyncio
async def test_test_smtp_settings_returns_not_found_when_no_config_available() -> None:
    db = AsyncMock()
    current_user = SimpleNamespace(id="u_admin")
    payload = SmtpTestRequest(recipient_email="qa@example.com", smtp=None)

    with (
        patch("app.modules.notifications.services.settings.ensure_admin", new_callable=AsyncMock),
        patch("app.modules.notifications.services.settings.notification_repo.get_smtp_settings", new_callable=AsyncMock, return_value=None),
    ):
        with pytest.raises(DomainError) as exc:
            await service.test_smtp_settings(db, payload=payload, current_user=current_user)

    assert exc.value.code == "smtp_settings_not_found"
