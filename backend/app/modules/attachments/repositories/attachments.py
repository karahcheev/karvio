from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attachments.models import Attachment
from app.models.enums import AttachmentOwnerType


async def get_by_id(db: AsyncSession, attachment_id: str) -> Attachment | None:
    return await db.scalar(select(Attachment).where(Attachment.id == attachment_id))


async def get_by_owner(
    db: AsyncSession, *, owner_type: AttachmentOwnerType, owner_id: str, attachment_id: str
) -> Attachment | None:
    return await db.scalar(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.owner_type == owner_type,
            Attachment.owner_id == owner_id,
        )
    )


async def list_by_owner(db: AsyncSession, *, owner_type: AttachmentOwnerType, owner_id: str) -> list[Attachment]:
    result = await db.scalars(
        select(Attachment)
        .where(
            Attachment.owner_type == owner_type,
            Attachment.owner_id == owner_id,
        )
        .order_by(Attachment.created_at.desc())
    )
    return list(result.all())


async def list_by_owners(
    db: AsyncSession, *, owner_type: AttachmentOwnerType, owner_ids: Iterable[str]
) -> list[Attachment]:
    owner_ids = list(owner_ids)
    if not owner_ids:
        return []
    result = await db.scalars(
        select(Attachment)
        .where(
            Attachment.owner_type == owner_type,
            Attachment.owner_id.in_(owner_ids),
        )
    )
    return list(result.all())
