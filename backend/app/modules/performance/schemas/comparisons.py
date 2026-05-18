from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.modules.performance.schemas.runs import PerformanceRunRead


MAX_COMPARE_RUNS = 4


class PerformanceComparisonCreate(BaseModel):
    project_id: str
    name: str | None = None
    base_run_id: str
    compare_run_ids: list[str] = Field(default_factory=list)
    metric_key: str
    public: bool = False

    model_config = {"extra": "forbid"}

    @field_validator("compare_run_ids")
    @classmethod
    def _bounded_run_list(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("at least one run to compare against is required")
        if len(value) > MAX_COMPARE_RUNS - 1:
            raise ValueError(f"comparison supports at most {MAX_COMPARE_RUNS} runs total (including base run)")
        return value

    @field_validator("metric_key")
    @classmethod
    def _non_empty_metric(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("metric_key must not be empty")
        return stripped


class PerformanceComparisonPatch(BaseModel):
    name: str | None = None
    public: bool | None = None

    model_config = {"extra": "forbid"}


class PerformanceComparisonSnapshot(BaseModel):
    """Frozen-in-time data for the comparison; rendered without re-fetching runs."""

    metric_key: str
    runs: list[PerformanceRunRead] = Field(default_factory=list)


class PerformanceComparisonRead(BaseModel):
    id: str
    project_id: str
    name: str | None = None
    base_run_id: str
    compare_run_ids: list[str]
    metric_key: str
    snapshot: PerformanceComparisonSnapshot
    public_token: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class PerformanceComparisonPublicRead(BaseModel):
    """Public viewer payload — no project metadata or actor identity exposed."""

    id: str
    name: str | None = None
    metric_key: str
    snapshot: PerformanceComparisonSnapshot
    created_at: datetime


class PerformanceComparisonListItemRead(BaseModel):
    """List view: omits the full snapshot and only carries scalar metadata."""

    id: str
    project_id: str
    name: str | None = None
    base_run_id: str
    compare_run_ids: list[str]
    metric_key: str
    run_count: int
    public_token: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class PerformanceComparisonsList(BaseModel):
    items: list[PerformanceComparisonListItemRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
