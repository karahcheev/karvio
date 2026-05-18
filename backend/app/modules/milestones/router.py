from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.models.enums import MilestoneStatus
from app.modules.milestones.schemas.milestone import (
    MilestoneCreate,
    MilestonePatch,
    MilestoneRead,
    MilestonesList,
    MilestoneSummaryRead,
)
from app.modules.milestones.services import milestones as milestones_service
from app.modules.projects.models import User

router = APIRouter(prefix="/milestones", tags=["milestones"])


@router.get("")
async def list_milestones(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: Annotated[
        list[MilestoneStatus] | None,
        Query(description="Filter by milestone status. Repeat for multiple."),
    ] = None,
    search: Annotated[
        str | None,
        Query(description="Search by name, description or release label."),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
) -> MilestonesList:
    return await milestones_service.list_milestones(
        db,
        project_id=project_id,
        statuses=status,
        search=search,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_milestone(
    payload: MilestoneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MilestoneRead:
    return await milestones_service.create_milestone(db, payload=payload, current_user=current_user)


@router.get("/{milestone_id}")
async def get_milestone(
    milestone_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MilestoneRead:
    return await milestones_service.get_milestone(db, milestone_id=milestone_id, current_user=current_user)


@router.get("/{milestone_id}/summary")
async def get_milestone_summary(
    milestone_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MilestoneSummaryRead:
    return await milestones_service.get_milestone_summary(db, milestone_id=milestone_id, current_user=current_user)


@router.patch("/{milestone_id}")
async def patch_milestone(
    milestone_id: Annotated[str, Path(...)],
    payload: MilestonePatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MilestoneRead:
    return await milestones_service.patch_milestone(
        db,
        milestone_id=milestone_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await milestones_service.delete_milestone(db, milestone_id=milestone_id, current_user=current_user)
