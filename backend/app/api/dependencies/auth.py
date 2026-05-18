"""FastAPI authentication dependencies: JWT sessions, API keys, and request context."""

from __future__ import annotations

import hmac

from typing import Annotated

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit_context import set_audit_actor
from app.core.config import get_settings
from app.core.domain_strings import ACTION_AUTH_AUTHENTICATE, ACTION_AUTH_AUTHENTICATE_API_KEY
from app.core.errors import DomainError
from app.core.security import decode_access_token, hash_api_key, is_probable_api_key, parse_api_key_prefix
from app.db.session import get_db
from app.modules.audit.services.audit import try_emit_event_immediately
from app.modules.auth.repositories import api_keys as user_api_key_repo
from app.modules.auth.services.api_keys import register_api_key_login
from app.modules.projects.models import User
from app.modules.projects.repositories import users as user_repo

settings = get_settings()

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Request context helpers
# ---------------------------------------------------------------------------


def get_project_id_required(project_id: Annotated[str | None, Query()] = None) -> str:
    if not project_id:
        raise DomainError(
            status_code=400,
            code="missing_project_id",
            title="Invalid request",
            detail="Query parameter project_id is required",
        )
    return project_id


def get_request_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", maxsplit=1)[0].strip() or None
    if request.client:
        return request.client.host
    return None


def bind_user_audit_context(db: AsyncSession, user: User) -> None:
    db.info["audit_actor_id"] = user.id
    db.info["audit_actor_type"] = "user"
    set_audit_actor(actor_id=user.id, actor_type="user")


# ---------------------------------------------------------------------------
# API key authentication
# ---------------------------------------------------------------------------


def get_api_key_from_request(request: Request) -> str | None:
    explicit_header = request.headers.get("X-API-Key")
    if explicit_header:
        return explicit_header.strip()

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    if auth_header.lower().startswith("apikey "):
        return auth_header[7:].strip()
    if auth_header.lower().startswith("bearer "):
        candidate = auth_header[7:].strip()
        if is_probable_api_key(candidate):
            return candidate
    return None


async def try_authenticate_with_api_key(request: Request, db: AsyncSession) -> User | None:
    """Return a user if the request carries a valid API key; ``None`` if no key was sent.

    Raises ``DomainError`` when an API key is present but not valid.
    """
    raw_api_key = get_api_key_from_request(request)
    if not raw_api_key:
        return None

    key_prefix = parse_api_key_prefix(raw_api_key)
    if key_prefix:
        api_key = await user_api_key_repo.get_by_prefix(db, key_prefix)
        if api_key and hmac.compare_digest(hash_api_key(raw_api_key), api_key.key_hash):
            user = await user_repo.get_by_id(db, api_key.user_id)
            if not user:
                await try_emit_event_immediately(
                    action=ACTION_AUTH_AUTHENTICATE_API_KEY,
                    resource_type="user_api_key",
                    resource_id=api_key.id,
                    result="fail",
                    metadata={"reason": "api_key_user_not_found", "path": str(request.url.path)},
                )
                raise DomainError(
                    status_code=401,
                    code="invalid_api_key_user",
                    title="Unauthorized",
                    detail="API key user does not exist",
                )
            if not user.is_enabled:
                await try_emit_event_immediately(
                    action=ACTION_AUTH_AUTHENTICATE_API_KEY,
                    resource_type="user_api_key",
                    resource_id=api_key.id,
                    result="fail",
                    metadata={"reason": "api_key_user_disabled", "path": str(request.url.path)},
                    actor_id=user.id,
                    actor_type="user",
                )
                raise DomainError(
                    status_code=401,
                    code="invalid_api_key_user_disabled",
                    title="Unauthorized",
                    detail="API key user is disabled",
                )
            await register_api_key_login(
                db,
                api_key=api_key,
                ip=get_request_client_ip(request),
                user_agent=request.headers.get("user-agent"),
                request_path=str(request.url.path),
            )
            bind_user_audit_context(db, user)
            request.state.auth_user_id = user.id
            return user

    await try_emit_event_immediately(
        action=ACTION_AUTH_AUTHENTICATE_API_KEY,
        resource_type="user_api_key",
        resource_id=None,
        result="fail",
        metadata={"reason": "invalid_api_key", "path": str(request.url.path)},
    )
    raise DomainError(
        status_code=401,
        code="invalid_api_key",
        title="Unauthorized",
        detail="API key is invalid",
    )


# ---------------------------------------------------------------------------
# JWT / session authentication
# ---------------------------------------------------------------------------


def get_token_from_request(request: Request) -> str | None:
    """Extract token from httpOnly cookie (preferred) or Authorization header."""
    cookie_token = request.cookies.get(settings.session_cookie_name)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return None


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    cached_user = getattr(request.state, "current_user", None)
    if isinstance(cached_user, User):
        request.state.auth_user_id = cached_user.id
        return cached_user

    api_user = await try_authenticate_with_api_key(request, db)
    if api_user is not None:
        request.state.current_user = api_user
        request.state.auth_user_id = api_user.id
        return api_user

    token = get_token_from_request(request)
    if not token:
        await try_emit_event_immediately(
            action=ACTION_AUTH_AUTHENTICATE,
            resource_type="session",
            resource_id=None,
            result="fail",
            metadata={"reason": "bearer_token_required", "path": str(request.url.path)},
        )
        raise DomainError(
            status_code=401,
            code="unauthorized",
            title="Unauthorized",
            detail="Bearer token is required",
        )
    payload = decode_access_token(token)
    if payload is None:
        await try_emit_event_immediately(
            action=ACTION_AUTH_AUTHENTICATE,
            resource_type="session",
            resource_id=None,
            result="fail",
            metadata={"reason": "invalid_or_expired_token", "path": str(request.url.path)},
        )
        raise DomainError(
            status_code=401,
            code="invalid_token",
            title="Unauthorized",
            detail="Token is invalid or expired",
        )
    user_id = payload["sub"]
    user = await user_repo.get_by_id(db, user_id)
    if not user:
        await try_emit_event_immediately(
            action=ACTION_AUTH_AUTHENTICATE,
            resource_type="user",
            resource_id=user_id,
            result="fail",
            metadata={"reason": "token_user_not_found", "path": str(request.url.path)},
        )
        raise DomainError(
            status_code=401,
            code="invalid_token_user",
            title="Unauthorized",
            detail="Token user does not exist",
        )
    if not user.is_enabled:
        await try_emit_event_immediately(
            action=ACTION_AUTH_AUTHENTICATE,
            resource_type="user",
            resource_id=user.id,
            result="fail",
            metadata={"reason": "token_user_disabled", "path": str(request.url.path)},
        )
        raise DomainError(
            status_code=401,
            code="invalid_token_user_disabled",
            title="Unauthorized",
            detail="Token user is disabled",
        )
    token_version = payload.get("ver", 0)
    if not isinstance(token_version, int) or token_version != user.token_version:
        await try_emit_event_immediately(
            action=ACTION_AUTH_AUTHENTICATE,
            resource_type="session",
            resource_id=None,
            result="fail",
            metadata={"reason": "token_revoked", "path": str(request.url.path), "user_id": user.id},
            actor_id=user.id,
            actor_type="user",
        )
        raise DomainError(
            status_code=401,
            code="token_revoked",
            title="Unauthorized",
            detail="Session is no longer valid. Please sign in again",
        )
    bind_user_audit_context(db, user)
    request.state.current_user = user
    request.state.auth_user_id = user.id
    return user


async def require_authenticated_user(_: Annotated[User, Depends(get_current_user)]) -> None:
    return None
