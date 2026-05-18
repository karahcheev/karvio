from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from starlette.requests import Request

from app.api.dependencies.auth import get_current_user
from app.core.errors import DomainError
from app.modules.projects.models import User


def _make_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/test",
            "headers": [],
            "query_string": b"",
        }
    )


@pytest.mark.asyncio
async def test_get_current_user_uses_request_state_cache() -> None:
    db = AsyncMock()
    request = _make_request()
    cached_user = User(id="u_cached", username="cached", password_hash="hash")
    request.state.current_user = cached_user

    with patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock) as api_key_auth:
        user = await get_current_user(request, credentials=None, db=db)

    assert user is cached_user
    assert request.state.auth_user_id == cached_user.id
    api_key_auth.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_current_user_memoizes_bearer_user_for_same_request() -> None:
    db = AsyncMock()
    request = _make_request()
    resolved_user = User(id="u1", username="john", password_hash="hash", token_version=0, is_enabled=True)

    with (
        patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=None) as api_key_auth,
        patch("app.api.dependencies.auth.get_token_from_request", return_value="token"),
        patch("app.api.dependencies.auth.decode_access_token", return_value={"sub": "u1", "ver": 0}) as decode_token,
        patch("app.api.dependencies.auth.user_repo.get_by_id", new_callable=AsyncMock, return_value=resolved_user) as get_user,
        patch("app.api.dependencies.auth.bind_user_audit_context"),
    ):
        first = await get_current_user(request, credentials=None, db=db)
        second = await get_current_user(request, credentials=None, db=db)

    assert first is resolved_user
    assert second is resolved_user
    assert request.state.current_user is resolved_user
    get_user.assert_awaited_once_with(db, "u1")
    decode_token.assert_called_once_with("token")
    api_key_auth.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_current_user_rejects_disabled_token_user() -> None:
    db = AsyncMock()
    request = _make_request()
    disabled_user = User(id="u1", username="john", password_hash="hash", token_version=0, is_enabled=False)

    with (
        patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=None),
        patch("app.api.dependencies.auth.get_token_from_request", return_value="token"),
        patch("app.api.dependencies.auth.decode_access_token", return_value={"sub": "u1", "ver": 0}),
        patch("app.api.dependencies.auth.user_repo.get_by_id", new_callable=AsyncMock, return_value=disabled_user),
        patch("app.api.dependencies.auth.try_emit_event_immediately", new_callable=AsyncMock),
    ):
        with pytest.raises(DomainError) as exc:
            await get_current_user(request, credentials=None, db=db)

    assert exc.value.status_code == 401
    assert exc.value.code == "invalid_token_user_disabled"


@pytest.mark.asyncio
async def test_get_current_user_rejects_revoked_token_version() -> None:
    db = AsyncMock()
    request = _make_request()
    user = User(id="u1", username="john", password_hash="hash", token_version=2, is_enabled=True)

    with (
        patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=None),
        patch("app.api.dependencies.auth.get_token_from_request", return_value="token"),
        patch("app.api.dependencies.auth.decode_access_token", return_value={"sub": "u1", "ver": 1}),
        patch("app.api.dependencies.auth.user_repo.get_by_id", new_callable=AsyncMock, return_value=user),
        patch("app.api.dependencies.auth.try_emit_event_immediately", new_callable=AsyncMock),
    ):
        with pytest.raises(DomainError) as exc:
            await get_current_user(request, credentials=None, db=db)

    assert exc.value.status_code == 401
    assert exc.value.code == "token_revoked"


@pytest.mark.asyncio
async def test_get_current_user_raises_unauthorized_when_no_token() -> None:
    db = AsyncMock()
    request = _make_request()

    with (
        patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=None),
        patch("app.api.dependencies.auth.get_token_from_request", return_value=None),
        patch("app.api.dependencies.auth.try_emit_event_immediately", new_callable=AsyncMock),
    ):
        with pytest.raises(DomainError) as exc:
            await get_current_user(request, credentials=None, db=db)

    assert exc.value.status_code == 401
    assert exc.value.code == "unauthorized"


@pytest.mark.asyncio
async def test_get_current_user_raises_invalid_token_when_expired_or_tampered() -> None:
    db = AsyncMock()
    request = _make_request()

    with (
        patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=None),
        patch("app.api.dependencies.auth.get_token_from_request", return_value="expired.token"),
        patch("app.api.dependencies.auth.decode_access_token", return_value=None),
        patch("app.api.dependencies.auth.try_emit_event_immediately", new_callable=AsyncMock),
    ):
        with pytest.raises(DomainError) as exc:
            await get_current_user(request, credentials=None, db=db)

    assert exc.value.status_code == 401
    assert exc.value.code == "invalid_token"


@pytest.mark.asyncio
async def test_get_current_user_raises_when_token_user_deleted() -> None:
    """User was deleted after their token was issued — repo returns None."""
    db = AsyncMock()
    request = _make_request()

    with (
        patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=None),
        patch("app.api.dependencies.auth.get_token_from_request", return_value="valid.token"),
        patch("app.api.dependencies.auth.decode_access_token", return_value={"sub": "ghost_user", "ver": 0}),
        patch("app.api.dependencies.auth.user_repo.get_by_id", new_callable=AsyncMock, return_value=None),
        patch("app.api.dependencies.auth.try_emit_event_immediately", new_callable=AsyncMock),
    ):
        with pytest.raises(DomainError) as exc:
            await get_current_user(request, credentials=None, db=db)

    assert exc.value.status_code == 401
    assert exc.value.code == "invalid_token_user"


@pytest.mark.asyncio
async def test_get_current_user_succeeds_with_api_key() -> None:
    """API key auth path returns the user without touching JWT logic."""
    db = AsyncMock()
    request = _make_request()
    api_key_user = User(id="ak_user", username="api_user", password_hash="hash", is_enabled=True, token_version=0)

    with patch("app.api.dependencies.auth.try_authenticate_with_api_key", new_callable=AsyncMock, return_value=api_key_user):
        user = await get_current_user(request, credentials=None, db=db)

    assert user is api_key_user
    assert request.state.current_user is api_key_user
