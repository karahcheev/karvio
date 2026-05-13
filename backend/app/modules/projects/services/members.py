from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.common import SortDirection
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole
from app.modules.projects.models import ProjectMember, User
from app.modules.projects.repositories import members as project_member_repo
from app.modules.projects.repositories import projects as project_repo
from app.modules.projects.repositories import users as user_repo
from app.modules.projects.schemas.member import (
    ProjectMemberCreate,
    ProjectMemberPatch,
    ProjectMemberRead,
    ProjectMembersList,
)
from app.services.access import ensure_project_role
from app.modules.audit.services import audit as audit_service


async def _get_member_or_404(db: AsyncSession, project_member_id: str) -> ProjectMember:
    project_member = await project_member_repo.get_by_id(db, project_member_id)
    if not project_member:
        raise not_found("project_member")
    return project_member


async def list_project_members(
    db: AsyncSession,
    *,
    project_id: str,
    page: int,
    page_size: int,
    sort_by: project_member_repo.ProjectMemberSortField,
    sort_order: SortDirection,
    current_user: User,
) -> ProjectMembersList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await project_member_repo.list_by_project(
        db,
        project_id=project_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_direction=sort_order,
    )
    users_by_id = {
        user.id: user for user in await user_repo.list_by_ids(db, [member.user_id for member in result.items])
    }
    return ProjectMembersList(
        items=[
            ProjectMemberRead.model_validate(item).model_copy(
                update={"username": users_by_id.get(item.user_id).username if users_by_id.get(item.user_id) else None}
            )
            for item in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def create_project_member(
    db: AsyncSession,
    *,
    payload: ProjectMemberCreate,
    current_user: User,
) -> ProjectMemberRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.manager)

    if not await project_repo.exists(db, payload.project_id):
        raise not_found("project")
    if not await user_repo.exists(db, payload.user_id):
        raise not_found("user")

    project_member = ProjectMember(**payload.model_dump())
    db.add(project_member)
    await audit_service.queue_create_event(
        db,
        action="project_member.create",
        resource_type="project_member",
        entity=project_member,
        tenant_id=payload.project_id,
    )
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise DomainError(
            status_code=409,
            code="project_member_already_exists",
            title="Conflict",
            detail="user is already a member of this project",
            errors={"user_id": ["user is already a member of this project"]},
        ) from None
    await db.refresh(project_member)
    return ProjectMemberRead.model_validate(project_member)


async def get_project_member(db: AsyncSession, *, project_member_id: str, current_user: User) -> ProjectMemberRead:
    project_member = await _get_member_or_404(db, project_member_id)
    await ensure_project_role(db, current_user, project_member.project_id, ProjectMemberRole.viewer)
    return ProjectMemberRead.model_validate(project_member)


async def patch_project_member(
    db: AsyncSession,
    *,
    project_member_id: str,
    payload: ProjectMemberPatch,
    current_user: User,
) -> ProjectMemberRead:
    project_member = await _get_member_or_404(db, project_member_id)
    await ensure_project_role(db, current_user, project_member.project_id, ProjectMemberRole.manager)
    before_state = audit_service.snapshot_entity(project_member)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project_member, key, value)
    await audit_service.queue_update_event(
        db,
        action="project_member.update",
        resource_type="project_member",
        entity=project_member,
        before=before_state,
        tenant_id=project_member.project_id,
    )
    await db.flush()
    await db.refresh(project_member)
    return ProjectMemberRead.model_validate(project_member)


async def delete_project_member(db: AsyncSession, *, project_member_id: str, current_user: User) -> None:
    project_member = await _get_member_or_404(db, project_member_id)
    await ensure_project_role(db, current_user, project_member.project_id, ProjectMemberRole.manager)
    before_state = audit_service.snapshot_entity(project_member)
    await audit_service.queue_delete_event(
        db,
        action="project_member.delete",
        resource_type="project_member",
        resource_id=project_member.id,
        before=before_state,
        tenant_id=project_member.project_id,
    )
    await db.delete(project_member)
