from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ProjectMemberRole


class ProjectMemberCreate(BaseModel):
    project_id: str
    user_id: str
    role: ProjectMemberRole

    model_config = {"extra": "forbid"}


class ProjectMemberPatch(BaseModel):
    role: ProjectMemberRole | None = None


class ProjectMemberRead(BaseModel):
    id: str
    project_id: str
    user_id: str
    username: str | None = None
    role: ProjectMemberRole
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectMembersList(BaseModel):
    items: list[ProjectMemberRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
