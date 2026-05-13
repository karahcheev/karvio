from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None

    model_config = {"extra": "forbid"}


class ProjectPatch(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectRead(BaseModel):
    id: str
    name: str
    description: str | None = None
    members_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectsList(BaseModel):
    items: list[ProjectRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
