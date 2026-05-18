from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.projects.schemas.member import (
    ProjectMemberCreate,
    ProjectMemberPatch,
    ProjectMemberRead,
    ProjectMembersList,
)
from app.modules.projects.services import members

router = APIRouter(prefix="/project-members", tags=["project-members"])


@router.get("")
async def list_project_members(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
    sort_by: Annotated[Literal["created_at", "role", "username"], Query()] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> ProjectMembersList:
    return await members.list_project_members(
        db,
        project_id=project_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project_member(
    payload: ProjectMemberCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectMemberRead:
    return await members.create_project_member(
        db,
        payload=payload,
        current_user=current_user,
    )


@router.get("/{project_member_id}")
async def get_project_member(
    project_member_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectMemberRead:
    return await members.get_project_member(
        db,
        project_member_id=project_member_id,
        current_user=current_user,
    )


@router.patch("/{project_member_id}")
async def patch_project_member(
    project_member_id: Annotated[str, Path(...)],
    payload: ProjectMemberPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectMemberRead:
    return await members.patch_project_member(
        db,
        project_member_id=project_member_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{project_member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_member(
    project_member_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await members.delete_project_member(
        db,
        project_member_id=project_member_id,
        current_user=current_user,
    )
