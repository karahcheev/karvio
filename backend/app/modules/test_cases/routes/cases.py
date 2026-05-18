from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.api.dependencies.storage import get_attachment_storage
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.test_cases.schemas.case import (
    TestCaseBulkOperation,
    TestCaseBulkOperationResult,
    TestCaseCreate,
    TestCaseListQuery,
    TestCasePatch,
    TestCaseRead,
    TestCasesList,
)
from app.modules.test_cases.schemas.steps import TestStepsReplaceRequest, TestStepsResponse
from app.modules.test_cases.services import cases, steps
from app.modules.attachments.adapters.storage import AttachmentStorage


router = APIRouter(prefix="/test-cases", tags=["test-cases"])


@router.get("")
async def list_test_cases(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    query: Annotated[TestCaseListQuery, Query()],
) -> TestCasesList:
    return await cases.list_test_cases(
        db,
        project_id=project_id,
        current_user=current_user,
        query=query,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_test_case(
    payload: TestCaseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseRead:
    return await cases.create_test_case(db, payload=payload, current_user=current_user)


@router.post("/bulk")
async def bulk_operate_test_cases(
    payload: TestCaseBulkOperation,
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseBulkOperationResult:
    return await cases.bulk_operate_test_cases(
        db,
        payload=payload,
        storage=storage,
        current_user=current_user,
    )


@router.get("/{test_case_id}")
async def get_test_case(
    test_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseRead:
    return await cases.get_test_case(db, test_case_id=test_case_id, current_user=current_user)


@router.patch("/{test_case_id}")
async def patch_test_case(
    test_case_id: Annotated[str, Path(...)],
    payload: TestCasePatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseRead:
    return await cases.patch_test_case(
        db,
        test_case_id=test_case_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case(
    test_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await cases.delete_test_case(
        db,
        test_case_id=test_case_id,
        storage=storage,
        current_user=current_user,
    )


@router.get("/{test_case_id}/steps")
async def get_steps(
    test_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestStepsResponse:
    return await steps.get_steps(db, test_case_id=test_case_id, current_user=current_user)


@router.put("/{test_case_id}/steps")
async def replace_steps(
    test_case_id: Annotated[str, Path(...)],
    payload: TestStepsReplaceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestStepsResponse:
    return await steps.replace_steps(
        db,
        test_case_id=test_case_id,
        payload=payload,
        storage=storage,
        current_user=current_user,
    )
