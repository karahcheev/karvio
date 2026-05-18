from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Suite, User
from app.modules.test_cases.repositories import suites as suite_repo
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.schemas.suite import SuiteCreate, SuitePatch, SuiteRead, SuitesList
from app.services.access import ensure_admin, ensure_project_role
from app.modules.audit.services import audit as audit_service
from app.modules.attachments.adapters.storage import AttachmentStorage
from app.modules.attachments.services.storage import cleanup_test_case_attachments

MAX_SUITE_DEPTH = 4


async def _suite_to_read(db: AsyncSession, suite: Suite) -> SuiteRead:
    counts = await test_case_repo.count_listable_by_suite_ids(db, [suite.id])
    active_counts = await test_case_repo.count_active_by_suite_ids(db, [suite.id])
    base = SuiteRead.model_validate(suite)
    return base.model_copy(
        update={
            "test_cases_count": counts.get(suite.id, 0),
            "active_test_cases_count": active_counts.get(suite.id, 0),
        }
    )


async def _get_suite_or_404(db: AsyncSession, suite_id: str) -> Suite:
    suite = await suite_repo.get_by_id(db, suite_id)
    if not suite:
        raise not_found("suite")
    return suite


async def _get_suite_depth(db: AsyncSession, suite: Suite) -> int:
    depth = 1
    current_parent_id = suite.parent_id
    while current_parent_id is not None:
        parent = await suite_repo.get_by_id(db, current_parent_id)
        if not parent:
            break
        depth += 1
        current_parent_id = parent.parent_id
    return depth


async def _validate_suite_parent(db: AsyncSession, project_id: str, suite_id: str | None, parent_id: str | None) -> None:
    if parent_id is None:
        return

    parent = await suite_repo.get_by_id(db, parent_id)
    if not parent:
        raise not_found("suite")
    if parent.project_id != project_id:
        raise DomainError(
            status_code=422,
            code="suite_project_mismatch",
            title=TITLE_VALIDATION_ERROR,
            detail="parent suite does not belong to project",
            errors={"parent_id": ["parent suite does not belong to project"]},
        )
    if suite_id is not None and parent.id == suite_id:
        raise DomainError(
            status_code=422,
            code="suite_parent_invalid",
            title=TITLE_VALIDATION_ERROR,
            detail="suite cannot be its own parent",
            errors={"parent_id": ["suite cannot be its own parent"]},
        )

    visited = {parent.id}
    current = parent
    while current.parent_id is not None:
        current = await suite_repo.get_by_id(db, current.parent_id)
        if not current:
            break
        if suite_id is not None and current.id == suite_id:
            raise DomainError(
                status_code=422,
                code="suite_parent_cycle",
                title=TITLE_VALIDATION_ERROR,
                detail="suite parent cannot create a cycle",
                errors={"parent_id": ["suite parent cannot create a cycle"]},
            )
        if current.id in visited:
            break
        visited.add(current.id)

    if await _get_suite_depth(db, parent) >= MAX_SUITE_DEPTH:
        raise DomainError(
            status_code=422,
            code="suite_depth_limit_exceeded",
            title=TITLE_VALIDATION_ERROR,
            detail=f"suite nesting is limited to {MAX_SUITE_DEPTH} levels",
            errors={"parent_id": [f"suite nesting is limited to {MAX_SUITE_DEPTH} levels"]},
        )


async def list_suites(
    db: AsyncSession,
    *,
    project_id: str,
    parent_id: str | None,
    search: str | None,
    page: int,
    page_size: int,
    current_user: User,
) -> SuitesList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await suite_repo.list_by_project(
        db,
        project_id=project_id,
        parent_id=parent_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    suite_ids = [s.id for s in result.items]
    counts = await test_case_repo.count_listable_by_suite_ids(db, suite_ids)
    active_counts = await test_case_repo.count_active_by_suite_ids(db, suite_ids)
    items = [
        SuiteRead.model_validate(s).model_copy(
            update={
                "test_cases_count": counts.get(s.id, 0),
                "active_test_cases_count": active_counts.get(s.id, 0),
            }
        )
        for s in result.items
    ]
    return SuitesList(
        items=items,
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def create_suite(db: AsyncSession, *, payload: SuiteCreate, current_user: User) -> SuiteRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    await _validate_suite_parent(db, payload.project_id, None, payload.parent_id)
    suite = Suite(**payload.model_dump())
    db.add(suite)
    await audit_service.queue_create_event(
        db,
        action="suite.create",
        resource_type="suite",
        entity=suite,
        tenant_id=payload.project_id,
    )
    await db.flush()
    await db.refresh(suite)
    return await _suite_to_read(db, suite)


async def get_suite(db: AsyncSession, *, suite_id: str, current_user: User) -> SuiteRead:
    suite = await _get_suite_or_404(db, suite_id)
    await ensure_project_role(db, current_user, suite.project_id, ProjectMemberRole.viewer)
    return await _suite_to_read(db, suite)


async def patch_suite(
    db: AsyncSession,
    *,
    suite_id: str,
    payload: SuitePatch,
    current_user: User,
) -> SuiteRead:
    suite = await _get_suite_or_404(db, suite_id)
    await ensure_project_role(db, current_user, suite.project_id, ProjectMemberRole.tester)
    before_state = audit_service.snapshot_entity(suite)
    changes = payload.model_dump(exclude_unset=True)
    await _validate_suite_parent(
        db,
        suite.project_id,
        suite.id,
        changes.get("parent_id", suite.parent_id),
    )
    for key, value in changes.items():
        setattr(suite, key, value)
    await audit_service.queue_update_event(
        db,
        action="suite.update",
        resource_type="suite",
        entity=suite,
        before=before_state,
        tenant_id=suite.project_id,
    )
    await db.flush()
    await db.refresh(suite)
    return await _suite_to_read(db, suite)


async def _get_suite_ids_to_delete_order(db: AsyncSession, suite_id: str) -> list[str]:
    """Return suite and all descendant IDs in delete order (children before parents)."""
    result = []
    for child_id in await suite_repo.list_ids_by_parent(db, suite_id):
        result.extend(await _get_suite_ids_to_delete_order(db, child_id))
    result.append(suite_id)
    return result


async def delete_suite(
    db: AsyncSession,
    *,
    suite_id: str,
    storage: AttachmentStorage,
    current_user: User,
) -> None:
    suite = await _get_suite_or_404(db, suite_id)
    await ensure_admin(current_user, action="delete suite")

    suite_ids_to_delete = await _get_suite_ids_to_delete_order(db, suite_id)
    test_cases_to_delete = await test_case_repo.list_by_ids(
        db,
        await test_case_repo.list_ids_by_suite(db, suite.id),
    )
    for nested_suite_id in suite_ids_to_delete[:-1]:
        test_cases_to_delete.extend(
            await test_case_repo.list_by_ids(db, await test_case_repo.list_ids_by_suite(db, nested_suite_id))
        )

    for test_case in test_cases_to_delete:
        before_state = audit_service.snapshot_entity(test_case)
        await cleanup_test_case_attachments(db, storage, test_case.id)
        await audit_service.queue_delete_event(
            db,
            action="test_case.delete",
            resource_type="test_case",
            resource_id=test_case.id,
            before=before_state,
            tenant_id=test_case.project_id,
        )
        await db.delete(test_case)

    for sid in suite_ids_to_delete:
        suite_to_delete = await suite_repo.get_by_id(db, sid)
        if suite_to_delete:
            before_state = audit_service.snapshot_entity(suite_to_delete)
            await audit_service.queue_delete_event(
                db,
                action="suite.delete",
                resource_type="suite",
                resource_id=suite_to_delete.id,
                before=before_state,
                tenant_id=suite_to_delete.project_id,
            )
            await db.delete(suite_to_delete)
