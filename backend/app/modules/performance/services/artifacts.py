from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.storage import PerformanceArtifactDownload, PerformanceArtifactStorage
from app.modules.projects.models import User
from app.services.access import ensure_project_role


def build_performance_storage() -> PerformanceArtifactStorage:
    return PerformanceArtifactStorage(get_settings().performance_artifact_root)


async def download_performance_artifact(
    db: AsyncSession,
    *,
    artifact_id: str,
    storage: PerformanceArtifactStorage,
    current_user: User,
) -> PerformanceArtifactDownload:
    artifact = await perf_repo.get_artifact_by_id(db, artifact_id)
    if artifact is None:
        raise not_found("performance_artifact")
    if artifact.run is None:
        raise not_found("performance_run")

    await ensure_project_role(db, current_user, artifact.run.project_id, ProjectMemberRole.viewer)

    if artifact.status != "ready" or not artifact.storage_key or not artifact.filename or not artifact.content_type:
        raise DomainError(
            status_code=404,
            code="performance_artifact_not_ready",
            title="Not found",
            detail="Artifact is not available for download",
        )

    return storage.open(
        storage_key=artifact.storage_key,
        filename=artifact.filename,
        content_type=artifact.content_type,
    )
