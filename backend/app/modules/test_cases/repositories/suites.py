from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models import Suite
from app.repositories.common import OffsetPage


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    parent_id: str | None,
    search: str | None,
    page: int,
    page_size: int,
) -> OffsetPage[Suite]:
    stmt = select(Suite).where(Suite.project_id == project_id).order_by(Suite.created_at.desc())
    if parent_id is not None:
        stmt = stmt.where(Suite.parent_id == parent_id)
    if search and search.strip():
        stmt = stmt.where(Suite.name.ilike(f"%{search.strip()}%"))
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def get_by_id(db: AsyncSession, suite_id: str) -> Suite | None:
    return await db.scalar(select(Suite).where(Suite.id == suite_id))


async def map_names_by_ids(db: AsyncSession, suite_ids: list[str]) -> dict[str, str]:
    """Bulk load suite display names by id (one query). Missing ids are omitted from the map."""
    if not suite_ids:
        return {}
    unique = list(dict.fromkeys(suite_ids))
    rows = (await db.execute(select(Suite.id, Suite.name).where(Suite.id.in_(unique)))).all()
    return {row[0]: row[1] for row in rows}


async def get_by_project_parent_and_name(
    db: AsyncSession, *, project_id: str, parent_id: str | None, name: str
) -> Suite | None:
    stmt = select(Suite).where(
        Suite.project_id == project_id,
        Suite.parent_id == parent_id,
        Suite.name == name,
    )
    return await db.scalar(stmt)


async def list_ids_by_parent(db: AsyncSession, parent_id: str) -> list[str]:
    result = await db.scalars(select(Suite.id).where(Suite.parent_id == parent_id))
    return list(result.all())


async def collect_suite_ids_with_descendants(db: AsyncSession, suite_id: str) -> list[str]:
    """Return suite_id and all descendant suite IDs (recursive)."""
    result = [suite_id]
    for child_id in await list_ids_by_parent(db, suite_id):
        result.extend(await collect_suite_ids_with_descendants(db, child_id))
    return result
