from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.projects.models import Suite, User
from app.modules.test_cases.repositories import suites as suite_repo
from app.modules.audit.services import audit as audit_service


async def build_suite_paths_by_id(db: AsyncSession, *, project_id: str) -> dict[str, tuple[str, ...]]:
    result = await db.scalars(select(Suite).where(Suite.project_id == project_id))
    suites = list(result.all())
    suite_by_id = {suite.id: suite for suite in suites}
    resolved: dict[str, tuple[str, ...]] = {}

    def resolve(suite_id: str | None) -> tuple[str, ...]:
        if not suite_id:
            return ()
        if suite_id in resolved:
            return resolved[suite_id]
        suite = suite_by_id.get(suite_id)
        if not suite:
            return ()
        path = resolve(suite.parent_id) + ((suite.name or "").strip(),)
        resolved[suite_id] = tuple(part for part in path if part)
        return resolved[suite_id]

    for suite in suites:
        resolve(suite.id)
    return resolved


async def get_suite_depth_by_parent(db: AsyncSession, parent_id: str | None) -> int:
    depth = 0
    current_parent_id = parent_id
    while current_parent_id is not None:
        parent = await suite_repo.get_by_id(db, current_parent_id)
        if not parent:
            break
        depth += 1
        current_parent_id = parent.parent_id
    return depth


async def ensure_suite_path(
    db: AsyncSession,
    *,
    project_id: str,
    suite_path: tuple[str, ...],
    _current_user: User,
) -> str | None:
    if not suite_path:
        return None

    parent_id: str | None = None
    for suite_name in suite_path:
        existing = await suite_repo.get_by_project_parent_and_name(
            db,
            project_id=project_id,
            parent_id=parent_id,
            name=suite_name,
        )
        if existing:
            parent_id = existing.id
            continue
        if await get_suite_depth_by_parent(db, parent_id) >= 4:
            raise DomainError(
                status_code=422,
                code="suite_depth_limit_exceeded",
                title="Validation error",
                detail="suite nesting is limited to 4 levels",
            )
        suite = Suite(project_id=project_id, name=suite_name, parent_id=parent_id)
        db.add(suite)
        await db.flush()
        await audit_service.queue_create_event(
            db,
            action="suite.create",
            resource_type="suite",
            entity=suite,
            tenant_id=project_id,
        )
        await db.refresh(suite)
        parent_id = suite.id
    return parent_id
