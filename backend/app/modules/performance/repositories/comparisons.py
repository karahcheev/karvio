from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.performance.models import PerformanceComparison
from app.repositories.common import OffsetPage


async def get_comparison_by_id(db: AsyncSession, comparison_id: str) -> PerformanceComparison | None:
    stmt = select(PerformanceComparison).where(PerformanceComparison.id == comparison_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_comparisons_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    search: str | None,
    visibility: str | None,
    page: int,
    page_size: int,
) -> OffsetPage[PerformanceComparison]:
    stmt = select(PerformanceComparison).where(PerformanceComparison.project_id == project_id)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                PerformanceComparison.name.ilike(pattern),
                PerformanceComparison.base_run_id.ilike(pattern),
            )
        )

    if visibility == "public":
        stmt = stmt.where(PerformanceComparison.public_token.is_not(None))
    elif visibility == "project":
        stmt = stmt.where(PerformanceComparison.public_token.is_(None))

    offset = (page - 1) * page_size
    rows = (
        await db.scalars(
            stmt.order_by(PerformanceComparison.created_at.desc(), PerformanceComparison.id.desc())
            .limit(page_size + 1)
            .offset(offset)
        )
    ).all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def get_comparison_by_public_token(db: AsyncSession, token: str) -> PerformanceComparison | None:
    stmt = select(PerformanceComparison).where(PerformanceComparison.public_token == token)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def insert_comparison(db: AsyncSession, comparison: PerformanceComparison) -> PerformanceComparison:
    db.add(comparison)
    await db.flush()
    await db.refresh(comparison)
    return comparison


async def delete_comparison(db: AsyncSession, comparison: PerformanceComparison) -> None:
    await db.delete(comparison)
    await db.flush()
