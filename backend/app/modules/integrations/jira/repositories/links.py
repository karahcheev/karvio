from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExternalIssueOwnerType, ExternalIssueProvider
from app.modules.integrations.jira.models import ExternalIssueLink


async def get_by_id(db: AsyncSession, link_id: str) -> ExternalIssueLink | None:
    return await db.scalar(select(ExternalIssueLink).where(ExternalIssueLink.id == link_id))


async def list_by_owner(
    db: AsyncSession,
    *,
    provider: ExternalIssueProvider,
    owner_type: ExternalIssueOwnerType,
    owner_id: str,
) -> list[ExternalIssueLink]:
    result = await db.scalars(
        select(ExternalIssueLink)
        .where(
            ExternalIssueLink.provider == provider,
            ExternalIssueLink.owner_type == owner_type,
            ExternalIssueLink.owner_id == owner_id,
        )
        .order_by(ExternalIssueLink.created_at.desc())
    )
    return list(result.all())


async def find_by_owner_and_external_key(
    db: AsyncSession,
    *,
    provider: ExternalIssueProvider,
    owner_type: ExternalIssueOwnerType,
    owner_id: str,
    external_key: str,
) -> ExternalIssueLink | None:
    return await db.scalar(
        select(ExternalIssueLink).where(
            ExternalIssueLink.provider == provider,
            ExternalIssueLink.owner_type == owner_type,
            ExternalIssueLink.owner_id == owner_id,
            ExternalIssueLink.external_key == external_key,
        )
    )


async def find_by_idempotency_key(
    db: AsyncSession,
    *,
    provider: ExternalIssueProvider,
    owner_type: ExternalIssueOwnerType,
    owner_id: str,
    idempotency_key: str,
) -> ExternalIssueLink | None:
    return await db.scalar(
        select(ExternalIssueLink).where(
            ExternalIssueLink.provider == provider,
            ExternalIssueLink.owner_type == owner_type,
            ExternalIssueLink.owner_id == owner_id,
            ExternalIssueLink.creation_idempotency_key == idempotency_key,
        )
    )


async def list_by_project(
    db: AsyncSession,
    *,
    provider: ExternalIssueProvider,
    project_id: str,
) -> list[ExternalIssueLink]:
    result = await db.scalars(
        select(ExternalIssueLink)
        .where(
            ExternalIssueLink.provider == provider,
            ExternalIssueLink.project_id == project_id,
        )
        .order_by(ExternalIssueLink.updated_at.desc())
    )
    return list(result.all())


async def list_for_sync(
    db: AsyncSession,
    *,
    provider: ExternalIssueProvider,
    project_id: str | None = None,
) -> list[ExternalIssueLink]:
    conditions = [ExternalIssueLink.provider == provider]
    if project_id:
        conditions.append(ExternalIssueLink.project_id == project_id)
    conditions.append(
        or_(
            ExternalIssueLink.is_invalid.is_(False),
            and_(ExternalIssueLink.is_invalid.is_(True), ExternalIssueLink.invalid_reason.is_(None)),
        )
    )
    result = await db.scalars(
        select(ExternalIssueLink).where(*conditions).order_by(ExternalIssueLink.updated_at.asc())
    )
    return list(result.all())
