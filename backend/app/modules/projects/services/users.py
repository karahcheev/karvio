from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import TITLE_INVALID_REQUEST
from app.core.errors import not_found
from app.core.errors import DomainError
from app.core.security import hash_password
from app.models.enums import UserRole
from app.modules.projects.models import User
from app.repositories.common import SortDirection
from app.modules.projects.repositories import users as user_repo
from app.modules.projects.schemas.user import (
    UserCreate,
    UserPatch,
    UserPasswordSetRequest,
    UserProjectMembershipRead,
    UserRead,
    UsersList,
)
from app.modules.audit.services import audit as audit_service
from app.services.bootstrap import ADMIN_USERNAME


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_username(value: str | None) -> str:
    if value is None:
        raise DomainError(
            status_code=422,
            code="invalid_username",
            title=TITLE_INVALID_REQUEST,
            detail="username cannot be null",
            errors={"username": ["username cannot be null"]},
        )
    normalized = value.strip()
    if not normalized:
        raise DomainError(
            status_code=422,
            code="invalid_username",
            title=TITLE_INVALID_REQUEST,
            detail="username cannot be empty",
            errors={"username": ["username cannot be empty"]},
        )
    return normalized


def _normalize_email(value: str | None) -> str | None:
    normalized = _normalize_optional_text(value)
    return normalized.lower() if normalized else None


def _user_project_memberships(
    user_id: str, memberships_by_user_id: dict[str, list[user_repo.UserProjectMembership]]
) -> list[UserProjectMembershipRead]:
    return [
        UserProjectMembershipRead(
            project_id=item.project_id,
            project_name=item.project_name,
            role=item.role,
        )
        for item in memberships_by_user_id.get(user_id, [])
    ]


def _to_user_read(
    user: User, memberships_by_user_id: dict[str, list[user_repo.UserProjectMembership]] | None = None
) -> UserRead:
    memberships = memberships_by_user_id or {}
    return UserRead(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        team=user.team,
        is_enabled=user.is_enabled,
        role=user.role,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        project_memberships=_user_project_memberships(user.id, memberships),
    )


def _raise_user_conflict() -> None:
    raise DomainError(
        status_code=409,
        code="user_already_exists",
        title="Conflict",
        detail="username or email already exists",
        errors={
            "username": ["username already exists"],
            "email": ["email already exists"],
        },
    )


async def _ensure_self_or_admin(current_user: User, user_id: str, *, action: str) -> None:
    if current_user.role == UserRole.admin or current_user.id == user_id:
        return
    await audit_service.try_emit_event_immediately(
        action="user.access",
        resource_type="user",
        resource_id=user_id,
        result="fail",
        actor_id=current_user.id,
        actor_type="user",
        metadata={"reason": "self_or_admin_required", "operation": action},
    )
    raise DomainError(
        status_code=403,
        code="forbidden",
        title="Forbidden",
        detail=f"User can {action} only own profile",
    )


async def _get_user_or_404(db: AsyncSession, user_id: str) -> User:
    user = await user_repo.get_by_id(db, user_id)
    if not user:
        raise not_found("user")
    return user


async def _ensure_admin(current_user: User, *, action: str) -> None:
    if current_user.role == UserRole.admin:
        return
    await audit_service.try_emit_event_immediately(
        action="user.access",
        resource_type="user",
        resource_id=current_user.id,
        result="fail",
        actor_id=current_user.id,
        actor_type="user",
        metadata={"reason": "admin_required", "operation": action},
    )
    raise DomainError(
        status_code=403,
        code="forbidden",
        title="Forbidden",
        detail=f"Admin role is required to {action}",
    )


async def list_users(
    db: AsyncSession,
    *,
    current_user: User,
    page: int,
    page_size: int,
    search: str | None,
    sort_by: user_repo.UserSortField,
    sort_order: SortDirection,
) -> UsersList:
    await _ensure_admin(current_user, action="list users")
    result = await user_repo.list_users(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_direction=sort_order,
    )
    memberships_by_user_id = await user_repo.list_project_memberships_by_user_ids(
        db,
        user_ids=[item.id for item in result.items],
    )
    return UsersList(
        items=[_to_user_read(item, memberships_by_user_id) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def create_user(db: AsyncSession, payload: UserCreate, *, current_user: User) -> UserRead:
    await _ensure_admin(current_user, action="create users")
    user = User(
        username=_normalize_username(payload.username),
        first_name=_normalize_optional_text(payload.first_name),
        last_name=_normalize_optional_text(payload.last_name),
        email=_normalize_email(payload.email),
        team=_normalize_optional_text(payload.team),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await audit_service.queue_create_event(
        db,
        action="user.create",
        resource_type="user",
        entity=user,
    )
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        _raise_user_conflict()
    await db.refresh(user)
    return _to_user_read(user)


async def get_user(db: AsyncSession, *, user_id: str, current_user: User) -> UserRead:
    await _ensure_self_or_admin(current_user, user_id, action="access")
    user = await _get_user_or_404(db, user_id)
    memberships_by_user_id = await user_repo.list_project_memberships_by_user_ids(db, user_ids=[user.id])
    return _to_user_read(user, memberships_by_user_id)


async def patch_user(db: AsyncSession, *, user_id: str, payload: UserPatch, current_user: User) -> UserRead:
    await _ensure_self_or_admin(current_user, user_id, action="update")
    user = await _get_user_or_404(db, user_id)
    before_state = audit_service.snapshot_entity(user)
    patch_data = payload.model_dump(exclude_unset=True)
    next_username = user.username

    if "username" in patch_data:
        next_username = _normalize_username(patch_data["username"])

    if user.username == ADMIN_USERNAME and "username" in patch_data and next_username != ADMIN_USERNAME:
        raise DomainError(
            status_code=403,
            code="default_admin_protected",
            title="Forbidden",
            detail="Default admin username cannot be changed",
        )
    if "is_enabled" in patch_data:
        if patch_data["is_enabled"] is None:
            raise DomainError(
                status_code=422,
                code="invalid_user_status",
                title=TITLE_INVALID_REQUEST,
                detail="is_enabled cannot be null",
                errors={"is_enabled": ["is_enabled cannot be null"]},
            )
        await _ensure_admin(current_user, action="update user status")
        if user.username == ADMIN_USERNAME and not patch_data["is_enabled"]:
            raise DomainError(
                status_code=403,
                code="default_admin_protected",
                title="Forbidden",
                detail="Default admin user cannot be disabled",
            )
        user.is_enabled = patch_data["is_enabled"]

    if "username" in patch_data:
        user.username = next_username
    if "first_name" in patch_data:
        user.first_name = _normalize_optional_text(patch_data["first_name"])
    if "last_name" in patch_data:
        user.last_name = _normalize_optional_text(patch_data["last_name"])
    if "email" in patch_data:
        user.email = _normalize_email(patch_data["email"])
    if "team" in patch_data:
        user.team = _normalize_optional_text(patch_data["team"])

    await audit_service.queue_update_event(
        db,
        action="user.update",
        resource_type="user",
        entity=user,
        before=before_state,
    )
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        _raise_user_conflict()
    await db.refresh(user)
    memberships_by_user_id = await user_repo.list_project_memberships_by_user_ids(db, user_ids=[user.id])
    return _to_user_read(user, memberships_by_user_id)


async def set_user_password(
    db: AsyncSession,
    *,
    user_id: str,
    payload: UserPasswordSetRequest,
    current_user: User,
) -> None:
    await _ensure_admin(current_user, action="set user password")
    user = await _get_user_or_404(db, user_id)
    before_state = audit_service.snapshot_entity(user)
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    await audit_service.queue_update_event(
        db,
        action="user.reset_password",
        resource_type="user",
        entity=user,
        before=before_state,
    )


async def delete_user(db: AsyncSession, *, user_id: str, current_user: User) -> None:
    await _ensure_self_or_admin(current_user, user_id, action="delete")
    user = await _get_user_or_404(db, user_id)
    before_state = audit_service.snapshot_entity(user)

    if user.username == ADMIN_USERNAME:
        raise DomainError(
            status_code=403,
            code="default_admin_protected",
            title="Forbidden",
            detail="Default admin user cannot be deleted",
        )

    await audit_service.queue_delete_event(
        db,
        action="user.delete",
        resource_type="user",
        resource_id=user.id,
        before=before_state,
    )
    db.delete(user)
