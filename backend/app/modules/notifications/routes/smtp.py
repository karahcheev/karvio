from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.notifications.schemas.settings import (
    NotificationTestResult,
    SmtpEnabledRead,
    SmtpSettingsCreate,
    SmtpSettingsRead,
    SmtpSettingsUpdate,
    SmtpTestRequest,
)
from app.modules.notifications.services import settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/smtp")
async def get_smtp_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SmtpSettingsRead | SmtpEnabledRead:
    return await settings.get_smtp_settings(db, current_user=current_user)


@router.post("/smtp", status_code=status.HTTP_201_CREATED)
async def create_smtp_settings(
    payload: SmtpSettingsCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SmtpSettingsRead:
    return await settings.create_smtp_settings(db, payload=payload, current_user=current_user)


@router.put("/smtp")
async def update_smtp_settings(
    payload: SmtpSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SmtpSettingsRead:
    return await settings.update_smtp_settings(db, payload=payload, current_user=current_user)


@router.post("/smtp/test")
async def test_smtp_settings(
    payload: SmtpTestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationTestResult:
    return await settings.test_smtp_settings(db, payload=payload, current_user=current_user)
