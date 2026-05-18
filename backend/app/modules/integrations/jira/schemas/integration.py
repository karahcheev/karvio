from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ExternalIssueOwnerType


class JiraConnectionRead(BaseModel):
    id: str
    workspace_id: str
    cloud_id: str
    site_url: str
    account_id: str
    enabled: bool = True
    scopes: list[str] = Field(default_factory=list)
    connected_at: datetime
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync_retry_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JiraConnectionList(BaseModel):
    items: list[JiraConnectionRead] = Field(default_factory=list)


class JiraConnectionPatch(BaseModel):
    enabled: bool | None = None

    model_config = {"extra": "forbid"}


class JiraConnectCallbackResponse(BaseModel):
    connected: bool = True
    connection: JiraConnectionRead


class JiraProjectMappingCreate(BaseModel):
    project_id: str
    jira_connection_id: str | None = None
    jira_project_key: str
    default_issue_type_id: str | None = None
    default_labels: list[str] = Field(default_factory=list)
    default_components: list[str] = Field(default_factory=list)
    active: bool = True

    model_config = {"extra": "forbid"}


class JiraProjectMappingPatch(BaseModel):
    jira_project_key: str | None = None
    default_issue_type_id: str | None = None
    default_labels: list[str] | None = None
    default_components: list[str] | None = None
    active: bool | None = None

    model_config = {"extra": "forbid"}


class JiraProjectMappingRead(BaseModel):
    id: str
    project_id: str
    jira_connection_id: str
    jira_project_key: str
    default_issue_type_id: str | None = None
    default_labels: list[str] = Field(default_factory=list)
    default_components: list[str] = Field(default_factory=list)
    active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JiraProjectMappingList(BaseModel):
    items: list[JiraProjectMappingRead] = Field(default_factory=list)


class ExternalIssueLinkRead(BaseModel):
    id: str
    provider: str
    project_id: str
    owner_type: ExternalIssueOwnerType
    owner_id: str
    external_key: str
    external_url: str
    snapshot_status: str | None = None
    snapshot_summary: str | None = None
    snapshot_priority: str | None = None
    snapshot_assignee: str | None = None
    snapshot_assignee_account_id: str | None = None
    snapshot_last_synced_at: datetime | None = None
    is_invalid: bool = False
    invalid_reason: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExternalIssueLinksList(BaseModel):
    items: list[ExternalIssueLinkRead] = Field(default_factory=list)


class JiraIssueResolveResponse(BaseModel):
    key: str
    url: str
    summary: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee: str | None = None
    assignee_account_id: str | None = None


class JiraIssueLinkRequest(BaseModel):
    owner_type: ExternalIssueOwnerType
    owner_id: str
    issue_key_or_url: str = Field(min_length=2, max_length=512)

    model_config = {"extra": "forbid"}


class JiraIssueCreateFromRunCaseRequest(BaseModel):
    run_case_id: str
    summary: str | None = None
    description: str | None = None
    issue_type_id: str | None = None
    labels: list[str] | None = None
    components: list[str] | None = None
    idempotency_key: str | None = None

    model_config = {"extra": "forbid"}


class JiraIssueCreateFromRunCasesRequest(BaseModel):
    run_case_ids: list[str] = Field(min_length=1, max_length=200)
    summary: str | None = None
    description: str | None = None
    issue_type_id: str | None = None
    labels: list[str] | None = None
    components: list[str] | None = None
    idempotency_key: str | None = None

    model_config = {"extra": "forbid"}


class JiraIssueLinkRunCasesRequest(BaseModel):
    run_case_ids: list[str] = Field(min_length=1, max_length=200)
    issue_key_or_url: str = Field(min_length=2, max_length=512)

    model_config = {"extra": "forbid"}


class JiraSyncRefreshRequest(BaseModel):
    project_id: str | None = None

    model_config = {"extra": "forbid"}


class JiraSyncRefreshResponse(BaseModel):
    processed: int = 0
    updated: int = 0
    invalid: int = 0
    errors: int = 0


class JiraSystemSettingsRead(BaseModel):
    id: str = "default"
    enabled: bool = False
    api_token_site_url: str = ""
    api_token_email: str = ""
    api_token_configured: bool = False
    api_base_url: str = "https://api.atlassian.com"
    http_timeout_seconds: float = 20.0
    http_max_retries: int = 4
    sync_default_interval_seconds: int = 300
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class JiraSystemSettingsUpdate(BaseModel):
    enabled: bool = False
    api_token_site_url: str = Field(default="", max_length=512)
    api_token_email: str = Field(default="", max_length=255)
    api_token: str | None = Field(default=None, max_length=4096)
    api_base_url: str = Field(default="https://api.atlassian.com", max_length=512)
    http_timeout_seconds: float = Field(default=20.0, ge=1, le=120)
    http_max_retries: int = Field(default=4, ge=1, le=10)
    sync_default_interval_seconds: int = Field(default=300, ge=30, le=3600)

    model_config = {"extra": "forbid"}
