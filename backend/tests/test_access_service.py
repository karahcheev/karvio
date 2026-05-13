from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, UserRole
from app.services.access import ensure_admin, ensure_project_role


@pytest.mark.asyncio
async def test_ensure_admin_allows_admin_user_without_audit_event() -> None:
    user = SimpleNamespace(id="u_admin", role=UserRole.admin)

    with patch("app.services.access.try_emit_event_immediately", new_callable=AsyncMock) as emit:
        await ensure_admin(user, action="rotate_keys")

    emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_admin_rejects_non_admin_and_emits_audit_event() -> None:
    user = SimpleNamespace(id="u_user", role=UserRole.user)

    with patch("app.services.access.try_emit_event_immediately", new_callable=AsyncMock) as emit:
        with pytest.raises(DomainError) as exc:
            await ensure_admin(user, action="rotate_keys")

    assert exc.value.code == "admin_required"
    emit.assert_awaited_once()
    kwargs = emit.await_args.kwargs
    assert kwargs["action"] == "admin.access"
    assert kwargs["actor_id"] == "u_user"
    assert kwargs["metadata"]["operation"] == "rotate_keys"


@pytest.mark.asyncio
async def test_ensure_project_role_raises_not_found_when_project_missing() -> None:
    db = AsyncMock()

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=False),
        patch("app.services.access.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        with pytest.raises(DomainError) as exc:
            await ensure_project_role(db, "u1", "p1", ProjectMemberRole.viewer)

    assert exc.value.code == "project_not_found"
    emit.assert_awaited_once()
    assert emit.await_args.kwargs["metadata"]["reason"] == "project_not_found"


@pytest.mark.asyncio
async def test_ensure_project_role_returns_none_for_admin_user() -> None:
    db = AsyncMock()
    admin = SimpleNamespace(role=UserRole.admin)

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=True),
        patch("app.services.access.user_repo.get_by_id", new_callable=AsyncMock, return_value=admin),
        patch("app.services.access.project_member_repo.get_membership", new_callable=AsyncMock) as get_membership,
    ):
        membership = await ensure_project_role(db, "u1", "p1", ProjectMemberRole.manager)

    assert membership is None
    get_membership.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_project_role_raises_when_user_has_no_membership() -> None:
    db = AsyncMock()

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=True),
        patch("app.services.access.user_repo.get_by_id", new_callable=AsyncMock, return_value=None),
        patch("app.services.access.project_member_repo.get_membership", new_callable=AsyncMock, return_value=None),
        patch("app.services.access.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        with pytest.raises(DomainError) as exc:
            await ensure_project_role(db, "u1", "p1", ProjectMemberRole.tester)

    assert exc.value.code == "project_access_denied"
    emit.assert_awaited_once()
    assert emit.await_args.kwargs["metadata"]["reason"] == "project_access_denied"


@pytest.mark.asyncio
async def test_ensure_project_role_raises_for_insufficient_role() -> None:
    db = AsyncMock()
    membership = SimpleNamespace(role=ProjectMemberRole.viewer)

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=True),
        patch("app.services.access.user_repo.get_by_id", new_callable=AsyncMock, return_value=None),
        patch("app.services.access.project_member_repo.get_membership", new_callable=AsyncMock, return_value=membership),
        patch("app.services.access.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        with pytest.raises(DomainError) as exc:
            await ensure_project_role(db, "u1", "p1", ProjectMemberRole.lead)

    assert exc.value.code == "insufficient_project_role"
    emit.assert_awaited_once()
    assert emit.await_args.kwargs["metadata"]["actual_role"] == ProjectMemberRole.viewer.value


@pytest.mark.asyncio
async def test_ensure_project_role_returns_membership_for_sufficient_role() -> None:
    db = AsyncMock()
    membership = SimpleNamespace(role=ProjectMemberRole.manager)

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=True),
        patch("app.services.access.user_repo.get_by_id", new_callable=AsyncMock, return_value=None),
        patch("app.services.access.project_member_repo.get_membership", new_callable=AsyncMock, return_value=membership),
        patch("app.services.access.try_emit_event_immediately", new_callable=AsyncMock) as emit,
    ):
        out = await ensure_project_role(db, "u1", "p1", ProjectMemberRole.lead)

    assert out is membership
    emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_project_role_uses_loaded_user_without_refetching_user() -> None:
    db = AsyncMock()
    current_user = SimpleNamespace(id="u1", role=UserRole.user)
    membership = SimpleNamespace(role=ProjectMemberRole.manager)

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=True),
        patch("app.services.access.user_repo.get_by_id", new_callable=AsyncMock) as get_user,
        patch("app.services.access.project_member_repo.get_membership", new_callable=AsyncMock, return_value=membership),
    ):
        out = await ensure_project_role(db, current_user, "p1", ProjectMemberRole.lead)

    assert out is membership
    get_user.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_project_role_allows_admin_user_object_without_membership_lookup() -> None:
    db = AsyncMock()
    current_user = SimpleNamespace(id="u_admin", role=UserRole.admin)

    with (
        patch("app.services.access.project_repo.exists", new_callable=AsyncMock, return_value=True),
        patch("app.services.access.user_repo.get_by_id", new_callable=AsyncMock) as get_user,
        patch("app.services.access.project_member_repo.get_membership", new_callable=AsyncMock) as get_membership,
    ):
        out = await ensure_project_role(db, current_user, "p1", ProjectMemberRole.manager)

    assert out is None
    get_user.assert_not_awaited()
    get_membership.assert_not_awaited()
