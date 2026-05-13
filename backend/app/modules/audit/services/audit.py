from __future__ import annotations

import enum
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit_context import get_audit_request_context
from app.core.config import get_settings
from app.core.metrics import observe_worker_batch, record_queue_retry, set_queue_depth
from app.db.session import AsyncSessionLocal, register_after_commit_callback, run_after_commit_callbacks
from app.modules.audit.models import AuditLog, AuditLogQueueEntry
from app.models.enums import AuditActorType, AuditQueueStatus, AuditResult
from app.modules.audit.repositories import logs as audit_repo

logger = logging.getLogger(__name__)
settings = get_settings()

_SENSITIVE_FIELD_MARKERS = (
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "credential",
    "api_key",
)
_REDACTED = "***"
_AUDIT_QUEUE_STATUSES = ("pending", "processing", "processed", "dead")
_AUDIT_CLEANUP_INTERVAL_SECONDS = 300
_last_audit_cleanup_at_monotonic = 0.0


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_sensitive_key(key: str) -> bool:
    key_lower = key.lower()
    return any(marker in key_lower for marker in _SENSITIVE_FIELD_MARKERS)


def _to_json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): _to_json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_json_safe(item) for item in value]
    return value


def _mask_sensitive(value: Any, *, parent_key: str | None = None) -> Any:
    value = _to_json_safe(value)
    if parent_key and _is_sensitive_key(parent_key):
        return _REDACTED
    if isinstance(value, dict):
        return {key: _mask_sensitive(item, parent_key=key) for key, item in value.items()}
    if isinstance(value, list):
        return [_mask_sensitive(item, parent_key=parent_key) for item in value]
    return value


def snapshot_entity(entity: Any) -> dict[str, Any]:
    mapper = sa_inspect(entity.__class__)
    data: dict[str, Any] = {}
    for column in mapper.columns:
        data[column.key] = getattr(entity, column.key)
    return _mask_sensitive(data)


def _new_event_id() -> str:
    return f"audit_{uuid.uuid4().hex}"


@dataclass(slots=True, kw_only=True)
class AuditQueueEventParams:
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    result: AuditResult | str = AuditResult.success
    before: dict | list | None = None
    after: dict | list | None = None
    metadata: dict | list | None = None
    actor_id: str | None = None
    actor_type: AuditActorType | str | None = None
    tenant_id: str | None = None
    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    timestamp_utc: datetime | None = None


async def queue_event(db: AsyncSession, *, params: AuditQueueEventParams) -> str:
    result = params.result
    resolved_result = result if isinstance(result, AuditResult) else AuditResult(str(result))
    request_context = get_audit_request_context()
    resolved_actor_id = params.actor_id if params.actor_id is not None else request_context.actor_id
    if resolved_actor_id is None:
        resolved_actor_id = db.info.get("audit_actor_id")

    resolved_actor_type_value: str | AuditActorType | None = params.actor_type or request_context.actor_type
    if resolved_actor_type_value is None:
        resolved_actor_type_value = db.info.get("audit_actor_type")
    if resolved_actor_type_value is None:
        resolved_actor_type_value = AuditActorType.user if resolved_actor_id else AuditActorType.system
    resolved_actor_type = (
        resolved_actor_type_value
        if isinstance(resolved_actor_type_value, AuditActorType)
        else AuditActorType(str(resolved_actor_type_value))
    )

    event_id = _new_event_id()
    payload = {
        "event_id": event_id,
        "timestamp_utc": (params.timestamp_utc or _now_utc()).isoformat(),
        "actor_id": resolved_actor_id,
        "actor_type": resolved_actor_type.value,
        "action": params.action,
        "resource_type": params.resource_type,
        "resource_id": params.resource_id,
        "result": resolved_result.value,
        "ip": params.ip if params.ip is not None else request_context.ip,
        "user_agent": params.user_agent if params.user_agent is not None else request_context.user_agent,
        "request_id": params.request_id if params.request_id is not None else request_context.request_id,
        "tenant_id": params.tenant_id,
        "before_state": _mask_sensitive(params.before),
        "after_state": _mask_sensitive(params.after),
        "event_metadata": _mask_sensitive(params.metadata),
    }
    queue_entry = AuditLogQueueEntry(
        event_id=event_id,
        payload=payload,
        status=AuditQueueStatus.pending,
        max_attempts=settings.audit_queue_max_attempts,
        next_retry_at=_now_utc(),
    )
    db.add(queue_entry)
    # Flush only audit queue row so domain write validation remains owned by caller.
    await db.flush([queue_entry])

    async def _enqueue_audit_task() -> None:
        from app.modules.audit.tasks import enqueue_audit_queue_entry

        await enqueue_audit_queue_entry(queue_entry.id, countdown=1)

    register_after_commit_callback(db, _enqueue_audit_task)
    return event_id


async def queue_create_event(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    entity: Any,
    tenant_id: str | None = None,
    metadata: dict | list | None = None,
) -> str:
    if hasattr(entity, "id") and getattr(entity, "id", None) is None:
        setattr(entity, "id", uuid.uuid4().hex[:16])
    resource_id = getattr(entity, "id", None)
    return await queue_event(
        db,
        params=AuditQueueEventParams(
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            result=AuditResult.success,
            before=None,
            after=snapshot_entity(entity),
            metadata=metadata,
            tenant_id=tenant_id,
        ),
    )


async def queue_update_event(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    entity: Any,
    before: dict | list | None,
    tenant_id: str | None = None,
    metadata: dict | list | None = None,
) -> str:
    resource_id = getattr(entity, "id", None)
    return await queue_event(
        db,
        params=AuditQueueEventParams(
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            result=AuditResult.success,
            before=before,
            after=snapshot_entity(entity),
            metadata=metadata,
            tenant_id=tenant_id,
        ),
    )


async def queue_delete_event(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    resource_id: str,
    before: dict | list | None,
    tenant_id: str | None = None,
    metadata: dict | list | None = None,
) -> str:
    return await queue_event(
        db,
        params=AuditQueueEventParams(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            result=AuditResult.success,
            before=before,
            after=None,
            metadata=metadata,
            tenant_id=tenant_id,
        ),
    )


def _deserialize_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


async def _insert_audit_log_from_payload(db: AsyncSession, payload: dict[str, Any]) -> None:
    event_id = str(payload["event_id"])
    if await audit_repo.get_audit_log(db, event_id):
        return
    db.add(
        AuditLog(
            event_id=event_id,
            timestamp_utc=_deserialize_datetime(payload.get("timestamp_utc")) or _now_utc(),
            actor_id=payload.get("actor_id"),
            actor_type=AuditActorType(payload.get("actor_type", AuditActorType.system.value)),
            action=payload["action"],
            resource_type=payload.get("resource_type"),
            resource_id=payload.get("resource_id"),
            result=AuditResult(payload.get("result", AuditResult.success.value)),
            ip=payload.get("ip"),
            user_agent=payload.get("user_agent"),
            request_id=payload.get("request_id"),
            tenant_id=payload.get("tenant_id"),
            before_state=payload.get("before_state"),
            after_state=payload.get("after_state"),
            event_metadata=payload.get("event_metadata"),
        )
    )


async def _mark_queue_failed(db: AsyncSession, queue_id: str, *, error: str) -> AuditLogQueueEntry | None:
    queue_entry = await audit_repo.get_queue_entry(db, queue_id)
    if queue_entry is None:
        return None
    queue_entry.attempt_count += 1
    queue_entry.last_error = error[:2000]
    queue_entry.next_retry_at = _now_utc() + timedelta(
        seconds=min(2**queue_entry.attempt_count, settings.audit_queue_retry_max_seconds)
    )
    queue_entry.status = (
        AuditQueueStatus.dead
        if queue_entry.attempt_count >= queue_entry.max_attempts
        else AuditQueueStatus.pending
    )
    record_queue_retry(queue="audit", dead_lettered=queue_entry.status == AuditQueueStatus.dead)
    await db.commit()
    return queue_entry


async def _refresh_queue_depth_metric(db: AsyncSession) -> None:
    set_queue_depth(
        queue="audit",
        by_status=await audit_repo.count_queue_by_status(db),
        known_statuses=_AUDIT_QUEUE_STATUSES,
    )


async def _maybe_run_retention_cleanup(db: AsyncSession) -> None:
    global _last_audit_cleanup_at_monotonic

    now = time.monotonic()
    if now - _last_audit_cleanup_at_monotonic < _AUDIT_CLEANUP_INTERVAL_SECONDS:
        return

    try:
        await apply_retention_cleanup(db)
        _last_audit_cleanup_at_monotonic = now
    except Exception:  # pragma: no cover - defensive logging path
        logger.exception("Audit retention cleanup failed")


async def process_queue_entry(db: AsyncSession, *, queue_id: str) -> bool:
    started = time.perf_counter()
    processed = 0

    claimed = await audit_repo.claim_queue_entry(db, queue_id=queue_id, now=_now_utc())
    if claimed is None:
        await _maybe_run_retention_cleanup(db)
        await _refresh_queue_depth_metric(db)
        observe_worker_batch(
            worker="audit_queue_worker",
            queue="audit",
            claimed=0,
            processed=0,
            duration_seconds=time.perf_counter() - started,
        )
        return False

    await db.commit()
    try:
        await _insert_audit_log_from_payload(db, claimed.payload)
        claimed.status = AuditQueueStatus.processed
        claimed.processed_at = _now_utc()
        claimed.last_error = None
        await db.commit()
        processed = 1
        return True
    except Exception as exc:  # pragma: no cover - defensive logging path
        await db.rollback()
        failed_entry = await _mark_queue_failed(db, claimed.id, error=str(exc))
        logger.exception("Failed to process audit queue entry", extra={"queue_id": claimed.id})

        if failed_entry is not None and failed_entry.status == AuditQueueStatus.pending:
            retry_seconds = max(1, int((failed_entry.next_retry_at - _now_utc()).total_seconds()))
            try:
                from app.modules.audit.tasks import enqueue_audit_queue_entry

                await enqueue_audit_queue_entry(claimed.id, countdown=retry_seconds)
            except Exception:  # pragma: no cover - defensive logging path
                logger.exception(
                    "Failed to enqueue audit queue retry",
                    extra={"queue_id": claimed.id},
                )
        return False
    finally:
        await _maybe_run_retention_cleanup(db)
        await _refresh_queue_depth_metric(db)
        observe_worker_batch(
            worker="audit_queue_worker",
            queue="audit",
            claimed=1,
            processed=processed,
            duration_seconds=time.perf_counter() - started,
        )


async def apply_retention_cleanup(db: AsyncSession) -> tuple[int, int]:
    cutoff = _now_utc() - timedelta(days=settings.audit_retention_days)
    deleted_logs = await audit_repo.delete_expired_audit_logs(db, older_than=cutoff)
    deleted_queue = await audit_repo.delete_old_processed_queue(db, older_than=cutoff)
    await db.commit()
    return deleted_logs, deleted_queue


async def emit_event_immediately(
    *,
    action: str,
    resource_type: str | None,
    resource_id: str | None,
    result: AuditResult | str,
    before: dict | list | None = None,
    after: dict | list | None = None,
    metadata: dict | list | None = None,
    actor_id: str | None = None,
    actor_type: AuditActorType | str | None = None,
    tenant_id: str | None = None,
) -> None:
    async with AsyncSessionLocal() as db:
        await queue_event(
            db,
            params=AuditQueueEventParams(
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                result=result,
                before=before,
                after=after,
                metadata=metadata,
                actor_id=actor_id,
                actor_type=actor_type,
                tenant_id=tenant_id,
            ),
        )
        await db.commit()
        await run_after_commit_callbacks(db)


async def try_emit_event_immediately(
    *,
    action: str,
    resource_type: str | None,
    resource_id: str | None,
    result: AuditResult | str,
    before: dict | list | None = None,
    after: dict | list | None = None,
    metadata: dict | list | None = None,
    actor_id: str | None = None,
    actor_type: AuditActorType | str | None = None,
    tenant_id: str | None = None,
) -> None:
    try:
        await emit_event_immediately(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            result=result,
            before=before,
            after=after,
            metadata=metadata,
            actor_id=actor_id,
            actor_type=actor_type,
            tenant_id=tenant_id,
        )
    except Exception:  # pragma: no cover - defensive logging path
        logger.exception("Failed to persist immediate audit event", extra={"action": action})
