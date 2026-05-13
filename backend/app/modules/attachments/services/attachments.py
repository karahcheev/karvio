"""Unified attachments service with polymorphic owner support."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.modules.attachments.models import Attachment
from app.models.enums import AttachmentOwnerType, ProjectMemberRole
from app.modules.projects.models import User
from app.modules.attachments.repositories import attachments as attachment_repo
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.modules.test_cases.repositories import steps as step_repo
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.attachments.schemas.attachment import (
    AttachmentListResponse,
    AttachmentRead,
    AttachmentTargetDraftStep,
    AttachmentTargetRunCase,
    AttachmentTargetStep,
    AttachmentTargetTestCase,
)
from app.modules.audit.services import audit as audit_service
from app.services.access import ensure_project_role
from app.modules.attachments.adapters.storage import AttachmentDownload, AttachmentStorage, AttachmentUpload

# Max size in bytes per owner type
ATTACHMENT_MAX_BYTES: dict[AttachmentOwnerType, int] = {
    AttachmentOwnerType.test_case: 50 * 1024 * 1024,  # 50 MB
    AttachmentOwnerType.step: 10 * 1024 * 1024,  # 10 MB
    AttachmentOwnerType.draft_step: 10 * 1024 * 1024,  # 10 MB
    AttachmentOwnerType.run_case: 10 * 1024 * 1024,  # 10 MB
}


async def _project_id_for_test_case_owner(db: AsyncSession, owner_id: str) -> str:
    tc = await test_case_repo.get_by_id(db, owner_id)
    if not tc:
        raise not_found("test_case")
    return tc.project_id


async def _project_id_for_step_owner(db: AsyncSession, owner_id: str) -> str:
    step = await step_repo.get_by_step_id(db, owner_id)
    if not step:
        raise not_found("test_case_step")
    tc = await test_case_repo.get_by_id(db, step.test_case_id)
    if not tc:
        raise not_found("test_case")
    return tc.project_id


async def _project_id_for_draft_step_owner(db: AsyncSession, owner_id: str) -> str:
    if ":" not in owner_id:
        raise not_found("draft_step")
    test_case_id = owner_id.split(":", 1)[0]
    tc = await test_case_repo.get_by_id(db, test_case_id)
    if not tc:
        raise not_found("test_case")
    return tc.project_id


async def _project_id_for_run_case_owner(db: AsyncSession, owner_id: str) -> str:
    project_id = await run_item_repo.get_project_id_for_run_item(db, owner_id)
    if not project_id:
        raise not_found("run_case")
    return project_id


async def _get_project_id_for_owner(db: AsyncSession, owner_type: AttachmentOwnerType, owner_id: str) -> str:
    """Resolve project_id from owner. Raises if owner not found."""
    if owner_type == AttachmentOwnerType.test_case:
        return await _project_id_for_test_case_owner(db, owner_id)
    if owner_type == AttachmentOwnerType.step:
        return await _project_id_for_step_owner(db, owner_id)
    if owner_type == AttachmentOwnerType.draft_step:
        return await _project_id_for_draft_step_owner(db, owner_id)
    if owner_type == AttachmentOwnerType.run_case:
        return await _project_id_for_run_case_owner(db, owner_id)
    raise not_found("attachment_owner")


def _get_storage_entity_type(owner_type: AttachmentOwnerType) -> str:
    """Map owner_type to storage path prefix."""
    return {
        AttachmentOwnerType.test_case: "test-cases",
        AttachmentOwnerType.step: "test-case-steps",
        AttachmentOwnerType.draft_step: "test-case-step-drafts",
        AttachmentOwnerType.run_case: "run-cases",
    }[owner_type]


def _get_storage_entity_id(owner_type: AttachmentOwnerType, owner_id: str) -> str:
    """Map owner to storage entity_id (path segment). Matches existing storage layout."""
    if owner_type == AttachmentOwnerType.draft_step:
        return owner_id.replace(":", "-", 1)
    return owner_id


def _owner_type_from_str(s: str) -> AttachmentOwnerType:
    return AttachmentOwnerType(s)


def attachment_to_read(attachment: Attachment) -> AttachmentRead:
    """Build AttachmentRead with public target from internal owner_type/owner_id."""
    ot = attachment.owner_type
    oid = attachment.owner_id
    if ot == AttachmentOwnerType.test_case:
        target = AttachmentTargetTestCase(test_case_id=oid)
    elif ot == AttachmentOwnerType.step:
        target = AttachmentTargetStep(step_id=oid)
    elif ot == AttachmentOwnerType.run_case:
        target = AttachmentTargetRunCase(run_case_id=oid)
    elif ot == AttachmentOwnerType.draft_step:
        tc_id, draft_id = oid.split(":", 1)
        target = AttachmentTargetDraftStep(test_case_id=tc_id, draft_step_client_id=draft_id)
    else:
        raise ValueError(f"Unknown owner_type: {ot}")
    return AttachmentRead(
        id=attachment.id,
        filename=attachment.filename,
        content_type=attachment.content_type,
        size=attachment.size,
        checksum_sha256=attachment.checksum_sha256,
        created_at=attachment.created_at,
        target=target,
    )


async def get_attachment_or_404(db: AsyncSession, attachment_id: str) -> Attachment:
    attachment = await attachment_repo.get_by_id(db, attachment_id)
    if not attachment:
        raise not_found("attachment")
    return attachment


def ensure_storage_backend_supported(attachment: Attachment, storage: AttachmentStorage) -> None:
    from app.modules.attachments.services.storage import ensure_storage_backend_supported as _ensure

    _ensure(attachment, storage)


async def list_attachments(
    db: AsyncSession,
    *,
    owner_type: str,
    owner_id: str,
    current_user: User,
    required_role: ProjectMemberRole = ProjectMemberRole.viewer,
) -> AttachmentListResponse:
    parsed = _owner_type_from_str(owner_type)
    project_id = await _get_project_id_for_owner(db, parsed, owner_id)
    await ensure_project_role(db, current_user, project_id, required_role)
    items = await attachment_repo.list_by_owner(db, owner_type=parsed, owner_id=owner_id)
    return AttachmentListResponse(
        items=[attachment_to_read(item) for item in items]
    )


async def create_attachment(
    db: AsyncSession,
    *,
    owner_type: str,
    owner_id: str,
    file: AttachmentUpload,
    storage: AttachmentStorage,
    current_user: User,
) -> AttachmentRead:
    parsed = _owner_type_from_str(owner_type)
    project_id = await _get_project_id_for_owner(db, parsed, owner_id)
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)

    max_bytes = ATTACHMENT_MAX_BYTES[parsed]
    entity_type = _get_storage_entity_type(parsed)
    entity_id = _get_storage_entity_id(parsed, owner_id)

    stored = await storage.save(
        file,
        entity_type=entity_type,
        entity_id=entity_id,
        max_size_bytes=max_bytes,
    )

    attachment = Attachment(
        owner_type=parsed,
        owner_id=owner_id,
        filename=stored.filename,
        content_type=stored.content_type,
        size=stored.size,
        checksum_sha256=stored.checksum_sha256,
        storage_backend=stored.storage_backend,
        storage_key=stored.storage_key,
    )
    db.add(attachment)
    await audit_service.queue_create_event(
        db,
        action="attachment.create",
        resource_type="attachment",
        entity=attachment,
        tenant_id=project_id,
        metadata={"owner_type": parsed.value, "owner_id": owner_id},
    )
    await db.flush()
    await db.refresh(attachment)
    return attachment_to_read(attachment)


async def download_attachment(
    db: AsyncSession,
    *,
    attachment_id: str,
    storage: AttachmentStorage,
    current_user: User,
) -> AttachmentDownload:
    attachment = await get_attachment_or_404(db, attachment_id)
    project_id = await _get_project_id_for_owner(db, attachment.owner_type, attachment.owner_id)
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    ensure_storage_backend_supported(attachment, storage)
    return storage.open(
        storage_key=attachment.storage_key,
        filename=attachment.filename,
        content_type=attachment.content_type,
    )


async def delete_attachment(
    db: AsyncSession,
    *,
    attachment_id: str,
    storage: AttachmentStorage,
    current_user: User,
) -> None:
    attachment = await get_attachment_or_404(db, attachment_id)
    project_id = await _get_project_id_for_owner(db, attachment.owner_type, attachment.owner_id)
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)
    ensure_storage_backend_supported(attachment, storage)
    before_state = audit_service.snapshot_entity(attachment)
    await audit_service.queue_delete_event(
        db,
        action="attachment.delete",
        resource_type="attachment",
        resource_id=attachment.id,
        before=before_state,
        tenant_id=project_id,
        metadata={"owner_type": attachment.owner_type.value, "owner_id": attachment.owner_id},
    )
    from app.modules.attachments.services.storage import delete_attachment as _delete

    await _delete(db, storage, attachment)


async def cleanup_attachments_by_owners(
    db: AsyncSession,
    storage: AttachmentStorage,
    *,
    owner_type: AttachmentOwnerType,
    owner_ids: list[str],
) -> None:
    """Delete all attachments for given owners (e.g. when steps are replaced)."""
    from app.modules.attachments.services.storage import delete_attachment as _delete

    for attachment in await attachment_repo.list_by_owners(db, owner_type=owner_type, owner_ids=owner_ids):
        ensure_storage_backend_supported(attachment, storage)
        await _delete(db, storage, attachment)
