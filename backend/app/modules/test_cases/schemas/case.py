from enum import Enum
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ComponentRiskLevel, TestCasePriority, TestCaseStatus, TestCaseTemplateType, TestCaseType
from app.modules.integrations.jira.schemas.integration import ExternalIssueLinkRead
from app.modules.products.schemas.coverage import TestCaseCoverageRead, TestCaseCoverageWrite
from app.modules.test_cases.schemas.dataset import TestCaseDatasetBindingRead


def _non_empty_text(value: str | None) -> bool:
    return value is not None and bool(value.strip())


def _validate_template_fields_by_type(model: "_TemplateFieldsMixin") -> None:
    if model.template_type == TestCaseTemplateType.text:
        if _non_empty_text(model.raw_test) or _non_empty_text(model.raw_test_language):
            raise ValueError("text template does not support raw_test/raw_test_language")
        if not (_non_empty_text(model.steps_text) or _non_empty_text(model.expected)):
            raise ValueError("text template requires steps_text or expected")
        return
    if model.template_type == TestCaseTemplateType.steps:
        if any(_non_empty_text(value) for value in (model.steps_text, model.expected, model.raw_test, model.raw_test_language)):
            raise ValueError("steps template only supports structured steps")
        return
    if model.template_type == TestCaseTemplateType.automated:
        if _non_empty_text(model.expected):
            raise ValueError("automated template does not support expected")
        if not _non_empty_text(model.raw_test):
            raise ValueError("automated template requires raw_test")


class _TemplateFieldsMixin(BaseModel):
    template_type: TestCaseTemplateType = TestCaseTemplateType.steps
    steps_text: str | None = None
    expected: str | None = None
    raw_test: str | None = None
    raw_test_language: str | None = None

    @model_validator(mode="after")
    def validate_template_fields(self):
        _validate_template_fields_by_type(self)
        return self


class TestCaseCreate(_TemplateFieldsMixin):
    project_id: str
    suite_id: str | None = None
    owner_id: str | None = None
    primary_product_id: str | None = None
    automation_id: str | None = None
    title: str
    preconditions: str | None = None
    time: str | None = None
    priority: TestCasePriority | None = None
    test_case_type: TestCaseType | None = None
    status: TestCaseStatus | None = None
    tags: list[str] = Field(default_factory=list)
    component_coverages: list[TestCaseCoverageWrite] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class TestCasePatch(_TemplateFieldsMixin):
    template_type: TestCaseTemplateType | None = None
    suite_id: str | None = None
    owner_id: str | None = None
    primary_product_id: str | None = None
    automation_id: str | None = None
    title: str | None = None
    preconditions: str | None = None
    time: str | None = None
    priority: TestCasePriority | None = None
    test_case_type: TestCaseType | None = None
    tags: list[str] | None = None
    status: TestCaseStatus | None = None
    component_coverages: list[TestCaseCoverageWrite] | None = None

    model_config = {"extra": "forbid"}


class TestCaseRead(_TemplateFieldsMixin):
    id: str
    project_id: str
    suite_id: str | None = None
    owner_id: str | None = None
    primary_product_id: str | None = None
    owner_name: str | None = None
    key: str
    automation_id: str | None = None
    title: str
    preconditions: str | None = None
    time: str | None = None
    priority: TestCasePriority | None = None
    status: TestCaseStatus
    test_case_type: TestCaseType
    tags: list[str]
    dataset_bindings: list[TestCaseDatasetBindingRead] = Field(default_factory=list)
    external_issues: list[ExternalIssueLinkRead] = Field(default_factory=list)
    variables_used: list[str] = Field(default_factory=list)
    component_coverages: list[TestCaseCoverageRead] = Field(default_factory=list)
    suite_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TestCaseListQuery(BaseModel):
    """Query parameters for GET /test-cases (project_id is read by get_project_id_required)."""

    model_config = ConfigDict(extra="ignore")

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=200)
    search: str | None = None
    status: list[TestCaseStatus] | None = None
    priority: list[TestCasePriority] | None = None
    suite_id: list[str] | None = None
    tag: list[str] | None = None
    owner_id: str | None = None
    product_id: list[str] | None = None
    component_id: list[str] | None = None
    minimum_component_risk_level: ComponentRiskLevel | None = None
    exclude_test_case_id: list[str] | None = None
    sort_by: Literal[
        "created_at",
        "updated_at",
        "key",
        "title",
        "status",
        "priority",
        "owner_name",
        "suite_name",
    ] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"


class TestCasesList(BaseModel):
    items: list[TestCaseRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


class TestCaseBulkAction(str, Enum):
    delete = "delete"
    move = "move"
    set_status = "set_status"
    set_owner = "set_owner"
    add_tag = "add_tag"
    set_priority = "set_priority"
    update = "update"


class TestCaseBulkOperation(BaseModel):
    project_id: str
    test_case_ids: list[str] = Field(min_length=1)
    action: TestCaseBulkAction
    suite_id: str | None = None
    status: TestCaseStatus | None = None
    owner_id: str | None = None
    tag: str | None = None
    priority: TestCasePriority | None = None


class TestCaseBulkOperationResult(BaseModel):
    affected_count: int
