from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, TestCaseStatus, TestCaseTemplateType, TestCaseType
from app.models.enums import ExternalIssueOwnerType, ExternalIssueProvider
from app.modules.products.models import Component, Product, TestCaseComponentCoverage
from app.modules.integrations.jira.repositories import links as external_links_repo
from app.modules.integrations.jira.schemas.integration import ExternalIssueLinkRead
from app.modules.projects.models import Suite, User
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.repositories import steps as test_case_step_repo
from app.modules.test_cases.repositories import datasets as test_dataset_repo
from app.modules.test_cases.schemas.case import (
    TestCaseListQuery,
    TestCaseBulkAction,
    TestCaseBulkOperation,
    TestCaseBulkOperationResult,
    TestCaseCreate,
    TestCasePatch,
    TestCaseRead,
    TestCasesList,
)
from app.core import application_events
from app.modules.audit.services import audit as audit_service
from app.modules.audit.services.audit import AuditQueueEventParams
from app.services.access import ensure_project_role
from app.modules.attachments.adapters.storage import AttachmentStorage
from app.modules.attachments.services.storage import cleanup_test_case_attachments, get_test_case_or_404
from app.modules.projects.repositories import users as user_repo

from app.modules.test_cases.owner_resolution import resolve_create_owner_id
from app.modules.test_cases.policies import (
    ensure_create_test_case_status_allowed,
    ensure_test_case_status_change_allowed,
)
from app.modules.test_cases.presenters import (
    dataset_summary_by_case_id,
    owner_and_suite_names_for_test_case,
    serialize_test_case,
)
from app.modules.test_cases.validation import (
    TEMPLATE_PAYLOAD_KEYS,
    collect_bulk_update_field_keys,
    get_project_test_cases_or_404,
    normalize_automation_id,
    normalize_template_payload,
    require_bulk_field,
    extract_dataset_variables,
    validate_variables_against_bindings,
    validate_automation_id_unique,
    validate_suite_and_owner,
    validate_template_contract,
)


async def _external_issues_for_test_case(db: AsyncSession, *, test_case_id: str) -> list[ExternalIssueLinkRead]:
    links = await external_links_repo.list_by_owner(
        db,
        provider=ExternalIssueProvider.jira,
        owner_type=ExternalIssueOwnerType.test_case,
        owner_id=test_case_id,
    )
    return [ExternalIssueLinkRead.model_validate(item) for item in links]


async def _validate_primary_product(db: AsyncSession, *, project_id: str, primary_product_id: str | None) -> None:
    if primary_product_id is None:
        return
    product = await db.scalar(select(Product).where(Product.id == primary_product_id))
    if product is None or product.project_id != project_id:
        raise DomainError(
            status_code=422,
            code="product_project_mismatch",
            title="Validation error",
            detail="primary_product_id must belong to the same project",
            errors={"primary_product_id": ["product does not belong to project"]},
        )


async def _replace_component_coverages(
    db: AsyncSession,
    *,
    test_case: TestCase,
    coverages: list[dict[str, object]],
) -> None:
    component_ids = [str(item.get("component_id")) for item in coverages]
    if component_ids:
        rows = await db.scalars(select(Component).where(Component.id.in_(component_ids)))
        components = {component.id: component for component in rows.all()}
        for component_id in component_ids:
            component = components.get(component_id)
            if component is None or component.project_id != test_case.project_id:
                raise DomainError(
                    status_code=422,
                    code="component_project_mismatch",
                    title="Validation error",
                    detail="component coverages must reference components from the same project",
                    errors={"component_id": [f"invalid component_id: {component_id}"]},
                )

    await db.execute(
        delete(TestCaseComponentCoverage).where(TestCaseComponentCoverage.test_case_id == test_case.id)
    )

    for coverage in coverages:
        db.add(
            TestCaseComponentCoverage(
                test_case_id=test_case.id,
                component_id=str(coverage["component_id"]),
                coverage_type=coverage["coverage_type"],
                coverage_strength=coverage["coverage_strength"],
                is_mandatory_for_release=bool(coverage.get("is_mandatory_for_release", False)),
                notes=coverage.get("notes"),
            )
        )


async def _available_columns_by_alias(db: AsyncSession, test_case_id: str) -> dict[str, set[str]]:
    bindings = await test_dataset_repo.list_bindings_by_test_case(db, test_case_id)
    result: dict[str, set[str]] = {}
    for binding in bindings:
        if binding.mode.value == "pin_revision" and binding.pinned_revision_number is not None:
            revision_number = binding.pinned_revision_number
        else:
            revision_number = binding.dataset.current_revision_number if binding.dataset else 0
        if not binding.dataset_id or revision_number <= 0:
            continue
        revision = await test_dataset_repo.get_revision_by_number(
            db,
            dataset_id=binding.dataset_id,
            revision_number=revision_number,
        )
        if revision is None:
            continue
        result[binding.dataset_alias] = {column.column_key for column in revision.columns}
    return result


async def _collect_case_variables(db: AsyncSession, *, template_payload: dict[str, object], test_case_id: str | None) -> set[str]:
    variables: set[str] = set()
    for key in TEMPLATE_PAYLOAD_KEYS:
        value = template_payload.get(key)
        if isinstance(value, str):
            variables.update(extract_dataset_variables(value))
    if test_case_id:
        steps = await test_case_step_repo.list_by_test_case(db, test_case_id)
        for step in steps:
            variables.update(extract_dataset_variables(step.action))
            variables.update(extract_dataset_variables(step.expected_result))
    return variables


async def list_test_cases(
    db: AsyncSession,
    *,
    project_id: str,
    current_user: User,
    query: TestCaseListQuery,
) -> TestCasesList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await test_case_repo.list_by_project(
        db,
        project_id=project_id,
        page=query.page,
        page_size=query.page_size,
        search=query.search,
        status_filters=query.status,
        priority_filters=query.priority,
        suite_ids=query.suite_id,
        tags=query.tag,
        owner_id=query.owner_id,
        product_ids=query.product_id,
        component_ids=query.component_id,
        minimum_component_risk_level=query.minimum_component_risk_level,
        exclude_test_case_ids=query.exclude_test_case_id or [],
        sort_by=query.sort_by,
        sort_direction=query.sort_order,
    )
    owner_ids = list({item.owner_id for item in result.items if item.owner_id})
    suite_ids_for_names = list({item.suite_id for item in result.items if item.suite_id})
    summaries = await dataset_summary_by_case_id(db, [item.id for item in result.items])
    owners_by_id = {user.id: user for user in await user_repo.list_by_ids(db, owner_ids)}
    suite_name_by_id: dict[str, str] = {}
    if suite_ids_for_names:
        result_suites = await db.scalars(select(Suite).where(Suite.id.in_(suite_ids_for_names)))
        suites = list(result_suites.all())
        suite_name_by_id = {suite.id: suite.name for suite in suites}
    return TestCasesList(
        items=[
            serialize_test_case(
                item,
                owner_name=owners_by_id.get(item.owner_id).username
                if item.owner_id and owners_by_id.get(item.owner_id)
                else None,
                suite_name=suite_name_by_id.get(item.suite_id) if item.suite_id else None,
                dataset_summary={
                    **summaries.get(item.id, {"dataset_bindings": []}),
                },
            )
            for item in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def create_test_case(db: AsyncSession, *, payload: TestCaseCreate, current_user: User) -> TestCaseRead:
    membership = await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    data = payload.model_dump(exclude_unset=False)
    data["owner_id"] = resolve_create_owner_id(
        owner_id_was_set_on_payload="owner_id" in payload.model_fields_set,
        owner_id=payload.owner_id,
        current_user=current_user,
    )
    await validate_suite_and_owner(db, payload.project_id, payload.suite_id, data["owner_id"])
    await _validate_primary_product(db, project_id=payload.project_id, primary_product_id=data.get("primary_product_id"))
    data["automation_id"] = normalize_automation_id(data.get("automation_id"))
    template_payload = normalize_template_payload(data)
    template_type = data.get("template_type", TestCaseTemplateType.steps)
    if template_type == TestCaseTemplateType.automated and data.get("test_case_type") is None:
        data["test_case_type"] = TestCaseType.automated
    elif data.get("test_case_type") is None:
        data.pop("test_case_type", None)
    validate_template_contract(
        template_type=template_type,
        preconditions=data.get("preconditions"),
        automation_id=data.get("automation_id"),
        test_case_type=data.get("test_case_type"),
        template_payload=template_payload,
    )
    create_variables = await _collect_case_variables(db, template_payload=template_payload, test_case_id=None)
    validate_variables_against_bindings(variables=create_variables, available_columns_by_alias={})
    await validate_automation_id_unique(db, project_id=payload.project_id, automation_id=data.get("automation_id"))
    desired_status = data.pop("status", None) or TestCaseStatus.draft
    component_coverages_payload = data.pop("component_coverages", [])
    ensure_create_test_case_status_allowed(
        desired_status,
        membership.role if membership is not None else None,
    )
    test_case = TestCase(
        **data,
        template_payload=template_payload,
        key=f"TC-{uuid.uuid4().hex[:6].upper()}",
        status=desired_status,
    )
    db.add(test_case)
    await application_events.publish(db, application_events.TestCaseCreated(entity=test_case))
    await db.flush()
    await _replace_component_coverages(db, test_case=test_case, coverages=component_coverages_payload)
    await db.refresh(test_case)
    reloaded = await test_case_repo.get_by_id(db, test_case.id)
    entity = reloaded or test_case
    owner_name, suite_name = await owner_and_suite_names_for_test_case(db, test_case)
    return serialize_test_case(
        entity,
        owner_name=owner_name,
        suite_name=suite_name,
        dataset_summary={"dataset_bindings": []},
    )


async def get_test_case(db: AsyncSession, *, test_case_id: str, current_user: User) -> TestCaseRead:
    test_case = await get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    summary = (await dataset_summary_by_case_id(db, [test_case.id])).get(
        test_case.id, {"dataset_bindings": []}
    )
    owner_name, suite_name = await owner_and_suite_names_for_test_case(db, test_case)
    external_issues = await _external_issues_for_test_case(db, test_case_id=test_case.id)
    return serialize_test_case(
        test_case,
        owner_name=owner_name,
        suite_name=suite_name,
        dataset_summary=summary,
        external_issues=external_issues,
    )


async def _resolve_test_case_patch_membership(
    db: AsyncSession,
    *,
    current_user: User,
    test_case: TestCase,
    changes: dict,
    status_change: TestCaseStatus | None,
):
    membership = None
    if changes:
        membership = await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.tester)
    elif status_change is not None:
        membership = await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    else:
        await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    return membership


def _merge_patch_template_payload(
    test_case: TestCase,
    changes: dict,
    payload: TestCasePatch,
) -> tuple[dict, TestCaseTemplateType, str | None, str | None, TestCaseType | None]:
    template_type = changes.get("template_type", test_case.template_type)
    base_payload = dict(test_case.template_payload or {})
    payload_updates = normalize_template_payload(changes)
    payload_cleared = any(key in payload.model_fields_set and changes.get(key) is None for key in TEMPLATE_PAYLOAD_KEYS)
    if payload_cleared:
        for key in TEMPLATE_PAYLOAD_KEYS:
            if key in payload.model_fields_set and changes.get(key) is None:
                base_payload.pop(key, None)
    if template_type == TestCaseTemplateType.automated:
        payload_updates.pop("setup", None)
        payload_updates.pop("assertions", None)
        payload_updates.pop("teardown", None)
        payload_updates.pop("steps_text", None)
        base_payload.pop("setup", None)
        base_payload.pop("assertions", None)
        base_payload.pop("teardown", None)
        base_payload.pop("steps_text", None)
    merged_payload = {**base_payload, **payload_updates}
    effective_preconditions = changes.get("preconditions", test_case.preconditions)
    effective_automation_id = changes.get("automation_id", test_case.automation_id)
    effective_case_type = changes.get("test_case_type", test_case.test_case_type)
    if template_type == TestCaseTemplateType.automated and "test_case_type" not in changes:
        effective_case_type = TestCaseType.automated
        changes["test_case_type"] = TestCaseType.automated
    return merged_payload, template_type, effective_preconditions, effective_automation_id, effective_case_type


async def patch_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    payload: TestCasePatch,
    current_user: User,
) -> TestCaseRead:
    test_case = await get_test_case_or_404(db, test_case_id)
    before_state = application_events.snapshot_entity(test_case)

    changes = payload.model_dump(exclude_unset=True)
    status_change = changes.pop("status", None) if "status" in payload.model_fields_set else None
    membership = await _resolve_test_case_patch_membership(
        db,
        current_user=current_user,
        test_case=test_case,
        changes=changes,
        status_change=status_change,
    )

    await validate_suite_and_owner(
        db,
        test_case.project_id,
        changes.get("suite_id", test_case.suite_id),
        changes.get("owner_id", test_case.owner_id),
    )
    if "primary_product_id" in changes:
        await _validate_primary_product(
            db,
            project_id=test_case.project_id,
            primary_product_id=changes.get("primary_product_id"),
        )
    if "automation_id" in changes:
        changes["automation_id"] = normalize_automation_id(changes["automation_id"])
    merged_payload, template_type, effective_preconditions, effective_automation_id, effective_case_type = (
        _merge_patch_template_payload(test_case, changes, payload)
    )
    validate_template_contract(
        template_type=template_type,
        preconditions=effective_preconditions,
        automation_id=effective_automation_id,
        test_case_type=effective_case_type,
        template_payload=merged_payload,
    )
    available_columns = await _available_columns_by_alias(db, test_case.id)
    patch_variables = await _collect_case_variables(db, template_payload=merged_payload, test_case_id=test_case.id)
    validate_variables_against_bindings(variables=patch_variables, available_columns_by_alias=available_columns)
    await validate_automation_id_unique(
        db,
        project_id=test_case.project_id,
        automation_id=changes.get("automation_id", test_case.automation_id),
        exclude_test_case_id=test_case.id,
    )
    changes["template_payload"] = merged_payload
    component_coverages_payload = changes.pop("component_coverages", None)
    for key, value in changes.items():
        setattr(test_case, key, value)
    if status_change is not None:
        membership_role = membership.role if membership is not None else None
        ensure_test_case_status_change_allowed(test_case, status_change, membership_role)
        test_case.status = status_change

    await application_events.publish(
        db,
        application_events.TestCaseUpdated(entity=test_case, before_state=before_state),
    )
    if component_coverages_payload is not None:
        await _replace_component_coverages(db, test_case=test_case, coverages=component_coverages_payload)
    await db.flush()
    await db.refresh(test_case)
    reloaded = await test_case_repo.get_by_id(db, test_case.id)
    entity = reloaded or test_case
    summary = (await dataset_summary_by_case_id(db, [test_case.id])).get(
        test_case.id, {"dataset_bindings": []}
    )
    owner_name, suite_name = await owner_and_suite_names_for_test_case(db, test_case)
    external_issues = await _external_issues_for_test_case(db, test_case_id=test_case.id)
    return serialize_test_case(
        entity,
        owner_name=owner_name,
        suite_name=suite_name,
        dataset_summary=summary,
        external_issues=external_issues,
    )


async def delete_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    storage: AttachmentStorage,
    current_user: User,
) -> None:
    test_case = await get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.lead)
    before_state = application_events.snapshot_entity(test_case)
    await cleanup_test_case_attachments(db, storage, test_case_id)
    await application_events.publish(
        db,
        application_events.TestCaseDeleted(
            resource_id=test_case.id,
            before_state=before_state,
            tenant_id=test_case.project_id,
        ),
    )
    await db.delete(test_case)


async def _resolve_bulk_operation_membership(
    db: AsyncSession,
    payload: TestCaseBulkOperation,
    current_user: User,
):
    membership = None
    if payload.action == TestCaseBulkAction.delete:
        await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    elif payload.action == TestCaseBulkAction.set_status:
        membership = await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.viewer)
    elif payload.action == TestCaseBulkAction.update:
        update_keys = collect_bulk_update_field_keys(payload)
        if not update_keys:
            raise DomainError(
                status_code=422,
                code="validation_error",
                title="Validation error",
                detail="At least one of suite_id, status, owner_id, tag, or priority must be set for action 'update'.",
                errors={
                    "suite_id": ["provide at least one field to update"],
                    "status": ["provide at least one field to update"],
                    "owner_id": ["provide at least one field to update"],
                    "tag": ["provide at least one field to update"],
                    "priority": ["provide at least one field to update"],
                },
            )
        if update_keys == frozenset({"status"}):
            membership = await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.viewer)
        else:
            membership = await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    else:
        await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    return membership


async def _bulk_delete_cases(
    db: AsyncSession,
    payload: TestCaseBulkOperation,
    storage: AttachmentStorage,
    test_cases: list[TestCase],
    before_states: list,
) -> TestCaseBulkOperationResult:
    await audit_service.queue_event(
        db,
        params=AuditQueueEventParams(
            action="test_case.bulk_delete",
            resource_type="test_case",
            resource_id=payload.project_id,
            result="success",
            before=before_states,
            after=None,
            metadata={"action": payload.action.value, "affected_count": len(test_cases)},
            tenant_id=payload.project_id,
        ),
    )
    for test_case in test_cases:
        await cleanup_test_case_attachments(db, storage, test_case.id)
        await db.delete(test_case)
    return TestCaseBulkOperationResult(affected_count=len(test_cases))


def _apply_bulk_update_fields_to_case(
    test_case: TestCase,
    payload: TestCaseBulkOperation,
    *,
    normalized_tag: str | None,
    membership_role,
) -> None:
    if "suite_id" in payload.model_fields_set:
        test_case.suite_id = payload.suite_id
    if "owner_id" in payload.model_fields_set:
        test_case.owner_id = payload.owner_id
    if "status" in payload.model_fields_set:
        ensure_test_case_status_change_allowed(test_case, payload.status, membership_role)
        test_case.status = payload.status
    if "priority" in payload.model_fields_set:
        test_case.priority = payload.priority
    if normalized_tag is None:
        return
    current_tags = list(test_case.tags or [])
    if normalized_tag not in current_tags:
        test_case.tags = [*current_tags, normalized_tag]


async def _bulk_update_cases(
    db: AsyncSession,
    payload: TestCaseBulkOperation,
    test_cases: list[TestCase],
    before_states: list,
    membership,
) -> TestCaseBulkOperationResult:
    update_keys = collect_bulk_update_field_keys(payload)
    membership_role = membership.role if membership is not None else None
    if "suite_id" in payload.model_fields_set:
        await validate_suite_and_owner(db, payload.project_id, payload.suite_id, None)
    if "owner_id" in payload.model_fields_set:
        await validate_suite_and_owner(db, payload.project_id, None, payload.owner_id)
    normalized_tag = payload.tag.strip() if "tag" in payload.model_fields_set and payload.tag else None
    for test_case in test_cases:
        _apply_bulk_update_fields_to_case(
            test_case,
            payload,
            normalized_tag=normalized_tag,
            membership_role=membership_role,
        )
    await audit_service.queue_event(
        db,
        params=AuditQueueEventParams(
            action="test_case.bulk_update",
            resource_type="test_case",
            resource_id=payload.project_id,
            result="success",
            before=before_states,
            after=[application_events.snapshot_entity(test_case) for test_case in test_cases],
            metadata={
                "action": payload.action.value,
                "affected_count": len(test_cases),
                "fields": sorted(update_keys),
            },
            tenant_id=payload.project_id,
        ),
    )
    return TestCaseBulkOperationResult(affected_count=len(test_cases))


async def _bulk_apply_move(
    db: AsyncSession,
    payload: TestCaseBulkOperation,
    test_cases: list[TestCase],
) -> None:
    require_bulk_field(payload, "suite_id", payload.action)
    await validate_suite_and_owner(db, payload.project_id, payload.suite_id, None)
    for test_case in test_cases:
        test_case.suite_id = payload.suite_id


def _bulk_apply_set_status(payload: TestCaseBulkOperation, test_cases: list[TestCase], membership) -> None:
    if payload.status is None:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="status is required for action 'set_status'",
            errors={"status": ["status is required for action 'set_status'"]},
        )
    membership_role = membership.role if membership is not None else None
    for test_case in test_cases:
        ensure_test_case_status_change_allowed(test_case, payload.status, membership_role)
        test_case.status = payload.status


async def _bulk_apply_set_owner(db: AsyncSession, payload: TestCaseBulkOperation, test_cases: list[TestCase]) -> None:
    require_bulk_field(payload, "owner_id", payload.action)
    await validate_suite_and_owner(db, payload.project_id, None, payload.owner_id)
    for test_case in test_cases:
        test_case.owner_id = payload.owner_id


def _bulk_apply_add_tag(payload: TestCaseBulkOperation, test_cases: list[TestCase]) -> None:
    if payload.tag is None or not payload.tag.strip():
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="tag is required for action 'add_tag'",
            errors={"tag": ["tag is required for action 'add_tag'"]},
        )
    normalized_tag = payload.tag.strip()
    for test_case in test_cases:
        current_tags = list(test_case.tags or [])
        if normalized_tag in current_tags:
            continue
        test_case.tags = [*current_tags, normalized_tag]


def _bulk_apply_set_priority(payload: TestCaseBulkOperation, test_cases: list[TestCase]) -> None:
    if payload.priority is None:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="priority is required for action 'set_priority'",
            errors={"priority": ["priority is required for action 'set_priority'"]},
        )
    for test_case in test_cases:
        test_case.priority = payload.priority


async def _apply_bulk_simple_actions(
    db: AsyncSession,
    payload: TestCaseBulkOperation,
    test_cases: list[TestCase],
    membership,
) -> None:
    if payload.action == TestCaseBulkAction.move:
        await _bulk_apply_move(db, payload, test_cases)
    elif payload.action == TestCaseBulkAction.set_status:
        _bulk_apply_set_status(payload, test_cases, membership)
    elif payload.action == TestCaseBulkAction.set_owner:
        await _bulk_apply_set_owner(db, payload, test_cases)
    elif payload.action == TestCaseBulkAction.add_tag:
        _bulk_apply_add_tag(payload, test_cases)
    elif payload.action == TestCaseBulkAction.set_priority:
        _bulk_apply_set_priority(payload, test_cases)


async def bulk_operate_test_cases(
    db: AsyncSession,
    *,
    payload: TestCaseBulkOperation,
    storage: AttachmentStorage,
    current_user: User,
) -> TestCaseBulkOperationResult:
    membership = await _resolve_bulk_operation_membership(db, payload, current_user)
    test_cases = await get_project_test_cases_or_404(db, payload.project_id, payload.test_case_ids)
    before_states = [application_events.snapshot_entity(test_case) for test_case in test_cases]

    if payload.action == TestCaseBulkAction.delete:
        return await _bulk_delete_cases(db, payload, storage, test_cases, before_states)

    if payload.action == TestCaseBulkAction.update:
        return await _bulk_update_cases(db, payload, test_cases, before_states, membership)

    await _apply_bulk_simple_actions(db, payload, test_cases, membership)

    await audit_service.queue_event(
        db,
        params=AuditQueueEventParams(
            action="test_case.bulk_update",
            resource_type="test_case",
            resource_id=payload.project_id,
            result="success",
            before=before_states,
            after=[application_events.snapshot_entity(test_case) for test_case in test_cases],
            metadata={"action": payload.action.value, "affected_count": len(test_cases)},
            tenant_id=payload.project_id,
        ),
    )
    return TestCaseBulkOperationResult(affected_count=len(test_cases))
