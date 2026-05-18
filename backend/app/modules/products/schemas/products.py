from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ProductStatus


class ProductCreate(BaseModel):
    project_id: str
    name: str
    key: str | None = None
    description: str | None = None
    owner_id: str | None = None
    status: ProductStatus = ProductStatus.active
    tags: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class ProductPatch(BaseModel):
    name: str | None = None
    key: str | None = None
    description: str | None = None
    owner_id: str | None = None
    status: ProductStatus | None = None
    tags: list[str] | None = None

    model_config = {"extra": "forbid"}


class ProductListSummarySnapshotRead(BaseModel):
    total_components: int = 0
    adequately_covered_components: int = 0
    uncovered_components: int = 0
    high_risk_uncovered_components: int = 0
    mandatory_release_cases: int = 0


class ProductRead(BaseModel):
    id: str
    project_id: str
    name: str
    key: str
    description: str | None = None
    owner_id: str | None = None
    status: ProductStatus
    tags: list[str] = Field(default_factory=list)
    summary_snapshot: ProductListSummarySnapshotRead | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductsList(BaseModel):
    items: list[ProductRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0
