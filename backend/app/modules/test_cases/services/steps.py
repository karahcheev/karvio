from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import AttachmentOwnerType, ProjectMemberRole, TestCaseTemplateType
from app.modules.projects.models import User
from app.modules.test_cases.models import TestCaseStep
from app.modules.attachments.repositories import attachments as attachment_repo
from app.modules.test_cases.repositories import steps as step_repo
from app.modules.test_cases.repositories import datasets as test_dataset_repo
from app.modules.attachments.schemas.attachment import AttachmentRead
from app.modules.test_cases.schemas.steps import TestStepsReplaceRequest, TestStepsResponse
from app.modules.audit.services import audit as audit_service
from app.modules.audit.services.audit import AuditQueueEventParams
from app.services.access import ensure_project_role
from app.modules.attachments.services.storage import (
    cleanup_step_attachments,
    get_test_case_or_404,
    list_draft_step_attachments,
)
from app.modules.attachments.adapters.storage import AttachmentStorage
from app.modules.attachments.services.attachments import attachment_to_read
from app.modules.test_cases.validation import extract_dataset_variables, validate_variables_against_bindings


def _ensure_steps_template(test_case_id: str, template_type: TestCaseTemplateType) -> None:
    if template_type == TestCaseTemplateType.steps:
        return
    raise DomainError(
        status_code=409,
        code="invalid_template_operation",
        title="Conflict",
        detail=f"structured steps are only available for template '{TestCaseTemplateType.steps.value}'",
        errors={"template_type": ["structured steps are only available for template 'steps'"]},
    )


async def _load_step_attachments(db: AsyncSession, step_ids: list[str]) -> dict[str, list[AttachmentRead]]:
    if not step_ids:
        return {}
    attachments = await attachment_repo.list_by_owners(db, owner_type=AttachmentOwnerType.step, owner_ids=step_ids)
    grouped: dict[str, list[AttachmentRead]] = defaultdict(list)
    for att in attachments:
        grouped[att.owner_id].append(attachment_to_read(att))
    return dict(grouped)


async def _available_columns_by_alias_for_test_case(
    db: AsyncSession,
    test_case_id: str,
) -> dict[str, set[str]]:
    available_columns_by_alias: dict[str, set[str]] = {}
    bindings = await test_dataset_repo.list_bindings_by_test_case(db, test_case_id)
    for binding in bindings:
        if binding.mode.value == "pin_revision" and binding.pinned_revision_number is not None:
            revision_number = binding.pinned_revision_number
        else:
            revision_number = binding.dataset.current_revision_number if binding.dataset else 0
        if revision_number <= 0:
            continue
        revision = await test_dataset_repo.get_revision_by_number(
            db,
            dataset_id=binding.dataset_id,
            revision_number=revision_number,
        )
        if revision is None:
            continue
        available_columns_by_alias[binding.dataset_alias] = {item.column_key for item in revision.columns}
    return available_columns_by_alias


def _used_variables_from_created_steps(created_steps: list[tuple[TestCaseStep, str | None]]) -> set[str]:
    used_variables: set[str] = set()
    for created_step, _ in created_steps:
        used_variables.update(extract_dataset_variables(created_step.action))
        used_variables.update(extract_dataset_variables(created_step.expected_result))
    return used_variables


async def get_steps(db: AsyncSession, *, test_case_id: str, current_user: User) -> TestStepsResponse:
    test_case = await get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    _ensure_steps_template(test_case.id, test_case.template_type)
    steps = await step_repo.list_by_test_case(db, test_case_id)
    step_ids = [s.id for s in steps]
    step_attachments = await _load_step_attachments(db, step_ids)
    return TestStepsResponse(
        test_case_id=test_case_id,
        steps=steps,
        step_attachments=step_attachments,
    )


async def replace_steps(
    db: AsyncSession,
    *,
    test_case_id: str,
    payload: TestStepsReplaceRequest,
    storage: AttachmentStorage,
    current_user: User,
) -> TestStepsResponse:
    test_case = await get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.tester)
    _ensure_steps_template(test_case.id, test_case.template_type)

    existing_steps = await step_repo.list_by_test_case(db, test_case_id)
    before_states = [audit_service.snapshot_entity(step) for step in existing_steps]
    existing_step_ids = await step_repo.list_ids_by_test_case(db, test_case_id)
    await cleanup_step_attachments(db, storage, existing_step_ids)
    await step_repo.delete_by_test_case(db, test_case_id)

    created_steps: list[tuple[TestCaseStep, str | None]] = []
    for step in payload.steps:
        created = TestCaseStep(
            test_case_id=test_case_id,
            position=step.position,
            action=step.action,
            expected_result=step.expected_result,
        )
        db.add(created)
        created_steps.append((created, step.client_id))
    await db.flush()

    for created_step, client_id in created_steps:
        if not client_id:
            continue
        draft_attachments = await list_draft_step_attachments(db, test_case_id, client_id)
        for attachment in draft_attachments:
            attachment.owner_type = AttachmentOwnerType.step
            attachment.owner_id = created_step.id

    await audit_service.queue_event(
        db,
        params=AuditQueueEventParams(
            action="test_case.steps.replace",
            resource_type="test_case_step",
            resource_id=test_case_id,
            result="success",
            before=before_states,
            after=[audit_service.snapshot_entity(created_step) for created_step, _ in created_steps],
            metadata={"step_count": len(created_steps)},
            tenant_id=test_case.project_id,
        ),
    )
    available_columns_by_alias = await _available_columns_by_alias_for_test_case(db, test_case_id)
    used_variables = _used_variables_from_created_steps(created_steps)
    validate_variables_against_bindings(
        variables=used_variables,
        available_columns_by_alias=available_columns_by_alias,
    )
    steps = await step_repo.list_by_test_case(db, test_case_id)
    step_ids = [s.id for s in steps]
    step_attachments = await _load_step_attachments(db, step_ids)
    return TestStepsResponse(
        test_case_id=test_case_id,
        steps=steps,
        step_attachments=step_attachments,
    )
