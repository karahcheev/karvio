from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import UserExternalIdentity


async def get_by_provider_subject(
    db: AsyncSession, *, provider_id: str, subject: str
) -> UserExternalIdentity | None:
    result = await db.execute(
        select(UserExternalIdentity).where(
            UserExternalIdentity.provider_id == provider_id,
            UserExternalIdentity.subject == subject,
        )
    )
    return result.scalars().first()


async def list_for_user(db: AsyncSession, user_id: str) -> list[UserExternalIdentity]:
    result = await db.execute(
        select(UserExternalIdentity).where(UserExternalIdentity.user_id == user_id)
    )
    return list(result.scalars().all())
