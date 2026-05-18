from __future__ import annotations

import os
import tempfile
from pathlib import Path

import aiofiles

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

import logging

from app.core.errors import not_found
from app.core.errors import DomainError
from app.db.session import register_after_commit_callback
from app.models.enums import ProjectMemberRole
from app.modules.performance.adapters.adapter_registry import parse_upload
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.models import PerformanceImport, PerformanceRun, PerformanceRunArtifact
from app.modules.performance.services.runtime import (
    _artifact_type_from_filename,
    _default_environment_snapshot,
    _default_summary,
    _new_id,
    _now_utc,
)
from app.modules.performance.schemas.runs import (
    PerformanceImportAccepted,
    PerformanceImportRead,
    PerformancePreflightRead,
    PerformanceUpload,
)
from app.modules.performance.storage import PerformanceArtifactStorage
from app.modules.projects.models import User
from app.services.access import ensure_project_role

logger = logging.getLogger("tms.performance.imports")


async def read_performance_upload_to_temp(
    file: UploadFile,
    *,
    max_size_bytes: int,
    chunk_size: int = 1024 * 1024,
) -> Path:
    """Stream request body to a temp file; enforces max_size_bytes. Caller must unlink the path."""
    fd, raw = tempfile.mkstemp(prefix="perf-upload-", suffix=".bin")
    os.close(fd)
    path = Path(raw)
    try:
        written = 0
        async with aiofiles.open(path, "wb") as out:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_size_bytes:
                    raise DomainError(
                        status_code=413,
                        code="performance_artifact_too_large",
                        title="Payload too large",
                        detail=f"File exceeds maximum allowed size of {max_size_bytes} bytes",
                    )
                await out.write(chunk)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    if written == 0:
        path.unlink(missing_ok=True)
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title="Validation error",
            detail="Uploaded performance file is empty",
            errors={"file": ["empty file"]},
        )
    return path


def _to_import_read(item: PerformanceImport) -> PerformanceImportRead:
    return PerformanceImportRead(
        id=item.id,
        project_id=item.project_id,
        run_id=item.run_id,
        status=item.status,
        parse_status=item.parse_status,
        source_filename=item.source_filename,
        source_content_type=item.source_content_type,
        adapter=item.adapter,
        adapter_version=item.adapter_version,
        confidence=item.confidence,
        found=[str(v) for v in item.found],
        missing=[str(v) for v in item.missing],
        issues=[str(v) for v in item.issues],
        error_detail=item.error_detail,
        created_by=item.created_by,
        started_processing_at=item.started_processing_at,
        finished_processing_at=item.finished_processing_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def preflight_performance_import(
    db: AsyncSession,
    *,
    project_id: str,
    upload: PerformanceUpload,
    current_user: User,
) -> PerformancePreflightRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)
    parsed = parse_upload(upload)
    return PerformancePreflightRead(
        source=f"upload://{upload.filename or 'artifact.bin'}",
        adapter=parsed.adapter,
        adapter_version=parsed.adapter_version,
        confidence=parsed.confidence,
        found=parsed.found,
        missing=parsed.missing,
        parse_status=parsed.parse_status,
        issues=parsed.issues,
    )


async def create_performance_import(
    db: AsyncSession,
    *,
    project_id: str,
    upload: PerformanceUpload,
    current_user: User,
    storage: PerformanceArtifactStorage,
) -> PerformanceImportAccepted:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)

    if upload.content is not None and upload.path is not None:
        raise DomainError(
            status_code=500,
            code="performance_upload_invalid",
            title="Internal error",
            detail="Upload payload must be either in-memory or on disk, not both",
        )

    if upload.path is None and not upload.content:
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title="Validation error",
            detail="Uploaded performance file is empty",
            errors={"file": ["empty file"]},
        )

    file_name = upload.filename or "performance-artifact.bin"
    run_name = f"{Path(file_name).stem} import"

    now = _now_utc()
    run = PerformanceRun(
        id=_new_id("prf"),
        project_id=project_id,
        name=run_name,
        service="unknown-service",
        env="unknown",
        scenario="imported performance run",
        load_profile="unknown profile",
        branch="unknown",
        commit="unknown",
        build="unknown",
        version="unknown",
        tool="unknown",
        status="running",
        verdict="yellow",
        load_kind="http",
        started_at=now,
        duration_minutes=0,
        baseline_ref=None,
        baseline_policy="manual",
        baseline_label="Manual baseline",
        summary=_default_summary(),
        regressions=[],
        metrics_comparison=[],
        environment_snapshot=_default_environment_snapshot(),
        created_by=current_user.id,
    )
    db.add(run)
    await db.flush()

    if upload.path is not None:
        stored_source = storage.save_path(
            upload.path,
            filename=file_name,
            content_type=upload.content_type,
            entity_type="performance-imports",
            entity_id=run.id,
        )
    else:
        assert upload.content is not None
        stored_source = storage.save_bytes(
            upload.content,
            filename=file_name,
            content_type=upload.content_type,
            entity_type="performance-imports",
            entity_id=run.id,
        )

    import_item = PerformanceImport(
        id=_new_id("pimp"),
        project_id=project_id,
        run_id=run.id,
        status="pending",
        parse_status="partial",
        source_filename=stored_source.filename,
        source_content_type=stored_source.content_type,
        source_storage_backend=stored_source.storage_backend,
        source_storage_key=stored_source.storage_key,
        source_size_bytes=stored_source.size,
        created_by=current_user.id,
    )
    db.add(import_item)

    db.add(
        PerformanceRunArtifact(
            id=_new_id("parf"),
            run_id=run.id,
            label=stored_source.filename,
            artifact_type=_artifact_type_from_filename(stored_source.filename),
            size_bytes=stored_source.size,
            status="ready",
            storage_backend=stored_source.storage_backend,
            storage_key=stored_source.storage_key,
            content_type=stored_source.content_type,
            filename=stored_source.filename,
            created_at=now,
        )
    )

    accepted = PerformanceImportAccepted(import_id=import_item.id, run_id=run.id)

    async def _enqueue() -> None:
        from app.modules.performance import tasks as performance_tasks  # avoid circular at module level
        import app.core.metrics as metrics

        try:
            await performance_tasks.enqueue_performance_import(accepted.import_id)
        except Exception:
            logger.exception(
                "Failed to enqueue performance import after commit; import left in pending state",
                extra={"event": "performance.enqueue_failed", "import_id": accepted.import_id},
            )
            metrics.record_use_case("performance_import_enqueue", outcome="enqueue_failed")

    register_after_commit_callback(db, _enqueue)
    return accepted


async def get_performance_import(db: AsyncSession, *, import_id: str, current_user: User) -> PerformanceImportRead:
    item = await perf_repo.get_import_by_id(db, import_id)
    if item is None:
        raise not_found("performance_import")
    await ensure_project_role(db, current_user, item.project_id, ProjectMemberRole.viewer)
    return _to_import_read(item)
