"""Test plans persistence."""

from __future__ import annotations

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.test_plans.models import TestPlan, TestPlanSuite
from app.repositories.common import OffsetPage


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    search: str | None = None,
    tags: list[str] | None = None,
    milestone_ids: list[str] | None = None,
    page: int = 1,
    page_size: int = 50,
) -> OffsetPage[TestPlan]:
    conditions = [TestPlan.project_id == project_id]
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                TestPlan.name.ilike(pattern),
                (TestPlan.description.isnot(None)) & (TestPlan.description.ilike(pattern)),
            )
        )
    if tags:
        normalized_tags = [t.strip() for t in tags if t.strip()]
        if normalized_tags:
            conditions.append(or_(TestPlan.tags.contains([t]) for t in normalized_tags))
    if milestone_ids:
        normalized_milestone_ids = [value.strip() for value in milestone_ids if value.strip()]
        if normalized_milestone_ids:
            conditions.append(TestPlan.milestone_id.in_(normalized_milestone_ids))

    where_clause = and_(*conditions)
    total = await db.scalar(select(func.count()).select_from(TestPlan).where(where_clause)) or 0

    stmt = (
        select(TestPlan)
        .where(where_clause)
        .options(selectinload(TestPlan.suites), selectinload(TestPlan.cases))
        .order_by(TestPlan.created_at.desc())
    )
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next, total=total)


async def distinct_tags_for_project(db: AsyncSession, *, project_id: str) -> list[str]:
    result = await db.scalars(select(TestPlan.tags).where(TestPlan.project_id == project_id))
    rows = result.all()
    out: set[str] = set()
    for row in rows:
        if not row:
            continue
        for item in row:
            if isinstance(item, str) and item.strip():
                out.add(item.strip())
    return sorted(out, key=str.lower)


async def get_by_id(db: AsyncSession, test_plan_id: str) -> TestPlan | None:
    stmt = (
        select(TestPlan)
        .where(TestPlan.id == test_plan_id)
        .options(selectinload(TestPlan.suites), selectinload(TestPlan.cases))
        .execution_options(populate_existing=True)
    )
    return await db.scalar(stmt)


async def get_suite_ids(db: AsyncSession, test_plan_id: str) -> list[str]:
    result = await db.scalars(
        select(TestPlanSuite.suite_id).where(TestPlanSuite.test_plan_id == test_plan_id)
    )
    return list(result.all())
