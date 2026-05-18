from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.common import SortDirection
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, UserRole
from app.modules.projects.models import Project, ProjectMember, User
from app.modules.projects.repositories import projects as project_repo
from app.modules.projects.schemas.project import ProjectCreate, ProjectPatch, ProjectRead, ProjectsList
from app.services.access import ensure_project_role
from app.modules.audit.services import audit as audit_service
from app.services.bootstrap import DEFAULT_PROJECT_NAME


async def _to_project_read(db: AsyncSession, project: Project) -> ProjectRead:
    project.members_count = await project_repo.count_members(db, project.id)
    return ProjectRead.model_validate(project)


async def _get_project_or_404(db: AsyncSession, project_id: str) -> Project:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise not_found("project")
    return project


async def list_projects(
    db: AsyncSession,
    *,
    current_user: User,
    page: int,
    page_size: int,
    sort_by: project_repo.ProjectSortField,
    sort_order: SortDirection,
) -> ProjectsList:
    if current_user.role == UserRole.admin:
        result = await project_repo.list_all(
            db,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_direction=sort_order,
        )
    else:
        result = await project_repo.list_for_user(
            db,
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_direction=sort_order,
        )
    return ProjectsList(
        items=[ProjectRead.model_validate(item) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def create_project(db: AsyncSession, *, payload: ProjectCreate, current_user: User) -> ProjectRead:
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    await db.flush()

    owner_member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectMemberRole.manager,
    )
    db.add(owner_member)
    await audit_service.queue_create_event(
        db,
        action="project.create",
        resource_type="project",
        entity=project,
        tenant_id=project.id,
        metadata={"owner_user_id": current_user.id},
    )
    await db.flush()
    await db.refresh(project)
    return await _to_project_read(db, project)


async def get_project(db: AsyncSession, *, project_id: str, current_user: User) -> ProjectRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    project = await _get_project_or_404(db, project_id)
    return await _to_project_read(db, project)


async def patch_project(
    db: AsyncSession,
    *,
    project_id: str,
    payload: ProjectPatch,
    current_user: User,
) -> ProjectRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.manager)
    project = await _get_project_or_404(db, project_id)
    before_state = audit_service.snapshot_entity(project)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await audit_service.queue_update_event(
        db,
        action="project.update",
        resource_type="project",
        entity=project,
        before=before_state,
        tenant_id=project.id,
    )
    await db.flush()
    await db.refresh(project)
    return await _to_project_read(db, project)


async def delete_project(db: AsyncSession, *, project_id: str, current_user: User) -> None:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.manager)
    project = await _get_project_or_404(db, project_id)
    before_state = audit_service.snapshot_entity(project)
    if project.name == DEFAULT_PROJECT_NAME:
        raise DomainError(
            status_code=403,
            code="default_project_protected",
            title="Forbidden",
            detail="Default project cannot be deleted",
        )
    await audit_service.queue_delete_event(
        db,
        action="project.delete",
        resource_type="project",
        resource_id=project.id,
        before=before_state,
        tenant_id=project.id,
    )
    db.delete(project)
