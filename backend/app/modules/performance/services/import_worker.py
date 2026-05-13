from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.metrics import observe_worker_batch
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.schemas.runs import PerformanceUpload
from app.modules.performance.services.apply_import import apply_import_payload
from app.modules.performance.storage import PerformanceArtifactStorage
from app.modules.performance.adapters.adapter_registry import parse_upload

logger = logging.getLogger("tms.worker.performance_import")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _read_import_source(upload_storage: PerformanceArtifactStorage, source_key: str, filename: str, content_type: str) -> bytes:
    download = upload_storage.open(storage_key=source_key, filename=filename, content_type=content_type)
    try:
        return download.stream.read()
    finally:
        download.stream.close()


async def _process_import_item(
    db: AsyncSession,
    *,
    import_id: str,
    storage: PerformanceArtifactStorage,
) -> None:
    import_item = await perf_repo.get_import_by_id_with_run(db, import_id)
    if import_item is None:
        raise not_found("performance_import")

    import_item.status = "processing"
    import_item.started_processing_at = import_item.started_processing_at or _now_utc()
    await db.commit()

    try:
        source_content_type = import_item.source_content_type or "application/octet-stream"
        source_bytes = _read_import_source(
            storage,
            source_key=import_item.source_storage_key,
            filename=import_item.source_filename,
            content_type=source_content_type,
        )
        parsed = parse_upload(
            PerformanceUpload(
                content=source_bytes,
                filename=import_item.source_filename,
                content_type=source_content_type,
            )
        )
        await apply_import_payload(db, import_item=import_item, parsed=parsed, storage=storage)
        await db.commit()
    except Exception as exc:
        import_item.status = "failed"
        import_item.parse_status = "failed"
        import_item.error_detail = str(exc)
        issues = [str(v) for v in (import_item.issues or [])]
        issues.append(str(exc))
        import_item.issues = issues[-20:]
        import_item.finished_processing_at = _now_utc()
        await db.commit()
        raise


async def process_performance_import(
    db: AsyncSession,
    *,
    import_id: str,
    storage: PerformanceArtifactStorage,
) -> bool:
    started = time.perf_counter()
    processed = 0
    try:
        import_item = await perf_repo.get_import_by_id(db, import_id)
        if import_item is None:
            logger.warning("Performance import was not found for processing", extra={"import_id": import_id})
            return False

        if import_item.status in {"completed", "partial", "failed"}:
            return False

        await _process_import_item(db, import_id=import_id, storage=storage)
        processed = 1
        logger.info(
            "Processed performance import",
            extra={
                "event": "worker.performance_import_single",
                "import_id": import_id,
            },
        )
        return True
    except Exception:
        logger.exception(
            "Failed to process performance import",
            extra={"event": "worker.performance_import_failed", "import_id": import_id},
        )
        return False
    finally:
        observe_worker_batch(
            worker="performance_import_worker",
            queue="performance_import",
            claimed=1,
            processed=processed,
            duration_seconds=time.perf_counter() - started,
        )
