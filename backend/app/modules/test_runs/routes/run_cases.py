"""Run-cases API. Flat public routes: /run-cases."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.enums import RunItemStatus
from app.modules.projects.models import User
from app.modules.test_runs.schemas.run_cases import (
    RunCaseDetailRead,
    RunCasePatch,
    RunCaseRerunRequest,
    RunCaseRowPatch,
    RunCaseRowRead,
    RunCaseRowsList,
    RunCaseRead,
    RunCasesBulkCreateRequest,
    RunCasesBulkCreateResponse,
    RunCasesCreateRequest,
    RunCasesList,
)
from app.modules.test_runs.services import run_cases

router = APIRouter(prefix="/run-cases", tags=["run-cases"])


@router.get("")
async def list_run_cases(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    test_run_id: Annotated[str | None, Query(description="Filter by test run")] = None,
    project_id: Annotated[str | None, Query(description="Filter by project when listing a test case history")] = None,
    status: Annotated[
        list[RunItemStatus] | None,
        Query(description="Filter by status. Repeat for multiple."),
    ] = None,
    assignee_id: Annotated[str | None, Query()] = None,
    test_case_id: Annotated[str | None, Query()] = None,
    search: Annotated[
        str | None,
        Query(description="Search by test case title. Case-insensitive partial match."),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
    sort_by: Annotated[
        Literal["test_case_title", "suite_name", "status", "assignee_name", "last_executed_at"],
        Query(),
    ] = "last_executed_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> RunCasesList:
    return await run_cases.list_run_cases(
        db,
        test_run_id=test_run_id,
        project_id=project_id,
        status_filters=status,
        assignee_id=assignee_id,
        test_case_id=test_case_id,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_run_case(
    payload: RunCasesCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunCaseRead:
    return await run_cases.create_run_case(db, payload=payload, current_user=current_user)


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_run_cases(
    payload: RunCasesBulkCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunCasesBulkCreateResponse:
    return await run_cases.bulk_create_run_cases(db, payload=payload, current_user=current_user)


@router.get("/{run_case_id}")
async def get_run_case(
    run_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    history_page: Annotated[int, Query(ge=1, description="History page")] = 1,
    history_page_size: Annotated[int, Query(le=200, description="History page size")] = 50,
) -> RunCaseDetailRead:
    return await run_cases.get_run_case(
        db,
        run_case_id=run_case_id,
        current_user=current_user,
        history_page=history_page,
        history_page_size=history_page_size,
    )


@router.patch("/{run_case_id}")
async def patch_run_case(
    run_case_id: Annotated[str, Path(...)],
    payload: RunCasePatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunCaseRead:
    return await run_cases.patch_run_case(
        db,
        run_case_id=run_case_id,
        payload=payload,
        current_user=current_user,
    )


@router.get("/{run_case_id}/rows")
async def list_run_case_rows(
    run_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: Annotated[list[RunItemStatus] | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = 100,
) -> RunCaseRowsList:
    return await run_cases.list_run_case_rows(
        db,
        run_case_id=run_case_id,
        status_filters=status,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.patch("/rows/{run_case_row_id}")
async def patch_run_case_row(
    run_case_row_id: Annotated[str, Path(...)],
    payload: RunCaseRowPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunCaseRowRead:
    return await run_cases.patch_run_case_row(
        db,
        run_case_row_id=run_case_row_id,
        payload=payload,
        current_user=current_user,
    )


@router.post("/{run_case_id}/rerun", status_code=status.HTTP_201_CREATED)
async def rerun_run_case(
    run_case_id: Annotated[str, Path(...)],
    payload: RunCaseRerunRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunCaseRowsList:
    return await run_cases.rerun_run_case(
        db,
        run_case_id=run_case_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{run_case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run_case(
    run_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await run_cases.delete_run_case(db, run_case_id=run_case_id, current_user=current_user)
