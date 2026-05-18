from fastapi import APIRouter

from app.modules.test_cases.routes.cases import router as cases_router
from app.modules.test_cases.routes.datasets import router as datasets_router
from app.modules.test_cases.routes.suites import router as suites_router

router = APIRouter()
router.include_router(cases_router)
router.include_router(datasets_router)
router.include_router(suites_router)
