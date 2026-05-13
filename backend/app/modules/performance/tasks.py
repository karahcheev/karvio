from __future__ import annotations

from app.core.queue import queue_app
from app.db.session import AsyncSessionLocal
from app.modules.performance.services.artifacts import build_performance_storage
from app.modules.performance.services.import_worker import process_performance_import


@queue_app.task(name="performance.process_import", queue="performance")
async def process_performance_import_task(import_id: str) -> None:
    storage = build_performance_storage()
    async with AsyncSessionLocal() as db:
        await process_performance_import(db, import_id=import_id, storage=storage)


async def enqueue_performance_import(import_id: str) -> None:
    await process_performance_import_task.defer_async(import_id=import_id)
