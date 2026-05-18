from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.enums import AuditQueueStatus, NotificationQueueStatus
from app.modules.audit.models import AuditLogQueueEntry
from app.modules.notifications.models import NotificationQueueEntry
from app.modules.performance.models import PerformanceImport


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_status_key(value: Any) -> str:
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _age_seconds(value: datetime | None, now: datetime) -> int | None:
    if value is None:
        return None
    return max(0, int((now - value).total_seconds()))


def _component_status_from_health_flags(*, has_failure: bool, has_warning: bool) -> str:
    if has_failure:
        return "down"
    if has_warning:
        return "degraded"
    return "ok"


async def _check_database(db: AsyncSession) -> dict[str, Any]:
    started = _now_utc()
    try:
        await db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "checked_at": _now_utc().isoformat(),
            "latency_ms": int((_now_utc() - started).total_seconds() * 1000),
        }
    except Exception as exc:
        try:
            await db.rollback()
        except Exception:
            pass
        return {
            "status": "down",
            "checked_at": _now_utc().isoformat(),
            "error": str(exc),
            "error_type": exc.__class__.__name__,
        }


def _check_local_path_writable(path_value: str) -> dict[str, Any]:
    resolved = Path(path_value).expanduser().resolve()
    probe = resolved / f".status_probe_{uuid.uuid4().hex}"
    try:
        resolved.mkdir(parents=True, exist_ok=True)
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return {
            "status": "ok",
            "path": str(resolved),
        }
    except Exception as exc:
        return {
            "status": "down",
            "path": str(resolved),
            "error": str(exc),
            "error_type": exc.__class__.__name__,
        }


def _check_storage(settings: Settings) -> dict[str, Any]:
    attachments = _check_local_path_writable(settings.attachment_local_root)
    performance = _check_local_path_writable(settings.performance_artifact_root)
    status = _component_status_from_health_flags(
        has_failure=False,
        has_warning=attachments["status"] == "down" or performance["status"] == "down",
    )
    return {
        "status": status,
        "attachments": attachments,
        "performance_artifacts": performance,
    }


async def _build_queue_component(
    *,
    db: AsyncSession,
    name: str,
    model,
    pending_value: Any,
    processing_value: Any,
    dead_value: Any,
    now: datetime,
    backlog_warn: int,
    backlog_fail: int,
    stale_processing_seconds: int,
    stale_pending_seconds: int,
) -> dict[str, Any]:
    rows = (await db.execute(select(model.status, func.count(model.id)).group_by(model.status))).all()
    by_status = {_normalize_status_key(status): int(count) for status, count in rows}

    pending = by_status.get(_normalize_status_key(pending_value), 0)
    processing = by_status.get(_normalize_status_key(processing_value), 0)
    dead = by_status.get(_normalize_status_key(dead_value), 0)
    backlog = pending + processing + dead

    oldest_pending_created = await db.scalar(select(func.min(model.created_at)).where(model.status == pending_value))
    oldest_processing_updated = await db.scalar(select(func.min(model.updated_at)).where(model.status == processing_value))
    pending_age = _age_seconds(oldest_pending_created, now)
    processing_age = _age_seconds(oldest_processing_updated, now)

    warning = False
    failure = False
    reasons: list[str] = []

    if backlog >= backlog_fail:
        failure = True
        reasons.append("backlog_too_high")
    elif backlog >= backlog_warn:
        warning = True
        reasons.append("backlog_high")

    if dead > 0:
        warning = True
        reasons.append("dead_letter_detected")

    if processing_age is not None and processing_age >= stale_processing_seconds:
        warning = True
        reasons.append("processing_stale")

    if pending > 0 and processing == 0 and pending_age is not None and pending_age >= stale_pending_seconds:
        warning = True
        reasons.append("pending_stale_without_processing")

    status = _component_status_from_health_flags(has_failure=failure, has_warning=warning)
    return {
        "status": status,
        "name": name,
        "backlog": backlog,
        "pending": pending,
        "processing": processing,
        "dead": dead,
        "oldest_pending_age_seconds": pending_age,
        "oldest_processing_age_seconds": processing_age,
        "reasons": sorted(set(reasons)),
        "by_status": by_status,
    }


async def _check_workers_and_queues(db: AsyncSession, settings: Settings, *, now: datetime) -> dict[str, Any]:
    common_kwargs = {
        "db": db,
        "now": now,
        "backlog_warn": settings.status_queue_backlog_warn,
        "backlog_fail": settings.status_queue_backlog_fail,
        "stale_processing_seconds": settings.status_processing_stale_seconds,
        "stale_pending_seconds": settings.status_pending_stale_seconds,
    }
    audit = await _build_queue_component(
        name="audit_queue",
        model=AuditLogQueueEntry,
        pending_value=AuditQueueStatus.pending,
        processing_value=AuditQueueStatus.processing,
        dead_value=AuditQueueStatus.dead,
        **common_kwargs,
    )
    notifications = await _build_queue_component(
        name="notification_queue",
        model=NotificationQueueEntry,
        pending_value=NotificationQueueStatus.pending,
        processing_value=NotificationQueueStatus.processing,
        dead_value=NotificationQueueStatus.dead,
        **common_kwargs,
    )
    performance_import = await _build_queue_component(
        name="performance_import_queue",
        model=PerformanceImport,
        pending_value="pending",
        processing_value="processing",
        dead_value="failed",
        **common_kwargs,
    )
    queues = {
        "audit": audit,
        "notifications": notifications,
        "performance_import": performance_import,
    }
    has_failure = any(component["status"] == "down" for component in queues.values())
    has_warning = any(component["status"] == "degraded" for component in queues.values())
    return {
        "status": _component_status_from_health_flags(has_failure=has_failure, has_warning=has_warning),
        "queues": queues,
    }


async def build_system_status(db: AsyncSession, *, settings: Settings) -> dict[str, Any]:
    now = _now_utc()
    database = await _check_database(db)
    storage = _check_storage(settings)

    if database["status"] == "ok":
        try:
            workers = await _check_workers_and_queues(db, settings, now=now)
        except Exception as exc:
            try:
                await db.rollback()
            except Exception:
                pass
            workers = {
                "status": "down",
                "error": str(exc),
                "error_type": exc.__class__.__name__,
                "queues": {
                    "audit": {"status": "unknown", "reasons": ["workers_status_unavailable"]},
                    "notifications": {"status": "unknown", "reasons": ["workers_status_unavailable"]},
                    "performance_import": {"status": "unknown", "reasons": ["workers_status_unavailable"]},
                },
            }
    else:
        workers = {
            "status": "down",
            "queues": {
                "audit": {"status": "unknown", "reasons": ["database_unavailable"]},
                "notifications": {"status": "unknown", "reasons": ["database_unavailable"]},
                "performance_import": {"status": "unknown", "reasons": ["database_unavailable"]},
            },
        }

    statuses = [database["status"], storage["status"], workers["status"]]
    overall_status = "ok"
    if "down" in statuses:
        overall_status = "down"
    elif "degraded" in statuses:
        overall_status = "degraded"

    return {
        "status": overall_status,
        "checked_at": now.isoformat(),
        "app_version": settings.app_version,
        "components": {
            "database": database,
            "storage": storage,
            "workers": workers,
        },
    }
