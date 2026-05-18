from __future__ import annotations

from typing import Literal

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models import ProjectMember, User
from app.repositories.common import OffsetPage, SortDirection

ProjectMemberSortField = Literal["created_at", "role", "username"]


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    page: int,
    page_size: int,
    sort_by: ProjectMemberSortField,
    sort_direction: SortDirection,
) -> OffsetPage[ProjectMember]:
    sort_value_expr = {
        "created_at": ProjectMember.created_at,
        "role": func.lower(cast(ProjectMember.role, String)),
        "username": func.lower(User.username),
    }[sort_by]
    stmt = select(ProjectMember).join(User, User.id == ProjectMember.user_id).where(
        ProjectMember.project_id == project_id
    )
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = ProjectMember.id.asc() if sort_direction == "asc" else ProjectMember.id.desc()
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def get_by_id(db: AsyncSession, project_member_id: str) -> ProjectMember | None:
    return await db.scalar(select(ProjectMember).where(ProjectMember.id == project_member_id))


async def get_membership(db: AsyncSession, *, project_id: str, user_id: str) -> ProjectMember | None:
    return await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )


async def membership_exists(db: AsyncSession, *, project_id: str, user_id: str) -> bool:
    return (
        await db.scalar(
            select(ProjectMember.id).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
    ) is not None
