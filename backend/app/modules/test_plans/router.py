"""Test plans HTTP API."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.test_plans.schemas.plan import (
    TestPlanCreate,
    TestPlanCreateRunPayload,
    TestPlanGeneratePreviewPayload,
    TestPlanGeneratePreviewResponse,
    TestPlanPatch,
    TestPlanRead,
    TestPlanTagsList,
    TestPlansList,
)
from app.modules.test_plans.services import plans as test_plans_service
from app.modules.test_runs.schemas.runs import TestRunRead

router = APIRouter(prefix="/test-plans", tags=["test-plans"])


@router.get("")
async def list_test_plans(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    search: Annotated[
        str | None,
        Query(description="Search by name or description. Case-insensitive partial match."),
    ] = None,
    tags: Annotated[
        list[str] | None,
        Query(description="Filter by tags. Plans with any of the given tags are returned."),
    ] = None,
    milestone_id: Annotated[
        list[str] | None,
        Query(description="Filter by milestone id. Repeat for multiple."),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
) -> TestPlansList:
    return await test_plans_service.list_test_plans(
        db,
        project_id=project_id,
        search=search,
        tags=tags or [],
        milestone_ids=milestone_id,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/tags")
async def list_test_plan_tags(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestPlanTagsList:
    return await test_plans_service.list_test_plan_tags(db, project_id=project_id, current_user=current_user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_test_plan(
    payload: TestPlanCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestPlanRead:
    return await test_plans_service.create_test_plan(db, payload=payload, current_user=current_user)


@router.post("/generate-preview")
async def generate_test_plan_preview(
    payload: TestPlanGeneratePreviewPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestPlanGeneratePreviewResponse:
    return await test_plans_service.generate_test_plan_preview(db, payload=payload, current_user=current_user)


@router.get("/{test_plan_id}")
async def get_test_plan(
    test_plan_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestPlanRead:
    return await test_plans_service.get_test_plan(db, test_plan_id=test_plan_id, current_user=current_user)


@router.patch("/{test_plan_id}")
async def patch_test_plan(
    test_plan_id: Annotated[str, Path(...)],
    payload: TestPlanPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestPlanRead:
    return await test_plans_service.patch_test_plan(
        db,
        test_plan_id=test_plan_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{test_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_plan(
    test_plan_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await test_plans_service.delete_test_plan(db, test_plan_id=test_plan_id, current_user=current_user)


@router.post("/{test_plan_id}/create-run", status_code=status.HTTP_201_CREATED)
async def create_run_from_test_plan(
    test_plan_id: Annotated[str, Path(...)],
    payload: TestPlanCreateRunPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestRunRead:
    return await test_plans_service.create_run_from_test_plan(
        db,
        test_plan_id=test_plan_id,
        payload=payload,
        current_user=current_user,
    )
