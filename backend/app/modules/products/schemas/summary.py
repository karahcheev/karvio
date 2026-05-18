from pydantic import BaseModel, Field

from app.models.enums import ComponentRiskLevel


class ProductSummaryComponentBreakdown(BaseModel):
    component_id: str
    component_key: str
    component_name: str
    risk_level: ComponentRiskLevel
    risk_score: int
    coverage_score: int = 0
    required_coverage_score: int = 0
    adequately_covered: bool = False
    smoke_case_count: int = 0
    regression_case_count: int = 0
    deep_case_count: int = 0
    covered_case_ids: list[str] = Field(default_factory=list)
    uncovered: bool


class ProductSummaryRead(BaseModel):
    product_id: str
    total_components: int
    core_components: int
    components_with_cases: int
    adequately_covered_components: int = 0
    inadequately_covered_components: int = 0
    uncovered_components: int
    high_risk_uncovered_components: int
    coverage_score_total: int = 0
    required_coverage_score_total: int = 0
    total_cases: int
    mandatory_release_cases: int
    smoke_cases: int
    regression_cases: int
    deep_cases: int
    manual_cases: int
    automated_cases: int
    per_component_breakdown: list[ProductSummaryComponentBreakdown] = Field(default_factory=list)
