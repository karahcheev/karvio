from fastapi import APIRouter

from app.modules.notifications.routes.project_notifications import router as project_notifications_router
from app.modules.notifications.routes.smtp import router as smtp_router

router = APIRouter()
router.include_router(project_notifications_router)
router.include_router(smtp_router)
