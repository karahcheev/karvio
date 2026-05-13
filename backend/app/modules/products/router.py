from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.auth import get_project_id_required
from app.db.session import get_db
from app.models.enums import ComponentRiskLevel, ProductStatus
from app.modules.products.schemas.components import (
    ComponentCreate,
    ComponentPatch,
    ComponentRead,
    ComponentsList,
)
from app.modules.products.schemas.graph import ComponentGraphRead
from app.modules.products.schemas.dependencies import (
    ComponentDependenciesRead,
    ComponentDependencyReplacePayload,
)
from app.modules.products.schemas.links import (
    ProductComponentLinksRead,
    ProductComponentReplacePayload,
)
from app.modules.products.schemas.products import (
    ProductCreate,
    ProductPatch,
    ProductRead,
    ProductsList,
)
from app.modules.products.schemas.summary import ProductSummaryRead
from app.modules.products.services import facade as products_service
from app.modules.projects.models import User

router = APIRouter(tags=["products"])


@router.get("/products")
async def list_products(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: Annotated[list[ProductStatus] | None, Query(description="Filter by status.")] = None,
    search: Annotated[str | None, Query(description="Search by name, key, description")] = None,
    tag: Annotated[list[str] | None, Query(description="Filter by tag")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ProductsList:
    return await products_service.list_products(
        db,
        project_id=project_id,
        statuses=status,
        search=search,
        tags=tag,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProductRead:
    return await products_service.create_product(db, payload=payload, current_user=current_user)


@router.get("/products/{product_id}")
async def get_product(
    product_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProductRead:
    return await products_service.get_product(db, product_id=product_id, current_user=current_user)


@router.patch("/products/{product_id}")
async def patch_product(
    product_id: Annotated[str, Path(...)],
    payload: ProductPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProductRead:
    return await products_service.patch_product(db, product_id=product_id, payload=payload, current_user=current_user)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await products_service.delete_product(db, product_id=product_id, current_user=current_user)


@router.get("/components")
async def list_components(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: Annotated[list[ProductStatus] | None, Query(description="Filter by status.")] = None,
    risk_level: Annotated[list[ComponentRiskLevel] | None, Query(description="Filter by risk level.")] = None,
    search: Annotated[str | None, Query(description="Search by name, key, description")] = None,
    tag: Annotated[list[str] | None, Query(description="Filter by tag")] = None,
    product_id: Annotated[list[str] | None, Query(description="Filter by linked product")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ComponentsList:
    return await products_service.list_components(
        db,
        project_id=project_id,
        statuses=status,
        risk_levels=risk_level,
        search=search,
        tags=tag,
        product_ids=product_id,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.post("/components", status_code=status.HTTP_201_CREATED)
async def create_component(
    payload: ComponentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComponentRead:
    return await products_service.create_component(db, payload=payload, current_user=current_user)


@router.get("/components/graph")
async def get_component_graph(
    project_id: Annotated[str, Depends(get_project_id_required)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComponentGraphRead:
    return await products_service.get_component_graph(db, project_id=project_id, current_user=current_user)


@router.get("/components/{component_id}")
async def get_component(
    component_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComponentRead:
    return await products_service.get_component(db, component_id=component_id, current_user=current_user)


@router.patch("/components/{component_id}")
async def patch_component(
    component_id: Annotated[str, Path(...)],
    payload: ComponentPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComponentRead:
    return await products_service.patch_component(db, component_id=component_id, payload=payload, current_user=current_user)


@router.delete("/components/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_component(
    component_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await products_service.delete_component(db, component_id=component_id, current_user=current_user)


@router.get("/products/{product_id}/components")
async def list_product_components(
    product_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProductComponentLinksRead:
    return await products_service.list_product_component_links(db, product_id=product_id, current_user=current_user)


@router.put("/products/{product_id}/components")
async def replace_product_components(
    product_id: Annotated[str, Path(...)],
    payload: ProductComponentReplacePayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProductComponentLinksRead:
    return await products_service.replace_product_component_links(
        db,
        product_id=product_id,
        payload=payload,
        current_user=current_user,
    )


@router.get("/components/{component_id}/dependencies")
async def list_component_dependencies(
    component_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComponentDependenciesRead:
    return await products_service.list_component_dependencies(db, component_id=component_id, current_user=current_user)


@router.put("/components/{component_id}/dependencies")
async def replace_component_dependencies(
    component_id: Annotated[str, Path(...)],
    payload: ComponentDependencyReplacePayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComponentDependenciesRead:
    return await products_service.replace_component_dependencies(
        db,
        component_id=component_id,
        payload=payload,
        current_user=current_user,
    )


@router.get("/products/{product_id}/summary")
async def get_product_summary(
    product_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProductSummaryRead:
    return await products_service.get_product_summary(db, product_id=product_id, current_user=current_user)
