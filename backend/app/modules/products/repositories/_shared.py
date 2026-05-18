from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from sqlalchemy import case, or_
from sqlalchemy.sql.elements import ColumnElement

from app.models.enums import ComponentRiskLevel, CoverageStrength
from app.modules.products.models import Component, Product, TestCaseComponentCoverage
from app.repositories.common import OffsetPage


def normalized_non_empty(values: Iterable[str] | None) -> list[str]:
    if not values:
        return []
    return [value for value in dict.fromkeys(values) if value]


def normalized_tags(tags: Iterable[str] | None) -> list[str]:
    if not tags:
        return []
    return [tag.strip() for tag in tags if tag and tag.strip()]


def search_pattern(search: str | None) -> str | None:
    if not search:
        return None
    normalized = search.strip()
    if not normalized:
        return None
    return f"%{normalized}%"


def append_tag_filter(conditions: list[ColumnElement[bool]], tags_column: Any, tags: Iterable[str] | None) -> None:
    normalized = normalized_tags(tags)
    if normalized:
        conditions.append(or_(*[tags_column.contains([tag]) for tag in normalized]))


def append_product_search_filter(conditions: list[ColumnElement[bool]], search: str | None) -> None:
    pattern = search_pattern(search)
    if not pattern:
        return
    conditions.append(
        or_(
            Product.name.ilike(pattern),
            Product.key.ilike(pattern),
            (Product.description.isnot(None)) & (Product.description.ilike(pattern)),
        )
    )


def append_component_search_filter(conditions: list[ColumnElement[bool]], search: str | None) -> None:
    pattern = search_pattern(search)
    if not pattern:
        return
    conditions.append(
        or_(
            Component.name.ilike(pattern),
            Component.key.ilike(pattern),
            (Component.description.isnot(None)) & (Component.description.ilike(pattern)),
        )
    )


def offset(page: int, page_size: int) -> int:
    return (page - 1) * page_size


def to_offset_page(*, rows: Sequence[Any], page: int, page_size: int, total: int) -> OffsetPage[Any]:
    has_next = len(rows) > page_size
    return OffsetPage(items=list(rows[:page_size]), page=page, page_size=page_size, has_next=has_next, total=total)


def required_coverage_score_case():
    return case(
        (Component.risk_level == ComponentRiskLevel.low, 1),
        (Component.risk_level == ComponentRiskLevel.medium, 2),
        (Component.risk_level == ComponentRiskLevel.high, 4),
        else_=6,
    )


def strength_score_case():
    return case(
        (TestCaseComponentCoverage.coverage_strength == CoverageStrength.smoke, 1),
        (TestCaseComponentCoverage.coverage_strength == CoverageStrength.regression, 2),
        else_=3,
    )
