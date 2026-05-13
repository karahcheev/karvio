from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.api.dependencies.storage import get_attachment_storage
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.test_cases.schemas.suite import SuiteCreate, SuitePatch, SuiteRead, SuitesList
from app.modules.attachments.adapters.storage import AttachmentStorage
from app.modules.test_cases.services import suites

router = APIRouter(prefix="/suites", tags=["suites"])


@router.get("")
async def list_suites(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    parent_id: Annotated[str | None, Query(description="Filter by parent suite ID")] = None,
    search: Annotated[
        str | None,
        Query(description="Search by suite name. Case-insensitive partial match."),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
) -> SuitesList:
    return await suites.list_suites(
        db,
        project_id=project_id,
        parent_id=parent_id,
        search=search,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_suite(
    payload: SuiteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SuiteRead:
    return await suites.create_suite(db, payload=payload, current_user=current_user)


@router.get("/{suite_id}")
async def get_suite(
    suite_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SuiteRead:
    return await suites.get_suite(db, suite_id=suite_id, current_user=current_user)


@router.patch("/{suite_id}")
async def patch_suite(
    suite_id: Annotated[str, Path(...)],
    payload: SuitePatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SuiteRead:
    return await suites.patch_suite(
        db,
        suite_id=suite_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{suite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_suite(
    suite_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await suites.delete_suite(db, suite_id=suite_id, storage=storage, current_user=current_user)
