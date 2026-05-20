from __future__ import annotations

import json
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import (
    ACTION_AUTH_EXTERNAL_LOGIN,
    ACTION_AUTH_IDENTITY_LINK,
    ACTION_AUTH_PROVISION_USER,
    EVENT_USE_CASE_AUTH_EXTERNAL_LOGIN,
)
from app.core.errors import DomainError
from app.core.metrics import record_use_case
from app.core.security import hash_password
from app.core.token_crypto import decrypt_secret
from app.modules.audit.services import audit as audit_service
from app.modules.auth.models import AuthProvider, UserExternalIdentity
from app.modules.auth.oidc.discovery import OidcDiscoveryError, fetch_discovery, fetch_jwks
from app.modules.auth.oidc.jwt_verify import JwtValidationError, verify_id_token
from app.modules.auth.oidc.presets import effective_oidc_settings
from app.modules.auth.oidc.transaction import (
    OidcTransaction,
    code_challenge_s256,
    new_code_verifier,
    new_nonce,
    new_state,
)
from app.modules.projects.models import User

logger = logging.getLogger("tms.use_case.auth.oidc")

_GENERIC = "Unable to sign in with the selected method"


def _fail(reason: str, *, status: int = 400) -> DomainError:
    return DomainError(status_code=status, code=f"oidc_{reason}", title="Forbidden", detail=_GENERIC)


@dataclass(slots=True)
class StartResult:
    authorize_url: str
    transaction: OidcTransaction


@dataclass(slots=True)
class CallbackResult:
    user: User
    return_to: str


def _client_secret(provider: AuthProvider) -> str:
    if not provider.secrets_encrypted:
        return ""
    try:
        data = json.loads(decrypt_secret(provider.secrets_encrypted))
    except (ValueError, TypeError):
        return ""
    value = data.get("client_secret") if isinstance(data, dict) else None
    return value if isinstance(value, str) else ""


async def start_login(
    provider: AuthProvider, *, return_to: str, redirect_uri: str
) -> StartResult:
    effective = effective_oidc_settings(provider)
    if not effective.client_id or not effective.discovery_url:
        raise _fail("provider_misconfigured")
    try:
        discovery = await fetch_discovery(effective.discovery_url)
    except OidcDiscoveryError as exc:
        logger.warning("OIDC discovery failed", extra={"provider_id": provider.id})
        raise _fail("discovery_unreachable", status=502) from exc

    tx = OidcTransaction(
        provider_id=provider.id,
        state=new_state(),
        nonce=new_nonce(),
        code_verifier=new_code_verifier() if effective.require_pkce else "",
        return_to=return_to,
    )
    params = {
        "response_type": "code",
        "client_id": effective.client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(effective.scopes),
        "state": tx.state,
        "nonce": tx.nonce,
    }
    if effective.require_pkce:
        params["code_challenge"] = code_challenge_s256(tx.code_verifier)
        params["code_challenge_method"] = "S256"
    authorize_url = f"{discovery.authorization_endpoint}?{urlencode(params)}"
    return StartResult(authorize_url=authorize_url, transaction=tx)


async def _exchange_code(
    token_endpoint: str,
    *,
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
    code_verifier: str,
) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
    }
    if client_secret:
        data["client_secret"] = client_secret
    if code_verifier:
        data["code_verifier"] = code_verifier
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            token_endpoint,
            data=data,
            headers={"Accept": "application/json"},
        )
    if response.status_code != 200:
        raise _fail("token_exchange_failed", status=502)
    try:
        payload = response.json()
    except ValueError as exc:
        raise _fail("token_exchange_invalid", status=502) from exc
    if not isinstance(payload, dict) or "id_token" not in payload:
        raise _fail("token_exchange_invalid", status=502)
    return payload


def _claim_str(claims: dict, key: str | None) -> str | None:
    if not key:
        return None
    value = claims.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


async def _unique_username(db: AsyncSession, base: str) -> str:
    candidate = base
    suffix = 1
    while await db.scalar(select(User.id).where(User.username == candidate)) is not None:
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


async def _audit(action: str, *, result: str, provider: AuthProvider, user_id: str | None, reason: str) -> None:
    await audit_service.try_emit_event_immediately(
        action=action,
        resource_type="auth_provider",
        resource_id=provider.id,
        result=result,
        metadata={
            "provider_id": provider.id,
            "provider_type": provider.type.value,
            "reason": reason,
            "user_id": user_id,
        },
        actor_id=user_id,
        actor_type="user" if user_id else "system",
    )


async def complete_login(
    db: AsyncSession,
    provider: AuthProvider,
    *,
    tx: OidcTransaction,
    query_params: dict[str, str],
    redirect_uri: str,
) -> CallbackResult:
    metric_label = provider.type.value
    if query_params.get("error"):
        record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome=f"{metric_label}_provider_error")
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="provider_error")
        raise _fail("provider_error")
    code = query_params.get("code")
    if not code or query_params.get("state") != tx.state:
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="state_mismatch")
        raise _fail("state_mismatch")

    effective = effective_oidc_settings(provider)
    try:
        discovery = await fetch_discovery(effective.discovery_url)
        token_payload = await _exchange_code(
            discovery.token_endpoint,
            code=code,
            redirect_uri=redirect_uri,
            client_id=effective.client_id,
            client_secret=_client_secret(provider),
            code_verifier=tx.code_verifier,
        )
        jwks = await fetch_jwks(discovery.jwks_uri)
        claims = verify_id_token(
            token_payload["id_token"],
            jwks=jwks,
            effective=effective,
            expected_nonce=tx.nonce,
        )
    except OidcDiscoveryError as exc:
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="discovery")
        raise _fail("discovery", status=502) from exc
    except JwtValidationError as exc:
        record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome=f"{metric_label}_token_invalid")
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="token_invalid")
        raise _fail("token_invalid") from exc

    subject = _claim_str(claims, effective.subject_claim)
    if not subject:
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="no_subject")
        raise _fail("no_subject")

    email = _claim_str(claims, effective.email_claim)
    email_verified = bool(claims.get(effective.email_verified_claim, False))
    if effective.require_verified_email and email and not email_verified:
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="email_unverified")
        raise _fail("email_unverified", status=403)

    if effective.allowed_domains:
        domain = email.split("@")[-1].lower() if email and "@" in email else None
        if not domain or domain not in {d.lower() for d in effective.allowed_domains}:
            await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="domain_not_allowed")
            raise _fail("domain_not_allowed", status=403)

    first_name = _claim_str(claims, effective.first_name_claim)
    last_name = _claim_str(claims, effective.last_name_claim)
    username_value = next(
        (v for v in (_claim_str(claims, c) for c in effective.username_claims) if v),
        subject,
    )

    identity = await db.scalar(
        select(UserExternalIdentity).where(
            UserExternalIdentity.provider_id == provider.id,
            UserExternalIdentity.subject == subject,
        )
    )
    user: User | None = None
    newly_provisioned = False
    newly_linked = False

    if identity is not None:
        user = await db.scalar(select(User).where(User.id == identity.user_id))
    elif (
        provider.allow_email_linking
        and email
        and email_verified
    ):
        matches = (
            await db.scalars(
                select(User).where(func.lower(User.email) == email.lower(), User.is_enabled.is_(True))
            )
        ).all()
        if len(matches) == 1:
            user = matches[0]
            newly_linked = True

    if user is None:
        if not provider.auto_provision:
            await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=None, reason="provisioning_disabled")
            raise _fail("provisioning_disabled", status=403)
        email_taken = email and await db.scalar(
            select(User.id).where(func.lower(User.email) == email.lower())
        )
        user = User(
            username=await _unique_username(db, username_value),
            email=None if email_taken else email,
            first_name=first_name,
            last_name=last_name,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=provider.default_role,
            is_enabled=provider.new_user_enabled,
        )
        db.add(user)
        await db.flush()
        newly_provisioned = True
        await _audit(ACTION_AUTH_PROVISION_USER, result="success", provider=provider, user_id=user.id, reason="auto_provisioned")

    if identity is None:
        identity = UserExternalIdentity(
            user_id=user.id,
            provider_id=provider.id,
            provider_type=provider.type,
            subject=subject,
            email_at_link_time=email,
        )
        db.add(identity)
        if newly_linked:
            await _audit(ACTION_AUTH_IDENTITY_LINK, result="success", provider=provider, user_id=user.id, reason="email_linked")

    if not user.is_enabled:
        record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome=f"{metric_label}_user_disabled")
        await _audit(ACTION_AUTH_EXTERNAL_LOGIN, result="fail", provider=provider, user_id=user.id, reason="user_disabled")
        raise _fail("user_disabled", status=403)

    now = datetime.now(timezone.utc)
    identity.last_login_at = now
    user.last_login_at = now
    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if email and not await db.scalar(
        select(User.id).where(func.lower(User.email) == email.lower(), User.id != user.id)
    ):
        user.email = email

    from app.modules.auth.services.providers import apply_auto_assign_projects
    await apply_auto_assign_projects(db, user=user, provider=provider)

    await db.flush()
    record_use_case(ACTION_AUTH_EXTERNAL_LOGIN, outcome=f"{metric_label}_success")
    await _audit(
        ACTION_AUTH_EXTERNAL_LOGIN,
        result="success",
        provider=provider,
        user_id=user.id,
        reason="provisioned" if newly_provisioned else ("linked" if newly_linked else "matched"),
    )
    logger.info(
        "External login succeeded",
        extra={
            "event": EVENT_USE_CASE_AUTH_EXTERNAL_LOGIN,
            "provider_id": provider.id,
            "provider_type": provider.type.value,
            "user_id": user.id,
        },
    )
    return CallbackResult(user=user, return_to=tx.return_to)


__all__ = ["CallbackResult", "StartResult", "complete_login", "start_login"]
