from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_authenticated_user
from app.modules.ai.router import router as ai_router
from app.modules.ai.router import settings_router as ai_settings_router
from app.modules.attachments.router import router as attachments_router
from app.modules.audit.router import router as audit_logs_router
from app.modules.environments.router import router as environments_router
from app.modules.auth.router import router as auth_router
from app.modules.notifications.router import router as notification_settings_router
from app.modules.integrations.jira.router import router as jira_integrations_router
from app.modules.milestones.router import router as milestones_router
from app.modules.performance.router import public_router as performance_public_router
from app.modules.performance.router import router as performance_router
from app.modules.products.router import router as products_router
from app.modules.projects.router import router as projects_router
from app.modules.report_import.router import router as report_import_router
from app.modules.reports.router import router as reports_router
from app.modules.system.router import router as version_router
from app.modules.test_cases.router import router as test_cases_router
from app.modules.test_plans.router import router as test_plans_router
from app.modules.test_runs.router import router as test_runs_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(version_router)
api_router.include_router(attachments_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(projects_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(report_import_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(reports_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(products_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(test_cases_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(environments_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(milestones_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(test_runs_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(test_plans_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(performance_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(performance_public_router)
api_router.include_router(audit_logs_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(notification_settings_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(jira_integrations_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(ai_router, dependencies=[Depends(require_authenticated_user)])
api_router.include_router(ai_settings_router, dependencies=[Depends(require_authenticated_user)])
