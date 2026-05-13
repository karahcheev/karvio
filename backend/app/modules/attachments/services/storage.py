"""Low-level attachment helpers (storage, delete). Used by attachments."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.modules.attachments.models import Attachment
from app.models.enums import AttachmentOwnerType
from app.modules.test_cases.models import TestCase
from app.modules.attachments.repositories import attachments as attachment_repo
from app.modules.test_cases.repositories import steps as step_repo
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.attachments.adapters.storage import AttachmentStorage


async def get_test_case_or_404(db: AsyncSession, test_case_id: str) -> TestCase:
    test_case = await test_case_repo.get_by_id(db, test_case_id)
    if not test_case:
        raise not_found("test_case")
    return test_case


def ensure_storage_backend_supported(attachment: Attachment, storage: AttachmentStorage) -> None:
    driver_name = getattr(storage, "driver_name", None)
    if attachment.storage_backend != driver_name:
        raise DomainError(
            status_code=500,
            code="attachment_storage_backend_mismatch",
            title="Storage error",
            detail="Attachment is stored in a backend that is not configured for this service",
        )


async def delete_attachment(db: AsyncSession, storage: AttachmentStorage, attachment: Attachment) -> None:
    ensure_storage_backend_supported(attachment, storage)
    storage.delete(storage_key=attachment.storage_key)
    await db.delete(attachment)


async def cleanup_attachments(db: AsyncSession, storage: AttachmentStorage, attachments: Iterable[Attachment]) -> None:
    for attachment in attachments:
        await delete_attachment(db, storage, attachment)


async def cleanup_test_case_attachments(db: AsyncSession, storage: AttachmentStorage, test_case_id: str) -> None:
    """Delete all attachments related to a test case: case-level, steps, draft steps."""
    for att in await attachment_repo.list_by_owner(db, owner_type=AttachmentOwnerType.test_case, owner_id=test_case_id):
        await delete_attachment(db, storage, att)
    step_ids = await step_repo.list_ids_by_test_case(db, test_case_id)
    if step_ids:
        for att in await attachment_repo.list_by_owners(db, owner_type=AttachmentOwnerType.step, owner_ids=step_ids):
            await delete_attachment(db, storage, att)
    draft_result = await db.scalars(
        select(Attachment).where(
            Attachment.owner_type == AttachmentOwnerType.draft_step,
            Attachment.owner_id.startswith(f"{test_case_id}:"),
        )
    )
    for att in draft_result.all():
        await delete_attachment(db, storage, att)


async def list_draft_step_attachments(db: AsyncSession, test_case_id: str, draft_step_id: str) -> list[Attachment]:
    """List attachments for a draft step. owner_id = test_case_id:draft_step_id."""
    owner_id = f"{test_case_id}:{draft_step_id}"
    return await attachment_repo.list_by_owner(db, owner_type=AttachmentOwnerType.draft_step, owner_id=owner_id)


async def cleanup_step_attachments(db: AsyncSession, storage: AttachmentStorage, step_ids: Iterable[str]) -> None:
    """Delete all attachments for given step IDs."""
    step_ids = list(step_ids)
    if not step_ids:
        return
    for att in await attachment_repo.list_by_owners(db, owner_type=AttachmentOwnerType.step, owner_ids=step_ids):
        await delete_attachment(db, storage, att)
