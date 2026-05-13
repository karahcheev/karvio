from __future__ import annotations

from datetime import datetime
from typing import Literal

from sqlalchemy import String, cast, delete, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models import AuditLog, AuditLogQueueEntry
from app.models.enums import AuditQueueStatus, AuditResult
from app.modules.projects.models import User
from app.repositories.common import OffsetPage, SortDirection

AuditLogSortField = Literal["timestamp_utc", "actor", "action", "resource", "result", "request_id"]


async def list_audit_logs(
    db: AsyncSession,
    *,
    tenant_id: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    actor_id: str | None,
    action: str | None,
    resource_type: str | None,
    resource_id: str | None,
    result: AuditResult | None,
    page: int,
    page_size: int,
    sort_by: AuditLogSortField,
    sort_direction: SortDirection,
) -> OffsetPage[AuditLog]:
    resource_sort_expr = (
        func.coalesce(AuditLog.resource_type, "") + literal(":") + func.coalesce(AuditLog.resource_id, "")
    )
    sort_value_expr = {
        "timestamp_utc": AuditLog.timestamp_utc,
        "actor": func.lower(func.coalesce(User.username, "")),
        "action": func.lower(AuditLog.action),
        "resource": func.lower(resource_sort_expr),
        "result": func.lower(cast(AuditLog.result, String)),
        "request_id": func.lower(func.coalesce(AuditLog.request_id, "")),
    }[sort_by]
    stmt = select(AuditLog).outerjoin(User, User.id == AuditLog.actor_id)
    if tenant_id is not None:
        stmt = stmt.where(AuditLog.tenant_id == tenant_id)
    if date_from is not None:
        stmt = stmt.where(AuditLog.timestamp_utc >= date_from)
    if date_to is not None:
        stmt = stmt.where(AuditLog.timestamp_utc <= date_to)
    if actor_id is not None:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if action is not None:
        stmt = stmt.where(AuditLog.action == action)
    if resource_type is not None:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if resource_id is not None:
        stmt = stmt.where(AuditLog.resource_id == resource_id)
    if result is not None:
        stmt = stmt.where(AuditLog.result == result)
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = AuditLog.event_id.asc() if sort_direction == "asc" else AuditLog.event_id.desc()
    offset = (page - 1) * page_size
    result_rows = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = list(result_rows.all())
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def get_audit_log(db: AsyncSession, event_id: str) -> AuditLog | None:
    return await db.get(AuditLog, event_id)


async def claim_queue_entry(
    db: AsyncSession,
    *,
    queue_id: str,
    now: datetime,
) -> AuditLogQueueEntry | None:
    stmt = (
        select(AuditLogQueueEntry)
        .where(AuditLogQueueEntry.id == queue_id)
        .where(AuditLogQueueEntry.status == AuditQueueStatus.pending)
        .where(AuditLogQueueEntry.next_retry_at <= now)
        .with_for_update(skip_locked=True)
    )
    row = await db.scalar(stmt)
    if row is None:
        return None
    row.status = AuditQueueStatus.processing
    return row


async def get_queue_entry(db: AsyncSession, queue_id: str) -> AuditLogQueueEntry | None:
    return await db.get(AuditLogQueueEntry, queue_id)


async def count_queue_by_status(db: AsyncSession) -> dict[str, int]:
    result = await db.execute(
        select(AuditLogQueueEntry.status, func.count(AuditLogQueueEntry.id)).group_by(AuditLogQueueEntry.status)
    )
    rows = result.all()
    out: dict[str, int] = {}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        out[key] = int(count)
    return out


async def delete_expired_audit_logs(db: AsyncSession, *, older_than: datetime) -> int:
    result = await db.execute(delete(AuditLog).where(AuditLog.timestamp_utc < older_than))
    return result.rowcount or 0


async def delete_old_processed_queue(db: AsyncSession, *, older_than: datetime) -> int:
    result = await db.execute(
        delete(AuditLogQueueEntry)
        .where(AuditLogQueueEntry.status == AuditQueueStatus.processed)
        .where(AuditLogQueueEntry.processed_at < older_than)
    )
    return result.rowcount or 0
