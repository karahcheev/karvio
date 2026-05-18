from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.errors import DomainError
from app.modules.auth.schemas.api_keys import UserApiKeyCreateRequest, UserApiKeyPatchRequest
from app.modules.auth.services import api_keys as service


def _make_api_key(**overrides):
    now = datetime.now(timezone.utc)
    base = {
        "id": "ak_1",
        "user_id": "u1",
        "name": "Main",
        "description": "desc",
        "key_prefix": "tms2ak_abc",
        "key_hint": "7890",
        "key_hash": "sha256:hash",
        "created_at": now,
        "rotated_at": None,
        "last_used_at": None,
        "last_used_ip": None,
        "last_used_user_agent": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _make_db():
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


def test_normalize_required_text_rejects_empty() -> None:
    with pytest.raises(DomainError) as exc:
        service._normalize_required_text("   ", field_name="name")
    assert exc.value.code == "invalid_name"


def test_normalize_text_trims_or_returns_none() -> None:
    assert service._normalize_text("  hello  ") == "hello"
    assert service._normalize_text("   ") is None
    assert service._normalize_text(None) is None


@pytest.mark.asyncio
async def test_create_my_api_key_creates_and_returns_secret() -> None:
    db = _make_db()
    current_user = SimpleNamespace(id="u1")
    payload = UserApiKeyCreateRequest(name="  CI Key  ", description="  automation  ")
    login = SimpleNamespace(
        authenticated_at=datetime.now(timezone.utc),
        ip="127.0.0.1",
        user_agent="ua",
        request_path="/api/v1/auth/api-keys",
    )
    created_at = datetime.now(timezone.utc)

    async def _refresh(obj) -> None:
        obj.id = "ak_created"
        obj.created_at = created_at

    with (
        patch(
            "app.modules.auth.services.api_keys.create_api_key",
            return_value=("raw_secret", "tms2ak_pref", "1234", "sha256:newhash"),
        ),
        patch("app.modules.auth.services.api_keys.audit_service.queue_create_event", new_callable=AsyncMock) as queue_create,
        patch("app.modules.auth.services.api_keys.user_api_key_repo.list_recent_logins", new_callable=AsyncMock, return_value=[login]),
    ):
        db.refresh.side_effect = _refresh
        result = await service.create_my_api_key(db, current_user=current_user, payload=payload)

    assert result.api_key == "raw_secret"
    assert result.key.id == "ak_created"
    assert result.key.name == "CI Key"
    assert result.key.description == "automation"
    queue_create.assert_awaited_once()
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_my_api_keys_maps_recent_logins() -> None:
    db = _make_db()
    current_user = SimpleNamespace(id="u1")
    api_key = _make_api_key()
    login = SimpleNamespace(
        authenticated_at=datetime.now(timezone.utc),
        ip="127.0.0.1",
        user_agent="ua",
        request_path="/path",
    )

    with (
        patch("app.modules.auth.services.api_keys.user_api_key_repo.list_by_user_id", new_callable=AsyncMock, return_value=[api_key]),
        patch("app.modules.auth.services.api_keys.user_api_key_repo.list_recent_logins", new_callable=AsyncMock, return_value=[login]),
    ):
        result = await service.list_my_api_keys(db, current_user=current_user)

    assert len(result.items) == 1
    assert result.items[0].id == api_key.id
    assert result.items[0].recent_logins[0].ip == "127.0.0.1"


@pytest.mark.asyncio
async def test_patch_my_api_key_updates_trimmed_fields() -> None:
    db = _make_db()
    current_user = SimpleNamespace(id="u1")
    api_key = _make_api_key(name="Old", description="Old desc")
    payload = UserApiKeyPatchRequest(name="  New Name  ", description="  ")

    with (
        patch("app.modules.auth.services.api_keys.user_api_key_repo.get_by_id", new_callable=AsyncMock, return_value=api_key),
        patch("app.modules.auth.services.api_keys.audit_service.snapshot_entity", return_value={"id": api_key.id}),
        patch("app.modules.auth.services.api_keys.audit_service.queue_update_event", new_callable=AsyncMock) as queue_update,
        patch("app.modules.auth.services.api_keys.user_api_key_repo.list_recent_logins", new_callable=AsyncMock, return_value=[]),
    ):
        result = await service.patch_my_api_key(
            db, current_user=current_user, api_key_id=api_key.id, payload=payload
        )

    assert result.name == "New Name"
    assert result.description is None
    queue_update.assert_awaited_once()
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once_with(api_key)


@pytest.mark.asyncio
async def test_patch_my_api_key_404_when_not_owned() -> None:
    db = _make_db()
    current_user = SimpleNamespace(id="u1")
    foreign_key = _make_api_key(user_id="u2")

    with patch("app.modules.auth.services.api_keys.user_api_key_repo.get_by_id", new_callable=AsyncMock, return_value=foreign_key):
        with pytest.raises(DomainError) as exc:
            await service.patch_my_api_key(
                db,
                current_user=current_user,
                api_key_id=foreign_key.id,
                payload=UserApiKeyPatchRequest(name="x"),
            )
    assert exc.value.code == "user_api_key_not_found"


@pytest.mark.asyncio
async def test_regenerate_my_api_key_rotates_secret_and_clears_last_used() -> None:
    db = _make_db()
    current_user = SimpleNamespace(id="u1")
    api_key = _make_api_key(last_used_at=datetime.now(timezone.utc), last_used_ip="1.2.3.4", last_used_user_agent="ua")

    with (
        patch("app.modules.auth.services.api_keys.user_api_key_repo.get_by_id", new_callable=AsyncMock, return_value=api_key),
        patch(
            "app.modules.auth.services.api_keys.create_api_key",
            return_value=("raw_rotated", "tms2ak_new", "4321", "sha256:new"),
        ),
        patch("app.modules.auth.services.api_keys.user_api_key_repo.delete_logins", new_callable=AsyncMock) as delete_logins,
        patch("app.modules.auth.services.api_keys.audit_service.snapshot_entity", return_value={"id": api_key.id}),
        patch("app.modules.auth.services.api_keys.audit_service.queue_update_event", new_callable=AsyncMock) as queue_update,
        patch("app.modules.auth.services.api_keys.user_api_key_repo.list_recent_logins", new_callable=AsyncMock, return_value=[]),
    ):
        result = await service.regenerate_my_api_key(db, current_user=current_user, api_key_id=api_key.id)

    assert result.api_key == "raw_rotated"
    assert api_key.key_prefix == "tms2ak_new"
    assert api_key.key_hint == "4321"
    assert api_key.last_used_at is None
    assert api_key.last_used_ip is None
    assert api_key.last_used_user_agent is None
    assert api_key.rotated_at is not None
    delete_logins.assert_awaited_once_with(db, api_key_id=api_key.id)
    queue_update.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_my_api_key_emits_audit_and_deletes() -> None:
    db = _make_db()
    current_user = SimpleNamespace(id="u1")
    api_key = _make_api_key()

    with (
        patch("app.modules.auth.services.api_keys.user_api_key_repo.get_by_id", new_callable=AsyncMock, return_value=api_key),
        patch("app.modules.auth.services.api_keys.audit_service.snapshot_entity", return_value={"id": api_key.id}),
        patch("app.modules.auth.services.api_keys.audit_service.queue_delete_event", new_callable=AsyncMock) as queue_delete,
    ):
        await service.delete_my_api_key(db, current_user=current_user, api_key_id=api_key.id)

    queue_delete.assert_awaited_once()
    db.delete.assert_awaited_once_with(api_key)


@pytest.mark.asyncio
async def test_register_api_key_login_updates_last_used_and_persists_event() -> None:
    db = _make_db()
    api_key = _make_api_key(last_used_at=None, last_used_ip=None, last_used_user_agent=None)

    with patch("app.modules.auth.services.api_keys.user_api_key_repo.add_login_event", new_callable=AsyncMock) as add_login_event:
        await service.register_api_key_login(
            db,
            api_key=api_key,
            ip="10.0.0.2",
            user_agent="pytest",
            request_path="/api/v1/x",
        )

    assert api_key.last_used_at is not None
    assert api_key.last_used_ip == "10.0.0.2"
    assert api_key.last_used_user_agent == "pytest"
    add_login_event.assert_awaited_once()
