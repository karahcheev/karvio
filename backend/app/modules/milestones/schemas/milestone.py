from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import MilestoneStatus


class MilestoneCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    status: MilestoneStatus = MilestoneStatus.planned
    start_date: date | None = None
    target_date: date | None = None
    completed_at: datetime | None = None
    owner_id: str | None = None
    release_label: str | None = None

    model_config = {"extra": "forbid"}


class MilestonePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    status: MilestoneStatus | None = None
    start_date: date | None = None
    target_date: date | None = None
    completed_at: datetime | None = None
    owner_id: str | None = None
    release_label: str | None = None

    model_config = {"extra": "forbid"}


class MilestoneRead(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    status: MilestoneStatus
    start_date: date | None = None
    target_date: date | None = None
    completed_at: datetime | None = None
    owner_id: str | None = None
    release_label: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MilestonesList(BaseModel):
    items: list[MilestoneRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


class MilestoneSummaryRead(BaseModel):
    milestone_id: str
    plans_total: int = 0
    planned_cases_total: int = 0
    runs_total: int = 0
    planned_runs: int = 0
    active_runs: int = 0
    completed_runs: int = 0
    archived_runs: int = 0
    total_tests: int = 0
    untested: int = 0
    passed: int = 0
    error: int = 0
    failure: int = 0
    blocked: int = 0
    skipped: int = 0
    xfailed: int = 0
    xpassed: int = 0
    pass_rate: float = 0.0
    overdue: bool = False
