from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone

import anyio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.domain_strings import (
    ACTION_AUTH_EXTERNAL_LOGIN,
    ACTION_AUTH_IDENTITY_LINK,
    ACTION_AUTH_PROVISION_USER,
    EVENT_USE_CASE_AUTH_EXTERNAL_LOGIN,
)
from app.core.errors import DomainError
from app.core.metrics import record_use_case
from app.core.security import create_access_token, hash_password
from app.models.enums import AuthProviderType
from app.modules.audit.services import audit as audit_service
from app.modules.auth import presenters as auth_presenters
from app.modules.auth.ldap import client as ldap_client
from app.modules.auth.ldap.client import LdapError, LdapIdentity
from app.modules.auth.models import AuthProvider, UserExternalIdentity
from app.modules.auth.repositories import providers as provider_repo
from app.modules.auth.schemas.auth import LdapLoginRequest, TokenResponse
from app.modules.projects.models import User

logger = logging.getLogger("tms.use_case.auth.ldap")

_GENERIC = "Unable to sign in with the selected method"

# Brute-force speed bumps (in-process).
_IP_MAX = 20
_USER_MAX = 5
_WINDOW = 300.0


def _generic(status: int = 401) -> DomainError:
    return DomainError(status_code=status, code="ldap_login_failed", title="Unauthorized", detail=_GENERIC)


async def _audit(action: str, *, result: str, provider_id: str, user_id: str | None, reason: str) -> None:
    await audit_service.try_emit_event_immediately(
        action=action,
        resource_type="auth_provider",
        resource_id=provider_id,
        result=result,
        metadata={"provider_id": provider_id, "provider_type": "ldap", "reason": reason, "user_id": user_id},
        actor_id=user_id,
        actor_type="user" if user_id else "system",
    )


async def _unique_username(db: AsyncSession, base: str) -> str:
    candidate = base
    suffix = 1
    while await db.scalar(select(User.id).where(User.username == candidate)) is not None:
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


async def login_ldap(
    db: AsyncSession, *, payload: LdapLoginRequest, client_ip: str | None
) -> TokenResponse:
    ip_key = f"ldap:ip:{client_ip or 'unknown'}"
    user_key = f"ldap:user:{payload.provider_id}:{payload.username.lower()}"
    if rate_limit.is_rate_limited(ip_key, max_attempts=_IP_MAX, window_seconds=_WINDOW) or rate_limit.is_rate_limited(
        user_key, max_attempts=_USER_MAX, window_seconds=_WINDOW
    ):
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider_id=payload.provider_id, user_id=None, reason="rate_limited")
        raise DomainError(
            status_code=429, code="too_many_attempts", title="Too many requests", detail=_GENERIC
        )

    provider = await provider_repo.get(db, payload.provider_id)
    if provider is None or not provider.enabled or provider.type is not AuthProviderType.ldap:
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider_id=payload.provider_id, user_id=None, reason="provider_unavailable")
        raise _generic(status=403)

    try:
        identity_data: LdapIdentity = await anyio.to_thread.run_sync(
            ldap_client.authenticate, provider, payload.username, payload.password
        )
    except LdapError:
        record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome="ldap_invalid_credentials")
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider_id=provider.id, user_id=None, reason="invalid_credentials")
        raise _generic(status=401) from None

    user, newly_provisioned, newly_linked = await _resolve_user(db, provider, identity_data)

    if not user.is_enabled:
        record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome="ldap_user_disabled")
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider_id=provider.id, user_id=user.id, reason="user_disabled")
        raise _generic(status=403)

    now = datetime.now(timezone.utc)
    user.last_login_at = now
    if identity_data.first_name:
        user.first_name = identity_data.first_name
    if identity_data.last_name:
        user.last_name = identity_data.last_name
    if identity_data.team:
        user.team = identity_data.team
    if identity_data.email and not await db.scalar(
        select(User.id).where(func.lower(User.email) == identity_data.email.lower(), User.id != user.id)
    ):
        user.email = identity_data.email

    from app.modules.auth.services.providers import apply_auto_assign_projects
    await apply_auto_assign_projects(db, user=user, provider=provider)

    await db.flush()
    rate_limit.reset(ip_key)
    rate_limit.reset(user_key)
    record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome="ldap_success")
    await _audit(
        ACTION_AUTH_EXTERNAL_LOGIN,
        result="success",
        provider_id=provider.id,
        user_id=user.id,
        reason="provisioned" if newly_provisioned else ("linked" if newly_linked else "matched"),
    )
    logger.info(
        "LDAP login succeeded",
        extra={
            "event": EVENT_USE_CASE_AUTH_EXTERNAL_LOGIN,
            "provider_id": provider.id,
            "provider_type": "ldap",
            "user_id": user.id,
        },
    )
    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
        user=await auth_presenters.user_to_read_with_memberships(db, user),
    )


async def _resolve_user(
    db: AsyncSession, provider: AuthProvider, identity_data: LdapIdentity
) -> tuple[User, bool, bool]:
    identity = await db.scalar(
        select(UserExternalIdentity).where(
            UserExternalIdentity.provider_id == provider.id,
            UserExternalIdentity.subject == identity_data.subject,
        )
    )
    user: User | None = None
    newly_provisioned = False
    newly_linked = False

    if identity is not None:
        user = await db.scalar(select(User).where(User.id == identity.user_id))
    elif provider.allow_email_linking and identity_data.email:
        matches = (
            await db.scalars(
                select(User).where(
                    func.lower(User.email) == identity_data.email.lower(), User.is_enabled.is_(True)
                )
            )
        ).all()
        if len(matches) == 1:
            user = matches[0]
            newly_linked = True

    if user is None:
        if not provider.auto_provision:
            await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider_id=provider.id, user_id=None, reason="provisioning_disabled")
            raise _generic(status=403)
        email_taken = identity_data.email and await db.scalar(
            select(User.id).where(func.lower(User.email) == identity_data.email.lower())
        )
        user = User(
            username=await _unique_username(db, identity_data.username or identity_data.subject),
            email=None if email_taken else identity_data.email,
            first_name=identity_data.first_name,
            last_name=identity_data.last_name,
            team=identity_data.team,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=provider.default_role,
            is_enabled=provider.new_user_enabled,
        )
        db.add(user)
        await db.flush()
        newly_provisioned = True
        await _audit(ACTION_AUTH_PROVISION_USER, result="success", provider_id=provider.id, user_id=user.id, reason="auto_provisioned")

    if identity is None:
        db.add(
            UserExternalIdentity(
                user_id=user.id,
                provider_id=provider.id,
                provider_type=AuthProviderType.ldap,
                subject=identity_data.subject,
                email_at_link_time=identity_data.email,
                last_login_at=datetime.now(timezone.utc),
            )
        )
        if newly_linked:
            await _audit(ACTION_AUTH_IDENTITY_LINK, result="success", provider_id=provider.id, user_id=user.id, reason="email_linked")
    else:
        identity.last_login_at = datetime.now(timezone.utc)

    return user, newly_provisioned, newly_linked
