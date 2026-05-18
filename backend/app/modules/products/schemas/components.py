from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ComponentRiskLevel, ProductStatus


class ComponentCreate(BaseModel):
    project_id: str
    name: str
    key: str | None = None
    description: str | None = None
    owner_id: str | None = None
    status: ProductStatus = ProductStatus.active
    tags: list[str] = Field(default_factory=list)

    business_criticality: int = 0
    change_frequency: int = 0
    integration_complexity: int = 0
    defect_density: int = 0
    production_incident_score: int = 0
    automation_confidence: int = 5

    model_config = {"extra": "forbid"}

    @field_validator(
        "business_criticality",
        "change_frequency",
        "integration_complexity",
        "defect_density",
        "production_incident_score",
        "automation_confidence",
    )
    @classmethod
    def validate_risk_factor_range(cls, value: int) -> int:
        if value < 0 or value > 5:
            raise ValueError("risk factors must be between 0 and 5")
        return value


class ComponentPatch(BaseModel):
    name: str | None = None
    key: str | None = None
    description: str | None = None
    owner_id: str | None = None
    status: ProductStatus | None = None
    tags: list[str] | None = None

    business_criticality: int | None = None
    change_frequency: int | None = None
    integration_complexity: int | None = None
    defect_density: int | None = None
    production_incident_score: int | None = None
    automation_confidence: int | None = None

    model_config = {"extra": "forbid"}

    @field_validator(
        "business_criticality",
        "change_frequency",
        "integration_complexity",
        "defect_density",
        "production_incident_score",
        "automation_confidence",
    )
    @classmethod
    def validate_risk_factor_range(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 0 or value > 5:
            raise ValueError("risk factors must be between 0 and 5")
        return value


class ComponentRead(BaseModel):
    id: str
    project_id: str
    name: str
    key: str
    description: str | None = None
    owner_id: str | None = None
    status: ProductStatus
    tags: list[str] = Field(default_factory=list)
    business_criticality: int
    change_frequency: int
    integration_complexity: int
    defect_density: int
    production_incident_score: int
    automation_confidence: int
    risk_score: int
    risk_level: ComponentRiskLevel
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComponentsList(BaseModel):
    items: list[ComponentRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


