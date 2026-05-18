from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.models.enums import DatasetSourceType
from app.modules.projects.models import User
from app.modules.test_cases.schemas.dataset import (
    DatasetBulkOperation,
    DatasetBulkOperationResult,
    DatasetRevisionsList,
    DatasetRevisionRead,
    TestCaseDatasetBindingCreate,
    TestCaseDatasetBindingPatch,
    TestCaseDatasetBindingRead,
    TestCaseDatasetBindingsList,
    TestDatasetCreate,
    TestDatasetPatch,
    TestDatasetRead,
    TestDatasetsList,
)
from app.modules.test_cases.services import datasets

router = APIRouter(tags=["datasets"])


@router.get("/datasets")
async def list_datasets(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    test_case_id: Annotated[str | None, Query()] = None,
    exclude_test_case_id: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    source_type: Annotated[list[DatasetSourceType] | None, Query(alias="source_type")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> TestDatasetsList:
    return await datasets.list_datasets(
        db,
        project_id=project_id,
        test_case_id=test_case_id,
        exclude_test_case_id=exclude_test_case_id,
        search=search,
        source_types=source_type,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.post("/datasets", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    payload: TestDatasetCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestDatasetRead:
    return await datasets.create_dataset(db, payload=payload, current_user=current_user)


@router.post("/datasets/bulk")
async def bulk_operate_datasets(
    payload: DatasetBulkOperation,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DatasetBulkOperationResult:
    return await datasets.bulk_operate_datasets(db, payload=payload, current_user=current_user)


@router.get("/datasets/{dataset_id}")
async def get_dataset(
    dataset_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestDatasetRead:
    return await datasets.get_dataset(db, dataset_id=dataset_id, current_user=current_user)


@router.patch("/datasets/{dataset_id}")
async def patch_dataset(
    dataset_id: Annotated[str, Path(...)],
    payload: TestDatasetPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestDatasetRead:
    return await datasets.patch_dataset(
        db,
        dataset_id=dataset_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await datasets.delete_dataset(db, dataset_id=dataset_id, current_user=current_user)


@router.get("/datasets/{dataset_id}/revisions")
async def list_dataset_revisions(
    dataset_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> DatasetRevisionsList:
    return await datasets.list_dataset_revisions(
        db,
        dataset_id=dataset_id,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/datasets/{dataset_id}/revisions/{revision_number}")
async def get_dataset_revision(
    dataset_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    revision_number: Annotated[int, Path(..., ge=1)],
) -> DatasetRevisionRead:
    return await datasets.get_dataset_revision(
        db,
        dataset_id=dataset_id,
        revision_number=revision_number,
        current_user=current_user,
    )


@router.get("/test-cases/{test_case_id}/dataset-bindings")
async def list_test_case_bindings(
    test_case_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseDatasetBindingsList:
    return await datasets.list_bindings_for_test_case(
        db,
        test_case_id=test_case_id,
        current_user=current_user,
    )


@router.post(
    "/test-cases/{test_case_id}/dataset-bindings",
    status_code=status.HTTP_201_CREATED,
)
async def create_test_case_binding(
    test_case_id: Annotated[str, Path(...)],
    payload: TestCaseDatasetBindingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseDatasetBindingRead:
    return await datasets.create_binding_for_test_case(
        db,
        test_case_id=test_case_id,
        payload=payload,
        current_user=current_user,
    )


@router.patch("/test-cases/{test_case_id}/dataset-bindings/{binding_id}")
async def patch_test_case_binding(
    test_case_id: Annotated[str, Path(...)],
    binding_id: Annotated[str, Path(...)],
    payload: TestCaseDatasetBindingPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestCaseDatasetBindingRead:
    return await datasets.patch_binding_for_test_case(
        db,
        test_case_id=test_case_id,
        binding_id=binding_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/test-cases/{test_case_id}/dataset-bindings/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case_binding(
    test_case_id: Annotated[str, Path(...)],
    binding_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await datasets.delete_binding_from_test_case(
        db,
        test_case_id=test_case_id,
        binding_id=binding_id,
        current_user=current_user,
    )
