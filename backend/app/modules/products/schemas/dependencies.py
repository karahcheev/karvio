from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ComponentDependencyType


class ComponentDependencyEntry(BaseModel):
    target_component_id: str
    dependency_type: ComponentDependencyType = ComponentDependencyType.depends_on


class ComponentDependencyRead(BaseModel):
    id: str
    source_component_id: str
    target_component_id: str
    dependency_type: ComponentDependencyType
    created_at: datetime

    model_config = {"from_attributes": True}


class ComponentDependencyReplacePayload(BaseModel):
    dependencies: list[ComponentDependencyEntry] = Field(default_factory=list)


class ComponentDependenciesRead(BaseModel):
    items: list[ComponentDependencyRead] = Field(default_factory=list)
