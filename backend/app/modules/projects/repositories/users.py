from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Project, ProjectMember, User
from app.repositories.common import OffsetPage, SortDirection

UserSortField = Literal["created_at", "updated_at", "id", "username", "email", "team", "project_count", "is_enabled", "last_login_at"]
MIN_CURSOR_DATETIME = datetime.min.replace(tzinfo=timezone.utc)


@dataclass
class UserProjectMembership:
    user_id: str
    project_id: str
    project_name: str
    role: ProjectMemberRole


async def list_users(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None,
    sort_by: UserSortField,
    sort_direction: SortDirection,
) -> OffsetPage[User]:
    project_count_expr = (
        select(func.count(ProjectMember.id))
        .where(ProjectMember.user_id == User.id)
        .scalar_subquery()
    )
    is_enabled_sort_expr = case((User.is_enabled.is_(True), 1), else_=0)
    sort_value_expr = {
        "created_at": User.created_at,
        "updated_at": User.updated_at,
        "id": User.id,
        "username": func.lower(User.username),
        "email": func.lower(func.coalesce(User.email, "")),
        "team": func.lower(func.coalesce(User.team, "")),
        "project_count": project_count_expr,
        "is_enabled": is_enabled_sort_expr,
        "last_login_at": func.coalesce(User.last_login_at, MIN_CURSOR_DATETIME),
    }[sort_by]

    stmt = select(User)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            (User.username.ilike(pattern))
            | (func.coalesce(User.email, "").ilike(pattern))
            | (func.coalesce(User.first_name, "").ilike(pattern))
            | (func.coalesce(User.last_name, "").ilike(pattern))
            | (func.coalesce(User.team, "").ilike(pattern))
        )
    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = User.id.asc() if sort_direction == "asc" else User.id.desc()
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    items = list(rows[:page_size])
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def get_by_id(db: AsyncSession, user_id: str) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


async def get_by_username(db: AsyncSession, username: str) -> User | None:
    return await db.scalar(select(User).where(User.username == username))


async def exists(db: AsyncSession, user_id: str) -> bool:
    return await db.scalar(select(User.id).where(User.id == user_id)) is not None


async def list_by_ids(db: AsyncSession, user_ids: list[str]) -> list[User]:
    if not user_ids:
        return []
    result = await db.scalars(select(User).where(User.id.in_(user_ids)))
    return list(result.all())


async def list_project_memberships_by_user_ids(
    db: AsyncSession,
    *,
    user_ids: list[str],
) -> dict[str, list[UserProjectMembership]]:
    if not user_ids:
        return {}

    stmt = (
        select(
            ProjectMember.user_id,
            ProjectMember.project_id,
            Project.name,
            ProjectMember.role,
        )
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id.in_(user_ids))
        .order_by(Project.name.asc())
    )
    rows = (await db.execute(stmt)).all()

    memberships_by_user_id: dict[str, list[UserProjectMembership]] = defaultdict(list)
    for user_id, project_id, project_name, role in rows:
        memberships_by_user_id[user_id].append(
            UserProjectMembership(
                user_id=user_id,
                project_id=project_id,
                project_name=project_name,
                role=role,
            )
        )
    return dict(memberships_by_user_id)
