from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integrations.jira.models import JiraProjectMapping
from app.modules.projects.models import ProjectMember


async def get_by_id(db: AsyncSession, mapping_id: str) -> JiraProjectMapping | None:
    return await db.scalar(select(JiraProjectMapping).where(JiraProjectMapping.id == mapping_id))


async def get_by_project(db: AsyncSession, project_id: str) -> JiraProjectMapping | None:
    return await db.scalar(select(JiraProjectMapping).where(JiraProjectMapping.project_id == project_id))


async def list_by_project(db: AsyncSession, project_id: str) -> list[JiraProjectMapping]:
    result = await db.scalars(
        select(JiraProjectMapping)
        .where(JiraProjectMapping.project_id == project_id)
        .order_by(JiraProjectMapping.created_at.desc())
    )
    return list(result.all())


async def list_all(db: AsyncSession) -> list[JiraProjectMapping]:
    result = await db.scalars(select(JiraProjectMapping).order_by(JiraProjectMapping.created_at.desc()))
    return list(result.all())


async def list_for_user(db: AsyncSession, user_id: str) -> list[JiraProjectMapping]:
    result = await db.scalars(
        select(JiraProjectMapping)
        .join(ProjectMember, ProjectMember.project_id == JiraProjectMapping.project_id)
        .where(ProjectMember.user_id == user_id)
        .order_by(JiraProjectMapping.created_at.desc())
    )
    return list(result.all())
