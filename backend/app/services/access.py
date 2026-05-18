from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import ACTION_PROJECT_ACCESS
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, UserRole
from app.modules.projects.models import ProjectMember, User
from app.modules.projects.repositories import members as project_member_repo
from app.modules.projects.repositories import projects as project_repo
from app.modules.projects.repositories import users as user_repo
from app.modules.audit.services.audit import try_emit_event_immediately

ROLE_PRIORITY: dict[ProjectMemberRole, int] = {
    ProjectMemberRole.viewer: 10,
    ProjectMemberRole.tester: 20,
    ProjectMemberRole.lead: 30,
    ProjectMemberRole.manager: 40,
}


async def ensure_admin(current_user: User, *, action: str) -> None:
    if current_user.role == UserRole.admin:
        return

    await try_emit_event_immediately(
        action="admin.access",
        resource_type="system",
        resource_id=None,
        result="fail",
        metadata={"reason": "admin_required", "operation": action},
        actor_id=current_user.id,
        actor_type="user",
    )
    raise DomainError(
        status_code=403,
        code="admin_required",
        title="Forbidden",
        detail="Admin access required",
    )


async def ensure_project_role(
    db: AsyncSession,
    current_user: User | str,
    project_id: str,
    required_role: ProjectMemberRole,
) -> ProjectMember | None:
    if isinstance(current_user, str):
        user_id = current_user
        user = await user_repo.get_by_id(db, user_id)
        return await _ensure_project_role_by_identity(
            db,
            user_id=user_id,
            is_admin=bool(user and user.role == UserRole.admin),
            project_id=project_id,
            required_role=required_role,
        )
    return await ensure_project_role_for_user(db, current_user, project_id, required_role)


async def ensure_project_role_for_user(
    db: AsyncSession,
    current_user: User,
    project_id: str,
    required_role: ProjectMemberRole,
) -> ProjectMember | None:
    return await _ensure_project_role_by_identity(
        db,
        user_id=current_user.id,
        is_admin=current_user.role == UserRole.admin,
        project_id=project_id,
        required_role=required_role,
    )


async def _ensure_project_role_by_identity(
    db: AsyncSession,
    *,
    user_id: str,
    is_admin: bool,
    project_id: str,
    required_role: ProjectMemberRole,
) -> ProjectMember | None:
    if not await project_repo.exists(db, project_id):
        await try_emit_event_immediately(
            action=ACTION_PROJECT_ACCESS,
            resource_type="project",
            resource_id=project_id,
            result="fail",
            tenant_id=project_id,
            metadata={"reason": "project_not_found", "required_role": required_role.value},
        )
        raise not_found("project")

    if is_admin:
        return None

    membership = await project_member_repo.get_membership(
        db,
        project_id=project_id,
        user_id=user_id,
    )
    if membership is None:
        await try_emit_event_immediately(
            action=ACTION_PROJECT_ACCESS,
            resource_type="project",
            resource_id=project_id,
            result="fail",
            tenant_id=project_id,
            metadata={"reason": "project_access_denied", "required_role": required_role.value},
        )
        raise DomainError(
            status_code=403,
            code="project_access_denied",
            title="Forbidden",
            detail="User is not a member of this project",
        )
    if ROLE_PRIORITY[membership.role] < ROLE_PRIORITY[required_role]:
        await try_emit_event_immediately(
            action=ACTION_PROJECT_ACCESS,
            resource_type="project",
            resource_id=project_id,
            result="fail",
            tenant_id=project_id,
            metadata={
                "reason": "insufficient_project_role",
                "required_role": required_role.value,
                "actual_role": membership.role.value,
            },
        )
        raise DomainError(
            status_code=403,
            code="insufficient_project_role",
            title="Forbidden",
            detail=f"Required role is at least {required_role.value}",
        )
    return membership
