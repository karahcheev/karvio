from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db import session as db_session


class _SessionContext:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_sync_database_url_to_async() -> None:
    assert db_session._sync_database_url_to_async("postgresql+psycopg://u:p@h/db") == "postgresql+psycopg_async://u:p@h/db"
    assert db_session._sync_database_url_to_async("postgresql://u:p@h/db") == "postgresql+psycopg_async://u:p@h/db"


@pytest.mark.asyncio
async def test_after_commit_callbacks_run_sync_and_async_and_swallow_errors() -> None:
    session = MagicMock()
    session.info = {}
    sync_called = {"value": 0}
    async_called = {"value": 0}

    def sync_cb():
        sync_called["value"] += 1

    async def async_cb():
        async_called["value"] += 1

    def failing_cb():
        raise RuntimeError("boom")

    db_session.register_after_commit_callback(session, sync_cb)
    db_session.register_after_commit_callback(session, async_cb)
    db_session.register_after_commit_callback(session, failing_cb)

    with patch("app.db.session.logger.exception") as log_exception:
        await db_session.run_after_commit_callbacks(session)

    assert sync_called["value"] == 1
    assert async_called["value"] == 1
    assert session.info.get("after_commit_callbacks") is None
    log_exception.assert_called_once()


@pytest.mark.asyncio
async def test_get_db_commits_and_runs_callbacks_on_success() -> None:
    session = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.info = {}

    with patch("app.db.session.AsyncSessionLocal", return_value=_SessionContext(session)):
        gen = db_session.get_db()
        yielded = await gen.__anext__()
        assert yielded is session
        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()

    session.commit.assert_awaited_once()
    session.rollback.assert_not_called()


@pytest.mark.asyncio
async def test_get_db_rolls_back_and_clears_callbacks_on_error() -> None:
    session = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.info = {"after_commit_callbacks": [lambda: None]}

    with patch("app.db.session.AsyncSessionLocal", return_value=_SessionContext(session)):
        gen = db_session.get_db()
        await gen.__anext__()
        with pytest.raises(RuntimeError, match="fail"):
            await gen.athrow(RuntimeError("fail"))

    session.rollback.assert_awaited_once()
    assert "after_commit_callbacks" not in session.info
