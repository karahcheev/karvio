from __future__ import annotations

from pydantic import BaseModel


class ReleaseStats(BaseModel):
    active_runs: int
    total: int
    passed: int
    error: int
    failure: int
    blocked: int
    skipped: int
    untested: int
    pass_rate: float


class PassRateTrendPoint(BaseModel):
    run_id: str
    name: str
    build: str | None
    created_at: str
    pass_rate: float
    error: int
    failure: int


class FailuresByRunItem(BaseModel):
    run_id: str
    category: str
    error: int
    failure: int


class TrendBucket(BaseModel):
    bucket_start: str
    bucket_label: str
    runs: int


class StatusTrendBucket(BaseModel):
    bucket_start: str
    bucket_label: str
    runs: int
    total: int
    passed: int
    error: int
    failure: int
    blocked: int
    skipped: int
    untested: int
    in_progress: int
    xfailed: int
    xpassed: int
    pass_rate: float


class RunsByEnvironmentItem(BaseModel):
    environment: str
    runs: int


class RunsByBuildItem(BaseModel):
    build: str
    runs: int


class StatusDistributionItem(BaseModel):
    name: str
    value: int


class ExecutionByAssigneeItem(BaseModel):
    assignee_id: str | None
    assignee_name: str
    executed: int


class RecentActivityItem(BaseModel):
    id: str
    name: str
    status: str
    build: str | None
    updated_at: str


class ProjectOverviewRead(BaseModel):
    project_id: str
    created_from: str | None
    created_to: str | None
    granularity: str | None
    run_count: int
    release_stats: ReleaseStats
    pass_rate_trend: list[PassRateTrendPoint]
    failures_by_run: list[FailuresByRunItem]
    execution_trend: list[TrendBucket]
    status_trend: list[StatusTrendBucket]
    runs_by_environment: list[RunsByEnvironmentItem]
    runs_by_build: list[RunsByBuildItem]
    status_distribution: list[StatusDistributionItem]
    execution_by_assignee: list[ExecutionByAssigneeItem]
    recent_activity: list[RecentActivityItem]
