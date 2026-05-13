from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import TestRunStatus


class TestRunCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    environment_id: str | None = None
    milestone_id: str | None = None
    build: str | None = None
    assignee: str | None = None

    model_config = {"extra": "forbid"}


class TestRunPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    environment_id: str | None = None
    milestone_id: str | None = None
    build: str | None = None
    assignee: str | None = None
    status: TestRunStatus | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    archived_at: datetime | None = None
    planned_item_count: int | None = None

    model_config = {"extra": "forbid"}

    @field_validator("planned_item_count")
    @classmethod
    def _planned_non_negative(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("planned_item_count must be >= 0")
        return value


class RunSummarySnapshot(BaseModel):
    total: int = 0
    passed: int = 0
    error: int = 0
    failure: int = 0
    blocked: int = 0
    in_progress: int = 0
    skipped: int = 0
    xfailed: int = 0
    xpassed: int = 0
    pass_rate: float = 0.0


class StatusBreakdownItem(BaseModel):
    status: str
    count: int


class StatusBreakdown(BaseModel):
    items: list[StatusBreakdownItem] = Field(default_factory=list)


class TestRunRead(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    environment_id: str | None = None
    milestone_id: str | None = None
    milestone_name: str | None = None
    environment_revision_id: str | None = None
    environment_revision_number: int | None = None
    environment_name: str | None = None
    environment_snapshot: dict = Field(default_factory=dict)
    build: str | None = None
    assignee: str | None = None
    planned_item_count: int | None = None
    status: TestRunStatus
    created_by: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    archived_at: datetime | None = None
    summary: RunSummarySnapshot | None = None
    status_breakdown: StatusBreakdown | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TestRunsList(BaseModel):
    items: list[TestRunRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0

