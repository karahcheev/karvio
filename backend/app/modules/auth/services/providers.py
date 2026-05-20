from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import (
    ACTION_AUTH_PROVIDER_CREATE,
    ACTION_AUTH_PROVIDER_DELETE,
    ACTION_AUTH_PROVIDER_TEST,
    ACTION_AUTH_PROVIDER_UPDATE,
    EVENT_USE_CASE_AUTH_PROVIDER,
)
from app.core.errors import DomainError
from app.core.metrics import record_use_case
from app.core.token_crypto import decrypt_secret, encrypt_secret
from app.models.enums import AuthProviderType, ProjectMemberRole, UserRole
from app.modules.audit.services import audit as audit_service
from app.modules.auth.models import AuthProvider
from app.modules.auth.oidc.discovery import OidcDiscoveryError, fetch_discovery, fetch_jwks
from app.modules.auth.oidc.presets import effective_oidc_settings
from app.modules.auth.repositories import providers as provider_repo
from app.modules.auth.schemas.providers import (
    CONFIG_MODELS,
    DEFAULT_LOCAL_LABEL,
    SECRET_FIELDS,
    AuthProviderCreate,
    AuthProviderList,
    AuthProviderRead,
    AuthProviderUpdate,
    AutoAssignProjectEntry,
    ProviderSecretsState,
    ProviderTestCheck,
    ProviderTestResult,
    PublicAuthConfig,
    PublicLocalLogin,
    PublicProvider,
    RotateSecretRequest,
)
from app.modules.projects.models import Project, ProjectMember, User
from sqlalchemy import select

logger = logging.getLogger("tms.use_case.auth.provider")

RESOURCE_TYPE = "auth_provider"
PASSWORD_FORM_TYPES = {AuthProviderType.local, AuthProviderType.ldap}


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


def _require_admin(current_user: User) -> None:
    if current_user.role != UserRole.admin:
        raise DomainError(
            status_code=403,
            code="forbidden",
            title="Forbidden",
            detail="Administrator privileges are required",
        )


# ---------------------------------------------------------------------------
# Secret handling (write-only, encrypted at rest)
# ---------------------------------------------------------------------------


def _load_secrets(provider: AuthProvider) -> dict[str, str]:
    if not provider.secrets_encrypted:
        return {}
    try:
        raw = decrypt_secret(provider.secrets_encrypted)
    except ValueError:
        logger.warning("Unable to decrypt provider secrets", extra={"provider_id": provider.id})
        return {}
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return {k: v for k, v in data.items() if isinstance(v, str) and v}


def _store_secrets(provider: AuthProvider, secrets: dict[str, str]) -> None:
    cleaned = {k: v for k, v in secrets.items() if isinstance(v, str) and v}
    provider.secrets_encrypted = encrypt_secret(json.dumps(cleaned)) if cleaned else None


def _apply_secret_changes(
    provider: AuthProvider,
    incoming: dict[str, str | None] | None,
    *,
    allowed: tuple[str, ...],
) -> None:
    if incoming is None:
        return
    current = _load_secrets(provider)
    for name, value in incoming.items():
        if name not in allowed:
            raise DomainError(
                status_code=422,
                code="invalid_secret",
                title="Invalid request",
                detail=f"Unknown secret '{name}' for this provider type",
            )
        if value is None or value == "":
            current.pop(name, None)
        else:
            current[name] = value
    _store_secrets(provider, current)


def _secrets_state(provider: AuthProvider) -> ProviderSecretsState:
    stored = _load_secrets(provider)
    return ProviderSecretsState(
        client_secret_configured="client_secret" in stored,
        ldap_bind_password_configured="ldap_bind_password" in stored,
    )


# ---------------------------------------------------------------------------
# Config validation & status
# ---------------------------------------------------------------------------


def _validate_config(provider_type: AuthProviderType, config: dict[str, Any]) -> dict[str, Any]:
    model = CONFIG_MODELS[provider_type]
    try:
        return model.model_validate(config or {}).model_dump()
    except ValidationError as exc:
        raise DomainError(
            status_code=422,
            code="invalid_provider_config",
            title="Invalid request",
            detail=f"Invalid configuration for {provider_type.value} provider",
        ) from exc


def _missing_requirements(provider: AuthProvider) -> list[str]:
    """Return a list of missing required fields/secrets for the provider type."""
    missing: list[str] = []
    cfg = provider.config or {}
    secrets = _load_secrets(provider)
    if provider.type is AuthProviderType.local:
        return missing
    if provider.type is AuthProviderType.ldap:
        if not cfg.get("server_url"):
            missing.append("server_url")
        if not cfg.get("base_dn"):
            missing.append("base_dn")
        if cfg.get("bind_mode") == "service_account":
            if not cfg.get("bind_dn"):
                missing.append("bind_dn")
            if "ldap_bind_password" not in secrets:
                missing.append("ldap_bind_password")
        if cfg.get("bind_mode") == "direct_bind" and not cfg.get("user_dn_template"):
            missing.append("user_dn_template")
        return missing
    # OIDC / Google / Azure
    if not cfg.get("client_id"):
        missing.append("client_id")
    if "client_secret" not in secrets:
        missing.append("client_secret")
    if provider.type is AuthProviderType.oidc and not cfg.get("issuer"):
        missing.append("issuer")
    if provider.type is AuthProviderType.azure:
        if cfg.get("tenant_mode", "single") == "single" and not cfg.get("tenant_id"):
            missing.append("tenant_id")
    return missing


def _status(provider: AuthProvider) -> str:
    if not provider.enabled:
        return "disabled"
    return "misconfigured" if _missing_requirements(provider) else "enabled"


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


_PROJECT_ROLE_RANK = {
    ProjectMemberRole.viewer: 0,
    ProjectMemberRole.tester: 1,
    ProjectMemberRole.lead: 2,
    ProjectMemberRole.manager: 3,
}


async def _validate_auto_assign_projects(
    db: AsyncSession, entries: list[AutoAssignProjectEntry]
) -> list[dict[str, Any]]:
    if not entries:
        return []
    # Deduplicate by project_id; keep the highest role if listed twice.
    by_project: dict[str, ProjectMemberRole] = {}
    for entry in entries:
        existing = by_project.get(entry.project_id)
        if existing is None or _PROJECT_ROLE_RANK[entry.role] > _PROJECT_ROLE_RANK[existing]:
            by_project[entry.project_id] = entry.role
    project_ids = list(by_project)
    found = set(
        (await db.scalars(select(Project.id).where(Project.id.in_(project_ids)))).all()
    )
    missing = [pid for pid in project_ids if pid not in found]
    if missing:
        raise DomainError(
            status_code=422,
            code="invalid_auto_assign_project",
            title="Invalid request",
            detail=f"Unknown project ids: {', '.join(missing)}",
        )
    return [{"project_id": pid, "role": role.value} for pid, role in by_project.items()]


def _coerce_auto_assign_entries(raw: list[dict[str, Any]] | None) -> list[AutoAssignProjectEntry]:
    if not raw:
        return []
    result: list[AutoAssignProjectEntry] = []
    for item in raw:
        try:
            result.append(AutoAssignProjectEntry.model_validate(item))
        except ValidationError:
            continue
    return result


async def apply_auto_assign_projects(db: AsyncSession, *, user: User, provider: AuthProvider) -> None:
    """Ensure ``user`` is a member of each configured project for ``provider``.

    Idempotent: never downgrades an existing membership. Only upgrades when the
    configured role outranks the current role.
    """
    entries = provider.auto_assign_projects or []
    if not entries:
        return
    existing = (
        await db.scalars(select(ProjectMember).where(ProjectMember.user_id == user.id))
    ).all()
    existing_by_project = {m.project_id: m for m in existing}
    for entry in entries:
        project_id = entry.get("project_id") if isinstance(entry, dict) else None
        role_raw = entry.get("role") if isinstance(entry, dict) else None
        if not project_id or not role_raw:
            continue
        try:
            target_role = ProjectMemberRole(role_raw)
        except ValueError:
            continue
        # Skip if project was deleted.
        if not await db.scalar(select(Project.id).where(Project.id == project_id)):
            continue
        member = existing_by_project.get(project_id)
        if member is None:
            db.add(ProjectMember(project_id=project_id, user_id=user.id, role=target_role))
        elif _PROJECT_ROLE_RANK[target_role] > _PROJECT_ROLE_RANK[member.role]:
            member.role = target_role


def _serialize(provider: AuthProvider) -> AuthProviderRead:
    return AuthProviderRead(
        id=provider.id,
        type=provider.type,
        name=provider.name,
        login_label=provider.login_label,
        enabled=provider.enabled,
        sort_order=provider.sort_order,
        auto_provision=provider.auto_provision,
        default_role=provider.default_role,
        new_user_enabled=provider.new_user_enabled,
        allow_email_linking=provider.allow_email_linking,
        local_admin_only=provider.local_admin_only,
        config=provider.config or {},
        group_mapping=provider.group_mapping or [],
        full_group_sync=provider.full_group_sync,
        auto_assign_projects=_coerce_auto_assign_entries(provider.auto_assign_projects),
        secrets=_secrets_state(provider),
        status=_status(provider),
        last_tested_at=provider.last_tested_at,
        last_test_status=provider.last_test_status,
        last_test_error=provider.last_test_error,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


# ---------------------------------------------------------------------------
# Last-admin-path guard
# ---------------------------------------------------------------------------


def _is_admin_capable(provider: AuthProvider) -> bool:
    """A path through which a Karvio system admin can sign in.

    Only the Local provider can currently authenticate an existing admin
    account. External providers gain admin capability once group->role
    mapping is enforced (later phase); the guard generalizes automatically.
    """
    if not provider.enabled:
        return False
    if provider.type is AuthProviderType.local:
        return not _missing_requirements(provider)
    return False


async def _assert_admin_path_remains(
    db: AsyncSession, *, mutated: AuthProvider, removing: bool
) -> None:
    providers = await provider_repo.list_all(db)
    # Legacy default: with no provisioned local provider row, local login is
    # implicitly available to admins, so an admin path always exists.
    has_local = any(p.type is AuthProviderType.local for p in providers)
    if not has_local and not (mutated.type is AuthProviderType.local and not removing):
        return
    still_capable = False
    for existing in providers:
        if existing.id == mutated.id:
            if removing:
                continue
            if _is_admin_capable(mutated):
                still_capable = True
                break
            continue
        if _is_admin_capable(existing):
            still_capable = True
            break
    if not still_capable:
        raise DomainError(
            status_code=409,
            code="last_admin_path",
            title="Conflict",
            detail="At least one administrator sign-in path must remain enabled",
        )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def list_providers(db: AsyncSession, *, current_user: User) -> AuthProviderList:
    _require_admin(current_user)
    providers = await provider_repo.list_all(db)
    return AuthProviderList(items=[_serialize(p) for p in providers])


async def get_provider(db: AsyncSession, *, current_user: User, provider_id: str) -> AuthProviderRead:
    _require_admin(current_user)
    provider = await provider_repo.get(db, provider_id)
    if provider is None:
        raise DomainError(status_code=404, code="not_found", title="Not found", detail="Provider not found")
    return _serialize(provider)


async def create_provider(
    db: AsyncSession, *, current_user: User, payload: AuthProviderCreate
) -> AuthProviderRead:
    _require_admin(current_user)
    if payload.type is AuthProviderType.local:
        raise DomainError(
            status_code=409,
            code="local_provider_managed",
            title="Conflict",
            detail="The local provider is built-in and cannot be created",
        )
    validated_config = _validate_config(payload.type, payload.config)
    auto_assign = await _validate_auto_assign_projects(db, payload.auto_assign_projects)
    provider = AuthProvider(
        type=payload.type,
        name=payload.name,
        login_label=payload.login_label or payload.name,
        enabled=payload.enabled,
        sort_order=payload.sort_order,
        auto_provision=payload.auto_provision,
        default_role=payload.default_role,
        new_user_enabled=payload.new_user_enabled,
        allow_email_linking=payload.allow_email_linking,
        local_admin_only=False,
        config=validated_config,
        group_mapping=[entry.model_dump() for entry in payload.group_mapping],
        full_group_sync=payload.full_group_sync,
        auto_assign_projects=auto_assign,
    )
    allowed = SECRET_FIELDS[payload.type]
    _apply_secret_changes(provider, dict(payload.secrets), allowed=allowed)
    if provider.enabled and _missing_requirements(provider):
        raise DomainError(
            status_code=422,
            code="provider_misconfigured",
            title="Invalid request",
            detail="Provider cannot be enabled until required fields are configured",
        )
    db.add(provider)
    await db.flush()
    await audit_service.queue_create_event(
        db,
        action=ACTION_AUTH_PROVIDER_CREATE,
        resource_type=RESOURCE_TYPE,
        entity=provider,
        metadata={"provider_type": provider.type.value, "provider_id": provider.id},
    )
    record_use_case(ACTION_AUTH_PROVIDER_CREATE, outcome="success")
    logger.info(
        "Auth provider created",
        extra={"event": EVENT_USE_CASE_AUTH_PROVIDER, "provider_id": provider.id, "type": provider.type.value},
    )
    return _serialize(provider)


async def update_provider(
    db: AsyncSession, *, current_user: User, provider_id: str, payload: AuthProviderUpdate
) -> AuthProviderRead:
    _require_admin(current_user)
    provider = await provider_repo.get(db, provider_id)
    if provider is None:
        raise DomainError(status_code=404, code="not_found", title="Not found", detail="Provider not found")
    before_state = audit_service.snapshot_entity(provider)

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        provider.name = data["name"]
    if "login_label" in data and data["login_label"] is not None:
        provider.login_label = data["login_label"]
    if "sort_order" in data and data["sort_order"] is not None:
        provider.sort_order = data["sort_order"]
    if provider.type is not AuthProviderType.local:
        if "auto_provision" in data and data["auto_provision"] is not None:
            provider.auto_provision = data["auto_provision"]
        if "default_role" in data and data["default_role"] is not None:
            provider.default_role = data["default_role"]
        if "new_user_enabled" in data and data["new_user_enabled"] is not None:
            provider.new_user_enabled = data["new_user_enabled"]
        if "allow_email_linking" in data and data["allow_email_linking"] is not None:
            provider.allow_email_linking = data["allow_email_linking"]
        if "full_group_sync" in data and data["full_group_sync"] is not None:
            provider.full_group_sync = data["full_group_sync"]
        if payload.config is not None:
            provider.config = _validate_config(provider.type, payload.config)
        if payload.group_mapping is not None:
            provider.group_mapping = [entry.model_dump() for entry in payload.group_mapping]
        if payload.auto_assign_projects is not None:
            provider.auto_assign_projects = await _validate_auto_assign_projects(
                db, payload.auto_assign_projects
            )
        if payload.secrets is not None:
            _apply_secret_changes(provider, payload.secrets, allowed=SECRET_FIELDS[provider.type])
    elif "local_admin_only" in data and data["local_admin_only"] is not None:
        provider.local_admin_only = data["local_admin_only"]

    if "enabled" in data and data["enabled"] is not None:
        provider.enabled = data["enabled"]

    if provider.enabled and _missing_requirements(provider):
        raise DomainError(
            status_code=422,
            code="provider_misconfigured",
            title="Invalid request",
            detail="Provider cannot be enabled until required fields are configured",
        )
    await _assert_admin_path_remains(db, mutated=provider, removing=False)

    await db.flush()
    await audit_service.queue_update_event(
        db,
        action=ACTION_AUTH_PROVIDER_UPDATE,
        resource_type=RESOURCE_TYPE,
        entity=provider,
        before=before_state,
        metadata={"provider_type": provider.type.value, "provider_id": provider.id},
    )
    record_use_case(ACTION_AUTH_PROVIDER_UPDATE, outcome="success")
    logger.info(
        "Auth provider updated",
        extra={"event": EVENT_USE_CASE_AUTH_PROVIDER, "provider_id": provider.id, "type": provider.type.value},
    )
    return _serialize(provider)


async def delete_provider(db: AsyncSession, *, current_user: User, provider_id: str) -> None:
    _require_admin(current_user)
    provider = await provider_repo.get(db, provider_id)
    if provider is None:
        raise DomainError(status_code=404, code="not_found", title="Not found", detail="Provider not found")
    if provider.type is AuthProviderType.local:
        raise DomainError(
            status_code=409,
            code="local_provider_protected",
            title="Conflict",
            detail="The local provider cannot be deleted",
        )
    await _assert_admin_path_remains(db, mutated=provider, removing=True)
    before_state = audit_service.snapshot_entity(provider)
    await db.delete(provider)
    await db.flush()
    await audit_service.queue_delete_event(
        db,
        action=ACTION_AUTH_PROVIDER_DELETE,
        resource_type=RESOURCE_TYPE,
        resource_id=provider_id,
        before=before_state,
        metadata={"provider_type": provider.type.value, "provider_id": provider_id},
    )
    record_use_case(ACTION_AUTH_PROVIDER_DELETE, outcome="success")


async def rotate_secret(
    db: AsyncSession, *, current_user: User, provider_id: str, payload: RotateSecretRequest
) -> AuthProviderRead:
    _require_admin(current_user)
    provider = await provider_repo.get(db, provider_id)
    if provider is None:
        raise DomainError(status_code=404, code="not_found", title="Not found", detail="Provider not found")
    before_state = audit_service.snapshot_entity(provider)
    _apply_secret_changes(
        provider, {payload.secret_name: payload.value}, allowed=SECRET_FIELDS[provider.type]
    )
    await db.flush()
    await audit_service.queue_update_event(
        db,
        action=ACTION_AUTH_PROVIDER_UPDATE,
        resource_type=RESOURCE_TYPE,
        entity=provider,
        before=before_state,
        metadata={"provider_id": provider.id, "rotated_secret": payload.secret_name},
    )
    return _serialize(provider)


# ---------------------------------------------------------------------------
# Test connection (Phase 1: configuration completeness validation only;
# network reachability checks are added with the LDAP/OIDC runtime phases)
# ---------------------------------------------------------------------------


async def _ldap_checks(provider: AuthProvider) -> list[ProviderTestCheck]:
    import anyio

    from app.modules.auth.ldap import client as ldap_client

    results = await anyio.to_thread.run_sync(ldap_client.test_connection, provider)
    return [ProviderTestCheck(name=c.name, passed=c.passed, detail=c.detail) for c in results]


async def _oidc_discovery_checks(provider: AuthProvider) -> list[ProviderTestCheck]:
    effective = effective_oidc_settings(provider)
    try:
        discovery = await fetch_discovery(effective.discovery_url, use_cache=False)
    except OidcDiscoveryError as exc:
        return [ProviderTestCheck(name="discovery", passed=False, detail=str(exc))]
    checks = [ProviderTestCheck(name="discovery", passed=True, detail=discovery.issuer)]
    checks.append(
        ProviderTestCheck(
            name="endpoints",
            passed=bool(discovery.authorization_endpoint and discovery.token_endpoint),
        )
    )
    try:
        await fetch_jwks(discovery.jwks_uri, use_cache=False)
        checks.append(ProviderTestCheck(name="jwks", passed=True))
    except OidcDiscoveryError as exc:
        checks.append(ProviderTestCheck(name="jwks", passed=False, detail=str(exc)))
    return checks


async def test_provider(
    db: AsyncSession, *, current_user: User, provider_id: str
) -> ProviderTestResult:
    _require_admin(current_user)
    provider = await provider_repo.get(db, provider_id)
    if provider is None:
        raise DomainError(status_code=404, code="not_found", title="Not found", detail="Provider not found")

    checks: list[ProviderTestCheck] = []
    if provider.type is AuthProviderType.local:
        checks.append(ProviderTestCheck(name="configuration", passed=True))
    else:
        missing = _missing_requirements(provider)
        config_ok = not missing
        checks.append(
            ProviderTestCheck(
                name="configuration",
                passed=config_ok,
                detail=None if config_ok else f"Missing: {', '.join(missing)}",
            )
        )
        if config_ok and provider.type in {
            AuthProviderType.oidc,
            AuthProviderType.google,
            AuthProviderType.azure,
        }:
            checks.extend(await _oidc_discovery_checks(provider))
        elif config_ok and provider.type is AuthProviderType.ldap:
            checks.extend(await _ldap_checks(provider))

    passed = all(c.passed for c in checks)
    now = datetime.now(timezone.utc)
    provider.last_tested_at = now
    provider.last_test_status = "success" if passed else "fail"
    provider.last_test_error = None if passed else "; ".join(c.detail or c.name for c in checks if not c.passed)
    await db.flush()
    await audit_service.queue_update_event(
        db,
        action=ACTION_AUTH_PROVIDER_TEST,
        resource_type=RESOURCE_TYPE,
        entity=provider,
        before=None,
        metadata={
            "provider_id": provider.id,
            "provider_type": provider.type.value,
            "result": provider.last_test_status,
        },
    )
    record_use_case(ACTION_AUTH_PROVIDER_TEST, outcome=provider.last_test_status)
    return ProviderTestResult(
        status="success" if passed else "fail",
        tested_at=now,
        detail=provider.last_test_error,
        checks=checks,
    )


# ---------------------------------------------------------------------------
# Public login-page configuration & local-login policy
# ---------------------------------------------------------------------------


async def build_public_config(db: AsyncSession) -> PublicAuthConfig:
    all_providers = await provider_repo.list_all(db)
    local = next((p for p in all_providers if p.type is AuthProviderType.local), None)
    # Legacy default: when no local provider row has been provisioned yet,
    # local login stays available (matches pre-feature behavior).
    local_login = PublicLocalLogin(
        enabled=local.enabled if local is not None else True,
        label=(local.login_label if local and local.login_label else DEFAULT_LOCAL_LABEL),
    )
    providers = [p for p in all_providers if p.enabled]
    public_providers: list[PublicProvider] = []
    for provider in providers:
        if provider.type is AuthProviderType.local:
            continue
        if _missing_requirements(provider):
            continue
        public_providers.append(
            PublicProvider(
                id=provider.id,
                type=provider.type,
                label=provider.login_label or provider.name,
                sort_order=provider.sort_order,
                uses_password_form=provider.type in PASSWORD_FORM_TYPES,
            )
        )
    public_providers.sort(key=lambda p: (p.sort_order, p.label))
    return PublicAuthConfig(local_login=local_login, providers=public_providers)


async def assert_local_login_allowed(db: AsyncSession, *, user_is_admin: bool) -> None:
    """Enforce the Local provider policy for the existing /auth/login flow.

    Raises a generic 403 so the caller never reveals provider topology.
    """
    local = await provider_repo.get_local(db)
    # No provisioned local provider row => legacy behavior (allowed).
    if local is not None and (not local.enabled or (local.local_admin_only and not user_is_admin)):
        raise DomainError(
            status_code=403,
            code="local_login_disabled",
            title="Forbidden",
            detail="Unable to sign in with the selected method",
        )


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------


async def ensure_default_local_provider(db: AsyncSession) -> None:
    existing = await provider_repo.get_local(db)
    if existing is not None:
        return
    db.add(
        AuthProvider(
            type=AuthProviderType.local,
            name="Local",
            login_label=DEFAULT_LOCAL_LABEL,
            enabled=True,
            sort_order=0,
            auto_provision=False,
            config={},
        )
    )
