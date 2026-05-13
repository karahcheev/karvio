from __future__ import annotations

from app.core.queue import queue_app
from app.db.session import AsyncSessionLocal
from app.modules.audit.services.audit import process_queue_entry


@queue_app.task(name="audit.process_queue_entry", queue="audit")
async def process_audit_queue_entry_task(queue_id: str) -> None:
    async with AsyncSessionLocal() as db:
        await process_queue_entry(db, queue_id=queue_id)


async def enqueue_audit_queue_entry(queue_id: str, *, countdown: int | float | None = None) -> None:
    if countdown is not None:
        await process_audit_queue_entry_task.configure(
            schedule_in={"seconds": int(countdown)}
        ).defer_async(queue_id=queue_id)
    else:
        await process_audit_queue_entry_task.defer_async(queue_id=queue_id)
