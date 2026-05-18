"""Jira integration service — public orchestration layer (API token auth only).

This module is the single entry-point for all Jira integration business logic.
It delegates to private sub-modules:

  _utils          — constants + normalization utilities
  _adf            — Atlassian Document Format serialization
  _description    — issue summary/description builders
  _mappers        — ORM → schema serializers + settings converters
  _connection_ops — API-token-aware Jira API dispatch

Only public functions (no leading underscore) live here.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import TITLE_BAD_GATEWAY, TITLE_VALIDATION_ERROR
from app.core.errors import DomainError, not_found
from app.core.metrics import record_jira_link_invalid, record_jira_sync_lag
from app.core.token_crypto import encrypt_secret
from app.models.enums import ExternalIssueOwnerType, ExternalIssueProvider, ProjectMemberRole, UserRole
from app.modules.audit.services import audit as audit_service
from app.modules.audit.services.audit import AuditQueueEventParams
from app.modules.integrations.jira.clients.api import JiraApiClient
from app.modules.integrations.jira.models import ExternalIssueLink, JiraConnection, JiraProjectMapping, SystemJiraSettings
from app.modules.integrations.jira.repositories import connections as connection_repo
from app.modules.integrations.jira.repositories import links as link_repo
from app.modules.integrations.jira.repositories import mappings as mapping_repo
from app.modules.integrations.jira.repositories import settings as settings_repo
from app.modules.integrations.jira.schemas.integration import (
    ExternalIssueLinkRead,
    ExternalIssueLinksList,
    JiraConnectCallbackResponse,
    JiraConnectionList,
    JiraConnectionPatch,
    JiraConnectionRead,
    JiraIssueCreateFromRunCaseRequest,
    JiraIssueCreateFromRunCasesRequest,
    JiraIssueLinkRequest,
    JiraIssueLinkRunCasesRequest,
    JiraIssueResolveResponse,
    JiraProjectMappingCreate,
    JiraProjectMappingList,
    JiraProjectMappingPatch,
    JiraProjectMappingRead,
    JiraSystemSettingsRead,
    JiraSystemSettingsUpdate,
    JiraSyncRefreshRequest,
    JiraSyncRefreshResponse,
)
from app.modules.projects.models import User
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.repositories import steps as test_case_step_repo
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.modules.test_runs.repositories import runs as test_run_repo
from app.services.access import ensure_admin, ensure_project_role

from ._adf import _to_jira_adf_text_document
from ._connection_ops import (
    _create_issue_for_connection,
    _get_issue_for_connection,
    _get_project_for_connection,
)
from ._description import (
    _build_default_issue_description,
    _build_default_issue_summary,
    _bulk_issue_description_from_payload,
    _default_summary_for_bulk_issue,
    _normalize_jira_issue_payload,
    _pick_issue_type_id_from_project_payload,
)
from ._mappers import (
    _default_settings_read_from_env,
    _runtime_settings_from_env,
    _runtime_settings_from_row,
    _serialize_connection,
    _serialize_link,
    _serialize_mapping,
    _serialize_system_settings,
)
from ._utils import (
    JIRA_SETTINGS_DEFAULT_ID,
    WORKSPACE_DEFAULT_ID,
    _cloud_id_for_api_token_site,
    _extract_issue_key,
    _normalize_list,
    _normalize_run_case_ids,
    _normalize_text,
    _now,
)

__all__ = [
    "WORKSPACE_DEFAULT_ID",
    "JIRA_SETTINGS_DEFAULT_ID",
    # public functions
    "get_runtime_client_settings",
    "get_system_settings",
    "upsert_system_settings",
    "connect_with_api_token",
    "list_connections",
    "disconnect_connection",
    "patch_connection",
    "list_mappings",
    "create_mapping",
    "patch_mapping",
    "delete_mapping",
    "resolve_issue",
    "list_owner_links",
    "link_issue",
    "unlink_issue",
    "create_issue_from_run_case",
    "create_issue_from_run_cases",
    "link_issue_to_run_cases",
    "refresh_sync",
    "refresh_sync_internal",
]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


async def get_runtime_client_settings(db: AsyncSession) -> Any:
    """Return runtime Jira client settings from DB row or env fallback."""
    settings = await settings_repo.get_default(db)
    if settings is None:
        return _runtime_settings_from_env()
    return _runtime_settings_from_row(settings)


async def get_system_settings(db: AsyncSession, *, current_user: User) -> JiraSystemSettingsRead:
    await ensure_admin(current_user, action="settings.jira.read")
    settings = await settings_repo.get_default(db)
    if settings is None:
        return _default_settings_read_from_env()
    return _serialize_system_settings(settings)


async def upsert_system_settings(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraSystemSettingsUpdate,
) -> JiraSystemSettingsRead:
    await ensure_admin(current_user, action="settings.jira.update")
    settings = await settings_repo.get_default(db)
    creating = settings is None
    if settings is None:
        settings = SystemJiraSettings(id=JIRA_SETTINGS_DEFAULT_ID)
        db.add(settings)
        await db.flush()
    before_state = audit_service.snapshot_entity(settings) if not creating else None
    settings.enabled = payload.enabled
    settings.api_token_site_url = _normalize_text(payload.api_token_site_url)
    settings.api_token_email = _normalize_text(payload.api_token_email)
    settings.api_base_url = _normalize_text(payload.api_base_url)
    settings.http_timeout_seconds = float(payload.http_timeout_seconds)
    settings.http_max_retries = int(payload.http_max_retries)
    settings.sync_default_interval_seconds = int(payload.sync_default_interval_seconds)

    if payload.api_token is not None:
        api_token = _normalize_text(payload.api_token)
        settings.api_token_encrypted = encrypt_secret(api_token) if api_token else None

    _require_complete_jira_api_token_credentials(settings)

    await db.flush()
    if creating:
        await audit_service.queue_create_event(
            db,
            action="jira.settings.create",
            resource_type="jira_settings",
            entity=settings,
            tenant_id=WORKSPACE_DEFAULT_ID,
        )
    else:
        await audit_service.queue_update_event(
            db,
            action="jira.settings.update",
            resource_type="jira_settings",
            entity=settings,
            before=before_state or {},
            tenant_id=WORKSPACE_DEFAULT_ID,
        )
    return _serialize_system_settings(settings)


def _require_complete_jira_api_token_credentials(settings: SystemJiraSettings) -> None:
    if not settings.enabled:
        return
    if not settings.api_token_site_url or not settings.api_token_email or not settings.api_token_encrypted:
        raise DomainError(
            status_code=422,
            code="jira_settings_incomplete",
            title=TITLE_VALIDATION_ERROR,
            detail="When Jira is enabled, site URL, account email, and API token are required",
        )


# ---------------------------------------------------------------------------
# API token connect flow
# ---------------------------------------------------------------------------


def _ensure_api_token_configured(client: JiraApiClient) -> None:
    enabled = bool(getattr(client, "enabled", True))
    site_url = _normalize_text(getattr(client, "api_token_site_url", ""))
    api_email = _normalize_text(getattr(client, "api_token_email", ""))
    api_token = _normalize_text(getattr(client, "api_token", ""))

    if not enabled:
        raise DomainError(
            status_code=409,
            code="jira_integration_disabled",
            title="Conflict",
            detail="Jira integration is disabled in settings",
        )
    if not site_url or not api_email or not api_token:
        raise DomainError(
            status_code=422,
            code="jira_settings_incomplete",
            title=TITLE_VALIDATION_ERROR,
            detail="API token mode requires site URL, account email and API token",
        )


async def connect_with_api_token(
    db: AsyncSession,
    *,
    current_user: User,
    client: JiraApiClient,
) -> JiraConnectCallbackResponse:
    await ensure_admin(current_user, action="jira.connect.api_token")
    _ensure_api_token_configured(client)

    site_url = _normalize_text(client.api_token_site_url)
    account_email = _normalize_text(client.api_token_email)
    api_token = _normalize_text(client.api_token)

    await client.get_myself_by_site(site_url=site_url, email=account_email, api_token=api_token)
    cloud_id = _cloud_id_for_api_token_site(site_url)

    connection = await connection_repo.get_by_workspace_and_cloud(
        db,
        workspace_id=WORKSPACE_DEFAULT_ID,
        cloud_id=cloud_id,
    )
    if connection is None:
        connection = JiraConnection(
            workspace_id=WORKSPACE_DEFAULT_ID,
            cloud_id=cloud_id,
            site_url=site_url,
            account_id=account_email,
            enabled=True,
            access_token_encrypted=encrypt_secret(api_token),
            connected_at=_now(),
        )
        db.add(connection)
        await db.flush()
        await audit_service.queue_create_event(
            db,
            action="jira.connection.connect_api_token",
            resource_type="jira_connection",
            entity=connection,
            tenant_id=WORKSPACE_DEFAULT_ID,
        )
    else:
        before_state = audit_service.snapshot_entity(connection)
        connection.site_url = site_url
        connection.account_id = account_email
        connection.enabled = True
        connection.access_token_encrypted = encrypt_secret(api_token)
        connection.last_sync_error = None
        connection.last_sync_retry_count = 0
        await db.flush()
        await audit_service.queue_update_event(
            db,
            action="jira.connection.reconnect_api_token",
            resource_type="jira_connection",
            entity=connection,
            before=before_state,
            tenant_id=WORKSPACE_DEFAULT_ID,
        )

    return JiraConnectCallbackResponse(connection=_serialize_connection(connection))


# ---------------------------------------------------------------------------
# Connections CRUD
# ---------------------------------------------------------------------------


async def list_connections(db: AsyncSession, *, _current_user: User) -> JiraConnectionList:
    connections = await connection_repo.list_by_workspace(db, WORKSPACE_DEFAULT_ID)
    return JiraConnectionList(items=[_serialize_connection(item) for item in connections])


async def disconnect_connection(
    db: AsyncSession,
    *,
    current_user: User,
    connection_id: str,
) -> None:
    await ensure_admin(current_user, action="jira.disconnect")
    connection = await connection_repo.get_by_id(db, connection_id)
    if not connection:
        raise not_found("jira_connection")
    before_state = audit_service.snapshot_entity(connection)
    await audit_service.queue_delete_event(
        db,
        action="jira.connection.disconnect",
        resource_type="jira_connection",
        resource_id=connection.id,
        before=before_state,
        tenant_id=connection.workspace_id,
    )
    await db.delete(connection)


async def patch_connection(
    db: AsyncSession,
    *,
    current_user: User,
    connection_id: str,
    payload: JiraConnectionPatch,
) -> JiraConnectionRead:
    await ensure_admin(current_user, action="jira.connection.patch")
    connection = await connection_repo.get_by_id(db, connection_id)
    if not connection:
        raise not_found("jira_connection")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return _serialize_connection(connection)
    before_state = audit_service.snapshot_entity(connection)
    if "enabled" in changes:
        connection.enabled = bool(changes["enabled"])
    await db.flush()
    await audit_service.queue_update_event(
        db,
        action="jira.connection.update",
        resource_type="jira_connection",
        entity=connection,
        before=before_state,
        tenant_id=connection.workspace_id,
    )
    return _serialize_connection(connection)


# ---------------------------------------------------------------------------
# Project mappings CRUD
# ---------------------------------------------------------------------------


async def list_mappings(
    db: AsyncSession,
    *,
    current_user: User,
    project_id: str | None = None,
) -> JiraProjectMappingList:
    if project_id:
        await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
        mappings = await mapping_repo.list_by_project(db, project_id)
    elif current_user.role == UserRole.admin:
        mappings = await mapping_repo.list_all(db)
    else:
        mappings = await mapping_repo.list_for_user(db, current_user.id)
    return JiraProjectMappingList(items=[_serialize_mapping(item) for item in mappings])


async def create_mapping(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraProjectMappingCreate,
    client: JiraApiClient,
) -> JiraProjectMappingRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    existing = await mapping_repo.get_by_project(db, payload.project_id)
    if existing:
        raise DomainError(
            status_code=409,
            code="jira_mapping_exists",
            title="Conflict",
            detail="Jira mapping already exists for this project",
        )
    connection = await _resolve_connection_for_mapping(db, payload=payload)
    await _get_project_for_connection(
        db=db,
        connection=connection,
        project_key=payload.jira_project_key.strip().upper(),
        client=client,
    )
    mapping = JiraProjectMapping(
        project_id=payload.project_id,
        jira_connection_id=connection.id,
        jira_project_key=payload.jira_project_key.strip().upper(),
        default_issue_type_id=payload.default_issue_type_id,
        default_labels=_normalize_list(payload.default_labels),
        default_components=_normalize_list(payload.default_components),
        active=payload.active,
    )
    db.add(mapping)
    await db.flush()
    await audit_service.queue_create_event(
        db,
        action="jira.mapping.create",
        resource_type="jira_mapping",
        entity=mapping,
        tenant_id=payload.project_id,
    )
    return _serialize_mapping(mapping)


async def patch_mapping(
    db: AsyncSession,
    *,
    current_user: User,
    mapping_id: str,
    payload: JiraProjectMappingPatch,
    client: JiraApiClient,
) -> JiraProjectMappingRead:
    mapping = await mapping_repo.get_by_id(db, mapping_id)
    if not mapping:
        raise not_found("jira_mapping")
    await ensure_project_role(db, current_user, mapping.project_id, ProjectMemberRole.lead)
    before_state = audit_service.snapshot_entity(mapping)
    changes = payload.model_dump(exclude_unset=True)
    if "jira_project_key" in changes and changes["jira_project_key"]:
        connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
        if not connection:
            raise not_found("jira_connection")
        project_key = str(changes["jira_project_key"]).strip().upper()
        await _get_project_for_connection(db=db, connection=connection, project_key=project_key, client=client)
        mapping.jira_project_key = project_key
    if "default_issue_type_id" in changes:
        mapping.default_issue_type_id = changes["default_issue_type_id"]
    if "default_labels" in changes:
        mapping.default_labels = _normalize_list(changes["default_labels"])
    if "default_components" in changes:
        mapping.default_components = _normalize_list(changes["default_components"])
    if "active" in changes:
        mapping.active = bool(changes["active"])
    await db.flush()
    await audit_service.queue_update_event(
        db,
        action="jira.mapping.update",
        resource_type="jira_mapping",
        entity=mapping,
        before=before_state,
        tenant_id=mapping.project_id,
    )
    return _serialize_mapping(mapping)


async def delete_mapping(
    db: AsyncSession,
    *,
    current_user: User,
    mapping_id: str,
) -> None:
    mapping = await mapping_repo.get_by_id(db, mapping_id)
    if not mapping:
        raise not_found("jira_mapping")
    await ensure_project_role(db, current_user, mapping.project_id, ProjectMemberRole.lead)
    before_state = audit_service.snapshot_entity(mapping)
    await audit_service.queue_delete_event(
        db,
        action="jira.mapping.delete",
        resource_type="jira_mapping",
        resource_id=mapping.id,
        before=before_state,
        tenant_id=mapping.project_id,
    )
    await db.delete(mapping)


# ---------------------------------------------------------------------------
# Issue resolve / link / unlink
# ---------------------------------------------------------------------------


async def resolve_issue(
    db: AsyncSession,
    *,
    current_user: User,
    key: str,
    project_id: str | None,
    client: JiraApiClient,
) -> JiraIssueResolveResponse:
    issue_key = _extract_issue_key(key)
    if project_id:
        await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
        mapping = await _get_active_mapping_for_project(db, project_id=project_id)
        connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
        if not connection:
            raise not_found("jira_connection")
        issue = await _get_issue_for_connection(db=db, connection=connection, issue_key=issue_key, client=client)
        return JiraIssueResolveResponse(**_normalize_jira_issue_payload(issue=issue, site_url=connection.site_url))

    connections = await connection_repo.list_by_workspace(db, WORKSPACE_DEFAULT_ID)
    if not connections:
        raise DomainError(
            status_code=409,
            code="jira_connection_not_found",
            title="Conflict",
            detail="No Jira connection configured",
        )
    errors: list[DomainError] = []
    for connection in connections:
        try:
            issue = await _get_issue_for_connection(db=db, connection=connection, issue_key=issue_key, client=client)
            return JiraIssueResolveResponse(**_normalize_jira_issue_payload(issue=issue, site_url=connection.site_url))
        except DomainError as exc:
            errors.append(exc)
            continue
    if errors:
        raise errors[-1]
    raise not_found("jira_issue")


async def list_owner_links(
    db: AsyncSession,
    *,
    current_user: User,
    owner_type: ExternalIssueOwnerType,
    owner_id: str,
) -> ExternalIssueLinksList:
    project_id = await _resolve_owner_project_id(db, owner_type=owner_type, owner_id=owner_id)
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    items = await link_repo.list_by_owner(
        db,
        provider=ExternalIssueProvider.jira,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    return ExternalIssueLinksList(items=[_serialize_link(item) for item in items])


async def link_issue(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraIssueLinkRequest,
    client: JiraApiClient,
) -> ExternalIssueLinkRead:
    project_id = await _resolve_owner_project_id(db, owner_type=payload.owner_type, owner_id=payload.owner_id)
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)
    mapping = await _get_active_mapping_for_project(db, project_id=project_id)
    connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
    if not connection:
        raise not_found("jira_connection")

    issue_key = _extract_issue_key(payload.issue_key_or_url)
    existing = await link_repo.find_by_owner_and_external_key(
        db,
        provider=ExternalIssueProvider.jira,
        owner_type=payload.owner_type,
        owner_id=payload.owner_id,
        external_key=issue_key,
    )
    if existing:
        return _serialize_link(existing)

    issue = await _get_issue_for_connection(db=db, connection=connection, issue_key=issue_key, client=client)
    normalized = _normalize_jira_issue_payload(issue=issue, site_url=connection.site_url)
    link = ExternalIssueLink(
        provider=ExternalIssueProvider.jira,
        project_id=project_id,
        owner_type=payload.owner_type,
        owner_id=payload.owner_id,
        external_key=issue_key,
        external_url=str(normalized["url"] or ""),
        snapshot_status=normalized["status"],
        snapshot_summary=normalized["summary"],
        snapshot_priority=normalized["priority"],
        snapshot_assignee=normalized["assignee"],
        snapshot_assignee_account_id=normalized["assignee_account_id"],
        snapshot_last_synced_at=_now(),
        created_by=current_user.id,
    )
    db.add(link)
    await db.flush()
    await audit_service.queue_create_event(
        db,
        action="jira.issue.link",
        resource_type="external_issue_link",
        entity=link,
        tenant_id=project_id,
        metadata={"owner_type": payload.owner_type.value, "owner_id": payload.owner_id},
    )
    return _serialize_link(link)


async def unlink_issue(db: AsyncSession, *, current_user: User, link_id: str) -> None:
    link = await link_repo.get_by_id(db, link_id)
    if not link:
        raise not_found("external_issue_link")
    await ensure_project_role(db, current_user, link.project_id, ProjectMemberRole.tester)
    before_state = audit_service.snapshot_entity(link)
    await audit_service.queue_delete_event(
        db,
        action="jira.issue.unlink",
        resource_type="external_issue_link",
        resource_id=link.id,
        before=before_state,
        tenant_id=link.project_id,
    )
    await db.delete(link)


# ---------------------------------------------------------------------------
# Issue creation from run case(s)
# ---------------------------------------------------------------------------


async def create_issue_from_run_case(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraIssueCreateFromRunCaseRequest,
    client: JiraApiClient,
) -> ExternalIssueLinkRead:
    run_case = await run_item_repo.get_by_id(db, payload.run_case_id)
    if not run_case:
        raise not_found("run_case")
    run = await test_run_repo.get_by_id(db, run_case.test_run_id)
    if not run:
        raise not_found("test_run")
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    if run_case.status.value not in {"error", "failure", "blocked"}:
        raise DomainError(
            status_code=409,
            code="jira_issue_create_not_allowed",
            title="Conflict",
            detail="Jira issue can be created only for failed/error/blocked run cases",
        )

    mapping = await _get_active_mapping_for_project(db, project_id=run.project_id)
    connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
    if not connection:
        raise not_found("jira_connection")

    existing_link = await _existing_run_case_link_for_idempotency(
        db, run_case_id=run_case.id, raw_idempotency_key=payload.idempotency_key
    )
    if existing_link:
        return _serialize_link(existing_link)

    idempotency_key = payload.idempotency_key.strip() if payload.idempotency_key else None
    summary = (
        payload.summary.strip()
        if payload.summary and payload.summary.strip()
        else _build_default_issue_summary(run_case=run_case, run_name=run.name)
    )
    test_case = await test_case_repo.get_by_id(db, run_case.test_case_id)
    steps = await test_case_step_repo.list_by_test_case(db, run_case.test_case_id) if test_case else []
    comment_for_jira, actual_result_for_jira = await _comment_and_actual_for_run_case_jira(db, run_case)
    description = (
        payload.description.strip()
        if payload.description and payload.description.strip()
        else _build_default_issue_description(
            run_case=run_case,
            run=run,
            test_case=test_case,
            steps=steps,
            comment_override=comment_for_jira,
            actual_result_override=actual_result_for_jira,
        )
    )

    fields = await _compose_jira_issue_fields_for_run_case(
        db, mapping=mapping, connection=connection, payload=payload, summary=summary, description=description, client=client
    )
    created = await _create_issue_for_connection(db=db, connection=connection, fields=fields, client=client)
    issue_key = str(created.get("key") or "")
    if not issue_key:
        raise DomainError(
            status_code=502,
            code="jira_issue_create_failed",
            title=TITLE_BAD_GATEWAY,
            detail="Jira issue create response does not contain issue key",
        )
    issue = await _get_issue_for_connection(db=db, connection=connection, issue_key=issue_key, client=client)
    normalized = _normalize_jira_issue_payload(issue=issue, site_url=connection.site_url)
    link = ExternalIssueLink(
        provider=ExternalIssueProvider.jira,
        project_id=run.project_id,
        owner_type=ExternalIssueOwnerType.run_case,
        owner_id=run_case.id,
        external_key=issue_key,
        external_url=str(normalized["url"] or ""),
        snapshot_status=normalized["status"],
        snapshot_summary=normalized["summary"],
        snapshot_priority=normalized["priority"],
        snapshot_assignee=normalized["assignee"],
        snapshot_assignee_account_id=normalized["assignee_account_id"],
        snapshot_last_synced_at=_now(),
        created_by=current_user.id,
        creation_idempotency_key=idempotency_key,
    )
    db.add(link)
    await db.flush()
    await audit_service.queue_create_event(
        db,
        action="jira.issue.create_from_run_case",
        resource_type="external_issue_link",
        entity=link,
        tenant_id=run.project_id,
        metadata={"run_case_id": run_case.id},
    )
    return _serialize_link(link)


async def create_issue_from_run_cases(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraIssueCreateFromRunCasesRequest,
    client: JiraApiClient,
) -> ExternalIssueLinksList:
    run_cases, runs_by_id, project_id = await _load_bulk_run_cases(
        db, run_case_ids=payload.run_case_ids, current_user=current_user
    )
    for run_case in run_cases:
        if run_case.status.value not in {"error", "failure", "blocked"}:
            raise DomainError(
                status_code=409,
                code="jira_issue_create_not_allowed",
                title="Conflict",
                detail="Jira issue can be created only for failed/error/blocked run cases",
            )

    mapping = await _get_active_mapping_for_project(db, project_id=project_id)
    connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
    if not connection:
        raise not_found("jira_connection")

    idempotency_key = payload.idempotency_key.strip() if payload.idempotency_key else None
    first_existing = await _first_bulk_idempotency_link(db, run_cases, payload.idempotency_key)

    if first_existing:
        issue = await _get_issue_for_connection(
            db=db, connection=connection, issue_key=first_existing.external_key, client=client
        )
        normalized = _normalize_jira_issue_payload(issue=issue, site_url=connection.site_url)
        linked = await _link_issue_to_run_cases_with_snapshot(
            db,
            run_cases=run_cases,
            project_id=project_id,
            issue_key=first_existing.external_key,
            issue_snapshot=normalized,
            idempotency_key=idempotency_key,
            current_user=current_user,
        )
        return ExternalIssueLinksList(items=linked)

    default_summary = _default_summary_for_bulk_issue(run_cases, runs_by_id)
    summary = payload.summary.strip() if payload.summary and payload.summary.strip() else default_summary
    description = _bulk_issue_description_from_payload(payload, run_cases, runs_by_id)

    fields = await _compose_jira_issue_fields_for_run_case(
        db, mapping=mapping, connection=connection, payload=payload, summary=summary, description=description, client=client
    )
    created = await _create_issue_for_connection(db=db, connection=connection, fields=fields, client=client)
    issue_key = str(created.get("key") or "")
    if not issue_key:
        raise DomainError(
            status_code=502,
            code="jira_issue_create_failed",
            title=TITLE_BAD_GATEWAY,
            detail="Jira issue create response does not contain issue key",
        )
    issue = await _get_issue_for_connection(db=db, connection=connection, issue_key=issue_key, client=client)
    normalized = _normalize_jira_issue_payload(issue=issue, site_url=connection.site_url)
    linked = await _link_issue_to_run_cases_with_snapshot(
        db,
        run_cases=run_cases,
        project_id=project_id,
        issue_key=issue_key,
        issue_snapshot=normalized,
        idempotency_key=idempotency_key,
        current_user=current_user,
    )
    return ExternalIssueLinksList(items=linked)


async def link_issue_to_run_cases(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraIssueLinkRunCasesRequest,
    client: JiraApiClient,
) -> ExternalIssueLinksList:
    run_cases, _, project_id = await _load_bulk_run_cases(
        db, run_case_ids=payload.run_case_ids, current_user=current_user
    )
    mapping = await _get_active_mapping_for_project(db, project_id=project_id)
    connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
    if not connection:
        raise not_found("jira_connection")

    issue_key = _extract_issue_key(payload.issue_key_or_url)
    issue = await _get_issue_for_connection(db=db, connection=connection, issue_key=issue_key, client=client)
    normalized = _normalize_jira_issue_payload(issue=issue, site_url=connection.site_url)
    linked = await _link_issue_to_run_cases_with_snapshot(
        db,
        run_cases=run_cases,
        project_id=project_id,
        issue_key=issue_key,
        issue_snapshot=normalized,
        idempotency_key=None,
        current_user=current_user,
    )
    return ExternalIssueLinksList(items=linked)


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------


async def refresh_sync(
    db: AsyncSession,
    *,
    current_user: User,
    payload: JiraSyncRefreshRequest,
    client: JiraApiClient,
) -> JiraSyncRefreshResponse:
    await ensure_admin(current_user, action="jira.sync.refresh")
    result = await _refresh_sync_core(db, payload=payload, client=client)
    if result.processed > 0:
        await audit_service.queue_event(
            db,
            params=AuditQueueEventParams(
                action="jira.sync.refresh",
                resource_type="jira_sync",
                resource_id=None,
                metadata={
                    "project_id": payload.project_id,
                    "processed": result.processed,
                    "updated": result.updated,
                    "invalid": result.invalid,
                    "errors": result.errors,
                },
                tenant_id=payload.project_id,
            ),
        )
    return result


async def refresh_sync_internal(
    db: AsyncSession,
    *,
    project_id: str | None = None,
    client: JiraApiClient | None = None,
) -> JiraSyncRefreshResponse:
    runtime_client = client
    if runtime_client is None:
        runtime_client = JiraApiClient(runtime_settings=await get_runtime_client_settings(db))
    return await _refresh_sync_core(
        db,
        payload=JiraSyncRefreshRequest(project_id=project_id),
        client=runtime_client,
    )


# ---------------------------------------------------------------------------
# Private orchestration helpers
# ---------------------------------------------------------------------------


async def _resolve_owner_project_id(
    db: AsyncSession,
    *,
    owner_type: ExternalIssueOwnerType,
    owner_id: str,
) -> str:
    if owner_type == ExternalIssueOwnerType.run_case:
        run_case = await run_item_repo.get_by_id(db, owner_id)
        if not run_case:
            raise not_found("run_case")
        run = await test_run_repo.get_by_id(db, run_case.test_run_id)
        if not run:
            raise not_found("test_run")
        return run.project_id
    if owner_type == ExternalIssueOwnerType.test_case:
        test_case = await test_case_repo.get_by_id(db, owner_id)
        if not test_case:
            raise not_found("test_case")
        return test_case.project_id
    if owner_type == ExternalIssueOwnerType.test_run:
        run = await test_run_repo.get_by_id(db, owner_id)
        if not run:
            raise not_found("test_run")
        return run.project_id
    raise DomainError(
        status_code=422,
        code="unsupported_owner_type",
        title=TITLE_VALIDATION_ERROR,
        detail=f"Unsupported owner_type: {owner_type.value}",
    )


async def _get_active_mapping_for_project(db: AsyncSession, *, project_id: str) -> JiraProjectMapping:
    mapping = await mapping_repo.get_by_project(db, project_id)
    if not mapping or not mapping.active:
        raise DomainError(
            status_code=409,
            code="jira_mapping_not_configured",
            title="Conflict",
            detail="Active Jira mapping is not configured for this project",
        )
    return mapping


async def _resolve_connection_for_mapping(
    db: AsyncSession,
    *,
    payload: JiraProjectMappingCreate,
) -> JiraConnection:
    if payload.jira_connection_id:
        connection = await connection_repo.get_by_id(db, payload.jira_connection_id)
        if not connection:
            raise not_found("jira_connection")
        return connection
    connections = await connection_repo.list_by_workspace(db, WORKSPACE_DEFAULT_ID)
    if len(connections) != 1:
        raise DomainError(
            status_code=422,
            code="jira_connection_required",
            title=TITLE_VALIDATION_ERROR,
            detail="Specify jira_connection_id when multiple Jira connections exist",
            errors={"jira_connection_id": ["connection is required when multiple Jira sites are connected"]},
        )
    return connections[0]


async def _compose_jira_issue_fields_for_run_case(
    db: AsyncSession,
    *,
    mapping: JiraProjectMapping,
    connection: JiraConnection,
    payload: JiraIssueCreateFromRunCaseRequest | JiraIssueCreateFromRunCasesRequest,
    summary: str,
    description: str,
    client: JiraApiClient,
) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "project": {"key": mapping.jira_project_key},
        "summary": summary,
        "description": _to_jira_adf_text_document(description),
    }
    issue_type_id = payload.issue_type_id or mapping.default_issue_type_id
    if not issue_type_id:
        project_payload = await _get_project_for_connection(
            db=db, connection=connection, project_key=mapping.jira_project_key, client=client
        )
        issue_type_id = _pick_issue_type_id_from_project_payload(project_payload)
    if issue_type_id:
        fields["issuetype"] = {"id": issue_type_id}
    labels = _normalize_list(mapping.default_labels) + _normalize_list(payload.labels)
    if labels:
        fields["labels"] = sorted(set(labels))
    components = _normalize_list(mapping.default_components) + _normalize_list(payload.components)
    if components:
        fields["components"] = [{"name": item} for item in sorted(set(components))]
    return fields


async def _load_bulk_run_cases(
    db: AsyncSession,
    *,
    run_case_ids: list[str],
    current_user: User,
) -> tuple[list[Any], dict[str, Any], str]:
    normalized_ids = _normalize_run_case_ids(run_case_ids)
    run_cases: list[Any] = []
    for run_case_id in normalized_ids:
        run_case = await run_item_repo.get_by_id(db, run_case_id)
        if not run_case:
            raise not_found("run_case")
        run_cases.append(run_case)

    runs_by_id: dict[str, Any] = {}
    project_ids: set[str] = set()
    for run_case in run_cases:
        run = runs_by_id.get(run_case.test_run_id)
        if run is None:
            run = await test_run_repo.get_by_id(db, run_case.test_run_id)
            if not run:
                raise not_found("test_run")
            runs_by_id[run_case.test_run_id] = run
        project_ids.add(run.project_id)

    if len(project_ids) != 1:
        raise DomainError(
            status_code=422,
            code="jira_bulk_requires_single_project",
            title=TITLE_VALIDATION_ERROR,
            detail="Bulk Jira operations require run cases from a single project",
        )
    project_id = next(iter(project_ids))
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)
    return run_cases, runs_by_id, project_id


async def _link_issue_to_run_cases_with_snapshot(
    db: AsyncSession,
    *,
    run_cases: list[Any],
    project_id: str,
    issue_key: str,
    issue_snapshot: dict[str, Any],
    idempotency_key: str | None,
    current_user: User,
) -> list[ExternalIssueLinkRead]:
    items: list[ExternalIssueLinkRead] = []
    for run_case in run_cases:
        if idempotency_key:
            existing_by_idempotency = await link_repo.find_by_idempotency_key(
                db,
                provider=ExternalIssueProvider.jira,
                owner_type=ExternalIssueOwnerType.run_case,
                owner_id=run_case.id,
                idempotency_key=idempotency_key,
            )
            if existing_by_idempotency:
                items.append(_serialize_link(existing_by_idempotency))
                continue

        existing = await link_repo.find_by_owner_and_external_key(
            db,
            provider=ExternalIssueProvider.jira,
            owner_type=ExternalIssueOwnerType.run_case,
            owner_id=run_case.id,
            external_key=issue_key,
        )
        if existing:
            items.append(_serialize_link(existing))
            continue

        link = ExternalIssueLink(
            provider=ExternalIssueProvider.jira,
            project_id=project_id,
            owner_type=ExternalIssueOwnerType.run_case,
            owner_id=run_case.id,
            external_key=issue_key,
            external_url=str(issue_snapshot["url"] or ""),
            snapshot_status=issue_snapshot["status"],
            snapshot_summary=issue_snapshot["summary"],
            snapshot_priority=issue_snapshot["priority"],
            snapshot_assignee=issue_snapshot["assignee"],
            snapshot_assignee_account_id=issue_snapshot["assignee_account_id"],
            snapshot_last_synced_at=_now(),
            created_by=current_user.id,
            creation_idempotency_key=idempotency_key,
        )
        db.add(link)
        await db.flush()
        await audit_service.queue_create_event(
            db,
            action="jira.issue.link_bulk",
            resource_type="external_issue_link",
            entity=link,
            tenant_id=project_id,
            metadata={"owner_type": ExternalIssueOwnerType.run_case.value, "owner_id": run_case.id},
        )
        items.append(_serialize_link(link))
    return items


async def _comment_and_actual_for_run_case_jira(
    db: AsyncSession,
    run_case: object,
) -> tuple[str, str]:
    comment_for_jira = _normalize_text(getattr(run_case, "comment", None))
    actual_result_for_jira = _normalize_text(getattr(run_case, "actual_result", None))
    latest_row = await run_item_repo.get_latest_row_by_run_case(db, run_case.id)
    if latest_row is not None:
        if not comment_for_jira:
            comment_for_jira = _normalize_text(latest_row.comment)
        if not actual_result_for_jira:
            actual_result_for_jira = _normalize_text(latest_row.actual_result)
    return comment_for_jira, actual_result_for_jira


async def _existing_run_case_link_for_idempotency(
    db: AsyncSession,
    *,
    run_case_id: str,
    raw_idempotency_key: str | None,
) -> ExternalIssueLink | None:
    idempotency_key = raw_idempotency_key.strip() if raw_idempotency_key else None
    if not idempotency_key:
        return None
    return await link_repo.find_by_idempotency_key(
        db,
        provider=ExternalIssueProvider.jira,
        owner_type=ExternalIssueOwnerType.run_case,
        owner_id=run_case_id,
        idempotency_key=idempotency_key,
    )


async def _first_bulk_idempotency_link(
    db: AsyncSession,
    run_cases: list,
    raw_idempotency_key: str | None,
) -> ExternalIssueLink | None:
    idempotency_key = raw_idempotency_key.strip() if raw_idempotency_key else None
    if not idempotency_key:
        return None
    for run_case in run_cases:
        existing = await link_repo.find_by_idempotency_key(
            db,
            provider=ExternalIssueProvider.jira,
            owner_type=ExternalIssueOwnerType.run_case,
            owner_id=run_case.id,
            idempotency_key=idempotency_key,
        )
        if existing:
            return existing
    return None


async def _refresh_sync_core(
    db: AsyncSession,
    *,
    payload: JiraSyncRefreshRequest,
    client: JiraApiClient,
) -> JiraSyncRefreshResponse:
    processed = updated = invalid = errors = 0
    links = await link_repo.list_for_sync(db, provider=ExternalIssueProvider.jira, project_id=payload.project_id)
    for link in links:
        processed += 1
        connection = await _connection_for_jira_link_refresh(db, link)
        if connection is None:
            invalid += 1
            continue
        outcome = await _refresh_jira_link_issue_snapshot(db, link, connection, client)
        if outcome == "updated":
            updated += 1
        elif outcome == "invalid":
            invalid += 1
        else:
            errors += 1
    return JiraSyncRefreshResponse(processed=processed, updated=updated, invalid=invalid, errors=errors)


def _mark_jira_link_invalid_for_sync(link: ExternalIssueLink, reason: str) -> None:
    link.is_invalid = True
    link.invalid_reason = reason
    link.snapshot_last_synced_at = _now()
    record_jira_link_invalid(reason=reason)


async def _connection_for_jira_link_refresh(
    db: AsyncSession,
    link: ExternalIssueLink,
) -> JiraConnection | None:
    mapping = await mapping_repo.get_by_project(db, link.project_id)
    if not mapping or not mapping.active:
        _mark_jira_link_invalid_for_sync(link, "jira_mapping_not_configured")
        return None
    connection = await connection_repo.get_by_id(db, mapping.jira_connection_id)
    if not connection:
        _mark_jira_link_invalid_for_sync(link, "jira_connection_not_found")
        return None
    if not connection.enabled:
        _mark_jira_link_invalid_for_sync(link, "jira_integration_disabled")
        return None
    return connection


async def _refresh_jira_link_issue_snapshot(
    db: AsyncSession,
    link: ExternalIssueLink,
    connection: JiraConnection,
    client: JiraApiClient,
) -> str:
    """Return 'updated', 'invalid', or 'error'."""
    from datetime import timezone

    try:
        issue = await _get_issue_for_connection(
            db=db, connection=connection, issue_key=link.external_key, client=client
        )
        normalized = _normalize_jira_issue_payload(issue=issue, site_url=connection.site_url)
        previous_sync = link.snapshot_last_synced_at
        link.external_url = str(normalized["url"] or link.external_url)
        link.snapshot_status = normalized["status"]
        link.snapshot_summary = normalized["summary"]
        link.snapshot_priority = normalized["priority"]
        link.snapshot_assignee = normalized["assignee"]
        link.snapshot_assignee_account_id = normalized["assignee_account_id"]
        link.snapshot_last_synced_at = _now()
        link.is_invalid = False
        link.invalid_reason = None
        if previous_sync:
            prev = previous_sync
            if prev.tzinfo is None:
                prev = prev.replace(tzinfo=timezone.utc)
            record_jira_sync_lag(seconds=max(0.0, (_now() - prev).total_seconds()))
        return "updated"
    except DomainError as exc:
        if exc.code in {"jira_resource_not_found", "jira_forbidden"}:
            _mark_jira_link_invalid_for_sync(link, exc.code)
            return "invalid"
        link.invalid_reason = f"sync_error:{exc.code}"
        return "error"
