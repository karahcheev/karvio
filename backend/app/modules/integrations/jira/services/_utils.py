"""Pure utility helpers for the Jira integration service.

Contains: module-level constants, date helpers, normalization functions,
issue key extraction, and run-case id deduplication.  No I/O or side-effects.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

WORKSPACE_DEFAULT_ID = "workspace_default"
JIRA_SETTINGS_DEFAULT_ID = "default"
AUTH_MODE_API_TOKEN = "api_token"
_ISSUE_KEY_PATTERN = re.compile(r"([A-Z][A-Z0-9]+-\d+)")


# ---------------------------------------------------------------------------
# Date helper
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Text / list normalization
# ---------------------------------------------------------------------------


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _normalize_list(values: list[str] | None) -> list[str]:
    return [item.strip() for item in values or [] if item and item.strip()]


# ---------------------------------------------------------------------------
# Issue key / URL helpers
# ---------------------------------------------------------------------------


def _extract_issue_key(value: str) -> str:
    candidate = value.strip().upper()
    match = _ISSUE_KEY_PATTERN.search(candidate)
    if not match:
        raise DomainError(
            status_code=422,
            code="jira_issue_key_invalid",
            title=TITLE_VALIDATION_ERROR,
            detail="Issue key or URL is invalid",
            errors={"issue_key_or_url": ["Provide Jira issue key like ABC-123 or browse URL"]},
        )
    return match.group(1)


def _cloud_id_for_api_token_site(site_url: str) -> str:
    host = urlparse(site_url).netloc.strip().lower()
    if not host:
        raise DomainError(
            status_code=422,
            code="jira_api_token_site_invalid",
            title=TITLE_VALIDATION_ERROR,
            detail="API token site URL is invalid",
        )
    return f"site::{host}"


# ---------------------------------------------------------------------------
# Run-case id list normalization
# ---------------------------------------------------------------------------


def _normalize_run_case_ids(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        run_case_id = _normalize_text(value)
        if not run_case_id or run_case_id in seen:
            continue
        normalized.append(run_case_id)
        seen.add(run_case_id)
    if normalized:
        return normalized
    raise DomainError(
        status_code=422,
        code="jira_run_case_ids_invalid",
        title=TITLE_VALIDATION_ERROR,
        detail="run_case_ids must contain at least one valid id",
        errors={"run_case_ids": ["provide at least one run case id"]},
    )
