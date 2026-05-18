from __future__ import annotations

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Subquery

from app.models.enums import ComponentRiskLevel, TestCaseStatus
from app.modules.products.models import Component, ProductComponentLink, TestCaseComponentCoverage
from app.modules.test_cases.models import TestCase

from ._shared import normalized_non_empty, required_coverage_score_case, strength_score_case


def _build_case_strength_subquery(product_ids: list[str]) -> Subquery:
    strength_score = strength_score_case()
    return (
        select(
            ProductComponentLink.product_id.label("product_id"),
            TestCaseComponentCoverage.component_id.label("component_id"),
            TestCaseComponentCoverage.test_case_id.label("test_case_id"),
            func.max(strength_score).label("case_strength_score"),
        )
        .select_from(ProductComponentLink)
        .join(Component, Component.id == ProductComponentLink.component_id)
        .join(TestCaseComponentCoverage, TestCaseComponentCoverage.component_id == Component.id)
        .join(
            TestCase,
            and_(
                TestCase.id == TestCaseComponentCoverage.test_case_id,
                TestCase.status == TestCaseStatus.active,
            ),
        )
        .where(ProductComponentLink.product_id.in_(product_ids))
        .group_by(
            ProductComponentLink.product_id,
            TestCaseComponentCoverage.component_id,
            TestCaseComponentCoverage.test_case_id,
        )
        .subquery()
    )


def _build_component_coverage_subquery(case_strength_subquery: Subquery) -> Subquery:
    return (
        select(
            case_strength_subquery.c.product_id.label("product_id"),
            case_strength_subquery.c.component_id.label("component_id"),
            func.sum(case_strength_subquery.c.case_strength_score).label("coverage_score"),
        )
        .group_by(case_strength_subquery.c.product_id, case_strength_subquery.c.component_id)
        .subquery()
    )


def _empty_summary_snapshot() -> dict[str, int]:
    return {
        "total_components": 0,
        "adequately_covered_components": 0,
        "uncovered_components": 0,
        "high_risk_uncovered_components": 0,
        "mandatory_release_cases": 0,
    }


def _initialize_summary_snapshots(product_ids: list[str]) -> dict[str, dict[str, int]]:
    return {product_id: _empty_summary_snapshot() for product_id in product_ids}


def _apply_component_rows_to_snapshots(
    *,
    snapshots: dict[str, dict[str, int]],
    component_rows: list[tuple],
    mandatory_by_product: dict[str, int],
) -> dict[str, dict[str, int]]:
    for (
        product_id,
        total_components,
        adequately_covered_components,
        uncovered_components,
        high_risk_uncovered_components,
    ) in component_rows:
        snapshots[product_id] = {
            "total_components": int(total_components or 0),
            "adequately_covered_components": int(adequately_covered_components or 0),
            "uncovered_components": int(uncovered_components or 0),
            "high_risk_uncovered_components": int(high_risk_uncovered_components or 0),
            "mandatory_release_cases": int(mandatory_by_product.get(product_id, 0)),
        }
    return snapshots


async def _fetch_component_snapshot_rows(
    db: AsyncSession,
    *,
    product_ids: list[str],
    required_coverage_score,
    component_coverage_subquery: Subquery,
) -> list[tuple]:
    return (
        await db.execute(
            select(
                ProductComponentLink.product_id.label("product_id"),
                func.count(ProductComponentLink.component_id).label("total_components"),
                func.sum(
                    case(
                        (
                            func.coalesce(component_coverage_subquery.c.coverage_score, 0) >= required_coverage_score,
                            1,
                        ),
                        else_=0,
                    )
                ).label("adequately_covered_components"),
                func.sum(
                    case(
                        (
                            func.coalesce(component_coverage_subquery.c.coverage_score, 0) < required_coverage_score,
                            1,
                        ),
                        else_=0,
                    )
                ).label("uncovered_components"),
                func.sum(
                    case(
                        (
                            and_(
                                func.coalesce(component_coverage_subquery.c.coverage_score, 0) < required_coverage_score,
                                Component.risk_level.in_([ComponentRiskLevel.high, ComponentRiskLevel.critical]),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("high_risk_uncovered_components"),
            )
            .select_from(ProductComponentLink)
            .join(Component, Component.id == ProductComponentLink.component_id)
            .outerjoin(
                component_coverage_subquery,
                and_(
                    component_coverage_subquery.c.product_id == ProductComponentLink.product_id,
                    component_coverage_subquery.c.component_id == ProductComponentLink.component_id,
                ),
            )
            .where(ProductComponentLink.product_id.in_(product_ids))
            .group_by(ProductComponentLink.product_id)
        )
    ).all()


async def _fetch_mandatory_rows(db: AsyncSession, *, product_ids: list[str]) -> list[tuple]:
    return (
        await db.execute(
            select(
                ProductComponentLink.product_id.label("product_id"),
                func.count(func.distinct(TestCaseComponentCoverage.test_case_id)).label("mandatory_release_cases"),
            )
            .select_from(ProductComponentLink)
            .join(Component, Component.id == ProductComponentLink.component_id)
            .join(
                TestCaseComponentCoverage,
                and_(
                    TestCaseComponentCoverage.component_id == Component.id,
                    TestCaseComponentCoverage.is_mandatory_for_release.is_(True),
                ),
            )
            .join(
                TestCase,
                and_(
                    TestCase.id == TestCaseComponentCoverage.test_case_id,
                    TestCase.status == TestCaseStatus.active,
                ),
            )
            .where(ProductComponentLink.product_id.in_(product_ids))
            .group_by(ProductComponentLink.product_id)
        )
    ).all()


async def build_product_summary_rows(db: AsyncSession, product_id: str) -> list[tuple]:
    return (
        await db.execute(
            select(
                Component.id,
                Component.key,
                Component.name,
                Component.risk_level,
                Component.risk_score,
                ProductComponentLink.is_core,
                TestCaseComponentCoverage.test_case_id,
                TestCaseComponentCoverage.coverage_strength,
                TestCaseComponentCoverage.is_mandatory_for_release,
                TestCase.test_case_type,
                TestCase.status,
            )
            .select_from(ProductComponentLink)
            .join(Component, Component.id == ProductComponentLink.component_id)
            .outerjoin(TestCaseComponentCoverage, TestCaseComponentCoverage.component_id == Component.id)
            .outerjoin(TestCase, TestCase.id == TestCaseComponentCoverage.test_case_id)
            .where(ProductComponentLink.product_id == product_id)
            .order_by(Component.name.asc(), TestCaseComponentCoverage.test_case_id.asc())
        )
    ).all()


async def list_case_coverages_for_components(
    db: AsyncSession,
    *,
    component_ids: list[str],
) -> list[tuple[TestCaseComponentCoverage, Component, TestCase]]:
    normalized = normalized_non_empty(component_ids)
    if not normalized:
        return []
    rows = (
        await db.execute(
            select(TestCaseComponentCoverage, Component, TestCase)
            .join(Component, Component.id == TestCaseComponentCoverage.component_id)
            .join(TestCase, TestCase.id == TestCaseComponentCoverage.test_case_id)
            .where(
                TestCaseComponentCoverage.component_id.in_(normalized),
                TestCase.status == TestCaseStatus.active,
            )
        )
    ).all()
    return [(row[0], row[1], row[2]) for row in rows]


async def count_component_links_for_products(db: AsyncSession, product_ids: list[str]) -> dict[str, int]:
    normalized = normalized_non_empty(product_ids)
    if not normalized:
        return {}
    rows = (
        await db.execute(
            select(ProductComponentLink.product_id, func.count(ProductComponentLink.id))
            .where(ProductComponentLink.product_id.in_(normalized))
            .group_by(ProductComponentLink.product_id)
        )
    ).all()
    return {product_id: int(count) for product_id, count in rows}


async def list_product_summary_snapshots(
    db: AsyncSession,
    *,
    product_ids: list[str],
) -> dict[str, dict[str, int]]:
    normalized = normalized_non_empty(product_ids)
    if not normalized:
        return {}

    required_coverage_score = required_coverage_score_case()
    case_strength_subquery = _build_case_strength_subquery(normalized)
    component_coverage_subquery = _build_component_coverage_subquery(case_strength_subquery)

    component_rows = await _fetch_component_snapshot_rows(
        db,
        product_ids=normalized,
        required_coverage_score=required_coverage_score,
        component_coverage_subquery=component_coverage_subquery,
    )
    mandatory_rows = await _fetch_mandatory_rows(db, product_ids=normalized)

    mandatory_by_product = {product_id: int(mandatory_release_cases) for product_id, mandatory_release_cases in mandatory_rows}

    snapshots = _initialize_summary_snapshots(normalized)
    return _apply_component_rows_to_snapshots(
        snapshots=snapshots,
        component_rows=component_rows,
        mandatory_by_product=mandatory_by_product,
    )


async def risk_level_for_case_component_pairs(
    db: AsyncSession,
    *,
    case_ids: list[str],
    component_ids: list[str],
) -> dict[tuple[str, str], tuple[ComponentRiskLevel, int]]:
    if not case_ids or not component_ids:
        return {}
    rows = (
        await db.execute(
            select(
                TestCaseComponentCoverage.test_case_id,
                TestCaseComponentCoverage.component_id,
                Component.risk_level,
                Component.risk_score,
            )
            .join(Component, Component.id == TestCaseComponentCoverage.component_id)
            .where(
                TestCaseComponentCoverage.test_case_id.in_(case_ids),
                TestCaseComponentCoverage.component_id.in_(component_ids),
            )
        )
    ).all()
    return {(case_id, component_id): (risk_level, int(risk_score)) for case_id, component_id, risk_level, risk_score in rows}
