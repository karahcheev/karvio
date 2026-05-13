from __future__ import annotations

from app.core.queue import queue_app
from app.modules.integrations.jira.tasks import refresh_issue_snapshots_task


def test_jira_refresh_task_is_registered_as_periodic() -> None:
    matching = [
        registration
        for registration in queue_app.periodic_registry.periodic_tasks.values()
        if registration.task.name == refresh_issue_snapshots_task.name
    ]
    assert len(matching) == 1
    assert matching[0].cron is not None
