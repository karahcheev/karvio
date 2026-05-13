from __future__ import annotations

from app.core.queue import queue_app
from app.db.session import AsyncSessionLocal
from app.modules.notifications.services.queue import process_notification_queue_entry


@queue_app.task(name="notifications.process_queue_entry", queue="notifications")
async def process_notification_queue_entry_task(entry_id: str) -> None:
    async with AsyncSessionLocal() as db:
        await process_notification_queue_entry(db, entry_id=entry_id)


async def enqueue_notification_queue_entry(
    entry_id: str, *, countdown: int | float | None = None
) -> None:
    if countdown is not None:
        await process_notification_queue_entry_task.configure(
            schedule_in={"seconds": int(countdown)}
        ).defer_async(entry_id=entry_id)
    else:
        await process_notification_queue_entry_task.defer_async(entry_id=entry_id)
