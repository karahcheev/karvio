from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models import User
from app.modules.projects.repositories import users


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    return await users.get_by_username(db, username)
