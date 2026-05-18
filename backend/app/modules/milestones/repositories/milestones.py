from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MilestoneStatus, TestRunStatus
from app.modules.milestones.models import Milestone
from app.modules.test_plans.models import TestPlan, TestPlanCase
from app.modules.test_runs.models import TestRun
from app.repositories.common import OffsetPage


async def get_by_id(db: AsyncSession, milestone_id: str) -> Milestone | None:
    return await db.scalar(select(Milestone).where(Milestone.id == milestone_id))


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    statuses: list[MilestoneStatus] | None,
    search: str | None,
    page: int,
    page_size: int,
) -> OffsetPage[Milestone]:
    conditions = [Milestone.project_id == project_id]
    if statuses:
        conditions.append(Milestone.status.in_(statuses))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                Milestone.name.ilike(pattern),
                (Milestone.description.isnot(None)) & (Milestone.description.ilike(pattern)),
                (Milestone.release_label.isnot(None)) & (Milestone.release_label.ilike(pattern)),
            )
        )

    where_clause = and_(*conditions)
    total = await db.scalar(select(func.count()).select_from(Milestone).where(where_clause)) or 0

    offset = (page - 1) * page_size
    result = await db.scalars(
        select(Milestone)
        .where(where_clause)
        .order_by(Milestone.target_date.asc().nullslast(), Milestone.created_at.desc())
        .limit(page_size + 1)
        .offset(offset)
    )
    rows = result.all()
    has_next = len(rows) > page_size
    return OffsetPage(items=list(rows[:page_size]), page=page, page_size=page_size, has_next=has_next, total=total)


async def map_names_by_ids(db: AsyncSession, milestone_ids: Sequence[str]) -> dict[str, str]:
    normalized = [mid for mid in dict.fromkeys(milestone_ids) if mid]
    if not normalized:
        return {}
    rows = await db.execute(select(Milestone.id, Milestone.name).where(Milestone.id.in_(normalized)))
    return {milestone_id: name for milestone_id, name in rows.all()}


async def count_plans_for_milestone(db: AsyncSession, milestone_id: str) -> int:
    return await db.scalar(
        select(func.count()).select_from(TestPlan).where(TestPlan.milestone_id == milestone_id)
    ) or 0


async def count_planned_cases_for_milestone(db: AsyncSession, milestone_id: str) -> int:
    return await db.scalar(
        select(func.count(TestPlanCase.id))
        .select_from(TestPlanCase)
        .join(TestPlan, TestPlan.id == TestPlanCase.test_plan_id)
        .where(TestPlan.milestone_id == milestone_id)
    ) or 0


async def count_runs_by_status_for_milestone(db: AsyncSession, milestone_id: str) -> dict[TestRunStatus, int]:
    rows = (
        await db.execute(
            select(TestRun.status, func.count(TestRun.id))
            .where(TestRun.milestone_id == milestone_id)
            .group_by(TestRun.status)
        )
    ).all()
    return {status: count for status, count in rows}


async def list_run_ids_for_milestone(db: AsyncSession, milestone_id: str) -> list[str]:
    result = await db.scalars(select(TestRun.id).where(TestRun.milestone_id == milestone_id))
    return list(result.all())
