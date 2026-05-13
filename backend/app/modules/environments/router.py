from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.modules.environments.services import environments as environments_service
from app.modules.environments.schemas.environments import (
    EnvironmentCreate,
    EnvironmentPatch,
    EnvironmentRead,
    EnvironmentRevisionRead,
    EnvironmentRevisionsList,
    EnvironmentUseCasesList,
    EnvironmentsList,
)
from app.modules.projects.models import User

router = APIRouter(prefix="/environments", tags=["environments"])


@router.get("")
async def list_environments(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    include_archived: Annotated[bool, Query()] = False,
    search: Annotated[str | None, Query(description="Search by name or description")] = None,
    use_case: Annotated[
        list[str] | None,
        Query(
            description="Filter environments that include any of these use cases. Repeat for multiple.",
        ),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
    sort_by: Annotated[Literal["created_at", "updated_at", "name"], Query()] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> EnvironmentsList:
    return await environments_service.list_environments(
        db,
        project_id=project_id,
        include_archived=include_archived,
        search=search,
        use_cases=use_case,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
    )


@router.get("/use-cases")
async def list_environment_use_case_values(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    include_archived: Annotated[bool, Query()] = False,
) -> EnvironmentUseCasesList:
    return await environments_service.list_environment_use_cases(
        db,
        project_id=project_id,
        include_archived=include_archived,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_environment(
    payload: EnvironmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EnvironmentRead:
    return await environments_service.create_environment(db, payload=payload, current_user=current_user)


@router.get("/{environment_id}")
async def get_environment(
    environment_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EnvironmentRead:
    return await environments_service.get_environment(db, environment_id=environment_id, current_user=current_user)


@router.get("/{environment_id}/revisions")
async def list_environment_revisions(
    environment_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
) -> EnvironmentRevisionsList:
    return await environments_service.list_environment_revisions(
        db,
        environment_id=environment_id,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/{environment_id}/revisions/{revision_number}")
async def get_environment_revision(
    environment_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    revision_number: Annotated[int, Path(..., ge=1)],
) -> EnvironmentRevisionRead:
    return await environments_service.get_environment_revision(
        db,
        environment_id=environment_id,
        revision_number=revision_number,
        current_user=current_user,
    )


@router.patch("/{environment_id}")
async def patch_environment(
    environment_id: Annotated[str, Path(...)],
    payload: EnvironmentPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EnvironmentRead:
    return await environments_service.patch_environment(
        db,
        environment_id=environment_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{environment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_environment(
    environment_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await environments_service.delete_environment(db, environment_id=environment_id, current_user=current_user)
