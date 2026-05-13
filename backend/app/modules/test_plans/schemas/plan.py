"""Test plan request/response models."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import TestPlanGenerationSource
from app.modules.products.schemas.plan import PlanGenerationConfig, PlanGenerationPreviewRead

class TestPlanSuiteRead(BaseModel):
    id: str
    suite_id: str
    suite_name: str | None = None

    model_config = {"from_attributes": True}


class TestPlanCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    generation_source: TestPlanGenerationSource = TestPlanGenerationSource.manual
    generation_config: PlanGenerationConfig | None = None
    milestone_id: str | None = None
    suite_ids: list[str] = Field(default_factory=list)
    case_ids: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class TestPlanPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    generation_source: TestPlanGenerationSource | None = None
    generation_config: PlanGenerationConfig | None = None
    milestone_id: str | None = None
    suite_ids: list[str] | None = None
    case_ids: list[str] | None = None

    model_config = {"extra": "forbid"}


class TestPlanRead(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    generation_source: TestPlanGenerationSource = TestPlanGenerationSource.manual
    generation_config: PlanGenerationConfig | None = None
    generation_summary: dict = Field(default_factory=dict)
    milestone_id: str | None = None
    milestone_name: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    suite_ids: list[str] = Field(default_factory=list)
    suite_names: list[str] = Field(default_factory=list)
    case_ids: list[str] = Field(default_factory=list)
    case_keys: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TestPlansList(BaseModel):
    items: list[TestPlanRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


class TestPlanTagsList(BaseModel):
    items: list[str] = Field(default_factory=list)


class TestPlanCreateRunPayload(BaseModel):
    name: str
    description: str | None = None
    environment_id: str | None = None
    build: str | None = None
    assignee: str | None = None
    milestone_id: str | None = None
    start_immediately: bool = False

    model_config = {"extra": "forbid"}


class TestPlanGeneratePreviewPayload(BaseModel):
    project_id: str
    config: PlanGenerationConfig

    model_config = {"extra": "forbid"}


class TestPlanGeneratePreviewResponse(BaseModel):
    preview: PlanGenerationPreviewRead
