from __future__ import annotations

from typing import Literal

from sqlalchemy import String, and_, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.environments.models import Environment, EnvironmentRevision
from app.repositories.common import OffsetPage, SortDirection

EnvironmentSortField = Literal["created_at", "updated_at", "name"]


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    include_archived: bool,
    search: str | None,
    use_cases: list[str] | None,
    page: int,
    page_size: int,
    sort_by: EnvironmentSortField,
    sort_direction: SortDirection,
) -> OffsetPage[Environment]:
    sort_expr = {
        "created_at": Environment.created_at,
        "updated_at": Environment.updated_at,
        "name": func.lower(cast(Environment.name, String)),
    }[sort_by]

    conditions = [Environment.project_id == project_id]
    if not include_archived:
        conditions.append(Environment.archived_at.is_(None))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(
            Environment.name.ilike(pattern) | func.coalesce(Environment.description, "").ilike(pattern)
        )
    if use_cases:
        normalized = [u.strip() for u in use_cases if u.strip()]
        if normalized:
            conditions.append(or_(*[Environment.use_cases.contains([u]) for u in normalized]))

    where_clause = and_(*conditions)
    total = (
        await db.scalar(select(func.count()).select_from(Environment).where(where_clause))
    ) or 0

    order = sort_expr.asc() if sort_direction == "asc" else sort_expr.desc()
    id_order = Environment.id.asc() if sort_direction == "asc" else Environment.id.desc()
    offset = (page - 1) * page_size
    stmt = select(Environment).where(where_clause)
    result_rows = await db.scalars(stmt.order_by(order, id_order).limit(page_size + 1).offset(offset))
    rows = list(result_rows.all())
    has_next = len(rows) > page_size
    return OffsetPage(
        items=list(rows[:page_size]),
        page=page,
        page_size=page_size,
        has_next=has_next,
        total=total,
    )


async def distinct_use_cases_for_project(
    db: AsyncSession,
    *,
    project_id: str,
    include_archived: bool,
) -> list[str]:
    stmt = select(Environment.use_cases).where(Environment.project_id == project_id)
    if not include_archived:
        stmt = stmt.where(Environment.archived_at.is_(None))
    result_rows = await db.scalars(stmt)
    rows = result_rows.all()
    out: set[str] = set()
    for row in rows:
        if not row:
            continue
        for item in row:
            if isinstance(item, str) and item.strip():
                out.add(item.strip())
    return sorted(out, key=str.lower)


async def get_by_id(db: AsyncSession, environment_id: str) -> Environment | None:
    return await db.scalar(select(Environment).where(Environment.id == environment_id))


async def get_current_revision(db: AsyncSession, environment_id: str) -> EnvironmentRevision | None:
    return await db.scalar(
        select(EnvironmentRevision)
        .where(
            EnvironmentRevision.environment_id == environment_id,
            EnvironmentRevision.is_current.is_(True),
        )
        .options(selectinload(EnvironmentRevision.entities), selectinload(EnvironmentRevision.edges))
        .order_by(EnvironmentRevision.revision_number.desc())
    )


async def get_current_revisions_by_environment_ids(
    db: AsyncSession,
    environment_ids: list[str],
) -> dict[str, EnvironmentRevision]:
    if not environment_ids:
        return {}
    result_rows = await db.scalars(
        select(EnvironmentRevision)
        .where(
            EnvironmentRevision.environment_id.in_(environment_ids),
            EnvironmentRevision.is_current.is_(True),
        )
        .options(selectinload(EnvironmentRevision.entities), selectinload(EnvironmentRevision.edges))
    )
    rows = list(result_rows.all())
    return {row.environment_id: row for row in rows}


async def mark_all_revisions_not_current(db: AsyncSession, environment_id: str) -> None:
    await db.execute(
        update(EnvironmentRevision)
        .where(
            EnvironmentRevision.environment_id == environment_id,
            EnvironmentRevision.is_current.is_(True),
        )
        .values(is_current=False)
    )


async def list_revisions(
    db: AsyncSession,
    *,
    environment_id: str,
    page: int,
    page_size: int,
) -> OffsetPage[EnvironmentRevision]:
    stmt = (
        select(EnvironmentRevision)
        .where(EnvironmentRevision.environment_id == environment_id)
        .options(selectinload(EnvironmentRevision.entities), selectinload(EnvironmentRevision.edges))
        .order_by(EnvironmentRevision.revision_number.desc())
    )
    offset = (page - 1) * page_size
    result_rows = await db.scalars(stmt.limit(page_size + 1).offset(offset))
    rows = list(result_rows.all())
    has_next = len(rows) > page_size
    return OffsetPage(items=list(rows[:page_size]), page=page, page_size=page_size, has_next=has_next)


async def get_revision_by_number(
    db: AsyncSession,
    *,
    environment_id: str,
    revision_number: int,
) -> EnvironmentRevision | None:
    return await db.scalar(
        select(EnvironmentRevision)
        .where(
            EnvironmentRevision.environment_id == environment_id,
            EnvironmentRevision.revision_number == revision_number,
        )
        .options(selectinload(EnvironmentRevision.entities), selectinload(EnvironmentRevision.edges))
    )
