from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import (
    ComponentRiskLevel,
    ProductStatus,
    ProjectMemberRole,
)
from app.modules.products.models import (
    Component,
    ComponentDependency,
    Product,
    ProductComponentLink,
)
from app.modules.products.repositories import products as product_repo
from app.modules.products.schemas.components import (
    ComponentCreate,
    ComponentPatch,
    ComponentRead,
    ComponentsList,
)
from app.modules.products.schemas.graph import ComponentGraphRead
from app.modules.products.schemas.dependencies import (
    ComponentDependenciesRead,
    ComponentDependencyRead,
    ComponentDependencyReplacePayload,
)
from app.modules.products.schemas.links import (
    ProductComponentLinkRead,
    ProductComponentLinksRead,
    ProductComponentReplacePayload,
)
from app.modules.products.schemas.plan import (
    PlanGenerationConfig,
    PlanGenerationPreviewRead,
)
from app.modules.products.schemas.products import (
    ProductCreate,
    ProductListSummarySnapshotRead,
    ProductPatch,
    ProductRead,
    ProductsList,
)
from app.modules.products.schemas.summary import ProductSummaryRead
from app.modules.projects.models import User
from app.modules.products.services.keys import _unique_product_key, _unique_component_key
from app.modules.products.services.risk import compute_risk_score_and_level
from app.modules.products.services.validation import (
    _get_product_or_404,
    _get_component_or_404,
    _ensure_owner_is_project_member,
    _creates_dependency_cycle,
)
from app.modules.products.services.summary import _build_product_summary
from app.modules.products.services.plan import (
    resolve_generation_components,
    _build_plan_generation_preview,
)
from app.services.access import ensure_project_role


async def list_products(
    db: AsyncSession,
    *,
    project_id: str,
    statuses: list[ProductStatus] | None,
    search: str | None,
    tags: list[str] | None,
    page: int,
    page_size: int,
    current_user: User,
) -> ProductsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await product_repo.list_products(
        db,
        project_id=project_id,
        statuses=statuses,
        search=search,
        tags=tags,
        page=page,
        page_size=page_size,
    )
    product_ids = [item.id for item in result.items]
    summary_snapshots = await product_repo.list_product_summary_snapshots(db, product_ids=product_ids)

    items: list[ProductRead] = []
    for item in result.items:
        product_read = ProductRead.model_validate(item)
        snapshot = summary_snapshots.get(item.id)
        if snapshot is not None:
            product_read = product_read.model_copy(update={"summary_snapshot": ProductListSummarySnapshotRead(**snapshot)})
        items.append(product_read)

    return ProductsList(
        items=items,
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def create_product(db: AsyncSession, *, payload: ProductCreate, current_user: User) -> ProductRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    await _ensure_owner_is_project_member(db, project_id=payload.project_id, owner_id=payload.owner_id)
    product = Product(
        project_id=payload.project_id,
        name=payload.name,
        key=await _unique_product_key(db, project_id=payload.project_id, name=payload.name, key=payload.key),
        description=payload.description,
        owner_id=payload.owner_id,
        status=payload.status,
        tags=payload.tags,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return ProductRead.model_validate(product)


async def get_product(db: AsyncSession, *, product_id: str, current_user: User) -> ProductRead:
    product = await _get_product_or_404(db, product_id)
    await ensure_project_role(db, current_user, product.project_id, ProjectMemberRole.viewer)
    return ProductRead.model_validate(product)


async def patch_product(db: AsyncSession, *, product_id: str, payload: ProductPatch, current_user: User) -> ProductRead:
    product = await _get_product_or_404(db, product_id)
    await ensure_project_role(db, current_user, product.project_id, ProjectMemberRole.lead)

    changes = payload.model_dump(exclude_unset=True)
    if "owner_id" in changes:
        await _ensure_owner_is_project_member(db, project_id=product.project_id, owner_id=changes["owner_id"])
    if "name" in changes or "key" in changes:
        product.key = await _unique_product_key(
            db,
            project_id=product.project_id,
            name=changes.get("name", product.name),
            key=changes.get("key", product.key),
            exclude_id=product.id,
        )
    for key, value in changes.items():
        if key == "key":
            continue
        setattr(product, key, value)

    await db.flush()
    await db.refresh(product)
    return ProductRead.model_validate(product)


async def delete_product(db: AsyncSession, *, product_id: str, current_user: User) -> None:
    product = await _get_product_or_404(db, product_id)
    await ensure_project_role(db, current_user, product.project_id, ProjectMemberRole.lead)
    await db.delete(product)


async def list_components(
    db: AsyncSession,
    *,
    project_id: str,
    statuses: list[ProductStatus] | None,
    risk_levels: list[ComponentRiskLevel] | None,
    search: str | None,
    tags: list[str] | None,
    product_ids: list[str] | None,
    page: int,
    page_size: int,
    current_user: User,
) -> ComponentsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await product_repo.list_components(
        db,
        project_id=project_id,
        statuses=statuses,
        risk_levels=risk_levels,
        search=search,
        tags=tags,
        product_ids=product_ids,
        page=page,
        page_size=page_size,
    )
    return ComponentsList(
        items=[ComponentRead.model_validate(item) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def create_component(db: AsyncSession, *, payload: ComponentCreate, current_user: User) -> ComponentRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.lead)
    await _ensure_owner_is_project_member(db, project_id=payload.project_id, owner_id=payload.owner_id)

    component = Component(
        project_id=payload.project_id,
        name=payload.name,
        key=await _unique_component_key(db, project_id=payload.project_id, name=payload.name, key=payload.key),
        description=payload.description,
        owner_id=payload.owner_id,
        status=payload.status,
        tags=payload.tags,
        business_criticality=payload.business_criticality,
        change_frequency=payload.change_frequency,
        integration_complexity=payload.integration_complexity,
        defect_density=payload.defect_density,
        production_incident_score=payload.production_incident_score,
        automation_confidence=payload.automation_confidence,
    )
    component.risk_score, component.risk_level = compute_risk_score_and_level(component)
    db.add(component)
    await db.flush()
    await db.refresh(component)
    return ComponentRead.model_validate(component)


async def get_component(db: AsyncSession, *, component_id: str, current_user: User) -> ComponentRead:
    component = await _get_component_or_404(db, component_id)
    await ensure_project_role(db, current_user, component.project_id, ProjectMemberRole.viewer)
    return ComponentRead.model_validate(component)


async def patch_component(db: AsyncSession, *, component_id: str, payload: ComponentPatch, current_user: User) -> ComponentRead:
    component = await _get_component_or_404(db, component_id)
    await ensure_project_role(db, current_user, component.project_id, ProjectMemberRole.lead)

    changes = payload.model_dump(exclude_unset=True)
    if "owner_id" in changes:
        await _ensure_owner_is_project_member(db, project_id=component.project_id, owner_id=changes["owner_id"])
    if "name" in changes or "key" in changes:
        component.key = await _unique_component_key(
            db,
            project_id=component.project_id,
            name=changes.get("name", component.name),
            key=changes.get("key", component.key),
            exclude_id=component.id,
        )
    for key, value in changes.items():
        if key == "key":
            continue
        setattr(component, key, value)
    if {
        "business_criticality",
        "change_frequency",
        "integration_complexity",
        "defect_density",
        "production_incident_score",
        "automation_confidence",
    } & set(changes.keys()):
        component.risk_score, component.risk_level = compute_risk_score_and_level(component)

    await db.flush()
    await db.refresh(component)
    return ComponentRead.model_validate(component)


async def delete_component(db: AsyncSession, *, component_id: str, current_user: User) -> None:
    component = await _get_component_or_404(db, component_id)
    await ensure_project_role(db, current_user, component.project_id, ProjectMemberRole.lead)
    await db.delete(component)


async def list_product_component_links(
    db: AsyncSession,
    *,
    product_id: str,
    current_user: User,
) -> ProductComponentLinksRead:
    product = await _get_product_or_404(db, product_id)
    await ensure_project_role(db, current_user, product.project_id, ProjectMemberRole.viewer)
    items = await product_repo.list_product_components(db, product_id)
    return ProductComponentLinksRead(items=[ProductComponentLinkRead.model_validate(item) for item in items])


async def replace_product_component_links(
    db: AsyncSession,
    *,
    product_id: str,
    payload: ProductComponentReplacePayload,
    current_user: User,
) -> ProductComponentLinksRead:
    product = await _get_product_or_404(db, product_id)
    await ensure_project_role(db, current_user, product.project_id, ProjectMemberRole.lead)

    component_ids = [entry.component_id for entry in payload.links]
    components = await product_repo.list_components_by_ids(db, component_ids)
    component_by_id = {item.id: item for item in components}
    for component_id in component_ids:
        component = component_by_id.get(component_id)
        if not component or component.project_id != product.project_id:
            raise DomainError(
                status_code=422,
                code="component_project_mismatch",
                title="Validation error",
                detail="All components must belong to the same project as the product",
                errors={"component_id": [f"invalid component_id: {component_id}"]},
            )

    for existing in await product_repo.list_product_components(db, product_id):
        await db.delete(existing)
    await db.flush()

    for entry in payload.links:
        db.add(
            ProductComponentLink(
                product_id=product_id,
                component_id=entry.component_id,
                is_core=entry.is_core,
                sort_order=entry.sort_order,
            )
        )
    await db.flush()
    links = await product_repo.list_product_components(db, product_id)
    return ProductComponentLinksRead(items=[ProductComponentLinkRead.model_validate(item) for item in links])


async def list_component_dependencies(
    db: AsyncSession,
    *,
    component_id: str,
    current_user: User,
) -> ComponentDependenciesRead:
    component = await _get_component_or_404(db, component_id)
    await ensure_project_role(db, current_user, component.project_id, ProjectMemberRole.viewer)
    dependencies = await product_repo.list_component_dependencies(db, component_id)
    return ComponentDependenciesRead(items=[ComponentDependencyRead.model_validate(item) for item in dependencies])


async def replace_component_dependencies(
    db: AsyncSession,
    *,
    component_id: str,
    payload: ComponentDependencyReplacePayload,
    current_user: User,
) -> ComponentDependenciesRead:
    component = await _get_component_or_404(db, component_id)
    await ensure_project_role(db, current_user, component.project_id, ProjectMemberRole.lead)

    target_ids = [item.target_component_id for item in payload.dependencies]
    target_components = await product_repo.list_components_by_ids(db, target_ids)
    target_by_id = {item.id: item for item in target_components}

    for item in payload.dependencies:
        if item.target_component_id == component.id:
            raise DomainError(
                status_code=422,
                code="component_dependency_cycle",
                title="Validation error",
                detail="A component cannot depend on itself",
                errors={"target_component_id": ["component cannot depend on itself"]},
            )
        target = target_by_id.get(item.target_component_id)
        if not target or target.project_id != component.project_id:
            raise DomainError(
                status_code=422,
                code="component_project_mismatch",
                title="Validation error",
                detail="Dependencies must target components in the same project",
                errors={"target_component_id": [f"invalid target_component_id: {item.target_component_id}"]},
            )

    if await _creates_dependency_cycle(
        db,
        source_component_id=component.id,
        target_component_ids=target_ids,
    ):
        raise DomainError(
            status_code=422,
            code="component_dependency_cycle",
            title="Validation error",
            detail="Dependency replacement introduces a cycle",
            errors={"target_component_id": ["dependency cycle detected"]},
        )

    for dependency in await product_repo.list_component_dependencies(db, component_id):
        await db.delete(dependency)
    await db.flush()

    for item in payload.dependencies:
        db.add(
            ComponentDependency(
                source_component_id=component_id,
                target_component_id=item.target_component_id,
                dependency_type=item.dependency_type,
            )
        )
    await db.flush()
    dependencies = await product_repo.list_component_dependencies(db, component_id)
    return ComponentDependenciesRead(items=[ComponentDependencyRead.model_validate(item) for item in dependencies])


async def get_product_summary(db: AsyncSession, *, product_id: str, current_user: User) -> ProductSummaryRead:
    product = await _get_product_or_404(db, product_id)
    await ensure_project_role(db, current_user, product.project_id, ProjectMemberRole.viewer)
    return await _build_product_summary(db, product.id)


async def get_component_graph(
    db: AsyncSession,
    *,
    project_id: str,
    current_user: User,
) -> ComponentGraphRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    components = await product_repo.list_components(
        db,
        project_id=project_id,
        statuses=None,
        risk_levels=None,
        search=None,
        tags=None,
        product_ids=None,
        page=1,
        page_size=500,
    )
    deps = await product_repo.list_all_component_dependencies_for_project(db, project_id)
    return ComponentGraphRead(
        components=[ComponentRead.model_validate(c) for c in components.items],
        dependencies=[ComponentDependencyRead.model_validate(d) for d in deps],
    )


async def build_plan_generation_preview(
    db: AsyncSession,
    *,
    project_id: str,
    config: PlanGenerationConfig,
    current_user: User,
) -> tuple[PlanGenerationPreviewRead, dict[str, list[str]]]:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)
    return await _build_plan_generation_preview(db, project_id=project_id, config=config)
