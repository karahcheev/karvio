from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, UserRole
from app.modules.projects.models import User
from app.modules.audit.repositories import logs as audit_repo
from app.modules.audit.schemas.logs import AuditLogListQuery, AuditLogRead, AuditLogsList
from app.services.access import ensure_project_role


async def _resolve_tenant_scope(
    db: AsyncSession,
    *,
    current_user: User,
    project_id: str | None,
) -> str | None:
    if current_user.role == UserRole.admin:
        return project_id

    if not project_id:
        raise DomainError(
            status_code=400,
            code="missing_project_id",
            title="Invalid request",
            detail="Query parameter project_id is required",
        )

    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    return project_id


async def list_audit_logs(
    db: AsyncSession,
    *,
    current_user: User,
    query: AuditLogListQuery,
) -> AuditLogsList:
    tenant_id = await _resolve_tenant_scope(db, current_user=current_user, project_id=query.project_id)
    result_page = await audit_repo.list_audit_logs(
        db,
        tenant_id=tenant_id,
        date_from=query.date_from,
        date_to=query.date_to,
        actor_id=query.actor_id,
        action=query.action,
        resource_type=query.resource_type,
        resource_id=query.resource_id,
        result=query.result,
        page=query.page,
        page_size=query.page_size,
        sort_by=query.sort_by,
        sort_direction=query.sort_order,
    )
    return AuditLogsList(
        items=[AuditLogRead.model_validate(item) for item in result_page.items],
        page=result_page.page,
        page_size=result_page.page_size,
        has_next=result_page.has_next,
    )
