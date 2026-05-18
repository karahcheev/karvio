"""Run-case status transitions and execution updates. Replaces run-result flow."""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import RunItemStatus, TestRunStatus
from app.modules.test_runs.models import RunItem
from app.modules.test_runs.repositories import run_case_history as history_repo
from app.modules.test_runs.repositories import runs as test_run_repo


TERMINAL_STATUSES = {
    RunItemStatus.passed,
    RunItemStatus.error,
    RunItemStatus.failure,
    RunItemStatus.blocked,
    RunItemStatus.skipped,
    RunItemStatus.xfailed,
    RunItemStatus.xpassed,
}


async def _ensure_parent_run_allows_change(db: AsyncSession, item: RunItem) -> None:
    parent_run = await test_run_repo.get_by_id(db, item.test_run_id)
    if not parent_run:
        raise DomainError(
            status_code=404,
            code="run_not_found",
            title="Not found",
            detail="Parent TestRun not found",
        )
    if parent_run.status in {TestRunStatus.completed, TestRunStatus.archived}:
        raise DomainError(
            status_code=409,
            code="invalid_status_transition",
            title="Invalid transition",
            detail="Run-case status cannot change when parent TestRun is completed or archived",
        )


def _resolve_finished_at(status: RunItemStatus, finished_at: datetime | None) -> datetime | None:
    if finished_at is not None:
        return finished_at
    if status in TERMINAL_STATUSES:
        return datetime.now(timezone.utc)
    return None


def _validate_timestamps(
    started_at: datetime | None, finished_at: datetime | None, duration_ms: int | None
) -> int | None:
    if finished_at and started_at and finished_at < started_at:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="finished_at must be greater than or equal to started_at",
            errors={"finished_at": ["must be greater than or equal to started_at"]},
        )
    if duration_ms is not None:
        return duration_ms
    if started_at and finished_at:
        return int((finished_at - started_at).total_seconds() * 1000)
    return None


@dataclass(slots=True, kw_only=True)
class ExecutionUpdateParams:
    item: RunItem
    status: RunItemStatus
    comment: str | None = None
    defect_ids: list[str] | None = None
    actual_result: str | None = None
    system_out: str | None = None
    system_err: str | None = None
    executed_by_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    time: str | None = None
    changed_by_id: str | None = None


async def apply_execution_update(db: AsyncSession, *, params: ExecutionUpdateParams) -> RunItem:
    """Apply execution update to run-case while parent run is open; updates item, appends history."""
    item = params.item
    status = params.status
    await _ensure_parent_run_allows_change(db, item)

    finished_at = _resolve_finished_at(status, params.finished_at)
    duration_ms = _validate_timestamps(params.started_at, finished_at, params.duration_ms)

    from_status = item.status.value
    to_status = status.value
    previous_status = item.status

    item.status = status
    if params.time is not None:
        item.time = params.time
    if params.comment is not None:
        item.comment = params.comment
    if params.defect_ids is not None:
        item.defect_ids = params.defect_ids
    if params.actual_result is not None:
        item.actual_result = params.actual_result
    if params.system_out is not None:
        item.system_out = params.system_out
    if params.system_err is not None:
        item.system_err = params.system_err
    if params.executed_by_id is not None:
        item.executed_by = params.executed_by_id
    if params.started_at is not None:
        item.started_at = params.started_at
    item.finished_at = finished_at
    item.duration_ms = duration_ms

    if status in TERMINAL_STATUSES and previous_status != status:
        item.execution_count = (item.execution_count or 0) + 1
        item.last_executed_at = finished_at or datetime.now(timezone.utc)

    await db.flush()

    await history_repo.create(
        db,
        params=history_repo.RunCaseHistoryCreateParams(
            run_case_id=item.id,
            from_status=from_status,
            to_status=to_status,
            time=item.time,
            comment=item.comment,
            defect_ids=item.defect_ids or [],
            actual_result=item.actual_result,
            system_out=item.system_out,
            system_err=item.system_err,
            executed_by_id=item.executed_by,
            started_at=item.started_at,
            finished_at=item.finished_at,
            duration_ms=item.duration_ms,
            changed_by_id=params.changed_by_id,
        ),
    )
    return item
