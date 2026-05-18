from __future__ import annotations

from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models import Project, ProjectMember
from app.repositories.common import OffsetPage, SortDirection

ProjectSortField = Literal["created_at", "id", "name", "members_count"]


def _members_count_expr():
    return (
        select(func.count(ProjectMember.id))
        .where(ProjectMember.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )


async def _list_projects(
    db: AsyncSession,
    *,
    stmt,
    page: int,
    page_size: int,
    sort_by: ProjectSortField,
    sort_direction: SortDirection,
) -> OffsetPage[Project]:
    members_count_expr = _members_count_expr()
    sort_value_expr = {
        "created_at": Project.created_at,
        "id": Project.id,
        "name": func.lower(Project.name),
        "members_count": members_count_expr,
    }[sort_by]
    stmt = stmt.add_columns(members_count_expr.label("members_count"))
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = Project.id.asc() if sort_direction == "asc" else Project.id.desc()
    offset = (page - 1) * page_size
    rows = (await db.execute(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))).all()
    has_next = len(rows) > page_size
    page_rows = rows[:page_size]
    items = []
    for row in page_rows:
        project = row[0]
        project.members_count = int(row.members_count or 0)
        items.append(project)
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def list_all(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    sort_by: ProjectSortField,
    sort_direction: SortDirection,
) -> OffsetPage[Project]:
    stmt = select(Project)
    return await _list_projects(
        db,
        stmt=stmt,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_direction=sort_direction,
    )


async def list_for_user(
    db: AsyncSession,
    *,
    user_id: str,
    page: int,
    page_size: int,
    sort_by: ProjectSortField,
    sort_direction: SortDirection,
) -> OffsetPage[Project]:
    stmt = select(Project).join(ProjectMember, ProjectMember.project_id == Project.id).where(ProjectMember.user_id == user_id)
    return await _list_projects(
        db,
        stmt=stmt,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_direction=sort_direction,
    )


async def get_by_id(db: AsyncSession, project_id: str) -> Project | None:
    return await db.scalar(select(Project).where(Project.id == project_id))


async def get_by_name(db: AsyncSession, name: str) -> Project | None:
    return await db.scalar(select(Project).where(Project.name == name))


async def exists(db: AsyncSession, project_id: str) -> bool:
    return await db.scalar(select(Project.id).where(Project.id == project_id)) is not None


async def count_members(db: AsyncSession, project_id: str) -> int:
    return int(
        await db.scalar(select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project_id))
        or 0
    )
