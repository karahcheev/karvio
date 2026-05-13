from __future__ import annotations

from typing import Literal

from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.enums import ComponentRiskLevel, TestCasePriority, TestCaseStatus
from app.modules.products.models import Component, TestCaseComponentCoverage
from app.modules.projects.models import Suite, User
from app.modules.test_cases.models import TestCase
from app.repositories.common import OffsetPage, SortDirection

TestCaseSortField = Literal["created_at", "updated_at", "key", "title", "status", "priority", "owner_name", "suite_name"]


def _test_case_read_options():
    return (
        joinedload(TestCase.owner),
        joinedload(TestCase.suite),
        selectinload(TestCase.component_coverages).selectinload(TestCaseComponentCoverage.component),
    )


def _risk_levels_at_or_above(level: ComponentRiskLevel) -> list[ComponentRiskLevel]:
    ordered = [
        ComponentRiskLevel.low,
        ComponentRiskLevel.medium,
        ComponentRiskLevel.high,
        ComponentRiskLevel.critical,
    ]
    start_idx = ordered.index(level)
    return ordered[start_idx:]


def _test_case_list_conditions(
    *,
    project_id: str,
    search: str | None,
    status_filters: list[TestCaseStatus] | None,
    priority_filters: list[TestCasePriority] | None,
    suite_ids: list[str] | None,
    tags: list[str] | None,
    owner_id: str | None,
    product_ids: list[str] | None,
    component_ids: list[str] | None,
    minimum_component_risk_level: ComponentRiskLevel | None,
    exclude_test_case_ids: list[str] | None,
) -> list:
    conditions = [TestCase.project_id == project_id]
    if suite_ids:
        conditions.append(TestCase.suite_id.in_(suite_ids))
    if exclude_test_case_ids:
        conditions.append(TestCase.id.notin_(exclude_test_case_ids))
    if status_filters:
        conditions.append(TestCase.status.in_(status_filters))
    else:
        conditions.append(TestCase.status != TestCaseStatus.archived)
    if priority_filters:
        conditions.append(TestCase.priority.in_(priority_filters))
    if tags:
        tag_conditions = [TestCase.tags.contains([t]) for t in tags if t.strip()]
        if tag_conditions:
            conditions.append(or_(*tag_conditions))
    if owner_id:
        conditions.append(TestCase.owner_id == owner_id)
    if product_ids:
        conditions.append(TestCase.primary_product_id.in_(product_ids))
    if component_ids:
        conditions.append(
            TestCase.id.in_(
                select(TestCaseComponentCoverage.test_case_id).where(
                    TestCaseComponentCoverage.component_id.in_(component_ids)
                )
            )
        )
    if minimum_component_risk_level:
        conditions.append(
            TestCase.id.in_(
                select(TestCaseComponentCoverage.test_case_id)
                .join(Component, Component.id == TestCaseComponentCoverage.component_id)
                .where(Component.risk_level.in_(_risk_levels_at_or_above(minimum_component_risk_level)))
            )
        )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        title_or_key = (TestCase.title.ilike(pattern)) | (TestCase.key.ilike(pattern))
        automation_id = func.coalesce(TestCase.automation_id, "").ilike(pattern)
        tags_contain = func.cast(TestCase.tags, String).ilike(pattern)
        conditions.append(title_or_key | automation_id | tags_contain)
    return conditions


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    page: int,
    page_size: int,
    search: str | None,
    status_filters: list[TestCaseStatus] | None,
    priority_filters: list[TestCasePriority] | None,
    suite_ids: list[str] | None,
    tags: list[str] | None,
    owner_id: str | None,
    product_ids: list[str] | None,
    component_ids: list[str] | None,
    minimum_component_risk_level: ComponentRiskLevel | None,
    exclude_test_case_ids: list[str] | None,
    sort_by: TestCaseSortField,
    sort_direction: SortDirection,
) -> OffsetPage[TestCase]:
    conditions = _test_case_list_conditions(
        project_id=project_id,
        search=search,
        status_filters=status_filters,
        priority_filters=priority_filters,
        suite_ids=suite_ids,
        tags=tags,
        owner_id=owner_id,
        product_ids=product_ids,
        component_ids=component_ids,
        minimum_component_risk_level=minimum_component_risk_level,
        exclude_test_case_ids=exclude_test_case_ids,
    )
    total = await db.scalar(select(func.count(TestCase.id)).where(and_(*conditions))) or 0

    sort_value_expr = {
        "created_at": TestCase.created_at,
        "updated_at": TestCase.updated_at,
        "key": func.lower(TestCase.key),
        "title": func.lower(TestCase.title),
        "status": func.lower(cast(TestCase.status, String)),
        "priority": func.coalesce(cast(TestCase.priority, String), "medium"),
        "owner_name": func.lower(func.coalesce(User.username, "")),
        "suite_name": func.lower(func.coalesce(Suite.name, "")),
    }[sort_by]
    stmt = (
        select(TestCase, sort_value_expr.label("sort_value"))
        .outerjoin(User, User.id == TestCase.owner_id)
        .outerjoin(Suite, Suite.id == TestCase.suite_id)
        .options(selectinload(TestCase.component_coverages).selectinload(TestCaseComponentCoverage.component))
        .where(and_(*conditions))
    )
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = TestCase.id.asc() if sort_direction == "asc" else TestCase.id.desc()
    offset = (page - 1) * page_size
    rows = (await db.execute(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))).all()
    has_next = len(rows) > page_size
    page_rows = rows[:page_size]
    items = [row[0] for row in page_rows]
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next, total=total)


async def get_by_id(db: AsyncSession, test_case_id: str) -> TestCase | None:
    return await db.scalar(
        select(TestCase).where(TestCase.id == test_case_id).options(*_test_case_read_options())
    )


async def list_by_ids(db: AsyncSession, test_case_ids: list[str]) -> list[TestCase]:
    if not test_case_ids:
        return []
    result = await db.scalars(select(TestCase).where(TestCase.id.in_(test_case_ids)))
    return list(result.all())


async def map_keys_by_ids(db: AsyncSession, test_case_ids: list[str]) -> dict[str, str]:
    """Bulk load test case keys by id (one query). Missing ids are omitted from the map."""
    if not test_case_ids:
        return {}
    unique = list(dict.fromkeys(test_case_ids))
    rows = (await db.execute(select(TestCase.id, TestCase.key).where(TestCase.id.in_(unique)))).all()
    return {row[0]: row[1] for row in rows}


async def list_matchable_by_project(db: AsyncSession, *, project_id: str) -> list[TestCase]:
    result = await db.scalars(
        select(TestCase).where(
            TestCase.project_id == project_id,
            TestCase.status == TestCaseStatus.active,
        )
    )
    return list(result.all())


async def get_by_project_and_automation_id(
    db: AsyncSession, *, project_id: str, automation_id: str
) -> TestCase | None:
    return await db.scalar(
        select(TestCase).where(
            TestCase.project_id == project_id,
            TestCase.automation_id == automation_id,
        )
    )


async def list_ids_by_suite(db: AsyncSession, suite_id: str) -> list[str]:
    result = await db.scalars(select(TestCase.id).where(TestCase.suite_id == suite_id))
    return list(result.all())


async def list_active_ids_by_suite_ids(db: AsyncSession, suite_ids: list[str]) -> list[str]:
    """Return active test case IDs from given suite IDs. Deduplicated."""
    if not suite_ids:
        return []
    result = await db.scalars(
        select(TestCase.id)
        .where(TestCase.suite_id.in_(suite_ids))
        .where(TestCase.status == TestCaseStatus.active)
    )
    return list(dict.fromkeys(result.all()))


async def list_active_ids_from_ids(db: AsyncSession, test_case_ids: list[str]) -> list[str]:
    """Return only active test case IDs from the given list. Deduplicated."""
    if not test_case_ids:
        return []
    result = await db.scalars(
        select(TestCase.id)
        .where(TestCase.id.in_(test_case_ids))
        .where(TestCase.status == TestCaseStatus.active)
    )
    return list(dict.fromkeys(result.all()))


async def count_by_suite_ids(db: AsyncSession, suite_ids: list[str]) -> int:
    if not suite_ids:
        return 0
    result = await db.scalar(select(func.count(TestCase.id)).where(TestCase.suite_id.in_(suite_ids)))
    return result or 0


async def count_listable_by_suite_ids(db: AsyncSession, suite_ids: list[str]) -> dict[str, int]:
    """Return non-archived test case counts keyed by suite_id (suites with zero cases are omitted)."""
    if not suite_ids:
        return {}
    unique = list(dict.fromkeys(suite_ids))
    stmt = (
        select(TestCase.suite_id, func.count(TestCase.id))
        .where(TestCase.suite_id.in_(unique))
        .where(TestCase.status != TestCaseStatus.archived)
        .group_by(TestCase.suite_id)
    )
    rows = (await db.execute(stmt)).all()
    return {row[0]: int(row[1]) for row in rows if row[0] is not None}


async def count_active_by_suite_ids(db: AsyncSession, suite_ids: list[str]) -> dict[str, int]:
    """Return active test case counts keyed by suite_id (suites with zero cases are omitted)."""
    if not suite_ids:
        return {}
    unique = list(dict.fromkeys(suite_ids))
    stmt = (
        select(TestCase.suite_id, func.count(TestCase.id))
        .where(TestCase.suite_id.in_(unique))
        .where(TestCase.status == TestCaseStatus.active)
        .group_by(TestCase.suite_id)
    )
    rows = (await db.execute(stmt)).all()
    return {row[0]: int(row[1]) for row in rows if row[0] is not None}
