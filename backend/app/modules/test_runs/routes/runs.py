from datetime import date
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Path, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.models.enums import TestRunStatus
from app.modules.projects.models import User
from app.modules.report_import.schemas.imports import JunitImportRead, JunitXmlUpload
from app.modules.report_import.services.uploads import read_report_upload_to_temp
from app.modules.test_runs.schemas.runs import TestRunCreate, TestRunPatch, TestRunRead, TestRunsList
from app.modules.report_import.services import junit_import as junit_import_service
from app.modules.reports.services import reports as reports_service
from app.modules.test_runs.services import runs

router = APIRouter(prefix="/test-runs", tags=["test-runs"])


@router.get("")
async def list_test_runs(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: Annotated[
        list[TestRunStatus] | None,
        Query(description="Filter by status. Repeat for multiple."),
    ] = None,
    environment_id: Annotated[
        list[str] | None,
        Query(description="Filter by environment id. Repeat for multiple."),
    ] = None,
    milestone_id: Annotated[
        list[str] | None,
        Query(description="Filter by milestone id. Repeat for multiple."),
    ] = None,
    search: Annotated[
        str | None,
        Query(description="Search by name, build, or environment. Case-insensitive partial match."),
    ] = None,
    created_by: Annotated[str | None, Query()] = None,
    created_from: Annotated[date | None, Query(description="Filter runs created on or after this date")] = None,
    created_to: Annotated[date | None, Query(description="Filter runs created on or before this date")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
    sort_by: Annotated[
        Literal["created_at", "name", "status", "build", "environment"],
        Query(),
    ] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> TestRunsList:
    return await runs.list_test_runs(
        db,
        project_id=project_id,
        status_filters=status,
        environment_ids=environment_id,
        milestone_ids=milestone_id,
        search=search,
        created_by=created_by,
        created_from=created_from,
        created_to=created_to,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
    )

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_test_run(
    payload: TestRunCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestRunRead:
    return await runs.create_test_run(db, payload=payload, current_user=current_user)


@router.get("/{test_run_id}")
async def get_test_run(
    test_run_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestRunRead:
    return await runs.get_test_run(db, test_run_id=test_run_id, current_user=current_user)


@router.get("/{test_run_id}/export")
async def export_run_report(
    test_run_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    report_format: Annotated[
        reports_service.RunReportExportFormat,
        Query(alias="format"),
    ] = reports_service.RunReportExportFormat.json,
) -> Response:
    result = await reports_service.export_run_report(
        db,
        test_run_id=test_run_id,
        report_format=report_format,
        current_user=current_user,
    )
    return Response(
        content=result.content,
        media_type=result.media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(result.filename)}"},
    )


@router.post("/{test_run_id}/imports/junit", status_code=status.HTTP_201_CREATED)
async def import_junit_xml(
    test_run_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File(...)],
    dry_run: Annotated[bool, Query()] = False,
    create_missing_cases: Annotated[bool, Query()] = False,
) -> JunitImportRead:
    tmp_path = await read_report_upload_to_temp(file)
    try:
        body = JunitXmlUpload(
            path=tmp_path,
            filename=file.filename,
            content_type=file.content_type,
        )
        return await junit_import_service.import_junit_xml(
            db,
            test_run_id=test_run_id,
            upload=body,
            dry_run=dry_run,
            create_missing_cases=create_missing_cases,
            current_user=current_user,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@router.patch("/{test_run_id}")
async def patch_test_run(
    test_run_id: Annotated[str, Path(...)],
    payload: TestRunPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestRunRead:
    return await runs.patch_test_run(
        db,
        test_run_id=test_run_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{test_run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_run(
    test_run_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await runs.delete_test_run(db, test_run_id=test_run_id, current_user=current_user)
