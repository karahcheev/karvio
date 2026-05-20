from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AuthProviderType
from app.modules.auth.models import AuthProvider


async def list_all(db: AsyncSession) -> list[AuthProvider]:
    result = await db.execute(
        select(AuthProvider).order_by(AuthProvider.sort_order.asc(), AuthProvider.created_at.asc())
    )
    return list(result.scalars().all())


async def list_enabled(db: AsyncSession) -> list[AuthProvider]:
    result = await db.execute(
        select(AuthProvider)
        .where(AuthProvider.enabled.is_(True))
        .order_by(AuthProvider.sort_order.asc(), AuthProvider.created_at.asc())
    )
    return list(result.scalars().all())


async def get(db: AsyncSession, provider_id: str) -> AuthProvider | None:
    return await db.get(AuthProvider, provider_id)


async def get_local(db: AsyncSession) -> AuthProvider | None:
    result = await db.execute(
        select(AuthProvider).where(AuthProvider.type == AuthProviderType.local)
    )
    return result.scalars().first()


async def count_enabled(db: AsyncSession) -> int:
    result = await db.execute(
        select(AuthProvider.id).where(AuthProvider.enabled.is_(True))
    )
    return len(result.scalars().all())
