"""Run-case API schemas (RunItem aggregate + RunCaseRow executions)."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import RunItemStatus, TestCasePriority
from app.modules.integrations.jira.schemas.integration import ExternalIssueLinkRead


class RunCasesCreateRequest(BaseModel):
    test_run_id: str
    test_case_id: str
    assignee_id: str | None = None

    model_config = {"extra": "forbid"}


class RunCasesBulkCreateRequest(BaseModel):
    test_run_id: str
    test_case_ids: list[str] | None = None
    suite_id: str | None = None

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _validate_scope(self):
        has_case_ids = bool(self.test_case_ids)
        has_suite_id = bool(self.suite_id)
        if has_case_ids == has_suite_id:
            raise ValueError("Provide exactly one of test_case_ids or suite_id")
        return self


class RunCasePatch(BaseModel):
    assignee_id: str | None = None
    comment: str | None = None

    model_config = {"extra": "forbid"}


class RunCaseRowPatch(BaseModel):
    status: RunItemStatus | None = None
    comment: str | None = None
    defect_ids: list[str] | None = None
    actual_result: str | None = None
    system_out: str | None = None
    system_err: str | None = None
    executed_by_id: str | None = Field(default=None, validation_alias="executed_by")
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = Field(default=None, ge=0)

    model_config = {"extra": "forbid", "populate_by_name": True}


class RunCaseRerunRequest(BaseModel):
    mode: str = Field(default="failed")
    run_case_row_ids: list[str] = Field(default_factory=list)
    use_latest_revisions: bool = False

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _validate_mode(self):
        if self.mode not in {"failed", "subset"}:
            raise ValueError("mode must be 'failed' or 'subset'")
        if self.mode == "subset" and not self.run_case_row_ids:
            raise ValueError("run_case_row_ids is required for mode=subset")
        return self


class RunCaseRead(BaseModel):
    id: str
    test_run_id: str
    test_case_id: str
    test_run_name: str | None = None
    test_run_status: str | None = None
    test_run_environment_name: str | None = None
    test_run_environment_revision_number: int | None = None
    test_run_build: str | None = None
    assignee_id: str | None = None
    status: RunItemStatus
    rows_total: int = 0
    rows_passed: int = 0
    rows_failed: int = 0
    comment: str | None = None
    test_case_key: str | None = None
    test_case_title: str | None = None
    test_case_priority: TestCasePriority | None = None
    test_case_tags: list[str] = Field(default_factory=list)
    suite_name: str | None = None
    assignee_name: str | None = None
    external_issues: list[ExternalIssueLinkRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class RunCaseRowRead(BaseModel):
    id: str
    run_case_id: str
    parent_row_id: str | None = None
    row_order: int
    scenario_label: str
    row_snapshot: dict = Field(default_factory=dict)
    status: RunItemStatus
    comment: str | None = None
    defect_ids: list[str] = Field(default_factory=list)
    actual_result: str | None = None
    system_out: str | None = None
    system_err: str | None = None
    executed_by_id: str | None = Field(default=None, validation_alias="executed_by")
    execution_count: int = 0
    last_executed_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class RunCasesList(BaseModel):
    items: list[RunCaseRead]
    page: int = 1
    page_size: int = 50
    has_next: bool = False


class RunCaseRowsList(BaseModel):
    items: list[RunCaseRowRead]
    page: int = 1
    page_size: int = 50
    has_next: bool = False


class RunCasesBulkCreateResponse(BaseModel):
    items: list[RunCaseRead]


class RunCaseHistoryRead(BaseModel):
    id: str
    run_case_id: str
    from_status: str | None = None
    to_status: str
    time: str | None = None
    comment: str | None = None
    defect_ids: list[str]
    actual_result: str | None = None
    system_out: str | None = None
    system_err: str | None = None
    executed_by_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    changed_by_id: str | None = None
    changed_at: datetime

    model_config = {"from_attributes": True}


class RunCaseHistoryList(BaseModel):
    items: list[RunCaseHistoryRead]
    page: int = 1
    page_size: int = 50
    has_next: bool = False


class RunCaseDetailRead(RunCaseRead):
    history: RunCaseHistoryList
