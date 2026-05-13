from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.models.enums import UserRole
from app.services.bootstrap import ADMIN_USERNAME, DEFAULT_PROJECT_NAME, ensure_default_data


async def test_ensure_default_data_creates_project_and_admin_when_missing() -> None:
    db = MagicMock()
    db.commit = AsyncMock()
    settings = MagicMock(admin_password="AdminPass123")

    with (
        patch("app.services.bootstrap.get_settings", return_value=settings),
        patch("app.services.bootstrap.hash_password", return_value="hashed_password") as hash_password,
        patch("app.services.bootstrap.project_repo.get_by_name", new_callable=AsyncMock, return_value=None),
        patch("app.services.bootstrap.user_repo.get_by_username", new_callable=AsyncMock, return_value=None),
    ):
        await ensure_default_data(db)

    assert db.add.call_count == 2
    project = db.add.call_args_list[0].args[0]
    admin = db.add.call_args_list[1].args[0]
    assert project.name == DEFAULT_PROJECT_NAME
    assert admin.username == ADMIN_USERNAME
    assert admin.password_hash == "hashed_password"
    assert admin.role == UserRole.admin
    hash_password.assert_called_once_with("AdminPass123")
    db.commit.assert_awaited_once()


async def test_ensure_default_data_only_commits_when_entities_already_exist() -> None:
    db = MagicMock()
    db.commit = AsyncMock()
    settings = MagicMock(admin_password="AdminPass123")

    with (
        patch("app.services.bootstrap.get_settings", return_value=settings),
        patch("app.services.bootstrap.hash_password") as hash_password,
        patch("app.services.bootstrap.project_repo.get_by_name", new_callable=AsyncMock, return_value=object()),
        patch("app.services.bootstrap.user_repo.get_by_username", new_callable=AsyncMock, return_value=object()),
    ):
        await ensure_default_data(db)

    db.add.assert_not_called()
    hash_password.assert_not_called()
    db.commit.assert_awaited_once()
