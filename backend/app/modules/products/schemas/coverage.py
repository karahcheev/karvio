from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CoverageStrength, CoverageType


class TestCaseCoverageWrite(BaseModel):
    component_id: str
    coverage_type: CoverageType
    coverage_strength: CoverageStrength
    is_mandatory_for_release: bool = False
    notes: str | None = None


class TestCaseCoverageRead(TestCaseCoverageWrite):
    id: str
    test_case_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
