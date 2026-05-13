from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.core.security import create_api_key
from app.modules.projects.models import User
from app.modules.auth.models import UserApiKey
from app.modules.auth.repositories import api_keys as user_api_key_repo
from app.modules.auth.schemas.api_keys import (
    UserApiKeyCreateRequest,
    UserApiKeyLoginRead,
    UserApiKeyPatchRequest,
    UserApiKeyRead,
    UserApiKeysList,
    UserApiKeySecretResponse,
)
from app.modules.audit.services import audit as audit_service


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_required_text(value: str, *, field_name: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise DomainError(
            status_code=422,
            code=f"invalid_{field_name}",
            title="Invalid request",
            detail=f"{field_name} cannot be empty",
            errors={field_name: [f"{field_name} cannot be empty"]},
        )
    return trimmed


async def _to_user_api_key_read(db: AsyncSession, api_key: UserApiKey) -> UserApiKeyRead:
    recent_logins = await user_api_key_repo.list_recent_logins(db, api_key_id=api_key.id, limit=10)
    return UserApiKeyRead(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        key_hint=api_key.key_hint,
        created_at=api_key.created_at,
        rotated_at=api_key.rotated_at,
        last_used_at=api_key.last_used_at,
        last_used_ip=api_key.last_used_ip,
        last_used_user_agent=api_key.last_used_user_agent,
        recent_logins=[
            UserApiKeyLoginRead(
                authenticated_at=item.authenticated_at,
                ip=item.ip,
                user_agent=item.user_agent,
                request_path=item.request_path,
            )
            for item in recent_logins
        ],
    )


async def _get_user_api_key_or_404(db: AsyncSession, *, current_user: User, api_key_id: str) -> UserApiKey:
    api_key = await user_api_key_repo.get_by_id(db, api_key_id=api_key_id)
    if api_key is None or api_key.user_id != current_user.id:
        raise not_found("user_api_key")
    return api_key


async def list_my_api_keys(db: AsyncSession, *, current_user: User) -> UserApiKeysList:
    keys = await user_api_key_repo.list_by_user_id(db, current_user.id)
    items = []
    for item in keys:
        items.append(await _to_user_api_key_read(db, item))
    return UserApiKeysList(items=items)


async def create_my_api_key(
    db: AsyncSession, *, current_user: User, payload: UserApiKeyCreateRequest
) -> UserApiKeySecretResponse:
    raw_key, key_prefix, key_hint, key_hash = create_api_key()
    api_key = UserApiKey(
        user_id=current_user.id,
        name=_normalize_required_text(payload.name, field_name="name"),
        description=_normalize_text(payload.description),
        key_prefix=key_prefix,
        key_hint=key_hint,
        key_hash=key_hash,
    )
    db.add(api_key)
    await audit_service.queue_create_event(
        db,
        action="user.api_key.create",
        resource_type="user_api_key",
        entity=api_key,
        metadata={"user_id": current_user.id},
    )
    await db.flush()
    await db.refresh(api_key)
    return UserApiKeySecretResponse(api_key=raw_key, key=await _to_user_api_key_read(db, api_key))


async def patch_my_api_key(
    db: AsyncSession,
    *,
    current_user: User,
    api_key_id: str,
    payload: UserApiKeyPatchRequest,
) -> UserApiKeyRead:
    api_key = await _get_user_api_key_or_404(db, current_user=current_user, api_key_id=api_key_id)
    before_state = audit_service.snapshot_entity(api_key)
    patch = payload.model_dump(exclude_unset=True)

    if "name" in patch:
        api_key.name = _normalize_required_text(patch["name"], field_name="name")
    if "description" in patch:
        api_key.description = _normalize_text(patch["description"])

    await audit_service.queue_update_event(
        db,
        action="user.api_key.update",
        resource_type="user_api_key",
        entity=api_key,
        before=before_state,
        metadata={"user_id": current_user.id},
    )
    await db.flush()
    await db.refresh(api_key)
    return await _to_user_api_key_read(db, api_key)


async def regenerate_my_api_key(
    db: AsyncSession, *, current_user: User, api_key_id: str
) -> UserApiKeySecretResponse:
    api_key = await _get_user_api_key_or_404(db, current_user=current_user, api_key_id=api_key_id)
    raw_key, key_prefix, key_hint, key_hash = create_api_key()
    now = datetime.now(timezone.utc)
    before_state = audit_service.snapshot_entity(api_key)

    api_key.key_prefix = key_prefix
    api_key.key_hint = key_hint
    api_key.key_hash = key_hash
    api_key.rotated_at = now
    api_key.last_used_at = None
    api_key.last_used_ip = None
    api_key.last_used_user_agent = None
    await user_api_key_repo.delete_logins(db, api_key_id=api_key.id)

    await audit_service.queue_update_event(
        db,
        action="user.api_key.regenerate",
        resource_type="user_api_key",
        entity=api_key,
        before=before_state,
        metadata={"user_id": current_user.id},
    )
    await db.flush()
    await db.refresh(api_key)
    return UserApiKeySecretResponse(api_key=raw_key, key=await _to_user_api_key_read(db, api_key))


async def delete_my_api_key(db: AsyncSession, *, current_user: User, api_key_id: str) -> None:
    api_key = await _get_user_api_key_or_404(db, current_user=current_user, api_key_id=api_key_id)
    before_state = audit_service.snapshot_entity(api_key)
    await audit_service.queue_delete_event(
        db,
        action="user.api_key.delete",
        resource_type="user_api_key",
        resource_id=api_key.id,
        before=before_state,
        metadata={"user_id": current_user.id},
    )
    await db.delete(api_key)


async def register_api_key_login(
    db: AsyncSession,
    *,
    api_key: UserApiKey,
    ip: str | None,
    user_agent: str | None,
    request_path: str | None,
) -> None:
    at = datetime.now(timezone.utc)
    api_key.last_used_at = at
    api_key.last_used_ip = ip
    api_key.last_used_user_agent = user_agent
    await user_api_key_repo.add_login_event(
        db,
        api_key_id=api_key.id,
        user_id=api_key.user_id,
        at=at,
        ip=ip,
        user_agent=user_agent,
        request_path=request_path,
    )
