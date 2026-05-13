from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import DatasetBindingMode, DatasetRowSelectionType, DatasetSourceType, ProjectMemberRole
from app.modules.projects.models import User
from app.modules.test_cases.models import DatasetRevision, TestCase, TestCaseDatasetBinding, TestDataset
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.repositories import datasets as test_dataset_repo
from app.modules.test_cases.schemas.dataset import (
    DatasetBulkAction,
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
from app.modules.audit.services import audit as audit_service
from app.modules.audit.services.audit import AuditQueueEventParams
from app.services.access import ensure_project_role


def _raise_dataset_name_conflict() -> None:
    raise DomainError(
        status_code=409,
        code="dataset_already_exists",
        title="Conflict",
        detail="dataset name already exists in this project",
        errors={"name": ["dataset name already exists in this project"]},
    )


async def _get_dataset_or_404(db: AsyncSession, dataset_id: str) -> TestDataset:
    dataset = await test_dataset_repo.get_by_id(db, dataset_id)
    if not dataset:
        raise not_found("dataset")
    return dataset


async def _get_test_case_or_404(db: AsyncSession, test_case_id: str) -> TestCase:
    test_case = await test_case_repo.get_by_id(db, test_case_id)
    if not test_case:
        raise not_found("test_case")
    return test_case


def _to_revision_read(revision: DatasetRevision | None) -> DatasetRevisionRead | None:
    if revision is None:
        return None
    return DatasetRevisionRead.model_validate(revision)


async def _resolve_current_revision(dataset: TestDataset) -> DatasetRevision | None:
    for revision in dataset.revisions:
        if revision.revision_number == dataset.current_revision_number:
            return revision
    return None


async def _to_dataset_read(dataset: TestDataset) -> TestDatasetRead:
    current_revision = await _resolve_current_revision(dataset)
    test_case_ids = [link.test_case_id for link in dataset.case_links]
    return TestDatasetRead.model_validate(dataset).model_copy(
        update={
            "test_case_ids": test_case_ids,
            "test_cases_count": len(test_case_ids),
            "current_revision": _to_revision_read(current_revision),
        }
    )


def _validate_columns_and_rows(columns: list[dict], rows: list[dict]) -> None:
    keys = [item["column_key"] for item in columns]
    if len(set(keys)) != len(keys):
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="column_key must be unique within a dataset revision",
            errors={"columns": ["column_key must be unique"]},
        )
    label_columns = [item for item in columns if item.get("is_scenario_label")]
    if len(label_columns) > 1:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="Only one column can be marked as scenario label",
            errors={"columns": ["only one scenario label column is allowed"]},
        )
    key_set = set(keys)
    row_keys = [row["row_key"] for row in rows]
    if len(set(row_keys)) != len(row_keys):
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="row_key must be unique within a dataset revision",
            errors={"rows": ["row_key must be unique"]},
        )
    for row in rows:
        extra = [k for k in row.get("values", {}).keys() if k not in key_set]
        if extra:
            raise DomainError(
                status_code=422,
                code="validation_error",
                title="Validation error",
                detail="row values contain keys that are not defined as dataset columns",
                errors={"rows": [f"unknown column keys in row '{row['row_key']}': {', '.join(extra)}"]},
            )


async def list_datasets(
    db: AsyncSession,
    *,
    project_id: str,
    test_case_id: str | None,
    exclude_test_case_id: str | None,
    search: str | None,
    source_types: list[DatasetSourceType] | None,
    page: int,
    page_size: int,
    current_user: User,
) -> TestDatasetsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await test_dataset_repo.list_by_project(
        db,
        project_id=project_id,
        test_case_id=test_case_id,
        exclude_test_case_id=exclude_test_case_id,
        search=search,
        source_types=source_types,
        page=page,
        page_size=page_size,
    )
    items = [await _to_dataset_read(item) for item in result.items]
    return TestDatasetsList(
        items=items,
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def create_dataset(db: AsyncSession, *, payload: TestDatasetCreate, current_user: User) -> TestDatasetRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    columns = [item.model_dump() for item in payload.columns]
    rows = [item.model_dump() for item in payload.rows]
    _validate_columns_and_rows(columns, rows)

    dataset = TestDataset(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        source_type=payload.source_type,
        source_ref=payload.source_ref,
        created_by=current_user.id,
    )
    db.add(dataset)
    try:
        await db.flush()
        await test_dataset_repo.create_revision(
            db,
            dataset=dataset,
            columns=columns,
            rows=rows,
            created_by=current_user.id,
            change_summary=payload.change_summary,
        )
        await audit_service.queue_create_event(
            db,
            action="dataset.create",
            resource_type="dataset",
            entity=dataset,
            tenant_id=payload.project_id,
        )
        await db.flush()
    except IntegrityError:
        await db.rollback()
        _raise_dataset_name_conflict()
    await db.refresh(dataset)
    loaded = await test_dataset_repo.get_by_id(db, dataset.id)
    return await _to_dataset_read(loaded or dataset)


async def get_dataset(db: AsyncSession, *, dataset_id: str, current_user: User) -> TestDatasetRead:
    dataset = await _get_dataset_or_404(db, dataset_id)
    await ensure_project_role(db, current_user, dataset.project_id, ProjectMemberRole.viewer)
    return await _to_dataset_read(dataset)


def _resolved_columns_for_patch(
    columns: list[dict] | None,
    current_revision: DatasetRevision | None,
) -> list[dict]:
    if columns is not None:
        return columns
    if not current_revision:
        return []
    return [
        {
            "column_key": c.column_key,
            "display_name": c.display_name,
            "data_type": c.data_type,
            "required": c.required,
            "default_value": c.default_value,
            "is_scenario_label": c.is_scenario_label,
        }
        for c in current_revision.columns
    ]


def _resolved_rows_for_patch(
    rows: list[dict] | None,
    current_revision: DatasetRevision | None,
) -> list[dict]:
    if rows is not None:
        return rows
    if not current_revision:
        return []
    return [
        {
            "row_key": r.row_key,
            "scenario_label": r.scenario_label,
            "values": dict(r.values_json or {}),
            "is_active": r.is_active,
        }
        for r in current_revision.rows
    ]


async def _maybe_create_dataset_revision_on_patch(
    db: AsyncSession,
    *,
    dataset: TestDataset,
    changes: dict,
    current_user: User,
) -> None:
    revision_data_changed = ("columns" in changes) or ("rows" in changes)
    metadata_changed = bool(set(changes.keys()) - {"columns", "rows", "change_summary"})
    if not (revision_data_changed or metadata_changed):
        return
    current_revision = await test_dataset_repo.get_current_revision(db, dataset.id)
    resolved_columns = _resolved_columns_for_patch(changes.get("columns"), current_revision)
    resolved_rows = _resolved_rows_for_patch(changes.get("rows"), current_revision)
    _validate_columns_and_rows(resolved_columns, resolved_rows)
    await test_dataset_repo.create_revision(
        db,
        dataset=dataset,
        columns=resolved_columns,
        rows=resolved_rows,
        created_by=current_user.id,
        change_summary=changes.get("change_summary"),
    )


async def patch_dataset(
    db: AsyncSession,
    *,
    dataset_id: str,
    payload: TestDatasetPatch,
    current_user: User,
) -> TestDatasetRead:
    dataset = await _get_dataset_or_404(db, dataset_id)
    await ensure_project_role(db, current_user, dataset.project_id, ProjectMemberRole.tester)
    before_state = audit_service.snapshot_entity(dataset)

    changes = payload.model_dump(exclude_unset=True)

    for key in ("name", "description", "source_type", "source_ref", "status"):
        if key in changes:
            setattr(dataset, key, changes[key])

    try:
        await _maybe_create_dataset_revision_on_patch(db, dataset=dataset, changes=changes, current_user=current_user)

        await audit_service.queue_update_event(
            db,
            action="dataset.update",
            resource_type="dataset",
            entity=dataset,
            before=before_state,
            tenant_id=dataset.project_id,
        )
        await db.flush()
    except IntegrityError:
        await db.rollback()
        _raise_dataset_name_conflict()
    await db.refresh(dataset)
    loaded = await test_dataset_repo.get_by_id(db, dataset.id)
    return await _to_dataset_read(loaded or dataset)


async def list_dataset_revisions(
    db: AsyncSession,
    *,
    dataset_id: str,
    page: int,
    page_size: int,
    current_user: User,
) -> DatasetRevisionsList:
    dataset = await _get_dataset_or_404(db, dataset_id)
    await ensure_project_role(db, current_user, dataset.project_id, ProjectMemberRole.viewer)
    result = await test_dataset_repo.list_revisions(db, dataset_id=dataset_id, page=page, page_size=page_size)
    return DatasetRevisionsList(
        items=[DatasetRevisionRead.model_validate(item) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def get_dataset_revision(
    db: AsyncSession,
    *,
    dataset_id: str,
    revision_number: int,
    current_user: User,
) -> DatasetRevisionRead:
    dataset = await _get_dataset_or_404(db, dataset_id)
    await ensure_project_role(db, current_user, dataset.project_id, ProjectMemberRole.viewer)
    revision = await test_dataset_repo.get_revision_by_number(
        db, dataset_id=dataset_id, revision_number=revision_number
    )
    if revision is None:
        raise not_found("dataset_revision")
    return DatasetRevisionRead.model_validate(revision)


async def delete_dataset(db: AsyncSession, *, dataset_id: str, current_user: User) -> None:
    dataset = await _get_dataset_or_404(db, dataset_id)
    await ensure_project_role(db, current_user, dataset.project_id, ProjectMemberRole.lead)
    before_state = audit_service.snapshot_entity(dataset)
    await audit_service.queue_delete_event(
        db,
        action="dataset.delete",
        resource_type="dataset",
        resource_id=dataset.id,
        before=before_state,
        tenant_id=dataset.project_id,
    )
    await db.delete(dataset)


async def bulk_operate_datasets(
    db: AsyncSession,
    *,
    payload: DatasetBulkOperation,
    current_user: User,
) -> DatasetBulkOperationResult:
    if payload.action != DatasetBulkAction.delete:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="Unsupported bulk action.",
            errors={"action": ["unsupported action"]},
        )
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    datasets = await test_dataset_repo.list_by_ids(db, payload.dataset_ids)
    found_ids = {item.id for item in datasets}
    missing = [item for item in payload.dataset_ids if item not in found_ids]
    if missing:
        raise DomainError(
            status_code=404,
            code="dataset_not_found",
            title="Not found",
            detail="one or more datasets not found",
            errors={"dataset_ids": [f"unknown dataset_ids: {', '.join(missing)}"]},
        )
    for dataset in datasets:
        if dataset.project_id != payload.project_id:
            raise DomainError(
                status_code=422,
                code="dataset_project_mismatch",
                title="Validation error",
                detail="dataset does not belong to project",
                errors={"dataset_ids": [f"dataset does not belong to project: {dataset.id}"]},
            )

    before_states = [audit_service.snapshot_entity(item) for item in datasets]
    await audit_service.queue_event(
        db,
        params=AuditQueueEventParams(
            action="dataset.bulk_delete",
            resource_type="dataset",
            resource_id=payload.project_id,
            result="success",
            before=before_states,
            after=None,
            metadata={"action": payload.action.value, "affected_count": len(datasets)},
            tenant_id=payload.project_id,
        ),
    )
    for dataset in datasets:
        await db.delete(dataset)
    return DatasetBulkOperationResult(affected_count=len(datasets))


def _to_binding_read(binding: TestCaseDatasetBinding) -> TestCaseDatasetBindingRead:
    return TestCaseDatasetBindingRead.model_validate(binding).model_copy(
        update={"dataset_name": binding.dataset.name if binding.dataset else None}
    )


async def list_bindings_for_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    current_user: User,
) -> TestCaseDatasetBindingsList:
    test_case = await _get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    items = await test_dataset_repo.list_bindings_by_test_case(db, test_case_id)
    return TestCaseDatasetBindingsList(items=[_to_binding_read(item) for item in items])


async def create_binding_for_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    payload: TestCaseDatasetBindingCreate,
    current_user: User,
) -> TestCaseDatasetBindingRead:
    test_case = await _get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.tester)
    dataset = await _get_dataset_or_404(db, payload.dataset_id)
    if dataset.project_id != test_case.project_id:
        raise DomainError(
            status_code=422,
            code="dataset_project_mismatch",
            title="Validation error",
            detail="dataset does not belong to test case project",
            errors={"dataset_id": ["dataset does not belong to test case project"]},
        )
    existing = await test_dataset_repo.get_binding_by_case_and_dataset(
        db, test_case_id=test_case_id, dataset_id=payload.dataset_id
    )
    if existing:
        return _to_binding_read(existing)
    alias_taken = await test_dataset_repo.get_binding_by_case_and_alias(
        db, test_case_id=test_case_id, dataset_alias=payload.dataset_alias
    )
    if alias_taken:
        raise DomainError(
            status_code=409,
            code="dataset_alias_already_exists",
            title="Conflict",
            detail="dataset_alias must be unique within a test case",
            errors={"dataset_alias": ["dataset_alias must be unique within a test case"]},
        )
    if payload.mode == DatasetBindingMode.pin_revision:
        revision = await test_dataset_repo.get_revision_by_number(
            db, dataset_id=dataset.id, revision_number=payload.pinned_revision_number or 0
        )
        if revision is None:
            raise DomainError(
                status_code=422,
                code="dataset_revision_not_found",
                title="Validation error",
                detail="Pinned revision was not found for the selected dataset",
                errors={"pinned_revision_number": ["unknown revision number for dataset"]},
            )
    binding = TestCaseDatasetBinding(
        test_case_id=test_case_id,
        dataset_id=payload.dataset_id,
        dataset_alias=payload.dataset_alias,
        mode=payload.mode,
        pinned_revision_number=payload.pinned_revision_number,
        row_selection_type=payload.row_selection_type,
        selected_row_keys=list(payload.selected_row_keys),
        sort_order=payload.sort_order,
    )
    db.add(binding)
    await db.flush()
    await db.refresh(binding)
    loaded = await test_dataset_repo.get_binding(db, binding.id)
    return _to_binding_read(loaded or binding)


async def _validate_binding_alias_change(
    db: AsyncSession,
    *,
    test_case_id: str,
    binding: TestCaseDatasetBinding,
    changes: dict,
) -> None:
    if "dataset_alias" not in changes or changes["dataset_alias"] == binding.dataset_alias:
        return
    alias_taken = await test_dataset_repo.get_binding_by_case_and_alias(
        db, test_case_id=test_case_id, dataset_alias=changes["dataset_alias"]
    )
    if alias_taken and alias_taken.id != binding.id:
        raise DomainError(
            status_code=409,
            code="dataset_alias_already_exists",
            title="Conflict",
            detail="dataset_alias must be unique within a test case",
            errors={"dataset_alias": ["dataset_alias must be unique within a test case"]},
        )


async def _validate_binding_pin_revision(
    db: AsyncSession,
    *,
    binding: TestCaseDatasetBinding,
    changes: dict,
) -> None:
    if "mode" not in changes or changes["mode"] != DatasetBindingMode.pin_revision:
        return
    pinned = changes.get("pinned_revision_number", binding.pinned_revision_number)
    if pinned is None:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="pinned_revision_number is required when mode=pin_revision",
            errors={"pinned_revision_number": ["required when mode=pin_revision"]},
        )
    revision = await test_dataset_repo.get_revision_by_number(
        db, dataset_id=binding.dataset_id, revision_number=pinned
    )
    if revision is None:
        raise DomainError(
            status_code=422,
            code="dataset_revision_not_found",
            title="Validation error",
            detail="Pinned revision was not found for the selected dataset",
            errors={"pinned_revision_number": ["unknown revision number for dataset"]},
        )


def _validate_binding_subset_row_keys(binding: TestCaseDatasetBinding, changes: dict) -> None:
    if "row_selection_type" not in changes or changes["row_selection_type"] != DatasetRowSelectionType.subset:
        return
    if changes.get("selected_row_keys") or binding.selected_row_keys:
        return
    raise DomainError(
        status_code=422,
        code="validation_error",
        title="Validation error",
        detail="selected_row_keys is required when row_selection_type=subset",
        errors={"selected_row_keys": ["required when row_selection_type=subset"]},
    )


async def patch_binding_for_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    binding_id: str,
    payload: TestCaseDatasetBindingPatch,
    current_user: User,
) -> TestCaseDatasetBindingRead:
    test_case = await _get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.tester)
    binding = await test_dataset_repo.get_binding(db, binding_id)
    if not binding or binding.test_case_id != test_case_id:
        raise not_found("dataset_binding")

    changes = payload.model_dump(exclude_unset=True)
    await _validate_binding_alias_change(db, test_case_id=test_case_id, binding=binding, changes=changes)
    await _validate_binding_pin_revision(db, binding=binding, changes=changes)
    _validate_binding_subset_row_keys(binding, changes)

    for key, value in changes.items():
        setattr(binding, key, value)
    await db.flush()
    await db.refresh(binding)
    loaded = await test_dataset_repo.get_binding(db, binding.id)
    return _to_binding_read(loaded or binding)


async def delete_binding_from_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    binding_id: str,
    current_user: User,
) -> None:
    test_case = await _get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.tester)
    binding = await test_dataset_repo.get_binding(db, binding_id)
    if not binding or binding.test_case_id != test_case_id:
        raise not_found("dataset_binding")
    await db.delete(binding)
