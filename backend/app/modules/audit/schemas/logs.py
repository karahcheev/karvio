from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AuditActorType, AuditResult

AuditLogSortField = Literal["timestamp_utc", "actor", "action", "resource", "result", "request_id"]


class AuditLogListQuery(BaseModel):
    """Query parameters for GET /audit-logs (grouped for maintainability)."""

    model_config = ConfigDict(extra="forbid")

    project_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    actor_id: str | None = None
    action: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    result: AuditResult | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, le=200)
    sort_by: AuditLogSortField = "timestamp_utc"
    sort_order: Literal["asc", "desc"] = "desc"


class AuditLogRead(BaseModel):
    event_id: str
    timestamp_utc: datetime
    actor_id: str | None = None
    actor_type: AuditActorType
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    result: AuditResult
    ip: str | None = None
    user_agent: str | None = None
    request_id: str | None = None
    tenant_id: str | None = None
    before: dict | list | None = Field(default=None, alias="before_state")
    after: dict | list | None = Field(default=None, alias="after_state")
    metadata: dict | list | None = Field(default=None, alias="event_metadata")

    model_config = {"from_attributes": True, "populate_by_name": True}


class AuditLogsList(BaseModel):
    items: list[AuditLogRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
