"""Validation helpers: entity lookups, membership checks, cycle detection."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError, not_found
from app.modules.products.models import Component, Product
from app.modules.products.repositories import products as product_repo
from app.modules.projects.models import ProjectMember, User


async def _get_product_or_404(db: AsyncSession, product_id: str) -> Product:
    product = await product_repo.get_product_by_id(db, product_id)
    if not product:
        raise not_found("product")
    return product


async def _get_component_or_404(db: AsyncSession, component_id: str) -> Component:
    component = await product_repo.get_component_by_id(db, component_id)
    if not component:
        raise not_found("component")
    return component


async def _ensure_owner_is_project_member(
    db: AsyncSession,
    *,
    project_id: str,
    owner_id: str | None,
) -> None:
    if owner_id is None:
        return
    owner = await db.scalar(select(User).where(User.id == owner_id))
    if owner is None:
        raise not_found("user")
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == owner_id,
        )
    )
    if membership is None:
        raise DomainError(
            status_code=422,
            code="owner_not_project_member",
            title="Validation error",
            detail="owner must be a project member",
            errors={"owner_id": ["owner must be a project member"]},
        )


async def _creates_dependency_cycle(
    db: AsyncSession,
    *,
    source_component_id: str,
    target_component_ids: list[str],
) -> bool:
    frontier = {component_id for component_id in target_component_ids if component_id}
    visited: set[str] = set()
    while frontier:
        if source_component_id in frontier:
            return True
        visited.update(frontier)
        dependencies = await product_repo.list_dependencies_for_sources(db, list(frontier))
        frontier = {
            dependency.target_component_id
            for dependency in dependencies
            if dependency.target_component_id not in visited
        }
    return False
