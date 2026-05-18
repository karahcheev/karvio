from __future__ import annotations

from app.core.config import get_settings
from app.core.queue import queue_app
from app.db.session import AsyncSessionLocal
from app.modules.integrations.jira.services import integration

settings = get_settings()


@queue_app.periodic(cron=settings.jira_sync_cron, periodic_id="jira-refresh-issue-snapshots")
@queue_app.task(name="jira.refresh_issue_snapshots", queue="jira")
async def refresh_issue_snapshots_task(timestamp: int) -> None:
    async with AsyncSessionLocal() as db:
        await integration.refresh_sync_internal(db)
        await db.commit()
