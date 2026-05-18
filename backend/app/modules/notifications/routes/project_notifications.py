from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.notifications.schemas.settings import (
    NotificationSettingsTestRequest,
    NotificationTestResult,
    ProjectNotificationSettingsCreate,
    ProjectNotificationSettingsRead,
    ProjectNotificationSettingsUpdate,
)
from app.modules.notifications.services import settings

router = APIRouter(prefix="/settings/notifications", tags=["settings"])


@router.get("")
async def get_notification_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    project_id: Annotated[str, Query(...)],
) -> ProjectNotificationSettingsRead:
    return await settings.get_project_notification_settings(
        db,
        project_id=project_id,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_notification_settings(
    payload: ProjectNotificationSettingsCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectNotificationSettingsRead:
    return await settings.create_project_notification_settings(
        db,
        payload=payload,
        current_user=current_user,
    )


@router.put("")
async def update_notification_settings(
    payload: ProjectNotificationSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectNotificationSettingsRead:
    return await settings.update_project_notification_settings(
        db,
        payload=payload,
        current_user=current_user,
    )


@router.post("/test")
async def test_notification_settings(
    payload: NotificationSettingsTestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationTestResult:
    return await settings.test_project_notification_settings(
        db,
        payload=payload,
        current_user=current_user,
    )
