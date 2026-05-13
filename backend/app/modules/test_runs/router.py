from fastapi import APIRouter

from app.modules.test_runs.routes.run_cases import router as run_cases_router
from app.modules.test_runs.routes.runs import router as runs_router

router = APIRouter()
router.include_router(runs_router)
router.include_router(run_cases_router)
