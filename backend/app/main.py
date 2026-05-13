from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.api.dependencies.auth import require_authenticated_user
from app.api.router import api_router
from app.core.audit_middleware import AuditContextMiddleware
from app.core.config import get_settings
from app.core.errors import DomainError, domain_error_handler, validation_error_handler
from app.core.http_observability import HttpObservabilityMiddleware
from app.core.logging_config import configure_logging
from app.core.metrics import render_metrics_text
from app.core.queue import queue_app
from app.core.queue_recovery import recover_pending_jobs
from app.core.request_context import RequestIdMiddleware
from app.db.session import AsyncSessionLocal, get_db
from app.modules.system.services.status import build_system_status
from app.services.bootstrap import ensure_default_data
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()
configure_logging(level=settings.log_level, json_logs=settings.log_json)


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with queue_app.open_async():
        async with AsyncSessionLocal() as db:
            if settings.bootstrap_enabled:
                await ensure_default_data(db)
            await recover_pending_jobs(db)
            await db.commit()
        yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(AuditContextMiddleware)
app.add_middleware(HttpObservabilityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(DomainError, domain_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/status")
async def status(response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    payload = await build_system_status(db, settings=settings)
    if payload["status"] == "down":
        response.status_code = 503
    return payload


@app.get(settings.metrics_path, include_in_schema=False, dependencies=[Depends(require_authenticated_user)])
def metrics() -> PlainTextResponse:
    if not settings.metrics_enabled:
        return PlainTextResponse("", status_code=404)
    return PlainTextResponse(render_metrics_text(), media_type="text/plain; version=0.0.4")
