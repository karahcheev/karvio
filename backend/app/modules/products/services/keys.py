"""Key generation helpers for products and components."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.products.models import Component, Product

SLUG_CLEAN_RE = re.compile(r"[^a-z0-9]+")

_MAX_KEY_ATTEMPTS = 1000


def _slugify(value: str) -> str:
    cleaned = SLUG_CLEAN_RE.sub("-", value.strip().lower()).strip("-")
    if cleaned:
        return cleaned[:100]
    return "item"


async def _unique_product_key(
    db: AsyncSession,
    *,
    project_id: str,
    name: str,
    key: str | None,
    exclude_id: str | None = None,
) -> str:
    base = _slugify(key or name)
    candidate = base
    suffix = 2
    for _ in range(_MAX_KEY_ATTEMPTS):
        stmt = select(Product.id).where(Product.project_id == project_id, Product.key == candidate)
        existing_id = await db.scalar(stmt)
        if not existing_id or existing_id == exclude_id:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1
    raise DomainError(
        status_code=422,
        code="product_key_collision",
        title="Key generation failed",
        detail=f"Could not generate a unique key for '{base}' after {_MAX_KEY_ATTEMPTS} attempts",
    )


async def _unique_component_key(
    db: AsyncSession,
    *,
    project_id: str,
    name: str,
    key: str | None,
    exclude_id: str | None = None,
) -> str:
    base = _slugify(key or name)
    candidate = base
    suffix = 2
    for _ in range(_MAX_KEY_ATTEMPTS):
        stmt = select(Component.id).where(Component.project_id == project_id, Component.key == candidate)
        existing_id = await db.scalar(stmt)
        if not existing_id or existing_id == exclude_id:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1
    raise DomainError(
        status_code=422,
        code="component_key_collision",
        title="Key generation failed",
        detail=f"Could not generate a unique key for '{base}' after {_MAX_KEY_ATTEMPTS} attempts",
    )
