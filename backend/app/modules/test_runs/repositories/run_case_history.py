"""Repository for run_case_history."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.test_runs.models import RunCaseHistory
from app.repositories.common import OffsetPage


@dataclass(slots=True, kw_only=True)
class RunCaseHistoryCreateParams:
    run_case_id: str
    from_status: str | None
    to_status: str
    time: str | None
    comment: str | None
    defect_ids: list[str]
    actual_result: str | None
    system_out: str | None
    system_err: str | None
    executed_by_id: str | None
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None
    changed_by_id: str | None


async def list_by_run_case(
    db: AsyncSession,
    *,
    run_case_id: str,
    page: int,
    page_size: int,
) -> OffsetPage[RunCaseHistory]:
    stmt = (
        select(RunCaseHistory)
        .where(RunCaseHistory.run_case_id == run_case_id)
        .order_by(RunCaseHistory.changed_at.desc())
    )
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def create(db: AsyncSession, *, params: RunCaseHistoryCreateParams) -> RunCaseHistory:
    from app.models.common import now_utc

    record = RunCaseHistory(
        run_case_id=params.run_case_id,
        from_status=params.from_status,
        to_status=params.to_status,
        time=params.time,
        comment=params.comment,
        defect_ids=params.defect_ids,
        actual_result=params.actual_result,
        system_out=params.system_out,
        system_err=params.system_err,
        executed_by_id=params.executed_by_id,
        started_at=params.started_at,
        finished_at=params.finished_at,
        duration_ms=params.duration_ms,
        changed_by_id=params.changed_by_id,
        changed_at=now_utc(),
    )
    db.add(record)
    return record
