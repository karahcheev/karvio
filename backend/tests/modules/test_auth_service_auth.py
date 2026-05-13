from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.errors import DomainError
from app.modules.auth.schemas.auth import LoginRequest
from app.modules.auth.services import auth as service
from app.modules.projects.schemas.user import UserPasswordChangeRequest


def _user(**overrides):
    base = {
        "id": "u1",
        "username": "john",
        "password_hash": "hash",
        "is_enabled": True,
        "token_version": 3,
        "last_login_at": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_login_invalid_credentials() -> None:
    db = AsyncMock()
    payload = LoginRequest(username="john", password="bad")

    with (
        patch("app.modules.auth.services.auth.auth_repo.get_user_by_username", new_callable=AsyncMock, return_value=None),
        patch("app.modules.auth.services.auth.audit_service.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        with pytest.raises(DomainError) as exc:
            await service.login(db, payload)

    assert exc.value.code == "invalid_credentials"
    emit.assert_awaited_once()


@pytest.mark.asyncio
async def test_login_user_disabled() -> None:
    db = AsyncMock()
    payload = LoginRequest(username="john", password="pass")
    user = _user(is_enabled=False)

    with (
        patch("app.modules.auth.services.auth.auth_repo.get_user_by_username", new_callable=AsyncMock, return_value=user),
        patch("app.modules.auth.services.auth.verify_password", return_value=True),
        patch("app.modules.auth.services.auth.audit_service.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        with pytest.raises(DomainError) as exc:
            await service.login(db, payload)

    assert exc.value.code == "user_disabled"
    emit.assert_awaited_once()


@pytest.mark.asyncio
async def test_login_success_returns_token_and_user() -> None:
    db = AsyncMock()
    payload = LoginRequest(username="john", password="pass")
    user = _user()

    with (
        patch("app.modules.auth.services.auth.auth_repo.get_user_by_username", new_callable=AsyncMock, return_value=user),
        patch("app.modules.auth.services.auth.verify_password", return_value=True),
        patch("app.modules.auth.services.auth.audit_service.snapshot_entity", return_value={"id": "u1"}),
        patch("app.modules.auth.services.auth.audit_service.queue_update_event", new_callable=AsyncMock) as queue_update,
        patch("app.modules.auth.services.auth.create_access_token", return_value="token123"),
        patch(
            "app.modules.auth.services.auth.auth_presenters.user_to_read_with_memberships",
            new_callable=AsyncMock,
            return_value=SimpleNamespace(
                id="u1",
                username="john",
                is_enabled=True,
                role="user",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                project_memberships=[],
            ),
        ),
    ):
        result = await service.login(db, payload)

    assert result.access_token == "token123"
    assert user.last_login_at is not None
    queue_update.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_password_rejects_invalid_current_password() -> None:
    db = AsyncMock()
    current_user = _user(password_hash="hash1")
    payload = UserPasswordChangeRequest(current_password="wrong", new_password="StrongNewPass1")

    with (
        patch("app.modules.auth.services.auth.verify_password", return_value=False),
        patch("app.modules.auth.services.auth.audit_service.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        with pytest.raises(DomainError) as exc:
            await service.change_password(db, payload=payload, current_user=current_user)

    assert exc.value.code == "invalid_current_password"
    emit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_password_success_rotates_password_and_token_version() -> None:
    db = AsyncMock()
    current_user = _user(password_hash="old", token_version=10)
    payload = UserPasswordChangeRequest(current_password="old_pass", new_password="StrongNewPass1")

    with (
        patch("app.modules.auth.services.auth.verify_password", return_value=True),
        patch("app.modules.auth.services.auth.hash_password", return_value="new_hash"),
        patch("app.modules.auth.services.auth.audit_service.snapshot_entity", return_value={"id": "u1"}),
        patch("app.modules.auth.services.auth.audit_service.queue_update_event", new_callable=AsyncMock) as queue_update,
    ):
        await service.change_password(db, payload=payload, current_user=current_user)

    assert current_user.password_hash == "new_hash"
    assert current_user.token_version == 11
    queue_update.assert_awaited_once()
