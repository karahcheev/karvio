from pydantic import BaseModel, Field

from app.models.enums import ComponentRiskLevel, PlanGenerationMode


class IncludedCaseReason(BaseModel):
    test_case_id: str
    reason_codes: list[str] = Field(default_factory=list)
    matched_component_ids: list[str] = Field(default_factory=list)
    highest_component_risk_level: ComponentRiskLevel = ComponentRiskLevel.low
    highest_component_risk_score: int = 0


class ExcludedCaseReason(BaseModel):
    test_case_id: str
    reason: str


class PlanGenerationConfig(BaseModel):
    product_ids: list[str] = Field(default_factory=list)
    component_ids: list[str] = Field(default_factory=list)
    include_dependent_components: bool = False
    minimum_risk_level: ComponentRiskLevel | None = None
    generation_mode: PlanGenerationMode = PlanGenerationMode.regression
    explicit_include_case_ids: list[str] = Field(default_factory=list)
    explicit_exclude_case_ids: list[str] = Field(default_factory=list)


class PlanGenerationPreviewRead(BaseModel):
    resolved_component_ids: list[str] = Field(default_factory=list)
    resolved_case_ids: list[str] = Field(default_factory=list)
    included_cases: list[IncludedCaseReason] = Field(default_factory=list)
    excluded_cases: list[ExcludedCaseReason] = Field(default_factory=list)
    summary: dict[str, int] = Field(default_factory=dict)
