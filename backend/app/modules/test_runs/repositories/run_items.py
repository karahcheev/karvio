from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RunItemStatus
from app.modules.projects.models import Suite, User
from app.modules.test_cases.models import TestCase
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun
from app.repositories.common import OffsetPage, SortDirection

RunItemSortField = Literal["test_case_title", "suite_name", "status", "assignee_name", "last_executed_at"]


async def list_by_test_run(
    db: AsyncSession,
    *,
    test_run_id: str,
    status_filters: list[RunItemStatus] | None,
    assignee_id: str | None,
    test_case_id: str | None,
    search: str | None,
    page: int,
    page_size: int,
    sort_by: RunItemSortField,
    sort_direction: SortDirection,
) -> OffsetPage[RunItem]:
    sort_value_expr = {
        "test_case_title": func.lower(func.coalesce(RunItem.test_case_title_snapshot, TestCase.title, "")),
        "suite_name": func.lower(func.coalesce(RunItem.suite_name_snapshot, Suite.name, "")),
        "status": func.lower(cast(RunItem.status, String)),
        "assignee_name": func.lower(func.coalesce(User.username, "")),
        "last_executed_at": func.coalesce(RunItem.last_executed_at, datetime.min.replace(tzinfo=timezone.utc)),
    }[sort_by]
    stmt = (
        select(RunItem)
        .outerjoin(TestCase, TestCase.id == RunItem.test_case_id)
        .outerjoin(Suite, Suite.id == TestCase.suite_id)
        .outerjoin(User, User.id == RunItem.assignee_id)
        .where(RunItem.test_run_id == test_run_id)
    )
    if status_filters:
        stmt = stmt.where(RunItem.status.in_(status_filters))
    if assignee_id:
        stmt = stmt.where(RunItem.assignee_id == assignee_id)
    if test_case_id:
        stmt = stmt.where(RunItem.test_case_id == test_case_id)
    if search and search.strip():
        stmt = stmt.where(
            func.coalesce(RunItem.test_case_title_snapshot, TestCase.title, "").ilike(f"%{search.strip()}%")
        )
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = RunItem.id.asc() if sort_direction == "asc" else RunItem.id.desc()
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    return OffsetPage(items=list(rows[:page_size]), page=page, page_size=page_size, has_next=has_next)


async def list_by_project_and_test_case(
    db: AsyncSession,
    *,
    project_id: str,
    test_case_id: str,
    status_filters: list[RunItemStatus] | None,
    assignee_id: str | None,
    search: str | None,
    page: int,
    page_size: int,
    sort_by: RunItemSortField,
    sort_direction: SortDirection,
) -> OffsetPage[RunItem]:
    sort_value_expr = {
        "test_case_title": func.lower(func.coalesce(RunItem.test_case_title_snapshot, TestCase.title, "")),
        "suite_name": func.lower(func.coalesce(RunItem.suite_name_snapshot, Suite.name, "")),
        "status": func.lower(cast(RunItem.status, String)),
        "assignee_name": func.lower(func.coalesce(User.username, "")),
        "last_executed_at": func.coalesce(RunItem.last_executed_at, datetime.min.replace(tzinfo=timezone.utc)),
    }[sort_by]
    stmt = (
        select(RunItem)
        .join(TestRun, TestRun.id == RunItem.test_run_id)
        .outerjoin(TestCase, TestCase.id == RunItem.test_case_id)
        .outerjoin(Suite, Suite.id == TestCase.suite_id)
        .outerjoin(User, User.id == RunItem.assignee_id)
        .where(TestRun.project_id == project_id, RunItem.test_case_id == test_case_id)
    )
    if status_filters:
        stmt = stmt.where(RunItem.status.in_(status_filters))
    if assignee_id:
        stmt = stmt.where(RunItem.assignee_id == assignee_id)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            TestRun.name.ilike(pattern)
            | func.coalesce(TestRun.build, "").ilike(pattern)
            | func.coalesce(TestRun.environment_name_snapshot, "").ilike(pattern)
        )
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = RunItem.id.asc() if sort_direction == "asc" else RunItem.id.desc()
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    return OffsetPage(items=list(rows[:page_size]), page=page, page_size=page_size, has_next=has_next)


async def get_by_id(db: AsyncSession, run_item_id: str) -> RunItem | None:
    return await db.scalar(select(RunItem).where(RunItem.id == run_item_id))


async def get_project_id_for_run_item(db: AsyncSession, run_item_id: str) -> str | None:
    return await db.scalar(
        select(TestRun.project_id)
        .select_from(RunItem)
        .join(TestRun, TestRun.id == RunItem.test_run_id)
        .where(RunItem.id == run_item_id)
    )


async def get_by_run_and_case(
    db: AsyncSession,
    *,
    test_run_id: str,
    test_case_id: str,
) -> RunItem | None:
    return await db.scalar(
        select(RunItem).where(
            RunItem.test_run_id == test_run_id,
            RunItem.test_case_id == test_case_id,
        )
    )


async def list_rows_by_run_case(
    db: AsyncSession,
    *,
    run_case_id: str,
    status_filters: list[RunItemStatus] | None = None,
    page: int = 1,
    page_size: int = 100,
) -> OffsetPage[RunCaseRow]:
    stmt = select(RunCaseRow).where(RunCaseRow.run_case_id == run_case_id)
    if status_filters:
        stmt = stmt.where(RunCaseRow.status.in_(status_filters))
    offset = (page - 1) * page_size
    result = await db.scalars(
        stmt.order_by(RunCaseRow.row_order.asc(), RunCaseRow.id.asc()).limit(page_size + 1).offset(offset)
    )
    rows = result.all()
    has_next = len(rows) > page_size
    return OffsetPage(items=list(rows[:page_size]), page=page, page_size=page_size, has_next=has_next)


async def get_row_by_id(db: AsyncSession, run_case_row_id: str) -> RunCaseRow | None:
    return await db.scalar(select(RunCaseRow).where(RunCaseRow.id == run_case_row_id))


async def get_latest_row_by_run_case(db: AsyncSession, run_case_id: str) -> RunCaseRow | None:
    return await db.scalar(
        select(RunCaseRow)
        .where(RunCaseRow.run_case_id == run_case_id)
        .order_by(
            RunCaseRow.last_executed_at.desc().nullslast(),
            RunCaseRow.updated_at.desc(),
            RunCaseRow.row_order.asc(),
        )
        .limit(1)
    )


async def count_by_status(db: AsyncSession, test_run_id: str) -> list[tuple[RunItemStatus, int]]:
    rows = (
        await db.execute(
            select(RunItem.status, func.count(RunItem.id))
            .where(RunItem.test_run_id == test_run_id)
            .group_by(RunItem.status)
        )
    ).all()
    return list(rows)


async def count_by_status_for_runs(db: AsyncSession, run_ids: list[str]) -> list[tuple[str, RunItemStatus, int]]:
    if not run_ids:
        return []
    rows = (
        await db.execute(
            select(RunItem.test_run_id, RunItem.status, func.count(RunItem.id))
            .where(RunItem.test_run_id.in_(run_ids))
            .group_by(RunItem.test_run_id, RunItem.status)
        )
    ).all()
    return list(rows)


async def recalc_run_case_aggregate(db: AsyncSession, run_case_id: str) -> None:
    run_case = await get_by_id(db, run_case_id)
    if run_case is None:
        return
    counts = (
        await db.execute(
            select(RunCaseRow.status, func.count(RunCaseRow.id))
            .where(RunCaseRow.run_case_id == run_case_id)
            .group_by(RunCaseRow.status)
        )
    ).all()
    mapping = {status.value if hasattr(status, "value") else str(status): count for status, count in counts}
    total = sum(mapping.values())
    passed = mapping.get(RunItemStatus.passed.value, 0)
    failed = (
        mapping.get(RunItemStatus.error.value, 0)
        + mapping.get(RunItemStatus.failure.value, 0)
        + mapping.get(RunItemStatus.blocked.value, 0)
    )
    run_case.rows_total = total
    run_case.rows_passed = passed
    run_case.rows_failed = failed
    if failed > 0:
        run_case.status = RunItemStatus.failure
    elif total > 0 and passed == total:
        run_case.status = RunItemStatus.passed
    elif mapping.get(RunItemStatus.in_progress.value, 0) > 0:
        run_case.status = RunItemStatus.in_progress
    else:
        run_case.status = RunItemStatus.untested
