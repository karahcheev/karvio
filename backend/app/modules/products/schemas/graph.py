from pydantic import BaseModel, Field

from app.modules.products.schemas.components import ComponentRead
from app.modules.products.schemas.dependencies import ComponentDependencyRead


class ComponentGraphRead(BaseModel):
    components: list[ComponentRead] = Field(default_factory=list)
    dependencies: list[ComponentDependencyRead] = Field(default_factory=list)
