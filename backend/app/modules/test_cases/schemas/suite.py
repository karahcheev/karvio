from datetime import datetime

from pydantic import BaseModel, Field


class SuiteCreate(BaseModel):
    project_id: str
    name: str
    parent_id: str | None = None
    description: str | None = None

    model_config = {"extra": "forbid"}


class SuitePatch(BaseModel):
    name: str | None = None
    parent_id: str | None = None
    description: str | None = None
    position: int | None = None


class SuiteRead(BaseModel):
    id: str
    project_id: str
    name: str
    parent_id: str | None = None
    description: str | None = None
    position: int
    created_at: datetime
    updated_at: datetime
    test_cases_count: int = 0
    active_test_cases_count: int = 0

    model_config = {"from_attributes": True}


class SuitesList(BaseModel):
    items: list[SuiteRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
