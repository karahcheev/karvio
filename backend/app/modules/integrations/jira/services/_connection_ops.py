"""Auth-aware Jira API operations (API token mode only).

Handles API token validation and dispatches get/create project/issue calls
using Basic auth (email + API token) against the configured site URL.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError
from app.core.token_crypto import decrypt_secret
from app.modules.integrations.jira.clients.api import JiraApiClient
from app.modules.integrations.jira.models import JiraConnection

from ._utils import _normalize_text


# ---------------------------------------------------------------------------
# Connection guard
# ---------------------------------------------------------------------------


def _ensure_connection_enabled(connection: JiraConnection) -> None:
    if connection.enabled:
        return
    raise DomainError(
        status_code=409,
        code="jira_integration_disabled",
        title="Conflict",
        detail="Jira integration is disabled for this connection",
    )


# ---------------------------------------------------------------------------
# API token helpers
# ---------------------------------------------------------------------------


def _email_for_api_token_connection(*, connection: JiraConnection, client: JiraApiClient) -> str:
    # Historical connections may store Atlassian accountId in account_id.
    # API token auth requires account email for Basic auth username.
    account_value = _normalize_text(connection.account_id)
    if "@" in account_value:
        return account_value
    fallback_email = _normalize_text(getattr(client, "api_token_email", ""))
    if fallback_email:
        return fallback_email
    raise DomainError(
        status_code=422,
        code="jira_settings_incomplete",
        title=TITLE_VALIDATION_ERROR,
        detail="API token mode requires account email in Jira settings",
    )


def _get_api_token_for_connection(connection: JiraConnection) -> str:
    _ensure_connection_enabled(connection)
    token = decrypt_secret(connection.access_token_encrypted)
    if not token:
        raise DomainError(
            status_code=401,
            code="jira_token_missing",
            title="Unauthorized",
            detail="Jira API token is missing",
        )
    return token


# ---------------------------------------------------------------------------
# API calls
# ---------------------------------------------------------------------------


async def _get_project_for_connection(
    *,
    db: AsyncSession,
    connection: JiraConnection,
    project_key: str,
    client: JiraApiClient,
) -> dict[str, Any]:
    api_token = _get_api_token_for_connection(connection)
    email = _email_for_api_token_connection(connection=connection, client=client)
    return await client.get_project_by_site(
        site_url=connection.site_url,
        email=email,
        api_token=api_token,
        project_key=project_key,
    )


async def _get_issue_for_connection(
    *,
    db: AsyncSession,
    connection: JiraConnection,
    issue_key: str,
    client: JiraApiClient,
) -> dict[str, Any]:
    api_token = _get_api_token_for_connection(connection)
    email = _email_for_api_token_connection(connection=connection, client=client)
    return await client.get_issue_by_site(
        site_url=connection.site_url,
        email=email,
        api_token=api_token,
        issue_key=issue_key,
    )


async def _create_issue_for_connection(
    *,
    db: AsyncSession,
    connection: JiraConnection,
    fields: dict[str, Any],
    client: JiraApiClient,
) -> dict[str, Any]:
    api_token = _get_api_token_for_connection(connection)
    email = _email_for_api_token_connection(connection=connection, client=client)
    return await client.create_issue_by_site(
        site_url=connection.site_url,
        email=email,
        api_token=api_token,
        fields=fields,
    )
