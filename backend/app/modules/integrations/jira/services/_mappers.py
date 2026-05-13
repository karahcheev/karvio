"""Schema serializers and settings-to-runtime converters.

Transforms ORM models and DB rows into Pydantic read-schemas, and converts
SystemJiraSettings / env-config into JiraClientRuntimeSettings.  Pure
data-transformation — no DB writes or external calls.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.token_crypto import decrypt_secret
from app.modules.integrations.jira.clients.api import JiraClientRuntimeSettings
from app.modules.integrations.jira.models import ExternalIssueLink, JiraConnection, JiraProjectMapping, SystemJiraSettings
from app.modules.integrations.jira.repositories import settings as settings_repo
from app.modules.integrations.jira.schemas.integration import (
    ExternalIssueLinkRead,
    JiraConnectionRead,
    JiraProjectMappingRead,
    JiraSystemSettingsRead,
)

from ._utils import JIRA_SETTINGS_DEFAULT_ID


# ---------------------------------------------------------------------------
# ORM → Pydantic serializers
# ---------------------------------------------------------------------------


def _serialize_connection(connection: JiraConnection) -> JiraConnectionRead:
    return JiraConnectionRead.model_validate(connection)


def _serialize_mapping(mapping: JiraProjectMapping) -> JiraProjectMappingRead:
    return JiraProjectMappingRead.model_validate(mapping)


def _serialize_link(link: ExternalIssueLink) -> ExternalIssueLinkRead:
    return ExternalIssueLinkRead.model_validate(link)


def _serialize_system_settings(settings: SystemJiraSettings) -> JiraSystemSettingsRead:
    return JiraSystemSettingsRead(
        id=settings.id,
        enabled=settings.enabled,
        api_token_site_url=settings.api_token_site_url,
        api_token_email=settings.api_token_email,
        api_token_configured=bool(settings.api_token_encrypted),
        api_base_url=settings.api_base_url,
        http_timeout_seconds=settings.http_timeout_seconds,
        http_max_retries=settings.http_max_retries,
        sync_default_interval_seconds=settings.sync_default_interval_seconds,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


# ---------------------------------------------------------------------------
# Settings → JiraSystemSettingsRead (env fallback)
# ---------------------------------------------------------------------------


def _default_settings_read_from_env() -> JiraSystemSettingsRead:
    settings = get_settings()
    return JiraSystemSettingsRead(
        id=JIRA_SETTINGS_DEFAULT_ID,
        enabled=False,
        api_token_site_url="",
        api_token_email="",
        api_token_configured=False,
        api_base_url=settings.jira_api_base_url,
        http_timeout_seconds=settings.jira_http_timeout_seconds,
        http_max_retries=settings.jira_http_max_retries,
        sync_default_interval_seconds=settings.jira_sync_default_interval_seconds,
    )


# ---------------------------------------------------------------------------
# Settings → JiraClientRuntimeSettings
# ---------------------------------------------------------------------------


def _runtime_settings_from_row(settings: SystemJiraSettings) -> JiraClientRuntimeSettings:
    return JiraClientRuntimeSettings(
        enabled=settings.enabled,
        api_base_url=settings.api_base_url,
        http_timeout_seconds=settings.http_timeout_seconds,
        http_max_retries=settings.http_max_retries,
        api_token_site_url=settings.api_token_site_url,
        api_token_email=settings.api_token_email,
        api_token=decrypt_secret(settings.api_token_encrypted) if settings.api_token_encrypted else "",
    )


def _runtime_settings_from_env() -> JiraClientRuntimeSettings:
    settings = get_settings()
    return JiraClientRuntimeSettings(
        enabled=False,
        api_base_url=settings.jira_api_base_url,
        http_timeout_seconds=settings.jira_http_timeout_seconds,
        http_max_retries=settings.jira_http_max_retries,
        api_token_site_url="",
        api_token_email="",
        api_token="",
    )


# ---------------------------------------------------------------------------
# Public factory used by router and integration service
# ---------------------------------------------------------------------------


async def get_runtime_client_settings(db: AsyncSession) -> JiraClientRuntimeSettings:
    """Return runtime settings from DB row, falling back to env-vars."""
    row = await settings_repo.get_default(db)
    if row is None:
        return _runtime_settings_from_env()
    return _runtime_settings_from_row(row)
