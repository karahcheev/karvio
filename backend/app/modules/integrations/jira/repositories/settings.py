from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integrations.jira.models import SystemJiraSettings


async def get_default(db: AsyncSession) -> SystemJiraSettings | None:
    return await db.get(SystemJiraSettings, "default")
