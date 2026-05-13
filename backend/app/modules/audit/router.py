from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.audit.schemas.logs import AuditLogListQuery, AuditLogsList
from app.modules.audit.services import logs as audit_logs_service

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model_by_alias=False)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    query: Annotated[AuditLogListQuery, Depends()],
) -> AuditLogsList:
    return await audit_logs_service.list_audit_logs(db, current_user=current_user, query=query)
