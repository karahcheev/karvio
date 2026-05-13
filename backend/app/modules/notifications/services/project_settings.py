from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import NotificationChannel, NotificationEventType, ProjectMemberRole
from app.modules.notifications.models import ProjectNotificationSettings
from app.modules.projects.models import User
from app.modules.notifications.repositories import settings as notification_repo
from app.modules.notifications.services.email_delivery import send_email
from app.modules.notifications.services.message_builders import build_alerting_test_message
from app.modules.notifications.services.notification_rules import normalize_rule_payload, to_read_model
from app.modules.notifications.schemas.settings import (
    NotificationSettingsTestRequest,
    NotificationTestResult,
    ProjectNotificationSettingsCreate,
    ProjectNotificationSettingsRead,
    ProjectNotificationSettingsUpdate,
)
from app.modules.notifications.services.webhook_delivery import build_webhook_payload, send_webhook
from app.services.access import ensure_project_role


def _test_notification_copy(
    payload: NotificationSettingsTestRequest,
    settings: ProjectNotificationSettings,
) -> tuple[str, str, str, str, str, Any]:
    if payload.rule == NotificationEventType.test_run_report:
        title = "Karvio test run report test"
        body = "This is a test delivery for the test run report rule."
        subject, plain_text, html = title, body, f"<p>{body}</p>"
        rule_settings = normalize_rule_payload(settings.test_run_report)
    else:
        subject, plain_text, html = build_alerting_test_message(payload.project_id)
        title = subject
        body = plain_text
        rule_settings = normalize_rule_payload(settings.alerting)
    return title, body, subject, plain_text, html, rule_settings


async def _send_test_notification_for_channel(
    db: AsyncSession,
    payload: NotificationSettingsTestRequest,
    rule_settings: Any,
    *,
    title: str,
    body: str,
    subject: str,
    plain_text: str,
    html: str,
) -> None:
    if payload.channel == NotificationChannel.email:
        smtp_settings = await notification_repo.get_smtp_settings(db)
        if smtp_settings is None:
            raise not_found("smtp_settings")
        recipients = (
            [str(payload.recipient_email)]
            if payload.recipient_email is not None
            else [str(item) for item in rule_settings.email.recipients]
        )
        send_email(
            smtp_settings=smtp_settings,
            recipients=recipients,
            subject=subject,
            plain_text=plain_text,
            html=html,
        )
        return
    if payload.channel == NotificationChannel.slack:
        if not rule_settings.slack.enabled or not rule_settings.slack.webhook_url:
            raise DomainError(
                status_code=409,
                code="notification_channel_disabled",
                title="Channel disabled",
                detail="Slack webhook is not configured for this rule",
            )
        send_webhook(
            webhook_url=rule_settings.slack.webhook_url,
            payload=build_webhook_payload(
                title=title,
                text=body,
                channel=NotificationChannel.slack,
                channel_name=rule_settings.slack.channel_name,
            ),
        )
        return
    if not rule_settings.mattermost.enabled or not rule_settings.mattermost.webhook_url:
        raise DomainError(
            status_code=409,
            code="notification_channel_disabled",
            title="Channel disabled",
            detail="Mattermost webhook is not configured for this rule",
        )
    send_webhook(
        webhook_url=rule_settings.mattermost.webhook_url,
        payload=build_webhook_payload(
            title=title,
            text=body,
            channel=NotificationChannel.mattermost,
            channel_name=rule_settings.mattermost.channel_name,
        ),
    )


async def get_project_notification_settings(
    db: AsyncSession,
    *,
    project_id: str,
    current_user: User,
) -> ProjectNotificationSettingsRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    entity = await notification_repo.get_project_notification_settings(db, project_id)
    if entity is None:
        raise not_found("notification_settings")
    return to_read_model(entity)


async def create_project_notification_settings(
    db: AsyncSession,
    *,
    payload: ProjectNotificationSettingsCreate,
    current_user: User,
) -> ProjectNotificationSettingsRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    existing = await notification_repo.get_project_notification_settings(db, payload.project_id)
    if existing is not None:
        raise DomainError(
            status_code=409,
            code="notification_settings_already_exist",
            title="Conflict",
            detail="Notification settings already exist. Use PUT to update them.",
        )
    entity = ProjectNotificationSettings(
        project_id=payload.project_id,
        test_run_report=payload.test_run_report.model_dump(mode="json"),
        alerting=payload.alerting.model_dump(mode="json"),
    )
    db.add(entity)
    await db.flush()
    await db.refresh(entity)
    return to_read_model(entity)


async def update_project_notification_settings(
    db: AsyncSession,
    *,
    payload: ProjectNotificationSettingsUpdate,
    current_user: User,
) -> ProjectNotificationSettingsRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    entity = await notification_repo.get_project_notification_settings(db, payload.project_id)
    if entity is None:
        raise not_found("notification_settings")
    entity.test_run_report = payload.test_run_report.model_dump(mode="json")
    entity.alerting = payload.alerting.model_dump(mode="json")
    await db.flush()
    await db.refresh(entity)
    return to_read_model(entity)


async def test_project_notification_settings(
    db: AsyncSession,
    *,
    payload: NotificationSettingsTestRequest,
    current_user: User,
) -> NotificationTestResult:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    settings = await notification_repo.get_project_notification_settings(db, payload.project_id)
    if settings is None:
        raise not_found("notification_settings")

    title, body, subject, plain_text, html, rule_settings = _test_notification_copy(payload, settings)

    if not rule_settings.enabled:
        raise DomainError(
            status_code=409,
            code="notification_rule_disabled",
            title="Notification rule disabled",
            detail=f"{payload.rule.value} is disabled for this project",
        )

    await _send_test_notification_for_channel(
        db,
        payload,
        rule_settings,
        title=title,
        body=body,
        subject=subject,
        plain_text=plain_text,
        html=html,
    )

    return NotificationTestResult(message="Test notification sent successfully")
