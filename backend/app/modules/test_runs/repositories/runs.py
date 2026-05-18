from __future__ import annotations

from datetime import datetime
from typing import Literal

from sqlalchemy import String, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import RunItemStatus, TestRunStatus
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun
from app.repositories.common import OffsetPage, SortDirection

TestRunSortField = Literal["created_at", "name", "status", "build", "environment"]


def _list_by_project_where(
    *,
    project_id: str,
    status_filters: list[TestRunStatus] | None,
    environment_ids: list[str] | None,
    milestone_ids: list[str] | None,
    search: str | None,
    created_by: str | None,
    created_from: datetime | None,
    created_to: datetime | None,
):
    conditions = [TestRun.project_id == project_id]
    if status_filters:
        conditions.append(TestRun.status.in_(status_filters))
    else:
        conditions.append(TestRun.status != TestRunStatus.archived)
    if environment_ids:
        normalized_environment_ids = [value.strip() for value in environment_ids if value.strip()]
        if normalized_environment_ids:
            conditions.append(TestRun.environment_id.in_(normalized_environment_ids))
    if milestone_ids:
        normalized_milestone_ids = [value.strip() for value in milestone_ids if value.strip()]
        if normalized_milestone_ids:
            conditions.append(TestRun.milestone_id.in_(normalized_milestone_ids))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(
            TestRun.name.ilike(pattern)
            | func.coalesce(TestRun.build, "").ilike(pattern)
            | func.coalesce(TestRun.environment_name_snapshot, "").ilike(pattern)
        )
    if created_by:
        conditions.append(TestRun.created_by == created_by)
    if created_from:
        conditions.append(TestRun.created_at >= created_from)
    if created_to:
        conditions.append(TestRun.created_at <= created_to)
    return and_(*conditions)


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    status_filters: list[TestRunStatus] | None,
    environment_ids: list[str] | None,
    milestone_ids: list[str] | None,
    search: str | None,
    created_by: str | None,
    created_from: datetime | None,
    created_to: datetime | None,
    page: int,
    page_size: int,
    sort_by: TestRunSortField,
    sort_direction: SortDirection,
) -> OffsetPage[TestRun]:
    where_clause = _list_by_project_where(
        project_id=project_id,
        status_filters=status_filters,
        environment_ids=environment_ids,
        milestone_ids=milestone_ids,
        search=search,
        created_by=created_by,
        created_from=created_from,
        created_to=created_to,
    )
    total = await db.scalar(select(func.count()).select_from(TestRun).where(where_clause)) or 0

    sort_value_expr = {
        "created_at": TestRun.created_at,
        "name": func.lower(TestRun.name),
        "status": func.lower(cast(TestRun.status, String)),
        "build": func.lower(func.coalesce(TestRun.build, "")),
        "environment": func.lower(func.coalesce(TestRun.environment_name_snapshot, "")),
    }[sort_by]
    stmt = select(TestRun).where(where_clause)
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = TestRun.id.asc() if sort_direction == "asc" else TestRun.id.desc()
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next, total=total)


async def get_by_id(db: AsyncSession, test_run_id: str) -> TestRun | None:
    return await db.scalar(select(TestRun).where(TestRun.id == test_run_id))


async def get_by_id_with_users(db: AsyncSession, test_run_id: str) -> TestRun | None:
    """Like get_by_id but eager-loads assignee_user and created_by_user for reports."""
    return await db.scalar(
        select(TestRun)
        .where(TestRun.id == test_run_id)
        .options(
            selectinload(TestRun.assignee_user),
            selectinload(TestRun.created_by_user),
        )
    )


async def count_in_progress_items(db: AsyncSession, test_run_id: str) -> int:
    return await db.scalar(
        select(func.count())
        .select_from(RunCaseRow)
        .join(RunItem, RunItem.id == RunCaseRow.run_case_id)
        .where(
            RunItem.test_run_id == test_run_id,
            RunCaseRow.status == RunItemStatus.in_progress,
        )
    )


async def list_by_project_and_name(db: AsyncSession, *, project_id: str, name: str) -> list[TestRun]:
    result = await db.scalars(
        select(TestRun)
        .where(
            TestRun.project_id == project_id,
            func.lower(TestRun.name) == name.strip().lower(),
        )
        .order_by(TestRun.created_at.desc(), TestRun.id.desc())
    )
    return list(result.all())
