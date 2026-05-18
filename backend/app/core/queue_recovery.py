"""Re-enqueue background jobs for queue rows that are stuck in ``pending``.

A queue row in ``audit_log_queue`` / ``notification_queue`` / ``performance_imports``
is the source of truth for "work needs doing"; the procrastinate job is just the
trigger that wakes a worker. If the trigger gets lost — process restart, broker
outage, the AppNotOpen regression we hit during the celery → procrastinate
migration — the row sits in ``pending`` forever.

Running this on every startup makes recovery automatic: ``claim_queue_entry``
uses ``SELECT ... FOR UPDATE SKIP LOCKED``, so re-enqueuing rows that already
have a live procrastinate job is a no-op.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AuditQueueStatus, NotificationQueueStatus
from app.modules.audit.models import AuditLogQueueEntry
from app.modules.audit.tasks import enqueue_audit_queue_entry
from app.modules.notifications.models import NotificationQueueEntry
from app.modules.notifications.tasks import enqueue_notification_queue_entry
from app.modules.performance.models import PerformanceImport
from app.modules.performance.tasks import enqueue_performance_import

logger = logging.getLogger("tms.queue.recovery")


async def recover_pending_jobs(db: AsyncSession) -> dict[str, int]:
    counts = {
        "audit": await _recover_audit(db),
        "notifications": await _recover_notifications(db),
        "performance": await _recover_performance(db),
    }
    if any(counts.values()):
        logger.info(
            "Re-enqueued pending background jobs on startup",
            extra={"event": "queue.recovery", **counts},
        )
    return counts


async def _recover_audit(db: AsyncSession) -> int:
    rows = await db.scalars(
        select(AuditLogQueueEntry.id).where(AuditLogQueueEntry.status == AuditQueueStatus.pending)
    )
    count = 0
    for entry_id in rows:
        await enqueue_audit_queue_entry(entry_id)
        count += 1
    return count


async def _recover_notifications(db: AsyncSession) -> int:
    rows = await db.scalars(
        select(NotificationQueueEntry.id).where(
            NotificationQueueEntry.status == NotificationQueueStatus.pending
        )
    )
    count = 0
    for entry_id in rows:
        await enqueue_notification_queue_entry(entry_id)
        count += 1
    return count


async def _recover_performance(db: AsyncSession) -> int:
    rows = await db.scalars(
        select(PerformanceImport.id).where(PerformanceImport.status == "pending")
    )
    count = 0
    for import_id in rows:
        await enqueue_performance_import(import_id)
        count += 1
    return count
