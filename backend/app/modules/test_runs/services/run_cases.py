"""Run-cases integration. RunItem is case-level aggregate; RunCaseRow is row-level execution."""

from __future__ import annotations

from itertools import product

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import (
    DatasetBindingMode,
    DatasetRowSelectionType,
    ExternalIssueOwnerType,
    ExternalIssueProvider,
    ProjectMemberRole,
    RunItemStatus,
    TestCaseStatus,
    TestRunStatus,
)
from app.modules.integrations.jira.schemas.integration import ExternalIssueLinkRead
from app.modules.integrations.jira.repositories import links as external_links_repo
from app.modules.projects.models import User
from app.modules.projects.repositories import users as user_repo
from app.modules.test_cases.repositories import suites as suite_repo
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.repositories import datasets as test_dataset_repo
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun
from app.modules.test_runs.repositories import run_case_history as history_repo
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.modules.test_runs.repositories import runs as test_run_repo
from app.modules.test_runs.schemas.run_cases import (
    RunCaseDetailRead,
    RunCaseHistoryList,
    RunCaseHistoryRead,
    RunCasePatch,
    RunCaseRead,
    RunCaseRerunRequest,
    RunCaseRowPatch,
    RunCaseRowRead,
    RunCaseRowsList,
    RunCasesBulkCreateRequest,
    RunCasesBulkCreateResponse,
    RunCasesCreateRequest,
    RunCasesList,
)
from app.modules.audit.services import audit as audit_service
from app.repositories import common as common_repo
from app.services.access import ensure_project_role


async def _get_run_or_404(db: AsyncSession, test_run_id: str) -> TestRun:
    run = await test_run_repo.get_by_id(db, test_run_id)
    if not run:
        raise not_found("test_run")
    return run


async def _get_item_or_404(db: AsyncSession, run_case_id: str) -> RunItem:
    item = await run_item_repo.get_by_id(db, run_case_id)
    if not item:
        raise not_found("run_case")
    return item


def _ensure_run_allows_case_mutation(run: TestRun) -> None:
    if run.status in {TestRunStatus.completed, TestRunStatus.archived}:
        raise DomainError(
            status_code=409,
            code="invalid_status_transition",
            title="Conflict",
            detail="Run-case operations are unavailable for completed or archived runs.",
        )


async def snapshot_run_item_case_fields(db: AsyncSession, *, test_case_id: str) -> dict[str, object]:
    test_case = await test_case_repo.get_by_id(db, test_case_id)
    if not test_case:
        raise not_found("test_case")
    suite_name = None
    if test_case.suite_id:
        suite = await suite_repo.get_by_id(db, test_case.suite_id)
        suite_name = suite.name if suite else None
    return {
        "test_case_key_snapshot": test_case.key,
        "test_case_title_snapshot": test_case.title,
        "test_case_priority_snapshot": test_case.priority,
        "test_case_tags_snapshot": list(test_case.tags or []),
        "suite_name_snapshot": suite_name,
    }


async def _validate_run_case_ids(db: AsyncSession, *, run: TestRun, case_ids: list[str]) -> list[str]:
    requested_ids = list(dict.fromkeys(case_ids))
    if not requested_ids:
        return []

    test_cases = await test_case_repo.list_by_ids(db, requested_ids)
    test_case_ids_set = {item.id for item in test_cases}
    missing_ids = [case_id for case_id in requested_ids if case_id not in test_case_ids_set]
    if missing_ids:
        missing = ", ".join(missing_ids)
        raise DomainError(
            status_code=404,
            code="test_case_not_found",
            title="Not found",
            detail="one or more test cases not found",
            errors={"test_case_ids": [f"unknown test_case_ids: {missing}"]},
        )

    out_of_project = [item.id for item in test_cases if item.project_id != run.project_id]
    if out_of_project:
        invalid = ", ".join(out_of_project)
        raise DomainError(
            status_code=422,
            code="test_case_project_mismatch",
            title=TITLE_VALIDATION_ERROR,
            detail="test case does not belong to run project",
            errors={"test_case_ids": [f"test case does not belong to run project: {invalid}"]},
        )

    invalid_status_ids = [item.id for item in test_cases if item.status != TestCaseStatus.active]
    if invalid_status_ids:
        invalid = ", ".join(invalid_status_ids)
        raise DomainError(
            status_code=422,
            code="test_case_status_not_allowed",
            title=TITLE_VALIDATION_ERROR,
            detail="Only active test cases can be added to a run",
            errors={"test_case_ids": [f"test cases must be active: {invalid}"]},
        )
    return requested_ids


async def _dimension_entry_for_dataset_binding(
    db: AsyncSession,
    binding,
    *,
    use_latest_revisions: bool,
) -> dict | None:
    dataset = binding.dataset
    if dataset is None:
        return None
    if binding.mode == DatasetBindingMode.pin_revision and not use_latest_revisions:
        revision_number = binding.pinned_revision_number or 0
    else:
        revision_number = dataset.current_revision_number
    if revision_number <= 0:
        raise DomainError(
            status_code=422,
            code="dataset_revision_not_found",
            title=TITLE_VALIDATION_ERROR,
            detail="No dataset revision is available for a test-case binding",
            errors={"dataset_binding_id": [f"binding '{binding.id}' has no revision"]},
        )
    revision = await test_dataset_repo.get_revision_by_number(
        db,
        dataset_id=dataset.id,
        revision_number=revision_number,
    )
    if revision is None:
        raise DomainError(
            status_code=422,
            code="dataset_revision_not_found",
            title=TITLE_VALIDATION_ERROR,
            detail="Dataset revision was not found for a test-case binding",
            errors={"dataset_binding_id": [f"binding '{binding.id}' points to missing revision"]},
        )
    rows = [row for row in revision.rows if row.is_active]
    if binding.row_selection_type == DatasetRowSelectionType.subset:
        selected = set(binding.selected_row_keys or [])
        rows = [row for row in rows if row.row_key in selected]
    if not rows:
        raise DomainError(
            status_code=422,
            code="dataset_binding_empty_selection",
            title=TITLE_VALIDATION_ERROR,
            detail="Binding row selection resolved to zero rows",
            errors={"dataset_binding_id": [f"binding '{binding.id}' resolves to zero rows"]},
        )
    return {
        "binding_id": binding.id,
        "alias": binding.dataset_alias,
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "revision_number": revision.revision_number,
        "rows": rows,
    }


async def _resolve_dimensions_for_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    use_latest_revisions: bool = False,
) -> list[dict]:
    bindings = await test_dataset_repo.list_bindings_by_test_case(db, test_case_id)
    bindings.sort(key=lambda item: (item.sort_order, item.id))
    dimensions: list[dict] = []
    for binding in bindings:
        entry = await _dimension_entry_for_dataset_binding(db, binding, use_latest_revisions=use_latest_revisions)
        if entry is not None:
            dimensions.append(entry)
    return dimensions


async def _suite_name_for_enriched_run_case(db: AsyncSession, item: RunItem, test_case) -> str | None:
    suite_name = item.suite_name_snapshot
    if suite_name is not None:
        return suite_name
    if test_case and test_case.suite_id:
        suite = await suite_repo.get_by_id(db, test_case.suite_id)
        return suite.name if suite else None
    return None


async def _assignee_display_name(db: AsyncSession, assignee_id: str | None) -> str | None:
    if not assignee_id:
        return None
    user = await user_repo.get_by_id(db, assignee_id)
    return user.username if user else None


def _build_row_snapshots_from_dimensions(dimensions: list[dict]) -> list[dict]:
    if not dimensions:
        return [{"scenario_label": "Default scenario", "row_snapshot": {"datasets": []}}]
    combos = product(*[item["rows"] for item in dimensions])
    snapshots: list[dict] = []
    for combo in combos:
        dataset_parts: list[dict] = []
        labels: list[str] = []
        for idx, row in enumerate(combo):
            dim = dimensions[idx]
            label = row.scenario_label or row.row_key
            labels.append(f"{dim['alias']}:{label}")
            dataset_parts.append(
                {
                    "binding_id": dim["binding_id"],
                    "dataset_alias": dim["alias"],
                    "dataset_id": dim["dataset_id"],
                    "dataset_name": dim["dataset_name"],
                    "revision_number": dim["revision_number"],
                    "row_key": row.row_key,
                    "scenario_label": row.scenario_label,
                    "values": dict(row.values_json or {}),
                }
            )
        snapshots.append(
            {
                "scenario_label": " | ".join(labels),
                "row_snapshot": {"datasets": dataset_parts},
            }
        )
    return snapshots


async def _create_or_get_run_case(
    db: AsyncSession,
    *,
    run: TestRun,
    test_case_id: str,
    assignee_id: str | None,
    use_latest_revisions: bool = False,
) -> RunItem:
    existing = await run_item_repo.get_by_run_and_case(db, test_run_id=run.id, test_case_id=test_case_id)
    if existing:
        existing_rows = await run_item_repo.list_rows_by_run_case(
            db,
            run_case_id=existing.id,
            page=1,
            page_size=1,
        )
        if not existing_rows.items:
            dimensions = await _resolve_dimensions_for_case(
                db,
                test_case_id=test_case_id,
                use_latest_revisions=use_latest_revisions,
            )
            row_snapshots = _build_row_snapshots_from_dimensions(dimensions)
            for idx, snapshot in enumerate(row_snapshots):
                db.add(
                    RunCaseRow(
                        run_case_id=existing.id,
                        row_order=idx + 1,
                        scenario_label=snapshot["scenario_label"],
                        row_snapshot=snapshot["row_snapshot"],
                    )
                )
            await db.flush()
            await run_item_repo.recalc_run_case_aggregate(db, existing.id)
            await db.flush()
            await db.refresh(existing)
        return existing

    dimensions = await _resolve_dimensions_for_case(
        db, test_case_id=test_case_id, use_latest_revisions=use_latest_revisions
    )
    row_snapshots = _build_row_snapshots_from_dimensions(dimensions)
    run_case = RunItem(
        test_run_id=run.id,
        test_case_id=test_case_id,
        assignee_id=assignee_id or run.assignee,
        dataset_snapshot={
            "bindings": [
                {
                    "binding_id": item["binding_id"],
                    "dataset_alias": item["alias"],
                    "dataset_id": item["dataset_id"],
                    "revision_number": item["revision_number"],
                }
                for item in dimensions
            ]
        },
        **await snapshot_run_item_case_fields(db, test_case_id=test_case_id),
    )
    db.add(run_case)
    await db.flush()

    for idx, snapshot in enumerate(row_snapshots):
        db.add(
            RunCaseRow(
                run_case_id=run_case.id,
                row_order=idx + 1,
                scenario_label=snapshot["scenario_label"],
                row_snapshot=snapshot["row_snapshot"],
            )
        )
    await db.flush()
    await run_item_repo.recalc_run_case_aggregate(db, run_case.id)
    await db.flush()
    await db.refresh(run_case)
    return run_case


async def _enrich_run_case(db: AsyncSession, item: RunItem) -> RunCaseRead:
    test_case = await test_case_repo.get_by_id(db, item.test_case_id)
    test_run = await test_run_repo.get_by_id(db, item.test_run_id)
    suite_name = await _suite_name_for_enriched_run_case(db, item, test_case)
    assignee_name = await _assignee_display_name(db, item.assignee_id)
    external_issues = await external_links_repo.list_by_owner(
        db,
        provider=ExternalIssueProvider.jira,
        owner_type=ExternalIssueOwnerType.run_case,
        owner_id=item.id,
    )
    return RunCaseRead(
        id=item.id,
        test_run_id=item.test_run_id,
        test_case_id=item.test_case_id,
        test_run_name=test_run.name if test_run else None,
        test_run_status=test_run.status.value if test_run else None,
        test_run_environment_name=test_run.environment_name_snapshot if test_run else None,
        test_run_environment_revision_number=test_run.environment_revision_number if test_run else None,
        test_run_build=test_run.build if test_run else None,
        assignee_id=item.assignee_id,
        status=item.status,
        rows_total=item.rows_total,
        rows_passed=item.rows_passed,
        rows_failed=item.rows_failed,
        comment=item.comment,
        test_case_key=test_case.key if test_case else item.test_case_key_snapshot,
        test_case_title=test_case.title if test_case else item.test_case_title_snapshot,
        test_case_priority=test_case.priority if test_case else item.test_case_priority_snapshot,
        test_case_tags=list(test_case.tags) if test_case else list(item.test_case_tags_snapshot or []),
        suite_name=suite_name,
        assignee_name=assignee_name,
        external_issues=[ExternalIssueLinkRead.model_validate(link) for link in external_issues],
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def bulk_create_run_case_entries(
    db: AsyncSession,
    *,
    run: TestRun,
    entries: list[tuple[str, str | None]],
) -> list[RunItem]:
    # Compatibility helper used by plan/create-run flows and report import.
    case_ids = list(dict.fromkeys([case_id for case_id, _ in entries]))
    created_items: list[RunItem] = []
    for case_id in case_ids:
        created_items.append(
            await _create_or_get_run_case(
                db,
                run=run,
                test_case_id=case_id,
                assignee_id=run.assignee,
            )
        )
    return created_items


async def list_run_cases(
    db: AsyncSession,
    *,
    test_run_id: str | None,
    project_id: str | None,
    status_filters: list[RunItemStatus] | None,
    assignee_id: str | None,
    test_case_id: str | None,
    search: str | None,
    page: int,
    page_size: int,
    sort_by: run_item_repo.RunItemSortField,
    sort_order: common_repo.SortDirection,
    current_user: User,
) -> RunCasesList:
    if test_run_id:
        run = await _get_run_or_404(db, test_run_id)
        await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.viewer)
        result = await run_item_repo.list_by_test_run(
            db,
            test_run_id=test_run_id,
            status_filters=status_filters,
            assignee_id=assignee_id,
            test_case_id=test_case_id,
            search=search,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_direction=sort_order,
        )
    else:
        if not project_id or not test_case_id:
            raise DomainError(
                status_code=422,
                code="invalid_query",
                title=TITLE_VALIDATION_ERROR,
                detail="Provide either test_run_id, or project_id together with test_case_id",
                errors={"query": ["Invalid run-case listing filter combination"]},
            )
        await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
        case = await test_case_repo.get_by_id(db, test_case_id)
        if not case or case.project_id != project_id:
            raise not_found("test_case")
        result = await run_item_repo.list_by_project_and_test_case(
            db,
            project_id=project_id,
            test_case_id=test_case_id,
            status_filters=status_filters,
            assignee_id=assignee_id,
            search=search,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_direction=sort_order,
        )
    return RunCasesList(
        items=[await _enrich_run_case(db, item) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def create_run_case(
    db: AsyncSession,
    *,
    payload: RunCasesCreateRequest,
    current_user: User,
) -> RunCaseRead:
    run = await _get_run_or_404(db, payload.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    if run.status not in {TestRunStatus.not_started, TestRunStatus.in_progress}:
        raise DomainError(
            status_code=409,
            code="invalid_status_transition",
            title="Conflict",
            detail="Run-cases can be added only when parent TestRun is not_started or in_progress",
        )
    await _validate_run_case_ids(db, run=run, case_ids=[payload.test_case_id])
    item = await _create_or_get_run_case(
        db,
        run=run,
        test_case_id=payload.test_case_id,
        assignee_id=payload.assignee_id,
    )
    await db.flush()
    await db.refresh(item)
    return await _enrich_run_case(db, item)


async def bulk_create_run_cases(
    db: AsyncSession,
    *,
    payload: RunCasesBulkCreateRequest,
    current_user: User,
) -> RunCasesBulkCreateResponse:
    run = await _get_run_or_404(db, payload.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    if run.status not in {TestRunStatus.not_started, TestRunStatus.in_progress}:
        raise DomainError(
            status_code=409,
            code="invalid_status_transition",
            title="Conflict",
            detail="Run-cases can be added only when parent TestRun is not_started or in_progress",
        )
    if payload.test_case_ids:
        case_ids = await _validate_run_case_ids(db, run=run, case_ids=payload.test_case_ids)
    else:
        suite_ids = await suite_repo.collect_suite_ids_with_descendants(db, payload.suite_id or "")
        case_ids = await test_case_repo.list_active_ids_by_suite_ids(db, suite_ids)
        case_ids = await _validate_run_case_ids(db, run=run, case_ids=case_ids)

    items: list[RunItem] = []
    for case_id in case_ids:
        items.append(
            await _create_or_get_run_case(
                db,
                run=run,
                test_case_id=case_id,
                assignee_id=run.assignee,
            )
        )
    await db.flush()
    return RunCasesBulkCreateResponse(items=[await _enrich_run_case(db, item) for item in items])


async def get_run_case(
    db: AsyncSession,
    *,
    run_case_id: str,
    current_user: User,
    history_page: int,
    history_page_size: int,
) -> RunCaseDetailRead:
    item = await _get_item_or_404(db, run_case_id)
    run = await _get_run_or_404(db, item.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.viewer)
    base = await _enrich_run_case(db, item)
    history = await history_repo.list_by_run_case(
        db,
        run_case_id=run_case_id,
        page=history_page,
        page_size=history_page_size,
    )
    return RunCaseDetailRead(
        **base.model_dump(),
        history=RunCaseHistoryList(
            items=[RunCaseHistoryRead.model_validate(h) for h in history.items],
            page=history.page,
            page_size=history.page_size,
            has_next=history.has_next,
        ),
    )


async def patch_run_case(
    db: AsyncSession,
    *,
    run_case_id: str,
    payload: RunCasePatch,
    current_user: User,
) -> RunCaseRead:
    item = await _get_item_or_404(db, run_case_id)
    run = await _get_run_or_404(db, item.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    _ensure_run_allows_case_mutation(run)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    return await _enrich_run_case(db, item)


async def list_run_case_rows(
    db: AsyncSession,
    *,
    run_case_id: str,
    status_filters: list[RunItemStatus] | None,
    page: int,
    page_size: int,
    current_user: User,
) -> RunCaseRowsList:
    item = await _get_item_or_404(db, run_case_id)
    run = await _get_run_or_404(db, item.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.viewer)
    rows_page = await run_item_repo.list_rows_by_run_case(
        db,
        run_case_id=run_case_id,
        status_filters=status_filters,
        page=page,
        page_size=page_size,
    )
    return RunCaseRowsList(
        items=[RunCaseRowRead.model_validate(item) for item in rows_page.items],
        page=rows_page.page,
        page_size=rows_page.page_size,
        has_next=rows_page.has_next,
    )


async def patch_run_case_row(
    db: AsyncSession,
    *,
    run_case_row_id: str,
    payload: RunCaseRowPatch,
    current_user: User,
) -> RunCaseRowRead:
    row = await run_item_repo.get_row_by_id(db, run_case_row_id)
    if not row:
        raise not_found("run_case_row")
    run_case = await _get_item_or_404(db, row.run_case_id)
    run = await _get_run_or_404(db, run_case.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    _ensure_run_allows_case_mutation(run)

    before_status = run_case.status
    changes = payload.model_dump(exclude_unset=True, by_alias=False)
    status_change = changes.pop("status", None)
    executed_by = changes.pop("executed_by_id", None)
    if executed_by is not None:
        row.executed_by = executed_by
    for key, value in changes.items():
        setattr(row, key, value)
    if status_change is not None and status_change != row.status:
        row.status = status_change
        row.execution_count += 1
        row.last_executed_at = row.finished_at

    await db.flush()
    await run_item_repo.recalc_run_case_aggregate(db, run_case.id)
    if before_status != run_case.status:
        await history_repo.create(
            db,
            params=history_repo.RunCaseHistoryCreateParams(
                run_case_id=run_case.id,
                from_status=before_status.value if before_status else None,
                to_status=run_case.status.value,
                time=None,
                comment=row.comment,
                defect_ids=list(row.defect_ids or []),
                actual_result=row.actual_result,
                system_out=row.system_out,
                system_err=row.system_err,
                executed_by_id=row.executed_by,
                started_at=row.started_at,
                finished_at=row.finished_at,
                duration_ms=row.duration_ms,
                changed_by_id=current_user.id,
            ),
        )
    await db.flush()
    await db.refresh(row)
    return RunCaseRowRead.model_validate(row)


async def rerun_run_case(
    db: AsyncSession,
    *,
    run_case_id: str,
    payload: RunCaseRerunRequest,
    current_user: User,
) -> RunCaseRowsList:
    run_case = await _get_item_or_404(db, run_case_id)
    run = await _get_run_or_404(db, run_case.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    _ensure_run_allows_case_mutation(run)

    existing_rows_page = await run_item_repo.list_rows_by_run_case(
        db,
        run_case_id=run_case_id,
        page=1,
        page_size=100000,
    )
    existing_rows = list(existing_rows_page.items)
    if payload.mode == "failed":
        selected_rows = [row for row in existing_rows if row.status in {RunItemStatus.error, RunItemStatus.failure}]
    else:
        requested = set(payload.run_case_row_ids)
        selected_rows = [row for row in existing_rows if row.id in requested]
    if not selected_rows:
        return RunCaseRowsList(items=[], page=1, page_size=50, has_next=False)

    if payload.use_latest_revisions:
        dimensions = await _resolve_dimensions_for_case(
            db,
            test_case_id=run_case.test_case_id,
            use_latest_revisions=True,
        )
        snapshots = _build_row_snapshots_from_dimensions(dimensions)
        selected_labels = {row.scenario_label for row in selected_rows}
        snapshots = [item for item in snapshots if item["scenario_label"] in selected_labels]
    else:
        snapshots = [
            {"scenario_label": row.scenario_label, "row_snapshot": dict(row.row_snapshot or {}), "parent_id": row.id}
            for row in selected_rows
        ]

    max_order = max((row.row_order for row in existing_rows), default=0)
    created: list[RunCaseRow] = []
    label_to_parent = {row.scenario_label: row.id for row in selected_rows}
    for idx, snapshot in enumerate(snapshots):
        row = RunCaseRow(
            run_case_id=run_case.id,
            parent_row_id=snapshot.get("parent_id") or label_to_parent.get(snapshot["scenario_label"]),
            row_order=max_order + idx + 1,
            scenario_label=snapshot["scenario_label"],
            row_snapshot=snapshot["row_snapshot"],
            status=RunItemStatus.untested,
        )
        db.add(row)
        created.append(row)

    await db.flush()
    await run_item_repo.recalc_run_case_aggregate(db, run_case.id)
    await db.flush()
    return RunCaseRowsList(items=[RunCaseRowRead.model_validate(item) for item in created], page=1, page_size=len(created), has_next=False)


async def delete_run_case(
    db: AsyncSession,
    *,
    run_case_id: str,
    current_user: User,
) -> None:
    item = await _get_item_or_404(db, run_case_id)
    run = await _get_run_or_404(db, item.test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    _ensure_run_allows_case_mutation(run)
    before_state = audit_service.snapshot_entity(item)
    await audit_service.queue_delete_event(
        db,
        action="run_case.delete",
        resource_type="run_case",
        resource_id=item.id,
        before=before_state,
        tenant_id=run.project_id,
    )
    await db.delete(item)
