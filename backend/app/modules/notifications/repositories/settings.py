from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationQueueStatus
from app.modules.notifications.models import NotificationQueueEntry, ProjectNotificationSettings, SystemSmtpSettings


async def get_smtp_settings(db: AsyncSession) -> SystemSmtpSettings | None:
    return await db.get(SystemSmtpSettings, "default")


async def get_project_notification_settings(db: AsyncSession, project_id: str) -> ProjectNotificationSettings | None:
    stmt = select(ProjectNotificationSettings).where(ProjectNotificationSettings.project_id == project_id)
    return await db.scalar(stmt)


async def claim_queue_entry(
    db: AsyncSession,
    *,
    entry_id: str,
    now: datetime,
) -> NotificationQueueEntry | None:
    stmt = (
        select(NotificationQueueEntry)
        .where(NotificationQueueEntry.id == entry_id)
        .where(NotificationQueueEntry.status == NotificationQueueStatus.pending)
        .where(NotificationQueueEntry.next_retry_at <= now)
        .with_for_update(skip_locked=True)
    )
    row = await db.scalar(stmt)
    if row is None:
        return None
    row.status = NotificationQueueStatus.processing
    return row


async def get_queue_entry(db: AsyncSession, entry_id: str) -> NotificationQueueEntry | None:
    return await db.get(NotificationQueueEntry, entry_id)


async def count_queue_by_status(db: AsyncSession) -> dict[str, int]:
    result = await db.execute(
        select(NotificationQueueEntry.status, func.count(NotificationQueueEntry.id)).group_by(NotificationQueueEntry.status)
    )
    rows = result.all()
    out: dict[str, int] = {}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        out[key] = int(count)
    return out
