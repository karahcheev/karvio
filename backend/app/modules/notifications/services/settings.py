"""Public façade for notification settings, SMTP, queue, and project rules."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.modules.projects.models import User
from app.modules.notifications.repositories import settings as notification_repo
from app.modules.notifications.schemas.settings import (
    NotificationTestResult,
    SmtpTestRequest,
)
from app.modules.notifications.services.email_delivery import send_email
from app.modules.notifications.services.queue import (
    queue_test_run_report_notifications,
)
from app.modules.notifications.services.project_settings import (
    create_project_notification_settings,
    get_project_notification_settings,
    test_project_notification_settings,
    update_project_notification_settings,
)
from app.modules.notifications.services.smtp import (
    create_smtp_settings,
    get_smtp_settings,
    smtp_from_test_payload,
    update_smtp_settings,
)
from app.services.access import ensure_admin

__all__ = (
    "create_project_notification_settings",
    "create_smtp_settings",
    "get_project_notification_settings",
    "get_smtp_settings",
    "queue_test_run_report_notifications",
    "test_project_notification_settings",
    "test_smtp_settings",
    "update_project_notification_settings",
    "update_smtp_settings",
)


async def test_smtp_settings(
    db: AsyncSession,
    *,
    payload: SmtpTestRequest,
    current_user: User,
) -> NotificationTestResult:
    await ensure_admin(current_user, action="settings.smtp.test")
    settings = smtp_from_test_payload(payload.smtp) if payload.smtp is not None else await notification_repo.get_smtp_settings(db)
    if settings is None:
        raise not_found("smtp_settings")
    send_email(
        smtp_settings=settings,
        recipients=[str(payload.recipient_email)],
        subject="Karvio SMTP test",
        plain_text="This is a test email from Karvio SMTP settings.",
        html="<p>This is a test email from <strong>Karvio</strong> SMTP settings.</p>",
    )
    return NotificationTestResult(message="Test email sent successfully")
