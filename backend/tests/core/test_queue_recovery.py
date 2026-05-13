"""Recovery on startup re-enqueues queue rows whose procrastinate job got lost."""

from __future__ import annotations

from datetime import datetime, timezone

from procrastinate.testing import InMemoryConnector
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.queue_recovery import recover_pending_jobs
from app.models.enums import (
    AuditActorType,
    AuditQueueStatus,
    AuditResult,
    NotificationChannel,
    NotificationEventType,
    NotificationQueueStatus,
)
from app.modules.audit.models import AuditLogQueueEntry
from app.modules.audit.tasks import process_audit_queue_entry_task
from app.modules.notifications.models import NotificationQueueEntry
from app.modules.notifications.tasks import process_notification_queue_entry_task
from app.modules.projects.models import Project


async def test_recover_pending_jobs_reenqueues_audit_entries(
    db_session: AsyncSession,
    _in_memory_queue: InMemoryConnector,
) -> None:
    pending = AuditLogQueueEntry(
        id="pending_q",
        event_id="evt_pending",
        payload={
            "event_id": "evt_pending",
            "action": "user.create",
            "actor_id": "u1",
            "actor_type": AuditActorType.user.value,
            "result": AuditResult.success.value,
        },
        status=AuditQueueStatus.pending,
        max_attempts=5,
        next_retry_at=datetime.now(timezone.utc),
    )
    processed = AuditLogQueueEntry(
        id="processed_q",
        event_id="evt_done",
        payload={"event_id": "evt_done", "action": "user.update"},
        status=AuditQueueStatus.processed,
        max_attempts=5,
        next_retry_at=datetime.now(timezone.utc),
    )
    db_session.add_all([pending, processed])
    await db_session.commit()

    counts = await recover_pending_jobs(db_session)

    assert counts["audit"] == 1
    audit_jobs = [
        job
        for job in _in_memory_queue.jobs.values()
        if job["task_name"] == process_audit_queue_entry_task.name
    ]
    assert [job["args"] for job in audit_jobs] == [{"queue_id": "pending_q"}]


async def test_recover_pending_jobs_reenqueues_notification_entries(
    db_session: AsyncSession,
    _in_memory_queue: InMemoryConnector,
) -> None:
    project = Project(id="proj_recover", name="Recover")
    pending = NotificationQueueEntry(
        id="notif_pending",
        project_id=project.id,
        event_type=NotificationEventType.test_run_report,
        channel=NotificationChannel.email,
        target={"recipients": ["x@example.com"]},
        payload={"subject": "s", "plain_text": "t", "html": "<p>t</p>"},
        status=NotificationQueueStatus.pending,
    )
    db_session.add_all([project, pending])
    await db_session.commit()

    counts = await recover_pending_jobs(db_session)

    assert counts["notifications"] == 1
    notif_jobs = [
        job
        for job in _in_memory_queue.jobs.values()
        if job["task_name"] == process_notification_queue_entry_task.name
    ]
    assert [job["args"] for job in notif_jobs] == [{"entry_id": "notif_pending"}]
