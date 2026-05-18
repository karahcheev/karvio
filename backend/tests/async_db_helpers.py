"""Helpers for reading AsyncSession state after httpx AsyncClient ASGI calls."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


async def session_get(session: AsyncSession, entity: type, ident: object):
    def _get(sync_sess):
        return sync_sess.get(entity, ident)

    return await session.run_sync(_get)


async def session_scalar(session: AsyncSession, stmt):
    def _scalar(sync_sess):
        return sync_sess.scalar(stmt)

    return await session.run_sync(_scalar)
