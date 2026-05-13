from collections.abc import AsyncGenerator
import inspect
import logging
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
import app.core.metrics as metrics

settings = get_settings()
logger = logging.getLogger("tms.db.session")
_AFTER_COMMIT_CALLBACKS_KEY = "after_commit_callbacks"


def _sync_database_url_to_async(url: str) -> str:
    """Derive SQLAlchemy async URL (psycopg async dialect) from the configured sync URL."""
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql+psycopg_async://", 1)
    if url.startswith("postgresql://"):
        return "postgresql+psycopg_async://" + url.removeprefix("postgresql://")
    return url


async_engine = create_async_engine(_sync_database_url_to_async(settings.database_url), future=True)
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


AfterCommitCallback = Callable[[], Any | Awaitable[Any]]


def register_after_commit_callback(session: AsyncSession, callback: AfterCommitCallback) -> None:
    callbacks = session.info.setdefault(_AFTER_COMMIT_CALLBACKS_KEY, [])
    callbacks.append(callback)


async def run_after_commit_callbacks(session: AsyncSession) -> None:
    callbacks = list(session.info.pop(_AFTER_COMMIT_CALLBACKS_KEY, []))
    for callback in callbacks:
        try:
            result = callback()
            if inspect.isawaitable(result):
                await result
        except Exception:
            logger.exception(
                "After-commit callback failed",
                extra={"event": "db.after_commit_callback_error"},
            )
            metrics.record_use_case("after_commit_callback", outcome="error")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Request-scoped session: one transaction per HTTP request (commit on success, rollback on error).

    Application services must not call ``AsyncSession.commit()``; use ``flush()`` when IDs or DB defaults
    are needed before the request ends. Standalone jobs (scripts, queue workers) open their own
    session and commit explicitly.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
            await run_after_commit_callbacks(session)
        except Exception:
            await session.rollback()
            session.info.pop(_AFTER_COMMIT_CALLBACKS_KEY, None)
            raise
