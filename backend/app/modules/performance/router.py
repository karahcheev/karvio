from __future__ import annotations

from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Path, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.modules.performance.schemas.comparisons import (
    PerformanceComparisonCreate,
    PerformanceComparisonPatch,
    PerformanceComparisonPublicRead,
    PerformanceComparisonRead,
    PerformanceComparisonsList,
)
from app.modules.performance.schemas.runs import (
    PerformanceImportAccepted,
    PerformanceImportRead,
    PerformancePreflightRead,
    PerformanceRunCreate,
    PerformanceRunPatch,
    PerformanceRunRead,
    PerformanceRunsList,
    PerformanceUpload,
)
from app.modules.performance.services.artifacts import build_performance_storage, download_performance_artifact
from app.modules.performance.services.imports import (
    create_performance_import,
    get_performance_import,
    preflight_performance_import,
    read_performance_upload_to_temp,
)
from app.modules.performance.services.lifecycle import create_performance_run, patch_performance_run
from app.modules.performance.services.runs import get_performance_run, list_performance_runs
from app.modules.performance.services.saved_comparisons import (
    create_saved_comparison,
    delete_saved_comparison,
    get_public_comparison,
    get_saved_comparison,
    list_saved_comparisons,
    patch_saved_comparison,
)
from app.modules.performance.storage import (
    PerformanceArtifactStorage,
    max_full_performance_upload_bytes,
    max_preflight_performance_upload_bytes,
)
from app.modules.projects.models import User

router = APIRouter(tags=["performance"])
public_router = APIRouter(tags=["performance-public"])


def get_performance_storage() -> PerformanceArtifactStorage:
    return build_performance_storage()


@router.get("/perf/runs")
async def list_runs(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status_filter: Annotated[list[str] | None, Query(alias="status")] = None,
    verdict: Annotated[list[str] | None, Query()] = None,
    load_kind: Annotated[list[str] | None, Query()] = None,
    environment: Annotated[list[str] | None, Query(alias="environment")] = None,
    search: Annotated[str | None, Query()] = None,
    include_archived: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[
        Literal["created_at", "started_at", "name", "status", "verdict", "load_kind", "env"],
        Query(),
    ] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> PerformanceRunsList:
    return await list_performance_runs(
        db,
        project_id=project_id,
        status_filters=status_filter,
        verdict_filters=verdict,
        load_kind_filters=load_kind,
        env_filters=environment,
        search=search,
        include_archived=include_archived,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
    )


@router.post("/perf/runs", status_code=status.HTTP_201_CREATED)
async def create_run(
    payload: PerformanceRunCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceRunRead:
    return await create_performance_run(db, payload=payload, current_user=current_user)


@router.get("/perf/runs/{run_id}")
async def get_run(
    run_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceRunRead:
    return await get_performance_run(db, run_id=run_id, current_user=current_user)


@router.patch("/perf/runs/{run_id}")
async def patch_run(
    run_id: Annotated[str, Path(...)],
    payload: PerformanceRunPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceRunRead:
    return await patch_performance_run(db, run_id=run_id, payload=payload, current_user=current_user)


@router.post(
    "/perf/imports/validate",
    status_code=status.HTTP_200_OK,
)
async def validate_import(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File(...)],
) -> PerformancePreflightRead:
    max_bytes = max_preflight_performance_upload_bytes(file.filename)
    tmp_path = await read_performance_upload_to_temp(file, max_size_bytes=max_bytes)
    try:
        body = PerformanceUpload(
            path=tmp_path,
            filename=file.filename,
            content_type=file.content_type,
        )
        return await preflight_performance_import(db, project_id=project_id, upload=body, current_user=current_user)
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post(
    "/perf/imports",
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_import(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[PerformanceArtifactStorage, Depends(get_performance_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File(...)],
) -> PerformanceImportAccepted:
    max_bytes = max_full_performance_upload_bytes(file.filename)
    tmp_path = await read_performance_upload_to_temp(file, max_size_bytes=max_bytes)
    try:
        body = PerformanceUpload(
            path=tmp_path,
            filename=file.filename,
            content_type=file.content_type,
        )
        return await create_performance_import(
            db,
            project_id=project_id,
            upload=body,
            current_user=current_user,
            storage=storage,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/perf/imports/{import_id}")
async def get_import(
    import_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceImportRead:
    return await get_performance_import(db, import_id=import_id, current_user=current_user)


@router.get("/perf/comparisons")
async def list_comparisons(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    search: Annotated[str | None, Query()] = None,
    visibility: Annotated[Literal["public", "project"] | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> PerformanceComparisonsList:
    return await list_saved_comparisons(
        db,
        project_id=project_id,
        search=search,
        visibility=visibility,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.post("/perf/comparisons", status_code=status.HTTP_201_CREATED)
async def create_comparison(
    payload: PerformanceComparisonCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceComparisonRead:
    return await create_saved_comparison(db, payload=payload, current_user=current_user)


@router.get("/perf/comparisons/{comparison_id}")
async def get_comparison(
    comparison_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceComparisonRead:
    return await get_saved_comparison(db, comparison_id=comparison_id, current_user=current_user)


@router.patch("/perf/comparisons/{comparison_id}")
async def patch_comparison(
    comparison_id: Annotated[str, Path(...)],
    payload: PerformanceComparisonPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PerformanceComparisonRead:
    return await patch_saved_comparison(
        db,
        comparison_id=comparison_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/perf/comparisons/{comparison_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comparison(
    comparison_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await delete_saved_comparison(db, comparison_id=comparison_id, current_user=current_user)


@public_router.get("/public/perf/comparisons/{token}")
async def get_public_perf_comparison(
    token: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PerformanceComparisonPublicRead:
    return await get_public_comparison(db, token=token)


@router.get("/performance-artifacts/{artifact_id}")
async def download_artifact(
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[PerformanceArtifactStorage, Depends(get_performance_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
    artifact_id: Annotated[str, Path(...)],
) -> StreamingResponse:
    download = await download_performance_artifact(
        db,
        artifact_id=artifact_id,
        storage=storage,
        current_user=current_user,
    )
    return StreamingResponse(
        download.stream,
        media_type=download.content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(download.filename)}",
            "X-Content-Type-Options": "nosniff",
        },
        background=BackgroundTask(download.stream.close),
    )
