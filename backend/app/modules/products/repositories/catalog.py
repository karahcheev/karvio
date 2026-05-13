from __future__ import annotations

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.enums import ComponentRiskLevel, ProductStatus
from app.modules.products.models import Component, ComponentDependency, Product, ProductComponentLink
from app.repositories.common import OffsetPage

from ._shared import (
    append_component_search_filter,
    append_product_search_filter,
    append_tag_filter,
    normalized_non_empty,
    offset,
    to_offset_page,
)


async def get_product_by_id(db: AsyncSession, product_id: str) -> Product | None:
    return await db.scalar(select(Product).where(Product.id == product_id))


async def get_component_by_id(db: AsyncSession, component_id: str) -> Component | None:
    return await db.scalar(select(Component).where(Component.id == component_id))


async def list_products(
    db: AsyncSession,
    *,
    project_id: str,
    statuses: list[ProductStatus] | None,
    search: str | None,
    tags: list[str] | None,
    page: int,
    page_size: int,
) -> OffsetPage[Product]:
    conditions: list[ColumnElement[bool]] = [Product.project_id == project_id]
    if statuses:
        conditions.append(Product.status.in_(statuses))
    append_tag_filter(conditions, Product.tags, tags)
    append_product_search_filter(conditions, search)

    where_clause = and_(*conditions)
    total = await db.scalar(select(func.count()).select_from(Product).where(where_clause)) or 0
    rows = (
        await db.scalars(
            select(Product)
            .where(where_clause)
            .order_by(Product.updated_at.desc(), Product.id.asc())
            .limit(page_size + 1)
            .offset(offset(page, page_size))
        )
    ).all()
    return to_offset_page(rows=rows, page=page, page_size=page_size, total=total)


async def list_components(
    db: AsyncSession,
    *,
    project_id: str,
    statuses: list[ProductStatus] | None,
    risk_levels: list[ComponentRiskLevel] | None,
    search: str | None,
    tags: list[str] | None,
    product_ids: list[str] | None,
    page: int,
    page_size: int,
) -> OffsetPage[Component]:
    conditions: list[ColumnElement[bool]] = [Component.project_id == project_id]
    if statuses:
        conditions.append(Component.status.in_(statuses))
    if risk_levels:
        conditions.append(Component.risk_level.in_(risk_levels))
    append_tag_filter(conditions, Component.tags, tags)
    append_component_search_filter(conditions, search)

    normalized_product_ids = normalized_non_empty(product_ids)
    stmt = select(Component)
    if normalized_product_ids:
        stmt = stmt.join(ProductComponentLink, ProductComponentLink.component_id == Component.id)
        conditions.append(ProductComponentLink.product_id.in_(normalized_product_ids))

    where_clause = and_(*conditions)
    total_stmt = select(func.count(func.distinct(Component.id))).select_from(Component)
    if normalized_product_ids:
        total_stmt = total_stmt.join(ProductComponentLink, ProductComponentLink.component_id == Component.id)
    total = await db.scalar(total_stmt.where(where_clause)) or 0

    rows = (
        await db.scalars(
            stmt.where(where_clause)
            .group_by(Component.id)
            .order_by(Component.risk_score.desc(), Component.updated_at.desc(), Component.id.asc())
            .limit(page_size + 1)
            .offset(offset(page, page_size))
        )
    ).all()
    return to_offset_page(rows=rows, page=page, page_size=page_size, total=total)


async def list_product_components(db: AsyncSession, product_id: str) -> list[ProductComponentLink]:
    rows = await db.scalars(
        select(ProductComponentLink)
        .where(ProductComponentLink.product_id == product_id)
        .order_by(ProductComponentLink.sort_order.asc(), ProductComponentLink.id.asc())
    )
    return list(rows.all())


async def list_component_dependencies(db: AsyncSession, component_id: str) -> list[ComponentDependency]:
    rows = await db.scalars(
        select(ComponentDependency)
        .where(ComponentDependency.source_component_id == component_id)
        .order_by(ComponentDependency.created_at.asc(), ComponentDependency.id.asc())
    )
    return list(rows.all())


async def list_all_component_dependencies_for_project(db: AsyncSession, project_id: str) -> list[ComponentDependency]:
    rows = await db.scalars(
        select(ComponentDependency)
        .join(Component, ComponentDependency.source_component_id == Component.id)
        .where(Component.project_id == project_id)
        .order_by(ComponentDependency.created_at.asc(), ComponentDependency.id.asc())
    )
    return list(rows.all())
