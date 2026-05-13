from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.core.metrics import render_metrics_text
from app.modules.system.schemas.version import VersionRead

router = APIRouter(tags=["system"])


@router.get("/version")
def get_version() -> VersionRead:
    settings = get_settings()
    return VersionRead(version=settings.app_version)


@router.get(
    "/metrics",
    response_class=PlainTextResponse,
    summary="Prometheus metrics",
    description="Exposes all in-process metrics in Prometheus text format. Scrape with your Prometheus instance.",
    include_in_schema=False,
)
def get_metrics() -> str:
    return render_metrics_text()
