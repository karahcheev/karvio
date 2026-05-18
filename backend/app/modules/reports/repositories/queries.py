"""SQL aggregations for reports."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import TestRunStatus
from app.modules.projects.models import Suite, User
from app.modules.test_cases.models import TestCase
from app.modules.test_runs.models import RunItem, TestRun


@dataclass(frozen=True, slots=True)
class ProjectOverviewRunRow:
    id: str
    name: str
    build: str | None
    status: TestRunStatus
    environment_name_snapshot: str | None
    environment_revision_number: int | None
    created_at: datetime
    updated_at: datetime


def _project_run_ids_select(
    *,
    project_id: str,
    created_from: datetime | None,
    created_to: datetime | None,
    milestone_ids: list[str] | None = None,
):
    """IDs of test runs in the project (optional created_at window). For IN-subquery, not ORM load."""
    stmt = select(TestRun.id).where(TestRun.project_id == project_id)
    if created_from is not None:
        stmt = stmt.where(TestRun.created_at >= created_from)
    if created_to is not None:
        stmt = stmt.where(TestRun.created_at <= created_to)
    if milestone_ids:
        normalized_milestone_ids = [value.strip() for value in milestone_ids if value.strip()]
        if normalized_milestone_ids:
            stmt = stmt.where(TestRun.milestone_id.in_(normalized_milestone_ids))
    return stmt


async def fetch_run_items_with_cases(db: AsyncSession, run_id: str) -> list[tuple]:
    """Returns (RunItem, TestCase, Suite) for run_id, ordered by key and created_at.
    RunItem has assignee_user and executed_by_user eager-loaded via FK relationships.
    """
    result = await db.execute(
        select(RunItem, TestCase, Suite)
        .options(
            selectinload(RunItem.assignee_user),
            selectinload(RunItem.executed_by_user),
        )
        .join(TestCase, TestCase.id == RunItem.test_case_id)
        .outerjoin(Suite, Suite.id == TestCase.suite_id)
        .where(RunItem.test_run_id == run_id)
        .order_by(TestCase.key.asc(), RunItem.created_at.asc())
    )
    return list(result.all())


async def fetch_users_by_ids(db: AsyncSession, user_ids: set[str]) -> dict[str, str]:
    """Returns {user_id: username} for given user_ids."""
    if not user_ids:
        return {}
    result = await db.scalars(select(User).where(User.id.in_(sorted(user_ids))))
    users = list(result.all())
    return {user.id: user.username for user in users}


async def fetch_project_runs(
    db: AsyncSession,
    *,
    project_id: str,
    created_from: datetime | None,
    created_to: datetime | None,
    milestone_ids: list[str] | None = None,
) -> list[ProjectOverviewRunRow]:
    """Returns lightweight project run rows for overview, ordered by created_at descending."""
    stmt = (
        select(
            TestRun.id,
            TestRun.name,
            TestRun.build,
            TestRun.status,
            TestRun.environment_name_snapshot,
            TestRun.environment_revision_number,
            TestRun.created_at,
            TestRun.updated_at,
        )
        .where(TestRun.project_id == project_id)
    )
    if created_from:
        stmt = stmt.where(TestRun.created_at >= created_from)
    if created_to:
        stmt = stmt.where(TestRun.created_at <= created_to)
    if milestone_ids:
        normalized_milestone_ids = [value.strip() for value in milestone_ids if value.strip()]
        if normalized_milestone_ids:
            stmt = stmt.where(TestRun.milestone_id.in_(normalized_milestone_ids))
    stmt = stmt.order_by(TestRun.created_at.desc())
    rows = (await db.execute(stmt)).all()
    return [
        ProjectOverviewRunRow(
            id=run_id,
            name=name,
            build=build,
            status=status,
            environment_name_snapshot=environment_name_snapshot,
            environment_revision_number=environment_revision_number,
            created_at=created_at,
            updated_at=updated_at,
        )
        for (
            run_id,
            name,
            build,
            status,
            environment_name_snapshot,
            environment_revision_number,
            created_at,
            updated_at,
        ) in rows
    ]


async def fetch_status_by_run(db: AsyncSession, run_ids: list[str]) -> dict[str, dict[str, int]]:
    """Returns {run_id: {status_value: count}} for given run_ids."""
    if not run_ids:
        return {}
    rows = (
        await db.execute(
            select(RunItem.test_run_id, RunItem.status, func.count(RunItem.id))
            .where(RunItem.test_run_id.in_(run_ids))
            .group_by(RunItem.test_run_id, RunItem.status)
        )
    ).all()
    result: dict[str, dict[str, int]] = {}
    for run_id, status, count in rows:
        run_bucket = result.setdefault(run_id, {})
        status_value = status.value if hasattr(status, "value") else str(status)
        run_bucket[status_value] = count
    return result


async def fetch_status_by_project_run_window(
    db: AsyncSession,
    *,
    project_id: str,
    created_from: datetime | None,
    created_to: datetime | None,
    milestone_ids: list[str] | None = None,
) -> dict[str, dict[str, int]]:
    """Like fetch_status_by_run but scopes runs via subquery (no huge IN bind list)."""
    run_ids_sq = _project_run_ids_select(
        project_id=project_id,
        created_from=created_from,
        created_to=created_to,
        milestone_ids=milestone_ids,
    )
    rows = (
        await db.execute(
            select(RunItem.test_run_id, RunItem.status, func.count(RunItem.id))
            .where(RunItem.test_run_id.in_(run_ids_sq))
            .group_by(RunItem.test_run_id, RunItem.status)
        )
    ).all()
    result: dict[str, dict[str, int]] = {}
    for run_id, status, count in rows:
        run_bucket = result.setdefault(run_id, {})
        status_value = status.value if hasattr(status, "value") else str(status)
        run_bucket[status_value] = count
    return result


async def fetch_assignee_counts(db: AsyncSession, run_ids: list[str]) -> list[tuple[str | None, int]]:
    """Returns [(assignee_id, count), ...] for given run_ids."""
    if not run_ids:
        return []
    rows = (
        await db.execute(
            select(RunItem.assignee_id, func.count(RunItem.id))
            .where(RunItem.test_run_id.in_(run_ids))
            .group_by(RunItem.assignee_id)
        )
    ).all()
    return list(rows)


async def fetch_assignee_counts_by_project_run_window(
    db: AsyncSession,
    *,
    project_id: str,
    created_from: datetime | None,
    created_to: datetime | None,
    milestone_ids: list[str] | None = None,
) -> list[tuple[str | None, int]]:
    """Like fetch_assignee_counts but scopes runs via subquery (no huge IN bind list)."""
    run_ids_sq = _project_run_ids_select(
        project_id=project_id,
        created_from=created_from,
        created_to=created_to,
        milestone_ids=milestone_ids,
    )
    rows = (
        await db.execute(
            select(RunItem.assignee_id, func.count(RunItem.id))
            .where(RunItem.test_run_id.in_(run_ids_sq))
            .group_by(RunItem.assignee_id)
        )
    ).all()
    return list(rows)
