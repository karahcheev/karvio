from fastapi import APIRouter

from app.modules.projects.routes.members import router as members_router
from app.modules.projects.routes.projects import router as projects_router
from app.modules.projects.routes.users import router as users_router

router = APIRouter()
router.include_router(projects_router)
router.include_router(members_router)
router.include_router(users_router)
