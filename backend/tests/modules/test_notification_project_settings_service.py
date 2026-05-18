from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.errors import DomainError
from app.models.enums import NotificationChannel, NotificationEventType
from app.modules.notifications.schemas.settings import NotificationSettingsTestRequest
from app.modules.notifications.services import project_settings as service


@pytest.mark.asyncio
async def test_test_notification_copy_uses_test_run_report_copy() -> None:
    payload = NotificationSettingsTestRequest(
        project_id="p1",
        rule=NotificationEventType.test_run_report,
        channel=NotificationChannel.email,
    )
    settings = SimpleNamespace(test_run_report={"enabled": True}, alerting={"enabled": False})

    title, body, subject, plain_text, html, rule_settings = service._test_notification_copy(payload, settings)

    assert title == "Karvio test run report test"
    assert subject == title
    assert "test run report rule" in body
    assert "<p>" in html
    assert rule_settings.enabled is True


@pytest.mark.asyncio
async def test_test_notification_copy_uses_alerting_copy() -> None:
    payload = NotificationSettingsTestRequest(
        project_id="p1",
        rule=NotificationEventType.alerting,
        channel=NotificationChannel.email,
    )
    settings = SimpleNamespace(test_run_report={}, alerting={"enabled": True})

    with patch(
        "app.modules.notifications.services.project_settings.build_alerting_test_message",
        return_value=("Subj", "Body", "<p>Body</p>"),
    ):
        title, body, subject, plain_text, html, _rule_settings = service._test_notification_copy(payload, settings)

    assert (title, body, subject, plain_text, html) == ("Subj", "Body", "Subj", "Body", "<p>Body</p>")


@pytest.mark.asyncio
async def test_send_test_notification_for_channel_email_uses_payload_recipient_override() -> None:
    db = AsyncMock()
    payload = NotificationSettingsTestRequest(
        project_id="p1",
        rule=NotificationEventType.test_run_report,
        channel=NotificationChannel.email,
        recipient_email="override@example.com",
    )
    rule_settings = SimpleNamespace(
        email=SimpleNamespace(recipients=["rule@example.com"]),
        slack=SimpleNamespace(enabled=False, webhook_url=None, channel_name=None),
        mattermost=SimpleNamespace(enabled=False, webhook_url=None, channel_name=None),
    )

    with (
        patch(
            "app.modules.notifications.services.project_settings.notification_repo.get_smtp_settings",
            new_callable=AsyncMock,
            return_value=SimpleNamespace(host="smtp"),
        ),
        patch("app.modules.notifications.services.project_settings.send_email") as send_email,
    ):
        await service._send_test_notification_for_channel(
            db,
            payload,
            rule_settings,
            title="Title",
            body="Body",
            subject="Subj",
            plain_text="Body",
            html="<p>Body</p>",
        )

    send_email.assert_called_once()
    assert send_email.call_args.kwargs["recipients"] == ["override@example.com"]


@pytest.mark.asyncio
async def test_send_test_notification_for_channel_slack_validation_and_success() -> None:
    db = AsyncMock()
    payload = NotificationSettingsTestRequest(
        project_id="p1",
        rule=NotificationEventType.alerting,
        channel=NotificationChannel.slack,
    )
    disabled_rule = SimpleNamespace(
        slack=SimpleNamespace(enabled=False, webhook_url=None, channel_name="#qa"),
        mattermost=SimpleNamespace(enabled=False, webhook_url=None, channel_name=None),
        email=SimpleNamespace(recipients=[]),
    )

    with pytest.raises(DomainError) as disabled_exc:
        await service._send_test_notification_for_channel(
            db,
            payload,
            disabled_rule,
            title="Title",
            body="Body",
            subject="Subj",
            plain_text="Body",
            html="<p>Body</p>",
        )
    assert disabled_exc.value.code == "notification_channel_disabled"

    enabled_rule = SimpleNamespace(
        slack=SimpleNamespace(enabled=True, webhook_url="https://example.test/slack", channel_name="#qa"),
        mattermost=SimpleNamespace(enabled=False, webhook_url=None, channel_name=None),
        email=SimpleNamespace(recipients=[]),
    )
    with (
        patch("app.modules.notifications.services.project_settings.build_webhook_payload", return_value={"ok": True}) as build,
        patch("app.modules.notifications.services.project_settings.send_webhook") as send,
    ):
        await service._send_test_notification_for_channel(
            db,
            payload,
            enabled_rule,
            title="Title",
            body="Body",
            subject="Subj",
            plain_text="Body",
            html="<p>Body</p>",
        )

    build.assert_called_once()
    send.assert_called_once_with(webhook_url="https://example.test/slack", payload={"ok": True})


@pytest.mark.asyncio
async def test_send_test_notification_for_channel_mattermost_requires_configuration() -> None:
    db = AsyncMock()
    payload = NotificationSettingsTestRequest(
        project_id="p1",
        rule=NotificationEventType.alerting,
        channel=NotificationChannel.mattermost,
    )
    invalid_rule = SimpleNamespace(
        slack=SimpleNamespace(enabled=False, webhook_url=None, channel_name=None),
        mattermost=SimpleNamespace(enabled=False, webhook_url=None, channel_name=None),
        email=SimpleNamespace(recipients=[]),
    )

    with pytest.raises(DomainError) as invalid_exc:
        await service._send_test_notification_for_channel(
            db,
            payload,
            invalid_rule,
            title="Title",
            body="Body",
            subject="Subj",
            plain_text="Body",
            html="<p>Body</p>",
        )

    assert invalid_exc.value.code == "notification_channel_disabled"


@pytest.mark.asyncio
async def test_test_project_notification_settings_rejects_disabled_rule() -> None:
    db = AsyncMock()
    payload = NotificationSettingsTestRequest(
        project_id="p1",
        rule=NotificationEventType.alerting,
        channel=NotificationChannel.email,
    )
    current_user = SimpleNamespace(id="u1")

    with (
        patch("app.modules.notifications.services.project_settings.ensure_project_role", new_callable=AsyncMock),
        patch(
            "app.modules.notifications.services.project_settings.notification_repo.get_project_notification_settings",
            new_callable=AsyncMock,
            return_value=SimpleNamespace(test_run_report={}, alerting={"enabled": False}),
        ),
    ):
        with pytest.raises(DomainError) as exc:
            await service.test_project_notification_settings(db, payload=payload, current_user=current_user)

    assert exc.value.code == "notification_rule_disabled"
