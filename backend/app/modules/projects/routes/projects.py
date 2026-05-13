from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.projects.schemas.project import ProjectCreate, ProjectPatch, ProjectRead, ProjectsList
from app.modules.projects.services import projects

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
    sort_by: Annotated[
        Literal["created_at", "id", "name", "members_count"],
        Query(),
    ] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> ProjectsList:
    return await projects.list_projects(
        db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectRead:
    return await projects.create_project(db, payload=payload, current_user=current_user)


@router.get("/{project_id}")
async def get_project(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectRead:
    return await projects.get_project(db, project_id=project_id, current_user=current_user)


@router.patch("/{project_id}")
async def patch_project(
    project_id: Annotated[str, Path(...)],
    payload: ProjectPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectRead:
    return await projects.patch_project(
        db,
        project_id=project_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await projects.delete_project(db, project_id=project_id, current_user=current_user)
