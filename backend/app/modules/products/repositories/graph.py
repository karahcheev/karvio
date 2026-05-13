from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TestCaseStatus
from app.modules.products.models import Component, ComponentDependency, ProductComponentLink, TestCaseComponentCoverage
from app.modules.test_cases.models import TestCase

from ._shared import normalized_non_empty


async def list_links_for_products(db: AsyncSession, product_ids: list[str]) -> list[ProductComponentLink]:
    normalized = normalized_non_empty(product_ids)
    if not normalized:
        return []
    rows = await db.scalars(select(ProductComponentLink).where(ProductComponentLink.product_id.in_(normalized)))
    return list(rows.all())


async def list_components_by_ids(db: AsyncSession, component_ids: list[str]) -> list[Component]:
    normalized = normalized_non_empty(component_ids)
    if not normalized:
        return []
    rows = await db.scalars(select(Component).where(Component.id.in_(normalized)))
    return list(rows.all())


async def list_dependencies_for_sources(db: AsyncSession, source_component_ids: list[str]) -> list[ComponentDependency]:
    normalized = normalized_non_empty(source_component_ids)
    if not normalized:
        return []
    rows = await db.scalars(select(ComponentDependency).where(ComponentDependency.source_component_id.in_(normalized)))
    return list(rows.all())


async def list_coverages_for_components(db: AsyncSession, component_ids: list[str]) -> list[TestCaseComponentCoverage]:
    normalized = normalized_non_empty(component_ids)
    if not normalized:
        return []
    rows = await db.scalars(select(TestCaseComponentCoverage).where(TestCaseComponentCoverage.component_id.in_(normalized)))
    return list(rows.all())


async def list_active_cases_by_ids(db: AsyncSession, case_ids: list[str]) -> list[TestCase]:
    normalized = normalized_non_empty(case_ids)
    if not normalized:
        return []
    rows = await db.scalars(select(TestCase).where(TestCase.id.in_(normalized), TestCase.status == TestCaseStatus.active))
    return list(rows.all())


async def list_component_ids_for_product(db: AsyncSession, product_id: str) -> list[str]:
    rows = await db.scalars(select(ProductComponentLink.component_id).where(ProductComponentLink.product_id == product_id))
    return normalized_non_empty(rows.all())


async def map_component_ids_by_product(db: AsyncSession, product_ids: list[str]) -> dict[str, list[str]]:
    rows = await list_links_for_products(db, product_ids)
    result: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        result[row.product_id].append(row.component_id)
    return result


async def collect_dependency_expansion(
    db: AsyncSession,
    *,
    component_ids: set[str],
) -> set[str]:
    if not component_ids:
        return set()

    visited = set(component_ids)
    frontier = set(component_ids)

    while frontier:
        deps = await list_dependencies_for_sources(db, list(frontier))
        next_frontier: set[str] = set()
        for dep in deps:
            if dep.target_component_id in visited:
                continue
            visited.add(dep.target_component_id)
            next_frontier.add(dep.target_component_id)
        frontier = next_frontier
    return visited
