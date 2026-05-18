from pydantic import BaseModel, Field


class ProductComponentLinkEntry(BaseModel):
    component_id: str
    is_core: bool = False
    sort_order: int = 0


class ProductComponentLinkRead(BaseModel):
    id: str
    product_id: str
    component_id: str
    is_core: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ProductComponentReplacePayload(BaseModel):
    links: list[ProductComponentLinkEntry] = Field(default_factory=list)


class ProductComponentLinksRead(BaseModel):
    items: list[ProductComponentLinkRead] = Field(default_factory=list)
