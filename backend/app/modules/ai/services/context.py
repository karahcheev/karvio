from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.products.models import Component, Product
from app.modules.projects.models import Project, Suite


async def load_project_context(db: AsyncSession, *, project_id: str) -> dict[str, str | None]:
    project = await db.scalar(select(Project).where(Project.id == project_id))
    return {"id": project_id, "name": project.name if project else None}


async def load_suite_context(db: AsyncSession, *, project_id: str, suite_id: str | None) -> dict[str, str | None] | None:
    if suite_id is None:
        return None
    suite = await db.scalar(select(Suite).where(Suite.id == suite_id))
    if suite is None or suite.project_id != project_id:
        raise DomainError(
            status_code=422,
            code="suite_project_mismatch",
            title="Validation error",
            detail="suite_id must belong to the same project",
            errors={"suite_id": ["suite does not belong to project"]},
        )
    return {"id": suite.id, "name": suite.name, "description": suite.description}


async def load_product_context(
    db: AsyncSession,
    *,
    project_id: str,
    product_id: str | None,
) -> dict[str, str | None] | None:
    if product_id is None:
        return None
    product = await db.scalar(select(Product).where(Product.id == product_id))
    if product is None or product.project_id != project_id:
        raise DomainError(
            status_code=422,
            code="product_project_mismatch",
            title="Validation error",
            detail="primary_product_id must belong to the same project",
            errors={"primary_product_id": ["product does not belong to project"]},
        )
    return {
        "id": product.id,
        "name": product.name,
        "key": product.key,
        "description": product.description,
    }


async def load_component_context(
    db: AsyncSession,
    *,
    project_id: str,
    component_ids: list[str],
) -> list[dict[str, object]]:
    unique_ids = list(dict.fromkeys(component_id for component_id in component_ids if component_id))
    if not unique_ids:
        return []
    rows = await db.scalars(select(Component).where(Component.id.in_(unique_ids)))
    components = {component.id: component for component in rows.all()}
    invalid = [component_id for component_id in unique_ids if component_id not in components]
    wrong_project = [component_id for component_id, component in components.items() if component.project_id != project_id]
    if invalid or wrong_project:
        raise DomainError(
            status_code=422,
            code="component_project_mismatch",
            title="Validation error",
            detail="component_ids must reference components from the same project",
            errors={"component_ids": [*invalid, *wrong_project]},
        )
    return [
        {
            "id": component.id,
            "name": component.name,
            "key": component.key,
            "description": component.description,
            "risk_level": component.risk_level.value,
            "risk_score": component.risk_score,
            "business_criticality": component.business_criticality,
            "change_frequency": component.change_frequency,
            "integration_complexity": component.integration_complexity,
            "defect_density": component.defect_density,
            "production_incident_score": component.production_incident_score,
            "automation_confidence": component.automation_confidence,
        }
        for component in components.values()
    ]


def allowed_component_ids(component_context: list[dict[str, object]]) -> set[str]:
    return {str(item["id"]) for item in component_context}

