from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import UserApiKey, UserApiKeyLogin


async def list_by_user_id(db: AsyncSession, user_id: str) -> list[UserApiKey]:
    stmt = select(UserApiKey).where(UserApiKey.user_id == user_id).order_by(UserApiKey.created_at.desc(), UserApiKey.id.desc())
    result = await db.scalars(stmt)
    return list(result.all())


async def get_by_id(db: AsyncSession, *, api_key_id: str) -> UserApiKey | None:
    return await db.scalar(select(UserApiKey).where(UserApiKey.id == api_key_id))


async def get_by_prefix(db: AsyncSession, key_prefix: str) -> UserApiKey | None:
    return await db.scalar(select(UserApiKey).where(UserApiKey.key_prefix == key_prefix))


async def list_recent_logins(db: AsyncSession, *, api_key_id: str, limit: int = 10) -> list[UserApiKeyLogin]:
    stmt = (
        select(UserApiKeyLogin)
        .where(UserApiKeyLogin.api_key_id == api_key_id)
        .order_by(UserApiKeyLogin.authenticated_at.desc(), UserApiKeyLogin.id.desc())
        .limit(limit)
    )
    result = await db.scalars(stmt)
    return list(result.all())


async def add_login_event(
    db: AsyncSession,
    *,
    api_key_id: str,
    user_id: str,
    at: datetime,
    ip: str | None,
    user_agent: str | None,
    request_path: str | None,
) -> UserApiKeyLogin:
    event = UserApiKeyLogin(
        api_key_id=api_key_id,
        user_id=user_id,
        authenticated_at=at,
        ip=ip,
        user_agent=user_agent,
        request_path=request_path,
    )
    db.add(event)
    return event


async def delete_logins(db: AsyncSession, *, api_key_id: str) -> None:
    await db.execute(delete(UserApiKeyLogin).where(UserApiKeyLogin.api_key_id == api_key_id))
