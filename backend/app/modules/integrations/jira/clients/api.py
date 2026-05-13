from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.core.domain_strings import TITLE_BAD_GATEWAY, TITLE_VALIDATION_ERROR
from app.core.errors import DomainError
from app.core.metrics import record_jira_api_request

_RETRIABLE_STATUS_CODES = {429, 500, 502, 503, 504}


@dataclass(slots=True)
class JiraClientRuntimeSettings:
    enabled: bool
    api_base_url: str
    http_timeout_seconds: float
    http_max_retries: int
    api_token_site_url: str
    api_token_email: str
    api_token: str


def _extract_error_detail(payload: object) -> str:
    if isinstance(payload, dict):
        for key in ("error_description", "errorMessage", "message", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        errors = payload.get("errorMessages")
        if isinstance(errors, list) and errors:
            first = errors[0]
            if isinstance(first, str) and first.strip():
                return first.strip()
    return "Jira request failed"


def _safe_json(response: httpx.Response) -> object | None:
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return None


def _retry_sleep_seconds_for_jira(response: httpx.Response, attempt: int) -> float:
    retry_after = response.headers.get("Retry-After")
    if retry_after and retry_after.isdigit():
        return float(max(1, int(retry_after)))
    return float(min(2 ** (attempt - 1), 16))


def _success_dict_from_jira_response(response: httpx.Response) -> dict:
    if not response.content:
        return {}
    body = _safe_json(response)
    if isinstance(body, dict):
        return body
    raise DomainError(
        status_code=502,
        code="jira_invalid_response",
        title=TITLE_BAD_GATEWAY,
        detail="Unexpected Jira response payload",
    )


def _raise_domain_error_for_jira_failure(response: httpx.Response) -> None:
    detail = _extract_error_detail(_safe_json(response))
    status = response.status_code
    if status == 400:
        raise DomainError(
            status_code=422,
            code="jira_validation_error",
            title=TITLE_VALIDATION_ERROR,
            detail=detail,
        )
    mapped = {
        401: ("jira_auth_failed", "Unauthorized", 401),
        403: ("jira_forbidden", "Forbidden", 403),
        404: ("jira_resource_not_found", "Not found", 404),
        429: ("jira_rate_limited", "Too many requests", 429),
    }.get(status)
    if mapped is not None:
        code, title, status_code = mapped
        raise DomainError(status_code=status_code, code=code, title=title, detail=detail)
    raise DomainError(
        status_code=502,
        code="jira_api_error",
        title=TITLE_BAD_GATEWAY,
        detail=detail,
    )


class JiraApiClient:
    def __init__(self, *, runtime_settings: JiraClientRuntimeSettings | None = None) -> None:
        self.settings = get_settings()
        if runtime_settings is not None:
            r = runtime_settings
            self.enabled = r.enabled
            self.api_base_url = r.api_base_url
            self.http_timeout_seconds = r.http_timeout_seconds
            self.http_max_retries = r.http_max_retries
            self.api_token_site_url = r.api_token_site_url
            self.api_token_email = r.api_token_email
            self.api_token = r.api_token
        else:
            s = self.settings
            self.enabled = False
            self.api_base_url = s.jira_api_base_url
            self.http_timeout_seconds = s.jira_http_timeout_seconds
            self.http_max_retries = s.jira_http_max_retries
            self.api_token_site_url = ""
            self.api_token_email = ""
            self.api_token = ""

    async def _request_json(
        self,
        *,
        method: str,
        url: str,
        endpoint_label: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        json_payload: dict | None = None,
    ) -> dict:
        timeout = httpx.Timeout(self.http_timeout_seconds)
        attempts = max(1, self.http_max_retries)

        async with httpx.AsyncClient(timeout=timeout) as client:
            for attempt in range(1, attempts + 1):
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_payload,
                )
                record_jira_api_request(endpoint=endpoint_label, status_code=response.status_code)
                if response.status_code in _RETRIABLE_STATUS_CODES and attempt < attempts:
                    await asyncio.sleep(_retry_sleep_seconds_for_jira(response, attempt))
                    continue

                if 200 <= response.status_code < 300:
                    return _success_dict_from_jira_response(response)

                _raise_domain_error_for_jira_failure(response)

        raise DomainError(
            status_code=502,
            code="jira_api_error",
            title=TITLE_BAD_GATEWAY,
            detail="Jira request failed",
        )

    @staticmethod
    def _basic_auth_headers(*, email: str, api_token: str) -> dict[str, str]:
        raw = f"{email}:{api_token}".encode("utf-8")
        encoded = base64.b64encode(raw).decode("ascii")
        return {
            "Authorization": f"Basic {encoded}",
            "Accept": "application/json",
        }

    @staticmethod
    def _site_api_url(*, site_url: str, path: str) -> str:
        return f"{site_url.rstrip('/')}/rest/api/3/{path.lstrip('/')}"

    async def get_myself_by_site(self, *, site_url: str, email: str, api_token: str) -> dict:
        return await self._request_json(
            method="GET",
            url=self._site_api_url(site_url=site_url, path="myself"),
            endpoint_label="myself.get",
            headers=self._basic_auth_headers(email=email, api_token=api_token),
        )

    async def get_project_by_site(self, *, site_url: str, email: str, api_token: str, project_key: str) -> dict:
        return await self._request_json(
            method="GET",
            url=self._site_api_url(site_url=site_url, path=f"project/{project_key}"),
            endpoint_label="project.get",
            headers=self._basic_auth_headers(email=email, api_token=api_token),
        )

    async def get_issue_by_site(self, *, site_url: str, email: str, api_token: str, issue_key: str) -> dict:
        return await self._request_json(
            method="GET",
            url=self._site_api_url(site_url=site_url, path=f"issue/{issue_key}"),
            endpoint_label="issue.get",
            headers=self._basic_auth_headers(email=email, api_token=api_token),
            params={"fields": "summary,status,priority,assignee"},
        )

    async def create_issue_by_site(self, *, site_url: str, email: str, api_token: str, fields: dict) -> dict:
        return await self._request_json(
            method="POST",
            url=self._site_api_url(site_url=site_url, path="issue"),
            endpoint_label="issue.create",
            headers=self._basic_auth_headers(email=email, api_token=api_token),
            json_payload={"fields": fields},
        )
