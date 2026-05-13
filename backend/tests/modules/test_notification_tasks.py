from __future__ import annotations

from procrastinate.testing import InMemoryConnector

from app.modules.notifications.tasks import (
    enqueue_notification_queue_entry,
    process_notification_queue_entry_task,
)


async def test_enqueue_notification_queue_entry_without_countdown(
    _in_memory_queue: InMemoryConnector,
) -> None:
    await enqueue_notification_queue_entry("entry-10")

    [job] = _in_memory_queue.jobs.values()
    assert job["task_name"] == process_notification_queue_entry_task.name
    assert job["args"] == {"entry_id": "entry-10"}
    assert job["scheduled_at"] is None


async def test_enqueue_notification_queue_entry_with_countdown(
    _in_memory_queue: InMemoryConnector,
) -> None:
    await enqueue_notification_queue_entry("entry-11", countdown=30)

    [job] = _in_memory_queue.jobs.values()
    assert job["task_name"] == process_notification_queue_entry_task.name
    assert job["args"] == {"entry_id": "entry-11"}
    assert job["scheduled_at"] is not None
