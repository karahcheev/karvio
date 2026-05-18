from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

PerfRunStatus = Literal["completed", "incomplete", "running"]
PerfRunVerdict = Literal["green", "yellow", "red"]
PerfParseStatus = Literal["parsed", "partial", "failed"]
PerfBaselinePolicy = Literal["manual", "latest_green", "tagged"]
PerfLoadKind = Literal["http", "cpu", "ram", "disk_io", "benchmark"]
PerfArtifactType = Literal["zip", "json", "csv", "html", "txt"]
PerfImportStatus = Literal["pending", "processing", "completed", "partial", "failed"]


@dataclass(frozen=True, slots=True)
class PerformanceUpload:
    """Exactly one of `content` or `path` must be set. `path` is a temp file owned by the caller."""

    content: bytes | None = None
    filename: str | None = None
    content_type: str | None = None
    path: Path | None = None


class PerfSummaryRead(BaseModel):
    throughput_rps: float = 0.0
    error_rate_pct: float = 0.0
    p50_ms: int = 0
    p95_ms: int = 0
    p99_ms: int = 0
    peak_vus: int = 0
    checks_passed: int = 0
    checks_total: int = 0


class PerfBaselineRead(BaseModel):
    ref: str | None = None
    policy: PerfBaselinePolicy = "manual"
    label: str = "Manual baseline"


class PerfRegressionItemRead(BaseModel):
    title: str
    scope: str
    delta: str


class PerfMetricComparisonRead(BaseModel):
    label: str
    current: str
    baseline: str
    delta: str
    impact: Literal["improved", "regressed", "neutral"]


class PerfTransactionArtifactRead(BaseModel):
    label: str
    href: str


class PerfTransactionGeneratorResultRead(BaseModel):
    generator: str
    requests: int
    failures: int
    throughput_rps: float
    p95_ms: int
    error_rate_pct: float


class PerfSystemLoadSampleRead(BaseModel):
    timestamp: str
    cpu_pct: float
    memory_pct: float
    disk_io_mbps: float


class PerfTransactionRead(BaseModel):
    key: str
    group: str
    label: str
    throughput_rps: float
    p95_ms: int
    error_rate_pct: float
    delta_p95_pct: float | None = None
    delta_throughput_pct: float | None = None
    delta_error_rate_pp: float | None = None
    delta_error_rate_pct: float = 0.0
    description: str | None = None
    run_command: str | None = None
    generators: list[PerfTransactionGeneratorResultRead] = Field(default_factory=list)
    system_load: list[PerfSystemLoadSampleRead] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)
    artifacts: list[PerfTransactionArtifactRead] = Field(default_factory=list)


class PerfErrorBucketRead(BaseModel):
    key: str
    type: str
    count: int
    rate_pct: float
    last_seen_at: str
    hint: str


class PerfArtifactRead(BaseModel):
    id: str
    label: str
    type: PerfArtifactType
    size: str
    status: Literal["ready", "missing"]
    created_at: str


class PerfImportRecordRead(BaseModel):
    id: str | None = None
    source: str
    adapter: str
    adapter_version: str
    confidence: float
    found: list[str]
    missing: list[str]
    parse_status: PerfParseStatus
    issues: list[str]


class PerfEnvironmentSnapshotRead(BaseModel):
    region: str
    cluster: str
    namespace: str
    instance_type: str
    cpu_cores: int
    memory_gb: int
    python_version: str | None = None
    python_implementation: str | None = None
    os_system: str | None = None
    os_release: str | None = None
    architecture: str | None = None
    cpu_model: str | None = None
    benchmark_framework_version: str | None = None
    warmup_enabled: bool | None = None
    rounds_total: int | None = None
    iterations_total: int | None = None


class PerformanceRunRead(BaseModel):
    id: str
    project_id: str
    name: str
    service: str
    env: str
    scenario: str
    load_profile: str
    branch: str
    commit: str
    build: str
    version: str
    tool: str
    status: PerfRunStatus
    verdict: PerfRunVerdict
    load_kind: PerfLoadKind
    started_at: datetime
    finished_at: datetime | None = None
    duration_minutes: int
    summary: PerfSummaryRead
    baseline: PerfBaselineRead
    regressions: list[PerfRegressionItemRead] = Field(default_factory=list)
    metrics_comparison: list[PerfMetricComparisonRead] = Field(default_factory=list)
    transactions: list[PerfTransactionRead] = Field(default_factory=list)
    errors: list[PerfErrorBucketRead] = Field(default_factory=list)
    artifacts: list[PerfArtifactRead] = Field(default_factory=list)
    import_record: PerfImportRecordRead | None = None
    environment_snapshot: PerfEnvironmentSnapshotRead
    acknowledged: bool = False
    archived: bool = False
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class PerformanceRunsList(BaseModel):
    items: list[PerformanceRunRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False


class PerformanceRunCreate(BaseModel):
    project_id: str
    name: str
    load_kind: PerfLoadKind = "http"
    service: str
    env: str
    scenario: str
    load_profile: str
    branch: str
    commit: str
    build: str
    tool: str = "k6"
    version: str = "manual"
    status: PerfRunStatus = "incomplete"

    region: str = "unknown"
    cluster: str = "unknown"
    namespace: str = "default"
    instance_type: str = "unknown"
    cpu_cores: int = Field(default=0, ge=0)
    memory_gb: int = Field(default=0, ge=0)

    model_config = {"extra": "forbid"}

    @field_validator("name", "service", "env", "scenario", "load_profile", "branch", "commit", "build", "tool", "version")
    @classmethod
    def _non_empty(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be empty")
        return stripped


class PerformanceRunPatch(BaseModel):
    name: str | None = None
    service: str | None = None
    env: str | None = None
    scenario: str | None = None
    load_profile: str | None = None
    branch: str | None = None
    commit: str | None = None
    build: str | None = None
    version: str | None = None
    tool: str | None = None
    status: PerfRunStatus | None = None
    acknowledged: bool | None = None
    archived: bool | None = None
    mark_as_baseline: bool | None = None

    model_config = {"extra": "forbid"}


class PerformancePreflightRead(BaseModel):
    source: str
    adapter: str
    adapter_version: str
    confidence: float
    found: list[str]
    missing: list[str]
    parse_status: PerfParseStatus
    issues: list[str]


class PerformanceImportAccepted(BaseModel):
    import_id: str
    run_id: str
    status: Literal["pending"] = "pending"


class PerformanceImportRead(BaseModel):
    id: str
    project_id: str
    run_id: str
    status: PerfImportStatus
    parse_status: PerfParseStatus
    source_filename: str
    source_content_type: str | None = None
    adapter: str | None = None
    adapter_version: str | None = None
    confidence: float | None = None
    found: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    error_detail: str | None = None
    created_by: str | None = None
    started_processing_at: datetime | None = None
    finished_processing_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
