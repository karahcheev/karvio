"""Regression guards on the FastAPI lifespan.

These tests exist to catch wiring regressions like "forgot to open the queue app",
which silently break background-job enqueueing in production while leaving every
in-memory test green.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.core.queue import queue_app
from app.main import app, lifespan


class _NullSessionContext:
    """Stub for ``AsyncSessionLocal()`` so the lifespan can run without a DB."""

    async def __aenter__(self):
        session = MagicMock()
        session.commit = AsyncMock()
        return session

    async def __aexit__(self, exc_type, exc, tb):
        return False


async def test_lifespan_opens_and_closes_queue_app() -> None:
    """The lifespan must open the procrastinate App so request handlers can defer jobs.

    Without this, ``defer_async`` raises ``AppNotOpen``; the after-commit callback
    swallows the exception and audit/notification/performance queues never drain.
    """
    open_cm = MagicMock()
    open_cm.__aenter__ = AsyncMock(return_value=queue_app)
    open_cm.__aexit__ = AsyncMock(return_value=None)

    with (
        patch.object(queue_app, "open_async", return_value=open_cm) as open_async,
        patch("app.main.AsyncSessionLocal", return_value=_NullSessionContext()),
        patch("app.main.recover_pending_jobs", new=AsyncMock(return_value={})) as recover,
    ):
        async with lifespan(app):
            pass

    open_async.assert_called_once()
    open_cm.__aenter__.assert_awaited_once()
    open_cm.__aexit__.assert_awaited_once()
    recover.assert_awaited_once()
