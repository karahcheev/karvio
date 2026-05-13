from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integrations.jira.models import JiraConnection


async def list_by_workspace(db: AsyncSession, workspace_id: str) -> list[JiraConnection]:
    result = await db.scalars(
        select(JiraConnection).where(JiraConnection.workspace_id == workspace_id).order_by(JiraConnection.created_at.desc())
    )
    return list(result.all())


async def get_by_id(db: AsyncSession, connection_id: str) -> JiraConnection | None:
    return await db.scalar(select(JiraConnection).where(JiraConnection.id == connection_id))


async def get_by_workspace_and_cloud(db: AsyncSession, *, workspace_id: str, cloud_id: str) -> JiraConnection | None:
    return await db.scalar(
        select(JiraConnection).where(
            JiraConnection.workspace_id == workspace_id,
            JiraConnection.cloud_id == cloud_id,
        )
    )
