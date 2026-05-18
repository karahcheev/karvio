from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import CoverageStrength, CoverageType, TestCasePriority, TestCaseType

TestFocus = Literal[
    "functional",
    "regression",
    "negative",
    "boundary",
    "security",
    "accessibility",
    "api",
    "ui",
]

ReviewMode = Literal["quality", "completeness", "clarity", "edge_cases", "automation_readiness", "all"]
ReviewField = Literal[
    "title",
    "preconditions",
    "steps",
    "expected_result",
    "priority",
    "tags",
    "coverage",
    "automation",
    "other",
]
IssueSeverity = Literal["low", "medium", "high"]
DuplicateRecommendation = Literal["merge", "keep_both", "review"]


class AiFeatureStatus(BaseModel):
    enabled: bool
    provider: str | None = None
    model: str | None = None


AiEffectiveSource = Literal["project", "global", "env"]


class ProjectAiSettingsOverviewItem(BaseModel):
    project_id: str
    project_name: str
    has_project_settings: bool
    enabled: bool
    provider: str | None = None
    model: str | None = None
    api_key_configured: bool
    effective_source: AiEffectiveSource


class ProjectAiSettingsOverviewList(BaseModel):
    items: list[ProjectAiSettingsOverviewItem]


class GlobalAiSettingsBase(BaseModel):
    enabled: bool = False
    provider: Literal["openai"] | None = None
    model: str | None = Field(default=None, max_length=255)
    timeout_ms: int = Field(default=30000, ge=1000, le=300000)
    http_max_retries: int = Field(default=2, ge=0, le=10)
    duplicate_high_threshold: float = Field(default=0.88, ge=0, le=1)
    duplicate_medium_threshold: float = Field(default=0.72, ge=0, le=1)

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.duplicate_medium_threshold > self.duplicate_high_threshold:
            raise ValueError("duplicate_medium_threshold must be less than or equal to duplicate_high_threshold")
        return self


class GlobalAiSettingsUpdate(GlobalAiSettingsBase):
    api_key: str | None = Field(default=None, max_length=2000)

    @field_validator("api_key")
    @classmethod
    def normalize_api_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GlobalAiSettingsRead(GlobalAiSettingsBase):
    api_key_configured: bool = False
    created_at: datetime
    updated_at: datetime


class ProjectAiSettingsBase(BaseModel):
    project_id: str
    enabled: bool = False
    provider: Literal["openai"] | None = None
    model: str | None = Field(default=None, max_length=255)
    timeout_ms: int = Field(default=30000, ge=1000, le=300000)
    http_max_retries: int = Field(default=2, ge=0, le=10)
    duplicate_high_threshold: float = Field(default=0.88, ge=0, le=1)
    duplicate_medium_threshold: float = Field(default=0.72, ge=0, le=1)

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.duplicate_medium_threshold > self.duplicate_high_threshold:
            raise ValueError("duplicate_medium_threshold must be less than or equal to duplicate_high_threshold")
        return self


class ProjectAiSettingsUpdate(ProjectAiSettingsBase):
    api_key: str | None = Field(default=None, max_length=2000)

    @field_validator("api_key")
    @classmethod
    def normalize_api_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ProjectAiSettingsRead(ProjectAiSettingsBase):
    id: str
    api_key_configured: bool = False
    created_at: datetime
    updated_at: datetime


class AiStepDraft(BaseModel):
    action: str = Field(min_length=1, max_length=4000)
    expected_result: str = Field(min_length=1, max_length=4000)


class AiCoverageDraft(BaseModel):
    component_id: str
    coverage_type: CoverageType
    coverage_strength: CoverageStrength
    is_mandatory_for_release: bool = False
    notes: str | None = Field(default=None, max_length=1000)


class DuplicateCandidate(BaseModel):
    candidate_test_case_id: str
    key: str
    title: str
    similarity_score: float = Field(ge=0, le=1)
    reason: str
    matching_fields: list[str] = Field(default_factory=list)
    recommendation: DuplicateRecommendation = "review"


class DuplicateCheckResponse(BaseModel):
    duplicates: list[DuplicateCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AiDraftTestCase(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    preconditions: str | None = Field(default=None, max_length=8000)
    steps: list[AiStepDraft] = Field(default_factory=list, min_length=1, max_length=50)
    priority: TestCasePriority
    test_case_type: TestCaseType = TestCaseType.manual
    tags: list[str] = Field(default_factory=list, max_length=20)
    primary_product_id: str | None = None
    component_coverages: list[AiCoverageDraft] = Field(default_factory=list, max_length=20)
    risk_reason: str | None = Field(default=None, max_length=1500)
    suggestion_reason: str = Field(min_length=1, max_length=1500)
    ai_confidence: float = Field(ge=0, le=1)
    possible_duplicates: list[DuplicateCandidate] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def trim_tags(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(tag.strip() for tag in value if tag.strip()))[:20]


class GenerateTestCasesRequest(BaseModel):
    project_id: str
    source_text: str | None = Field(default=None, max_length=20000)
    suite_id: str | None = None
    primary_product_id: str | None = None
    component_ids: list[str] = Field(default_factory=list, max_length=25)
    test_focus: list[TestFocus] = Field(default_factory=list, max_length=8)
    priority_preference: TestCasePriority | None = None
    count: int = Field(default=3, ge=1, le=10)

    model_config = {"extra": "forbid"}


class GenerateTestCasesResponse(BaseModel):
    draft_test_cases: list[AiDraftTestCase] = Field(default_factory=list)
    source_references: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ReviewTestCaseRequest(BaseModel):
    mode: ReviewMode = "all"

    model_config = {"extra": "forbid"}


class ReviewIssue(BaseModel):
    severity: IssueSeverity
    field: ReviewField
    problem: str = Field(min_length=1, max_length=2000)
    recommendation: str = Field(min_length=1, max_length=2000)


class SuggestedRevision(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    preconditions: str | None = Field(default=None, max_length=8000)
    steps: list[AiStepDraft] | None = None
    priority: TestCasePriority | None = None
    tags: list[str] | None = None
    component_coverages: list[AiCoverageDraft] | None = None

    @field_validator("tags")
    @classmethod
    def trim_revision_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return list(dict.fromkeys(tag.strip() for tag in value if tag.strip()))[:20]


class AutomationReadiness(BaseModel):
    score: float = Field(ge=0, le=100)
    blocking_issues: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class ReviewTestCaseResponse(BaseModel):
    quality_score: float = Field(ge=0, le=100)
    summary: str = Field(min_length=1, max_length=4000)
    issues: list[ReviewIssue] = Field(default_factory=list)
    suggested_revision: SuggestedRevision
    missing_edge_cases: list[str] = Field(default_factory=list)
    automation_readiness: AutomationReadiness


class DuplicateCheckDraft(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    preconditions: str | None = Field(default=None, max_length=8000)
    steps: list[AiStepDraft] = Field(default_factory=list, max_length=50)
    tags: list[str] = Field(default_factory=list, max_length=20)
    component_ids: list[str] = Field(default_factory=list, max_length=25)


class DuplicateCheckRequest(BaseModel):
    project_id: str
    test_case: DuplicateCheckDraft
    exclude_test_case_id: str | None = None

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def require_searchable_content(self):
        if self.test_case.title.strip():
            return self
        raise ValueError("test_case.title is required")
