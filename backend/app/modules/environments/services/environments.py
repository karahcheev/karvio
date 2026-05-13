from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.models.enums import ProjectMemberRole
from app.modules.audit.services import audit as audit_service
from app.modules.environments.models import Environment
from app.modules.environments.repositories import environments as environment_repo
from app.modules.environments.schemas.environments import (
    EnvironmentCreate,
    EnvironmentPatch,
    EnvironmentRead,
    EnvironmentRevisionRead,
    EnvironmentRevisionsList,
    EnvironmentUseCasesList,
    EnvironmentsList,
)
from app.modules.environments.services.presenters import environment_to_read, revision_to_read
from app.modules.environments.services.revisions import create_revision
from app.modules.environments.services.snapshot import (
    ENVIRONMENT_DATA_SCHEMA_VERSION,
    build_snapshot_payload,
)
from app.modules.projects.models import User
from app.repositories.common import SortDirection
from app.services.access import ensure_project_role


async def _get_environment_or_404(db: AsyncSession, environment_id: str) -> Environment:
    environment = await environment_repo.get_by_id(db, environment_id)
    if not environment:
        raise not_found("environment")
    return environment


async def list_environments(
    db: AsyncSession,
    *,
    project_id: str,
    include_archived: bool,
    search: str | None,
    use_cases: list[str] | None,
    page: int,
    page_size: int,
    sort_by: environment_repo.EnvironmentSortField,
    sort_order: SortDirection,
    current_user: User,
) -> EnvironmentsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await environment_repo.list_by_project(
        db,
        project_id=project_id,
        include_archived=include_archived,
        search=search,
        use_cases=use_cases,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_direction=sort_order,
    )
    revision_by_environment_id = await environment_repo.get_current_revisions_by_environment_ids(
        db,
        [item.id for item in result.items],
    )
    return EnvironmentsList(
        items=[
            environment_to_read(item, revision_by_environment_id.get(item.id))
            for item in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def list_environment_use_cases(
    db: AsyncSession,
    *,
    project_id: str,
    include_archived: bool,
    current_user: User,
) -> EnvironmentUseCasesList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    items = await environment_repo.distinct_use_cases_for_project(
        db,
        project_id=project_id,
        include_archived=include_archived,
    )
    return EnvironmentUseCasesList(items=items)


async def create_environment(
    db: AsyncSession,
    *,
    payload: EnvironmentCreate,
    current_user: User,
) -> EnvironmentRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    environment = Environment(
        project_id=payload.project_id,
        name=payload.name,
        kind=payload.kind,
        status=payload.status,
        description=payload.description,
        tags=payload.tags,
        use_cases=payload.use_cases,
        schema_version=ENVIRONMENT_DATA_SCHEMA_VERSION,
        topology=payload.topology.model_dump(),
        meta=payload.meta,
        extra=payload.extra,
        current_revision_number=0,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(environment)
    await db.flush()
    revision = await create_revision(
        db,
        environment=environment,
        snapshot_payload=build_snapshot_payload(
            environment=environment,
            name=payload.name,
            kind=payload.kind,
            status=payload.status,
            description=payload.description,
            tags=payload.tags,
            use_cases=payload.use_cases,
            topology=payload.topology.model_dump(),
            meta=payload.meta,
            extra=payload.extra,
        ),
        current_user=current_user,
        revision_note="Initial revision",
    )
    await audit_service.queue_create_event(
        db,
        action="environment.create",
        resource_type="environment",
        entity=environment,
        tenant_id=payload.project_id,
    )
    await db.flush()
    await db.refresh(environment)
    await db.refresh(revision, attribute_names=["entities", "edges"])
    return environment_to_read(environment, revision)


async def get_environment(
    db: AsyncSession,
    *,
    environment_id: str,
    current_user: User,
) -> EnvironmentRead:
    environment = await _get_environment_or_404(db, environment_id)
    await ensure_project_role(db, current_user, environment.project_id, ProjectMemberRole.viewer)
    revision = await environment_repo.get_current_revision(db, environment.id)
    return environment_to_read(environment, revision)


async def patch_environment(
    db: AsyncSession,
    *,
    environment_id: str,
    payload: EnvironmentPatch,
    current_user: User,
) -> EnvironmentRead:
    environment = await _get_environment_or_404(db, environment_id)
    await ensure_project_role(db, current_user, environment.project_id, ProjectMemberRole.tester)
    before_state = audit_service.snapshot_entity(environment)
    current_revision = await environment_repo.get_current_revision(db, environment.id)
    base_snapshot = (
        current_revision.full_snapshot
        if current_revision is not None
        else build_snapshot_payload(
            environment=environment,
            name=environment.name,
            kind=environment.kind,
            status=environment.status,
            description=environment.description,
            tags=environment.tags,
            use_cases=environment.use_cases,
            topology=environment.topology,
            meta=environment.meta,
            extra=environment.extra,
        )
    )
    changes = payload.model_dump(exclude_unset=True)
    environment_snapshot_data = dict(base_snapshot.get("environment", {}))
    topology_data = dict(base_snapshot.get("topology", {}))

    for key, value in changes.items():
        if key == "topology" and payload.topology is not None:
            topology_data = payload.topology.model_dump()
            continue
        if key in {"name", "kind", "status", "description", "tags", "use_cases", "meta", "extra"}:
            environment_snapshot_data[key] = value

    environment.name = str(environment_snapshot_data.get("name") or environment.name)
    environment.kind = str(environment_snapshot_data.get("kind") or environment.kind)
    environment.status = str(environment_snapshot_data.get("status") or environment.status)
    environment.description = environment_snapshot_data.get("description")
    environment.tags = list(environment_snapshot_data.get("tags") or [])
    environment.use_cases = list(environment_snapshot_data.get("use_cases") or [])
    environment.topology = topology_data
    environment.meta = environment_snapshot_data.get("meta") or {}
    environment.extra = environment_snapshot_data.get("extra") or {}
    environment.updated_by = current_user.id
    revision = await create_revision(
        db,
        environment=environment,
        snapshot_payload={
            "environment": environment_snapshot_data,
            "topology": topology_data,
            "project_id": environment.project_id,
        },
        current_user=current_user,
        revision_note="Patched",
    )
    await audit_service.queue_update_event(
        db,
        action="environment.update",
        resource_type="environment",
        entity=environment,
        before=before_state,
        tenant_id=environment.project_id,
    )
    await db.flush()
    await db.refresh(environment)
    await db.refresh(revision, attribute_names=["entities", "edges"])
    return environment_to_read(environment, revision)


async def delete_environment(
    db: AsyncSession,
    *,
    environment_id: str,
    current_user: User,
) -> None:
    environment = await _get_environment_or_404(db, environment_id)
    await ensure_project_role(db, current_user, environment.project_id, ProjectMemberRole.lead)
    if environment.archived_at is not None:
        return
    before_state = audit_service.snapshot_entity(environment)
    environment.archived_at = datetime.now(timezone.utc)
    environment.updated_by = current_user.id
    await audit_service.queue_update_event(
        db,
        action="environment.archive",
        resource_type="environment",
        entity=environment,
        before=before_state,
        tenant_id=environment.project_id,
    )


async def list_environment_revisions(
    db: AsyncSession,
    *,
    environment_id: str,
    page: int,
    page_size: int,
    current_user: User,
) -> EnvironmentRevisionsList:
    environment = await _get_environment_or_404(db, environment_id)
    await ensure_project_role(db, current_user, environment.project_id, ProjectMemberRole.viewer)
    result = await environment_repo.list_revisions(
        db,
        environment_id=environment_id,
        page=page,
        page_size=page_size,
    )
    return EnvironmentRevisionsList(
        items=[revision_to_read(item) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def get_environment_revision(
    db: AsyncSession,
    *,
    environment_id: str,
    revision_number: int,
    current_user: User,
) -> EnvironmentRevisionRead:
    environment = await _get_environment_or_404(db, environment_id)
    await ensure_project_role(db, current_user, environment.project_id, ProjectMemberRole.viewer)
    revision = await environment_repo.get_revision_by_number(
        db,
        environment_id=environment_id,
        revision_number=revision_number,
    )
    if revision is None:
        raise not_found("environment_revision")
    return revision_to_read(revision)
