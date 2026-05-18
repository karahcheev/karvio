from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import register_after_commit_callback
from app.core.errors import not_found
from app.core.errors import DomainError
from app.core.metrics import observe_worker_batch, record_queue_retry, set_queue_depth
from app.models.enums import NotificationChannel, NotificationEventType, NotificationQueueStatus
from app.modules.notifications.models import NotificationQueueEntry
from app.modules.notifications.repositories import settings as notification_repo
from app.modules.notifications.services.email_delivery import send_email
from app.modules.notifications.services.message_builders import build_test_run_report_message
from app.modules.notifications.services.notification_rules import normalize_rule_payload
from app.modules.notifications.services.webhook_delivery import build_webhook_payload, send_webhook
from app.modules.test_runs.repositories import runs as test_run_repo

QUEUE_RETRY_MAX_SECONDS = 300
QUEUE_STATUSES = ("pending", "processing", "sent", "dead")

logger = logging.getLogger("tms.worker.notifications")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _deliver_queue_entry(
    db: AsyncSession,
    *,
    entry: NotificationQueueEntry,
) -> None:
    smtp_settings = await notification_repo.get_smtp_settings(db)
    payload = entry.payload
    if entry.channel == NotificationChannel.email:
        if smtp_settings is None:
            raise DomainError(
                status_code=409,
                code="smtp_settings_missing",
                title="SMTP settings missing",
                detail="SMTP settings are required to send email notifications",
            )
        send_email(
            smtp_settings=smtp_settings,
            recipients=list(entry.target.get("recipients") or []),
            subject=str(payload.get("subject") or "Karvio notification"),
            plain_text=str(payload.get("plain_text") or ""),
            html=str(payload.get("html") or "<p></p>"),
        )
    else:
        send_webhook(
            webhook_url=str(entry.target.get("webhook_url") or ""),
            payload=build_webhook_payload(
                title=str(payload.get("title") or "Karvio notification"),
                text=str(payload.get("text") or ""),
                channel=entry.channel,
                channel_name=str(entry.target.get("channel_name") or "") or None,
            ),
        )
    entry.status = NotificationQueueStatus.sent
    entry.processed_at = _now_utc()
    entry.last_error = None


async def queue_test_run_report_notifications(db: AsyncSession, *, test_run_id: str) -> int:
    run = await test_run_repo.get_by_id(db, test_run_id)
    if run is None:
        raise not_found("test_run")

    project_settings = await notification_repo.get_project_notification_settings(db, run.project_id)
    if project_settings is None:
        return 0

    rule = normalize_rule_payload(project_settings.test_run_report)
    if not rule.enabled:
        return 0

    subject, plain_text, html = await build_test_run_report_message(db, run)
    payload = {
        "subject": subject,
        "plain_text": plain_text,
        "html": html,
        "title": subject,
        "text": plain_text.replace("\n", "\n"),
        "test_run_id": run.id,
        "project_id": run.project_id,
    }
    entries: list[NotificationQueueEntry] = []

    if rule.email.enabled and rule.email.recipients:
        entry = NotificationQueueEntry(
            project_id=run.project_id,
            event_type=NotificationEventType.test_run_report,
            channel=NotificationChannel.email,
            target={"recipients": [str(item) for item in rule.email.recipients]},
            payload=payload,
        )
        db.add(entry)
        entries.append(entry)
    if rule.slack.enabled and rule.slack.webhook_url:
        entry = NotificationQueueEntry(
            project_id=run.project_id,
            event_type=NotificationEventType.test_run_report,
            channel=NotificationChannel.slack,
            target={"webhook_url": rule.slack.webhook_url, "channel_name": rule.slack.channel_name},
            payload=payload,
        )
        db.add(entry)
        entries.append(entry)
    if rule.mattermost.enabled and rule.mattermost.webhook_url:
        entry = NotificationQueueEntry(
            project_id=run.project_id,
            event_type=NotificationEventType.test_run_report,
            channel=NotificationChannel.mattermost,
            target={"webhook_url": rule.mattermost.webhook_url, "channel_name": rule.mattermost.channel_name},
            payload=payload,
        )
        db.add(entry)
        entries.append(entry)

    if not entries:
        return 0

    await db.flush()
    entry_ids = [entry.id for entry in entries]

    async def _enqueue_notification_tasks() -> None:
        from app.modules.notifications.tasks import enqueue_notification_queue_entry

        for entry_id in entry_ids:
            await enqueue_notification_queue_entry(entry_id, countdown=1)

    register_after_commit_callback(db, _enqueue_notification_tasks)
    return len(entries)


async def mark_queue_failed(db: AsyncSession, entry_id: str, *, error: str) -> NotificationQueueEntry | None:
    queue_entry = await notification_repo.get_queue_entry(db, entry_id)
    if queue_entry is None:
        return None
    queue_entry.attempt_count += 1
    queue_entry.last_error = error[:2000]
    queue_entry.next_retry_at = _now_utc() + timedelta(
        seconds=min(2**queue_entry.attempt_count, QUEUE_RETRY_MAX_SECONDS)
    )
    queue_entry.status = (
        NotificationQueueStatus.dead
        if queue_entry.attempt_count >= queue_entry.max_attempts
        else NotificationQueueStatus.pending
    )
    record_queue_retry(
        queue="notifications",
        dead_lettered=queue_entry.status == NotificationQueueStatus.dead,
    )
    return queue_entry


async def _refresh_queue_depth_metric(db: AsyncSession) -> None:
    set_queue_depth(
        queue="notifications",
        by_status=await notification_repo.count_queue_by_status(db),
        known_statuses=QUEUE_STATUSES,
    )


async def process_notification_queue_entry(db: AsyncSession, *, entry_id: str) -> bool:
    started = time.perf_counter()
    processed = 0

    claimed = await notification_repo.claim_queue_entry(db, entry_id=entry_id, now=_now_utc())
    if claimed is None:
        await _refresh_queue_depth_metric(db)
        observe_worker_batch(
            worker="notification_queue_worker",
            queue="notifications",
            claimed=0,
            processed=0,
            duration_seconds=time.perf_counter() - started,
        )
        return False

    await db.commit()
    try:
        await _deliver_queue_entry(db, entry=claimed)
        await db.commit()
        processed = 1
        return True
    except Exception as exc:
        failed_entry = await mark_queue_failed(db, claimed.id, error=str(exc))
        await db.commit()
        logger.exception(
            "Failed to process notification queue entry",
            extra={"event": "worker.notification_queue_entry_failed", "queue_entry_id": claimed.id},
        )

        if failed_entry is not None and failed_entry.status == NotificationQueueStatus.pending:
            retry_seconds = max(1, int((failed_entry.next_retry_at - _now_utc()).total_seconds()))
            try:
                from app.modules.notifications.tasks import enqueue_notification_queue_entry

                await enqueue_notification_queue_entry(claimed.id, countdown=retry_seconds)
            except Exception:
                logger.exception(
                    "Failed to enqueue notification queue retry",
                    extra={"event": "worker.notification_queue_retry_enqueue_failed", "queue_entry_id": claimed.id},
                )
        return False
    finally:
        await _refresh_queue_depth_metric(db)
        observe_worker_batch(
            worker="notification_queue_worker",
            queue="notifications",
            claimed=1,
            processed=processed,
            duration_seconds=time.perf_counter() - started,
        )
